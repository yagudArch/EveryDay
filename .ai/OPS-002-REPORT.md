# OPS-002 — staging deployment, secrets, backup/restore, PostgreSQL assessment, dependency audit

## Статус — 2026-09-23 — REVIEW (реализовано и проверено; DONE подтверждает LEAD)

Роль QA/DEVOPS. Область (по TASKS/ARCHITECTURE — «scripts и .github», deployment config): `scripts/**`, `.github/workflows/**`, `deploy/**`, `.gitignore`, `.ai/**`. Прикладной код (apps/**, packages/**, database/**) и контракты НЕ менялись. OPS-001 не трогал (отдельно BLOCKED на native toolchain). AI-001 не запускал.

### Реализовано

1. **Backup SQLite** — `scripts/backup-sqlite.mjs`. Горячий консистентный бэкап через `VACUUM INTO` (единый файл даже при WAL и активных читателях/писателях; не копирует «рваные» -wal/-shm, не останавливает сервер). После создания — `PRAGMA integrity_check`, SHA-256 в sidecar `.sha256`, ротация (`--keep`, по умолчанию 14). Параметры из env `DATABASE_PATH`/`BACKUP_DIR`/`BACKUP_KEEP` или флагов.
2. **Restore SQLite** — `scripts/restore-sqlite.mjs`. Перед перезаписью live БД: сверка SHA-256 с sidecar + `integrity_check` бэкапа; сохранение текущей БД как `*.pre-restore-<ts>` (safety copy). При несовпадении контрольной суммы или провале integrity — ничего не перезаписывается, exit != 0.
3. **Реальный E2E-тест** — `scripts/backup-restore.test.mjs` (node:test). Мигрирует временную БД через compiled backend CLI, вставляет строку, делает backup → wipe → restore, проверяет возврат данных; отдельно проверяет, что подделанный бэкап отклоняется по checksum. Добавлен в CI (`.github/workflows/ci.yml`).
4. **Staging HTTPS** — `deploy/staging-nginx.conf` (reference): TLS-терминация nginx→loopback backend, 80→443 redirect, TLS1.2/1.3, HSTS, `client_max_body_size 64k` (совпадает с backend bodyLimit), проброс `X-Forwarded-For`/`X-Forwarded-Proto`. Backend слушает только loopback, `TRUST_PROXY=true` в staging.
5. **Secret handling** — `deploy/staging.env.example` (только шаблон, без секретов). `.gitignore` расширен: `deploy/*.env`, `deploy/**/*.env`, `backups/` — заполненные секреты и локальные бэкапы не попадут в git. Проверено `git check-ignore`.

### Проверено (реальные запуски)

| Проверка | Результат |
|---|---|
| `npm run check` | PASS — builds contracts/AI/backend + mobile typecheck + **260/260 tests / 27 files**, 0 регрессий |
| backup→wipe→restore round-trip (реальная SQLite после миграций) | PASS — `users`: 1 → 0 (wipe) → 1 `Alice` (restore); backup integrity_check `ok`, sha256 совпал |
| tamper-detection restore | PASS — подделанный бэкап отклонён по checksum, exit 1, live БД не перезаписана |
| `scripts/backup-restore.test.mjs` | PASS — 1/1 (в т.ч. tamper-кейс), включён в CI |
| `git check-ignore deploy/staging.env` | ignored (секрет не коммитится); `deploy/staging.env.example` — НЕ ignored (шаблон сохраняется) |

### Security audit зависимостей

`npm audit`: **12 moderate**, 0 high/critical. Две уникальные advisory-цепочки:
- **GHSA-82fw-gwwq-j7x9** `@vitest/mocker` (Vitest) — dev-only test tooling, не в runtime backend/mobile.
- **GHSA-w5hq-g745-h8pq** `uuid` v3/v5/v6 buffer bounds — тянется транзитивно через `xcode` → `@expo/config-plugins` → Expo CLI/prebuild tooling (dev/build-time).

Проверка runtime-поверхности:
- `npm audit --omit=dev -w @everyday/backend` → **0 vulnerabilities**.
- `npm audit --omit=dev -w @everyday/contracts -w @everyday/ai` → **0 vulnerabilities**.
- `npm audit --omit=dev` (весь проект) → 10 moderate, все в Expo build/config tooling, не в backend runtime.

Вывод: **ни одна advisory не затрагивает серверный runtime backend/contracts/ai** (то, что развёртывается в staging). Затронуты только dev/build-time инструменты Vitest и Expo tooling. `npm audit fix --force` предлагает vitest 5.0.1 и expo 46.0.21 — оба breaking, downgrade несовместим со стеком; НЕ применял. Рекомендация LEAD: обновлять по мере совместимых мажоров Vitest/Expo; на deployment-риск staging не влияет.

### Найденные security / deployment риски

1. **TLS-материал вне репозитория** — корректно; сертификаты/ключи провижнятся на хосте (certbot/внутренний CA). Риск: без HSTS-preload и стабильных сертов раннее включение HSTS может «залочить» домен — включать после стабилизации (отмечено в конфиге).
2. **Rate limiting и auth-токены — per-process, in-memory** (см. env.ts, rate-limiter.ts; auth_tokens в SQLite одного процесса). На одном инстансе безопасно. При >1 инстанса без общего стора лимиты и session/token consistency ломаются → см. PostgreSQL ниже. Это блокер именно multi-instance, не одиночного staging.
3. **SQLite backup — только на том же хосте** пока нет offsite-копии. Скрипт готов, но расписание (cron/systemd timer) и offsite-выгрузка — операционная настройка на хосте, не в репозитории.
4. **`AI_PROVIDER=disabled`** сохранён; реальные ключи инъектируются секрет-стором при AI-001 и остаются server-side (в mobile не попадают — подтверждено apiBase/endpoints).

### Что требуется для multi-instance PostgreSQL (оценка, не реализация)

Текущий стек — `node:sqlite`, один файл, один процесс (ARCHITECTURE §DB). Для горизонтального масштабирования нужно:
1. **Абстракция БД**: сейчас `apps/backend/src/db/connection.ts` синхронный (DatabaseSync, prepare/run/get/all) и предполагает единый файл; PostgreSQL — асинхронный клиент (`pg`) → все repositories/services станут async, транзакции через пул соединений вместо WeakMap-depth savepoints.
2. **Диалект миграций**: `database/migrations/*.sql` использует SQLite-специфику (INTEGER-boolean CHECK, `PRAGMA`, `VACUUM INTO`). Нужен PG-набор миграций (BIGSERIAL/BOOLEAN/TIMESTAMPTZ, `gen_random_uuid`), либо диалект-агностичный слой.
3. **Общий стор для состояния между инстансами**: rate limiter и auth_tokens/sessions должны переехать в PG (или Redis) — иначе лимиты и отзыв сессий не консистентны между репликами.
4. **Backup/restore**: заменить `VACUUM INTO` на `pg_dump`/`pg_basebackup` + PITR (WAL archiving); текущие скрипты SQLite-специфичны.
5. **Data migration**: одноразовый экспорт SQLite → импорт PG с проверкой контрольных сумм и integration suite на PG.
6. **Deploy**: PG как управляемый сервис/контейнер, connection string в секрет-сторе, пул, health-check включает PG-ping.

Это отдельная крупная задача уровня BACKEND+QA (владелец решения — LEAD), НЕ входит в OPS-002 реализацию. Foundation осознанно однопроцессный (ARCHITECTURE §DB, §Готовность).

### Разблокировка AI-001

OPS-002 закрывает свою часть предпосылок AI-001: staging HTTPS-паттерн, server-side secret handling (env template + gitignore), backup/restore. Оставшиеся предпосылки AI-001 (operator-supplied server-side credentials + privacy review) — вне QA/DEVOPS; их предоставляет оператор/LEAD. AI-001 самостоятельно не запускаю.

### Ограничения

- nginx-конфиг и staging.env — reference-артефакты; реальный staging-хост, сертификаты, cron-расписание бэкапов и offsite-выгрузка настраиваются на сервере (нет staging-хоста в этой среде для живого HTTPS-прогона). Живой HTTPS end-to-end на реальном домене не проверялся — проверены конфиг-корректность, скрипты backup/restore на реальной SQLite и gitignore-поведение.
- PostgreSQL — только оценка, миграция не выполнялась (по ARCHITECTURE — отдельная задача).
