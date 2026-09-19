# Активная работа

## BACKEND — FND-002 BLOCKED (код готов к REVIEW; ожидается сдача DOC-001)
- Поручение заказчика: аудит существующего Foundation Backend и исправление подтверждённых дефектов без изменения архитектуры.
- Резервирование: apps/backend/**, database/**; только собственные записи FND-002 в .ai/ACTIVE_WORK.md, .ai/TASKS.md и добавление в .ai/CHANGELOG.md.
- Зависимости: опубликованные contracts и AI читаются без изменений. Проверки: SQLite/migrations, auth/profile/preferences/context/subscription, persistence/isolation, expiry/trial, validation/API contracts, tests/build.
- Git: main → origin/main, исходный HEAD ca21ac3; индекс пуст. Исходные изменения DOC-001 в трёх .ai-файлах принадлежат LEAD; заказчик подтвердил, что LEAD сдаст их самостоятельно. BACKEND не включает эти hunks в свой commit. До их сдачи финальный clean status заблокирован.
- Единственный исполнитель Git-операций FND-002 — BACKEND; перед staging повторно проверить индекс и состояние общей рабочей копии.
- Исправлено: зависающие Fastify preHandler (auth/rate limiter), await/unwrapping AI gateway, backend-типы из существующих schemas, runtime validation AI preview, JSON-only media type, нижняя граница trial. Исправлены два некорректных тестовых сценария (удаление БД до reopen, строка без Content-Type).
- Аудит SQLite: SQL schema, bound queries, FK, WAL, migration checksums/idempotency, rollback и persistence проверены. Схема/миграции и архитектура не менялись. Auth/profile/preferences/context/subscription, ownership, memory opt-in и API/OpenAPI проверены.
- Проверки: `npm run check` PASS — build contracts/AI/backend, mobile typecheck, 201 tests / 23 files. Новые audit tests: профиль и сохранённая сессия после reopen, rollback SQL migration и регистрации, goals/memory isolation, paid-period boundaries; отдельный regression нижней границы trial. Compiled HTTP smoke: GET /api/v1/health → 200, database=ok.
- Независимый code review: PASS, security_concerns/logic_errors пусты; рекомендации низкого приоритета по cleanup тестовых временных файлов и усилению assertions не блокируют review. SHA/push передаются LEAD итоговым сообщением. DONE не выставляется. Native/device и production readiness вне FND-002; node:sqlite остаётся experimental по принятой архитектуре.
- Блокировка сдачи: `git status --short` показывает исходные изменения LEAD в .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md. Ошибки Git-команд пока нет. Требуемое действие LEAD: сдать только свои DOC-001 hunks, согласовав последовательность Git-операций; затем проверить общий clean status. BACKEND сдаёт только собственные hunks FND-002.

## LEAD / ARCHITECT — DOC-001 REVIEW
- Задача заказчика: исправить только MD-документацию и процесс Git/завершения задач; не повторять инициализацию и не менять архитектуру или features.
- Резервирование: MASTER_PROMPT.md, AGENTS.md, agent-roles/*.md, .ai/ACTIVE_WORK.md, .ai/TASKS.md, .ai/PROJECT_STATE.md, .ai/CHANGELOG.md. .ai/ARCHITECTURE.md — только чтение.
- Зависимости: нет; изменения документации выполняет LEAD последовательно, остальные роли не запускаются.
- Исходный Git: main, HEAD ddc735b, origin/main; рабочее дерево и индекс чистые. Git identity задана; перед commit будет проверена повторно.
- Найденный дефект: инструкции завершения не требовали обязательных commit, push и чистого git status; прежние .ai-записи сохранили промежуточные статусы инициализации.
- Обязательные проверки DOC-001: согласованность MD-правил, git diff/--check, только согласованные MD-файлы, отсутствие изменений архитектуры/кода, проверка identity и индекса, успешные commit/push и чистый финальный status. Независимый аудит документации — PASS; git diff --check — PASS, diff содержит только согласованные MD-файлы.
- Дополнительные проектные проверки: `npm run check` — FAIL на сборке backend; `npm test` — тесты backend падают по тайм-аутам, весь запуск остановлен по лимиту времени без итогового успешного результата; `npm run typecheck -w @everyday/mobile` — PASS. Сборки contracts и AI в составе check прошли.
- Граница приёмки: DOC-001 — исправление документации, не приёмка приложения. Ошибки существующего неизменённого кода ниже переданы заказчику; они не исправляются и не выдаются за успешные проверки. Готовность Foundation/native/production этой задачей не подтверждается.
- Commit/push: ещё не выполнены; задача не завершена.
- Git-блокировки: не выявлены. При сбое Git задача остаётся BLOCKED, причина и требуемое действие передаются заказчику.

### Передано заказчику: ошибки проектных проверок вне DOC-001
- Команда `npm run check`: backend TypeScript — TS2322 в `apps/backend/src/app.ts:129` (`AiGateway | Promise<AiGatewayLoad>` несовместим с `AiGateway`); TS2305 — отсутствуют экспорты `UpdateProfileInput`, `Goal`, `MemoryFact` из `@everyday/contracts` в account-service/dto.
- Команда `npm test`: backend-тесты завершаются по timeout; полный запуск прерван лимитом времени. Корневая причина в рамках MD-задачи не диагностировалась.
- Затронутый код не изменён относительно исходного ddc735b. Нельзя объявлять сборку/test suite успешными или Foundation готовым.
- Требуемое действие: LEAD/заказчику отдельно согласовать исправление и повторные проверки с BACKEND и QA/DEVOPS; новые feature-задачи здесь не запускаются.

## Обязательный учёт Git-блокировок
- Порядок для каждой задачи: `git status → работа → тесты/build → git diff → git add → git commit → git push → git status` (подробности — AGENTS.md, разделы 9 и 14).
- Commit и push обязательны; commit без push, непроверенная отправка или нечистое дерево после push не являются завершением.
- При невозможности commit/push либо получения чистого статуса сохранить здесь блок своей задачи: TASK ID, роль, статус BLOCKED, ветка/remote, затронутые файлы, результаты тестов/build, команда и ошибка без секретов, SHA созданного commit (если есть), результат push, текущий git status, требуемое действие и адресат эскалации.
- Исполнитель немедленно сообщает LEAD; если исполнитель LEAD — заказчику. Запись в файле не заменяет сообщение. Если commit невозможен, блокировка остаётся локальной и явно передаётся адресату; удалять или скрывать её ради чистого дерева запрещено.
- После устранения причины повторить незавершённые шаги и проверки. Любое обновление .ai, включая запись о закрытии, тоже требует проверки diff, адресного git add, commit, push и чистого git status. DONE подтверждает только LEAD по фактическим результатам Git.

## Архив оперативных записей первичной инициализации
Следующие записи сохранены для истории, а не как текущие назначения. Инициализация уже зафиксирована в ddc735b; повторно её не запускать. Готовность последующих feature/native-задач в рамках DOC-001 не переоценивается.

### LEAD / ARCHITECT — FND-001 DONE / FND-005 IN_PROGRESS (запись до финализации)
- Область: корневые конфигурации, packages/contracts/**, .ai/**, интеграция.
- Прочитаны все 12 исходных MD-файлов, включая MASTER_PROMPT целиком.
- Git: main, исходный commit e84bc4e, начальное дерево чистое.
- Контракты опубликованы. BACKEND и AI передали реализацию на интеграцию; MOBILE исправляет API URL/порт и проверяет typecheck.
- npm install выполнен успешно после ограничения сетевого параллелизма; LEAD запускает сборку и тесты.
- Общие конфигурации, lockfile и .ai редактирует только LEAD. Отчёты исполнителей LEAD переносит сюда последовательно, без конфликтов.

## Резервирование после FND-001
- BACKEND / FND-002: apps/backend/** и database/**.
- MOBILE / FND-003: apps/mobile/**.
- AI ENGINEER / FND-004: packages/ai/**.
- QA/DEVOPS / FND-005: scripts/**, .github/** по согласованию с LEAD; FND-006 — независимая проверка.

## Ограничения окружения
- Windows, Node 22.23.2, npm 10.9.8, Python 3.12.2, Git 2.44.0.
- Flutter/Dart, Android SDK/adb, Gradle, Docker, psql не найдены в PATH. Java доступна.
- Нативную iOS сборку на Windows не заявлять. AI ключей в репозитории нет.
- npm metadata периодически ECONNRESET; используем подтверждённые версии и lockfile, без отключения TLS.
