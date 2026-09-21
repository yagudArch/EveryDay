# История изменений

## 2026-09-17 — LEAD / ARCHITECT — DOC-001
- Исправлены правила Git и завершения задач в AGENTS.md, MASTER_PROMPT.md и инструкциях всех ролей, без изменения архитектуры и кода приложения.
- Обязательная последовательность: `git status → работа → тесты/build → git diff → git add → git commit → git push → git status`.
- Commit и push обязательны; commit без push не завершает задачу. После push требуется чистое дерево и подтверждение отправки commits задачи.
- Добавлены проверка Git identity перед commit, адресный staging и проверка staged diff; запрещено включать случайные, временные и чужие изменения.
- Невозможность commit/push или чистого финального статуса означает BLOCKED с диагностикой в .ai/ACTIVE_WORK.md и эскалацией LEAD/заказчику.
- Синхронизированы правила REVIEW/DONE и сдачи последующих .ai-обновлений; первичная инициализация не повторяется. Статус выполнения DOC-001 отражается в .ai/ACTIVE_WORK.md и .ai/TASKS.md.

## 2026-09-19 — BACKEND — FND-002
- Аудит существующего Foundation Backend: SQLite/migrations, auth/profile/preferences/context/subscription, persistence/isolation, expiry/trial, validation и contracts.
- Исправлены Fastify hooks, инициализация AI gateway, backend type imports, проверка AI preview, JSON media type и начало trial. Архитектура, contracts и SQL schema не изменены.
- Исправлены ошибочные fixtures persistence/JSON; добавлены проверки rollback, profile/session persistence, goals/memory isolation, trial start и paid-period expiry.
- npm run check: PASS, 201 tests / 23 files, builds и mobile typecheck; compiled HTTP health smoke: 200/database ok. Сдача BLOCKED до commit/push и чистого общего дерева, включая отдельную сдачу DOC-001 владельцем LEAD; DONE не выставлен.

## 2026-09-19 — MOBILE — FND-003
- Продолжена существующая Expo/React Native foundation без изменения стека, Backend и contracts; новые feature-задачи не запускались.
- Исправлены timeout чтения HTTP body, сброс сессии при публичном/устаревшем 401, приём успешных ответов старой сессии и активация bearer до успешной записи хранилища.
- Добавлены регрессии и mobile API integration через настоящий HTTP/SQLite: register/profile/preferences/context/logout/login.
- Проверки: npm run check PASS (208 tests / 24 files, builds, mobile typecheck); Metro export Android/iOS/web PASS. Native/device E2E остаётся OPS-001; отсутствие microphone capture/permission вызовов проверено по коду.
- Финальный clean status блокируют исходные DOC-001 hunks LEAD; требуется их отдельная сдача владельцем. Статус FND-003 и Git-факты — ACTIVE_WORK и итоговый отчёт LEAD.

## 2026-09-19 — AI ENGINEER — FND-004
- Проведён аудит существующего AI Foundation: provider port, capability/consent, structured output, validation/errors, unavailable, contracts и отсутствие DB writes.
- Исправлены timeout/cancellation независимо от поведения провайдера, pre-abort, числовые лимиты, malformed/thrown status, result envelope и проверка исходного output до JSON-сериализации.
- Добавлены регрессии; npm run check PASS: 226 tests / 24 files (74 AI tests), builds и mobile typecheck. Независимый review PASS; рекомендованный schema-valid byte-limit test добавлен и проверен.
- AI-001, voice, memory и feature-specific AI не запускались. Git-сдача BLOCKED по clean status из-за исходных DOC-001 hunks LEAD; нужны их отдельная сдача владельцем и повторная проверка. DONE не выставлен.

## 2026-09-19 — QA / DEVOPS — FND-005
- Проверены обязательные инструкции, статусы зависимостей, история Git и удалённая main: commits FND-002/FND-003/FND-004 доступны, но задачи остаются BLOCKED до сдачи DOC-001 и подтверждения LEAD.
- FND-005 переведена в BLOCKED; Foundation gate не запускался согласно прямому условию заказчика. Отчёт LEAD сохранён в .ai/FND-005-REPORT.md.
- Изменены только собственные записи QA в документации; исходные DOC-001 hunks LEAD сохраняются отдельно. Готовность Foundation/native/production не подтверждена.

## 2026-09-19 — LEAD / ARCHITECT — DOC-001, финальная сдача
- Проведён аудит трёх исходных незакоммиченных .ai-файлов; синхронизированы текущий снимок и статусы с результатами Backend, Mobile, AI и QA. Исторические отчёты сохранены.
- После fetch и live remote lookup подтверждено присутствие implementation commits 92f642f / 754d081 / 251b4fd в origin/main; отчёт QA опубликован в 33610f1.
- FND-002/FND-003/FND-004 переданы на финальное подтверждение LEAD после Git-сдачи DOC-001. Следующий шаг — открыть FND-005 для QA/DEVOPS; независимый Foundation gate ещё не выполнялся.
- Код, contracts, архитектура и назначения feature-задач не изменены. Подтверждённые статусы закрытия сдаются отдельным commit/push после проверки чистоты по AGENTS.md §14.
- Проверка LEAD: npm run check PASS — сборки contracts/AI/backend, mobile typecheck, 226 tests / 24 files; это не независимый Foundation gate QA.

## 2026-09-19 — LEAD / ARCHITECT — подтверждение закрытия DOC-001
- Commit 91beb56dd08b3de9c3dd908f3b50c7ddbfbba184 (`docs: complete DOC-001 and unblock foundation gate`) отправлен в origin/main; live remote SHA совпал, git status clean, полный porcelain пустой.
- На основании опубликованных implementation commits, результатов проверок и устранения единственной Git-блокировки LEAD подтвердил DOC-001 и FND-002/FND-003/FND-004 DONE; FND-001 остаётся DONE.
- FND-005 переведена в TODO: QA/DEVOPS доступны повторный preflight и Foundation gate. Gate не выполнялся и не объявлен пройденным. Эта запись закрытия проходит отдельную Git-сдачу по AGENTS.md §14.

## 2026-09-19 — QA / DEVOPS — FND-005 Foundation gate
- Независимо выполнены check (226 tests / 24 files), builds/typecheck, Metro Android/iOS/web, migration CLI apply/idempotency и HTTP/SQLite проверки.
- Выявлены блокеры воспроизводимости: npm ci EUSAGE (несогласованный lockfile), Expo compatibility check FAIL. Переданы LEAD/MOBILE без изменения чужих manifests/lockfile.
- Исправлен вызов отсутствующего npm run smoke в CI: добавлен scripts/foundation-smoke.mjs и прямой запуск в workflow; 2 сквозных теста Mobile/Backend/AI PASS, независимый review PASS.
- FND-005 BLOCKED, Foundation/native/production readiness не объявляется. Детальные команды, владельцы и ограничения — FND-005-REPORT.md.

## 2026-09-19 — LEAD / MOBILE — FND-005 dependency repair
- Воспроизведены npm ci EUSAGE и четыре Expo mismatch; согласованы Expo 57.0.24, @expo/metro-runtime 57.0.16, safe-area 5.7.0, screens 4.26.2 при неизменных React 19.2.3/RN 0.86.3.
- Обновлён mobile manifest, lockfile восстановлен npm и dedupe с устранением native-дубликатов; логика приложения и QA smoke/workflow не менялись.
- Обычный npm ci в отдельной чистой копии без node_modules PASS (610 packages), Expo check PASS; check 226 tests / 24 files, smoke 2/2 и Metro Android/iOS/web PASS. Сеть давала ECONNRESET при подготовке cache; финальный npm ci прошёл. Audit: 12 moderate, передано QA без автоматического audit fix.
- Отдельно учтены P2 stale context после timezone change и GET/PATCH race в MOB-001. FND-005 остаётся BLOCKED до повторного полного QA gate/CI; исправление передано на REVIEW.

## 2026-09-19 — QA / DEVOPS — повторный FND-005 на cd55dcd
- По подтверждённой передаче от остановленного QA выполнен независимый Foundation gate в новой Git-копии с чистым npm ci; FND-006 и feature-задачи не запускались.
- PASS: builds contracts/AI/backend, mobile typecheck, Expo compatibility, Metro Android/iOS/web, smoke 2/2, migration CLI apply/skip. Auth/session, isolation/persistence, trial, contracts и AI регрессии проверены собственными запусками.
- Подтверждён remote CI run 35465046166: Ubuntu/Windows и все обязательные шаги success. Прежние npm ci/Expo/remote CI блокировки сняты.
- Новый BLOCKER: тест migrations.test.ts:34 привязан к имени каталога EveryDay. Check в независимой копии — 225/226, исходный каталог — 226/226; точечное воспроизведение FAIL. Передано BACKEND/LEAD, код владельца не менялся. FND-005 остаётся BLOCKED.
- Audit: 12 moderate (Vitest mocker, uuid через Expo tooling), omit=dev 10; опасный force downgrade не применялся. Подробный актуальный отчёт добавлен перед историей FND-005-REPORT.md; Git-сдача только документации.

## 2026-09-19 — BACKEND — FND-005 portability repair
- Устранена зависимость migration path test от имени папки EveryDay: проверяется точный корень относительно файла теста, сохранена проверка defaultMigrationsDir, добавлено наличие migration SQL. Production code, SQL и архитектура не менялись.
- Регрессия воспроизведена до исправления в независимой копии migration-portability-regression после обычного npm ci. После исправления npm run check PASS в исходном и переименованном каталогах: по 226 tests / 24 files, все builds/typecheck.
- Исправление передаётся на REVIEW; FND-005 не закрыта. QA должен повторить Foundation Gate после push.

## 2026-09-20 — QA / DEVOPS — FND-005 финальный Foundation gate DONE
- Повторный независимый gate на origin/main 4297502 после portability-фикса BACKEND. Проверки в чистой копии с ДРУГИМ именем каталога: обычный npm ci (610 packages), npm run check 226/226 PASS, builds contracts/AI/backend, mobile typecheck.
- PASS: smoke HTTP/Mobile/Backend/AI/SQLite 2/2, migration CLI apply/skip, Expo compatibility check, Metro Android/iOS/web export. Прежний basename-blocker migrations.test.ts не воспроизводится.
- Remote CI run 35466855284 подтверждён через GitHub API: foundation ubuntu-latest и windows-latest — success, упавших шагов нет.
- Все обязательные Foundation Gate пройдены. FND-005 закрыта в DONE. Не-блокирующие пункты переданы владельцам: npm audit 12 moderate (LEAD), P2 MOBILE risks (MOB-001), native/live AI (отдельные gates). FND-006 и feature-задачи не запускались.

## 2026-09-20 — QA / DEVOPS — FND-006 независимый аудит Foundation DONE
- Независимый аудит origin/main 6c8fd84 (прикладной код Foundation неизменён с 4297502, FND-005 PASS). Чтение auth/account/ai routes, services, db connection/migrate/repositories, errors/validation/env, contracts, mobile client/endpoints/storage.
- Критичных дефектов, архитектурных нарушений, проблем безопасности, разрывов интеграции Backend/Mobile/AI и fake production data не обнаружено. SQL через bound-параметры; scrypt+соль+timingSafeEqual; opaque sessions (SHA-256); identity из principal; contract-schemas на обеих сторонах; AI disabled→503, preview-only без DB writes; consent/микрофон по правилам.
- Не-блокирующее передано владельцам: npm audit 12 moderate (LEAD/OPS-002), P2 MOBILE race/timezone (MOB-001), backend hardening (BCK-001), косметика HomeScreen wardrobe wording (MOBILE).
- Native readiness — отдельный вердикт: НЕ готов (APK/IPA, device SecureStore/cold-launch, live AI), это не блокер Foundation по ARCHITECTURE; вынесено в OPS-001/OPS-002/AI-001.
- Реальных оставшихся блокеров Foundation нет. FND-006 DONE, Foundation закрыт. Проект передаётся LEAD для продуктового цикла (этап 2 — питание). Следующие задачи QA не начинает. Отчёт FND-006-REPORT.md.

## 2026-09-20 — QA / DEVOPS — OPS-001 BLOCKED (нет native toolchain)
- Проверено окружение хоста: Windows/MINGW64 (не macOS), Temurin JDK 25 (Android Gradle требует 17), ANDROID_HOME/ANDROID_SDK_ROOT пусты, adb/sdkmanager/gradle отсутствуют, eas.json и native android/ios dirs отсутствуют.
- Обязательные критерии OPS-001 (Android debug APK, iOS simulator build, device cold-launch без микрофона, login/logout device-persistence E2E) не выполнимы в этой среде и не фабрикуются; iOS на Windows принципиально невозможен. По AGENTS.md §9/§14 недоступность обязательной проверки = блокировка.
- Косвенное Node-покрытие (mobile API integration, foundation-smoke) уже зелёное в FND-005/006, но device SecureStore/cold-launch не заменяет. Статически микрофон не активируется (FND-006).
- OPS-001 BLOCKED; MOB-001 остаётся BLOCKED; OPS-002 не начата (одна роль). Требуется CI-runner (ubuntu Android SDK+JDK17, macos Xcode) или окружение с SDK/устройством — адресат LEAD/заказчик. Отчёт .ai/OPS-001-REPORT.md. Отмечен мусорный файл в корне `tatus --short` (владелец LEAD).

## 2026-09-20 — LEAD / ARCHITECT — Цикл 1: переход к продукту и nutrition-контракт
- Foundation закрыт (FND-001…006 DONE, origin/main b5b29b5). Начат первый продуктовый цикл; Foundation-аудиты и полный regression не повторяются.
- Опубликован nutrition-контракт в packages/contracts/src/index.ts: NutritionGoal/UpdateNutritionGoal/Meal/CreateMeal/UpdateMeal/MealList/NutritionSummary, routes nutrition/goals|meals|summary + nutritionMealById, регистрация в endpoints. Макросы finite/non-negative, округление до 0.1, локальный день по timezone профиля. Contracts — зона LEAD по ARCHITECTURE.md; прикладной код модулей LEAD не писал.
- Проверено LEAD: npm run build (contracts/AI/backend) PASS; openapi.test 4/4 и apiBase.test 19/19 PASS. Полный regression намеренно не переигрывался.
- Запущены параллельно без конфликта владения: NUT-001 (BACKEND — питание: миграция 0002, сервис+роуты, integration tests) и OPS-001 (QA/DEVOPS — native runner/APK/iOS/E2E). Готовы, но отложены во избежание конфликта одной роли/файлов: OPS-002 (после OPS-001), BCK-001 (после NUT-001, общий database/migrations/**). BLOCKED: MOB-001 (←OPS-001), AI-001 (←OPS-002 + credentials/privacy), BCK-002 (←BCK-001).
- Синхронизированы .ai/TASKS.md, .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md: статусы, владельцы, выполненные зависимости и «что брать следующим».

## 2026-09-20 — LEAD / ARCHITECT — Цикл 1: NUT-001 DONE, разблокировка BCK-001
- NUT-001 (BACKEND) переведена в DONE. Implementation 8467216 в origin/main (nutrition goals/meals/daily summary, миграция 0002). Подтверждено: npm run check 233/233 PASS, builds contracts/AI/backend + mobile typecheck PASS, working tree clean, HEAD==origin/main 9d9e1e0. Foundation-аудиты не повторялись.
- BCK-001 (BACKEND) РАЗБЛОКИРОВАНА: зависимость NUT-001 выполнена, миграция 0002 опубликована → следующая 0003; конфликт владения database/migrations/** снят. Статус TODO (ready), готова к запуску.
- OPS-001 (QA/DEVOPS) остаётся BLOCKED: локальный хост без native toolchain (нет Android SDK/adb/gradle, JDK 25 вместо 17, нет macOS/Xcode). Определён путь решения через GitHub Actions native runners: workflow native-build.yml (android=ubuntu-latest JDK17+setup-android+expo prebuild+Gradle assembleDebug+APK artifact; ios=macos-latest Xcode+expo prebuild+xcodebuild simulator; cold-launch/SecureStore E2E на android-emulator-runner или устройстве). DONE только после зелёного native-прогона с artifacts; Metro export ≠ APK/IPA по ARCHITECTURE.
- MOB-001, AI-001, NUT-002 НЕ запускаются: зависимости не выполнены (MOB-001←OPS-001; AI-001←OPS-002+credentials/privacy; NUT-002←NUT-001✓+MOB-001).
- Синхронизированы .ai/TASKS.md, .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md.

## 2026-09-20 — BACKEND — NUT-001 nutrition vertical slice REVIEW
- Добавлена миграция 0002_nutrition.sql: таблицы meals и nutrition_goals, обе с user_id FK ON DELETE CASCADE, конвенции 0001 (TEXT uuid, ISO TEXT timestamps, REAL макросы с non-negative CHECK, WAL/PRAGMA через runner, checksum-версионирование). Ничего не сидируется.
- Реализован сервис+роуты питания по опубликованному LEAD контракту: GET/PUT /api/v1/nutrition/goals, GET/POST /api/v1/nutrition/meals, GET /api/v1/nutrition/summary. Использованы routes.* и экспортированные Zod-схемы contracts без редекларации; packages/contracts не менялся.
- Владелец всегда из session principal (клиентский userId невозможен, strict DTO его отвергает). local_date считается сервером по timezone профиля через существующий localDateFor. Макросы/калории округляются до 0.1. ?date=YYYY-MM-DD валидируется, дефолт — локальное «сегодня». summary: consumed за день, remaining=goal−consumed (null без цели), mealCount.
- Идемпотентность POST meal: существующего HTTP-механизма в кодовой базе нет; согласно ТЗ фиктивный не вводился (кандидат для LEAD/BCK-002).
- Интеграционные тесты (реальный HTTP + file SQLite): полный срез goal→meals→list→summary, remaining=null без цели, изоляция пользователей A/B, граница локального дня по timezone, отклонение unknown/invalid полей и клиентского userId, требование авторизации, upsert цели (одна строка на пользователя). Обновлены собственные backend migrations.test.ts под новую миграцию.
- npm run check PASS: сборки contracts/AI/backend, mobile typecheck, vitest 233 tests / 25 files (226 baseline + 7 новых nutrition тестов), 0 регрессий. Сдача Git по AGENTS.md §9/§14; DONE подтверждает LEAD.

## 2026-09-21 — BACKEND — BCK-001 auth hardening REVIEW
- Миграция 0003_auth_hardening.sql: в users добавлены email_verified (INTEGER NOT NULL DEFAULT 0, CHECK 0|1) и email_verified_at (TEXT). Новая таблица auth_tokens (id, user_id FK users ON DELETE CASCADE, purpose CHECK email_verify|password_reset, token_hash UNIQUE, created_at, expires_at, consumed_at) + индексы (user_id,purpose) и (expires_at). Хранится только SHA-256 hash токена, как для сессий; ничего не сидируется. Конвенции 0001/0002 соблюдены.
- Реализованы endpoints по опубликованному LEAD контракту 6a02032 (packages/contracts НЕ менялся): POST /api/v1/auth/email/verify/request (auth, 202), /email/verify/confirm (public, 200), /password/reset/request (public, 202), /password/reset/confirm (public, 204), /sessions/revoke-all (auth, 200).
- Email verification: request выдаёт свежий opaque токен (инвалидируя прежние unconsumed), уже верифицированный аккаунт — no-op без выдачи токена; confirm single-use и atomic, невалидный/просроченный → 400 invalid_token. Password reset: request всегда 202 accepted и не раскрывает существование аккаунта (no user enumeration); confirm потребляет токен, заменяет scrypt-hash и отзывает ВСЕ сессии пользователя. Revoke-all отзывает все активные сессии текущего пользователя (включая вызывающую) и возвращает revokedCount; изоляция по пользователю.
- Opaque токены (32 байта base64url) доставляются через инъектируемый TokenDelivery seam; default noop-sink НЕ логирует токен, плейнтекст никогда не пересекает HTTP-границу и не эхонится API. Strict credential rate-limit применён к новым sensitive endpoints поверх глобального лимита.
- Тесты: новый apps/backend/tests/auth-hardening.test.ts (14 тестов: verify happy/expired/replay/no-op/re-issue, reset no-enumeration/revoke-all/old-password/expired/replay, revoke-all count/isolation/auth, storage integrity — только hash + consumed_at, rate-limit на sensitive endpoint). helpers.ts: capturing TokenDelivery double. migrations.test.ts: счётчик миграций 0002→0003, добавлена таблица auth_tokens. auth-service.register() инициализирует emailVerified=false.
- Проверка: npm run check PASS — builds contracts/AI/backend + mobile typecheck + vitest 247 tests / 26 files (было 233; +14, 0 регрессий). Git-сдача по AGENTS.md §9/§14; DONE подтверждает LEAD.

## 2026-09-21 — LEAD / ARCHITECT — приёмка BCK-001, разблокировка BCK-002
- BCK-001 (BACKEND) принята и переведена в DONE. Implementation 6742ae2 в origin/main (auth hardening: email verify, password reset, revoke-all; миграция 0003). Подтверждено: контракт не менялся (`git diff 6a02032..6742ae2 -- packages/contracts` пусто), миграция 0003_auth_hardening.sql присутствует, npm run check PASS 247 tests / 26 files, working tree clean, HEAD==origin/main 6742ae2. Foundation-аудит не повторялся; backend-код LEAD не менял.
- BCK-002 (BACKEND) РАЗБЛОКИРОВАНА: зависимость BCK-001 выполнена (миграция 0003 → следующая 0004). Статус TODO (ready), готова к запуску; LEAD её не стартует.
- OPS-001 (QA/DEVOPS) остаётся BLOCKED (нет native toolchain; путь через GitHub Actions native runners). Прочие зависимости без изменений: MOB-001 ← OPS-001; AI-001 ← OPS-002 + credentials/privacy; NUT-002 ← NUT-001 ✓ + MOB-001; NUT-003 ← NUT-001 ✓ + AI-001.
- Синхронизированы .ai/TASKS.md, .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md.

## 2026-09-21 — BACKEND — BCK-002 BLOCKED (нет контрактов)
- Перед реализацией проверены packages/contracts/src/index.ts. Для основных deliverable BCK-002 контрактов НЕТ: memory CRUD (list/create/delete + delete-all), экспорт аккаунта, удаление аккаунта — отсутствуют routes, Zod-схемы и записи в `endpoints`. Присутствует только `MemoryFactSchema` (форма факта внутри TodayContext) и флаги `memoryEnabled`/`aiConsent` в `PreferencesSchema` (disable-memory и consent переключаются существующим `PATCH /preferences`).
- По AGENTS.md §4/§10 `packages/contracts` — критичный общий файл LEAD; правило задачи запрещает придумывать API и менять contracts самостоятельно. Реализация не начата, код/миграции/тесты и contracts не тронуты.
- BCK-002 переведена в BLOCKED; эскалировано LEAD — требуется публикация контрактов memory CRUD / delete-all / account export / account delete (+ решение по disable-memory/consent). Диагностика в .ai/ACTIVE_WORK.md. Git-сдача этой записи по AGENTS.md §9/§14.
