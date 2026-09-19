# Активная работа

## BACKEND — FND-005 portability repair REVIEW
- Прямое поручение заказчика: исправить только зависимость migration path test от имени каталога checkout; FND-005 не закрывать, после push передать повторный Foundation Gate QA.
- Резервирование: apps/backend/tests/migrations.test.ts, собственный блок ACTIVE_WORK, append CHANGELOG. Runtime paths.ts, SQL migrations, архитектура, TASKS и отчёт QA не меняются.
- Исходный Git: main → origin/main, HEAD c4590e8, дерево/индекс чистые. Git-сдачу этого исправления выполняет BACKEND последовательно.
- Проверки: воспроизведение исходного FAIL в переименованной копии, затем полный npm run check в исходном checkout и независимой копии с другим именем, diff/identity, commit/push/clean status.
- Воспроизведён исходный FAIL: vitest migrations.test.ts -t 'resolves stable repository paths' в C:/Users/Admin2/AppData/Local/Temp/migration-portability-regression (1 failed / 7 skipped). Копия создана git clone --no-hardlinks, обычный npm ci PASS (610 packages); прежние 12 moderate audit findings не исправлялись в этой узкой задаче.
- Изменён только тест путей: точный projectRoot относительно import.meta.url файла теста вместо endsWith('EveryDay'); проверка defaultMigrationsDir сохранена, добавлена проверка наличия 0001_foundation.sql как файла. Runtime и SQL не менялись; исключений для QA нет.
- npm run check PASS в C:/Users/Admin2/Desktop/EveryDay и C:/Users/Admin2/AppData/Local/Temp/migration-portability-regression: в каждом 226 tests / 24 files, builds contracts/AI/backend и mobile typecheck. Исправленный файл одинаков в обеих копиях (git diff применён без дополнительных изменений).
- Передача LEAD/QA: после опубликованного исправления повторить Foundation Gate. FND-005 остаётся BLOCKED до решения QA/LEAD; этот REVIEW относится только к portability repair. Фактические commit SHA/push/clean status передаются итоговым сообщением после Git-сдачи.

## QA / DEVOPS — FND-005 BLOCKED; повторный Foundation gate
- Заказчик подтвердил передачу FND-005 и Git-сдачи этому чату; другой QA остановлен. Его исходная незакоммиченная запись о FND-006 заменена этой согласованной передачей. FND-006 и feature-задачи здесь не выполняются.
- Область сдачи: .ai/FND-005-REPORT.md, собственный блок ACTIVE_WORK, строка FND-005 TASKS, append CHANGELOG. Код/архитектура не изменены. PROJECT_STATE остаётся LEAD: актуальный результат для синхронизации — этот блок и отчёт.
- Проверен cd55dcdf5375b0839c9ce2008380da6341ad21bb, main → origin/main; live remote совпал, ancestry реализаций подтверждено, индекс исходно пуст. Единственный исполнитель Git-сдачи — текущий QA.
- Чистая независимая копия C:/Users/Admin2/AppData/Local/Temp/everyday-fnd005-gate-current: npm ci PASS (610 packages), build contracts/AI/backend PASS, mobile typecheck PASS, Expo check PASS, Metro Android/iOS/web PASS; smoke HTTP/Mobile/compiled Backend/AI/SQLite 2/2 PASS; migration CLI applied 0001, повтор skipped 0001.
- BLOCKER: npm run check в независимой копии exit 1, 225/226 tests PASS. apps/backend/tests/migrations.test.ts:34 требует projectRoot.endsWith('EveryDay'); отдельный vitest -t 'resolves stable repository paths' подтверждает FAIL. В исходном каталоге EveryDay check PASS 226/226. Это дефект переносимости теста, не отказ миграций. BACKEND/LEAD: заменить зависимость от имени checkout проверкой структуры/реальных путей; затем повторить gate в произвольно названной чистой копии. Чужой backend test не исправлялся QA без назначения.
- CI cd55dcd подтверждён через GitHub API: run 35465046166, ubuntu-latest и windows-latest success, каждый обязательный шаг success. Предыдущие lockfile/Expo/remote-CI блокеры сняты; зелёный CI не отменяет найденный локальный FAIL.
- npm audit exit 1: 12 moderate (2 advisory chains: Vitest mocker и uuid/xcode/Expo); omit=dev — 10 moderate. Передано LEAD для отдельного dependency/security решения; force-fix предлагает несовместимые версии, не применялся. Native/device/live AI вне подтверждённого Foundation PASS. P2 MOBILE risks из MOB-001 сохраняются, UI reproduction не заявляется.
- Git-сдача отчёта: diff/identity → адресный add → commit → push origin/main → live remote и clean status. Фактический SHA/push/status передаются итоговым сообщением; FND-005 остаётся BLOCKED независимо от успешной сдачи документации.

## LEAD / MOBILE — FND-005 dependency repair REVIEW; повторный gate QA
- Прямое поручение заказчика: согласовать Expo/RN и восстановить воспроизводимый npm ci. Исходный HEAD 9bf86b4, main → origin/main, дерево/индекс чистые.
- Резервирование: apps/mobile/package.json, package-lock.json, .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md, append .ai/CHANGELOG.md. LEAD выполняет изменения и Git-операции последовательно; код приложения, QA smoke/workflow и отчёт QA сохраняются.
- Воспроизведено: npm ci --dry-run — EUSAGE, lockfile содержит старые safe-area/screens; Expo check — четыре mismatch. Решение LEAD: Expo ~57.0.24, @expo/metro-runtime ~57.0.16, safe-area ~5.7.0, screens ~4.26.0; React 19.2.3 / RN 0.86.3 сохраняются. Lockfile генерируется npm, без legacy-peer-deps/force.
- Проверено: обычный npm ci в отдельной копии HEAD + исправленные manifests/lockfile без node_modules — PASS (610 packages); Expo check PASS. Общий check PASS (226 tests / 24 files), QA smoke 2/2 PASS, Metro Android/iOS/web PASS. npm ls подтверждает единственные safe-area 5.7.0 / screens 4.26.2, включая navigation peers.
- Lockfile восстановлен npm install --package-lock-only и npm dedupe --package-lock-only; dedupe также согласовал transitive parser/bplist зависимости и обновил fast-uri/lru-cache. Сетевой ECONNRESET обойдён загрузкой официального fast-uri tarball через curl в npm cache; integrity проверяет npm. Финальный обычный npm ci прошёл без обходных флагов. npm audit при установке: 12 moderate, передано QA; автоматический audit fix не выполнялся.
- Передача QA/DEVOPS: повторить полный Foundation gate и CI matrix на опубликованном commit. FND-005 остаётся BLOCKED до независимого успешного повторного gate; локальные проверки LEAD не являются его закрытием. Git-сдача исправления: проверка diff/identity, commit/push origin/main и clean status; SHA передаётся итоговым отчётом.
- Отдельные P2 Mobile риски (статический QA-аудит, runtime reproduction ещё нет): stale TodayContext после смены timezone; запоздалый GET перезаписывает результат PATCH, поскольку setData не инвалидирует pending request. Владелец MOBILE, учёт в MOB-001; в dependency repair логика не меняется.

## История: QA / DEVOPS — FND-005 BLOCKED (первый Foundation gate FAIL)
- Зависимости DONE; live origin/main 31a79b8 и ancestry реализаций проверены; исходное дерево и индекс чистые.
- Резервирование: scripts/**, .github/**, собственный блок ACTIVE_WORK, строка FND-005 TASKS, append CHANGELOG, FND-005-REPORT.md. QA выполняет Git-операции последовательно. Код модулей и архитектура только читаются.
- Проверки: npm ci, общий check, Metro export, migrations/HTTP, сквозная Mobile/Backend/AI интеграция, contracts, CI, отсутствие fake production data. Результаты фиксируются по собственным запускам.
- Фактически PASS: npm run check (226 tests / 24 files, builds contracts/AI/backend, mobile typecheck); Metro Android/iOS/web; migration CLI apply/skip; 2 сквозных smoke tests реального mobile HTTP client + compiled backend + AIService + SQLite, включая restart/isolation/consent/preview-only.
- Блокеры LEAD/MOBILE: npm ci exit 1 EUSAGE — missing react-native-safe-area-context@5.7.0 и react-native-screens@4.26.2 в lockfile; expo install --check exit 1 — установленные версии не соответствуют ожидаемым. Lockfile/root manifests принадлежат LEAD, QA не изменяет их самостоятельно.
- Исправлено QA: workflow вызывал отсутствующий npm run smoke (exit 1). Добавлен scripts/foundation-smoke.mjs, workflow вызывает node --import tsx --test scripts/foundation-smoke.mjs; 2/2 PASS, независимый review PASS, assertions усилены и проверены повторно.
- Remote CI не подтверждён: gh auth status exit 127 (gh отсутствует), unauthenticated GitHub Actions API HTTP 404. Нет Android SDK/adb в PATH, ANDROID_HOME не задан, iOS требует macOS/Xcode; live AI/native/production readiness не заявляются.
- Адресат LEAD: согласовать исправление manifests/lockfile с MOBILE и повторить чистый npm ci, Expo check и CI matrix. До устранения блокеров FND-005 не DONE. Собственные результаты подлежат commit/push; SHA и финальный status передаются итоговым сообщением.
- Статический аудит MOBILE: useAsyncResource.setData не инвалидирует pending GET; Home не перезагружает TodayContext при смене timezone. P2, UI reproduction не выполнялся; код и точные сценарии в FND-005-REPORT.md, переданы MOBILE/LEAD без изменения чужого модуля.

## История: LEAD / ARCHITECT — DOC-001 DONE; первоначальная передача QA/DEVOPS
- Резервирование 2026-09-19: .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md, append .ai/CHANGELOG.md. Единственный исполнитель Git-операций — LEAD. Код, contracts, архитектура и результаты агентов сохраняются.
- Исходный Git: main → origin/main, HEAD 33610f11302e1b46a1f35acc9279af3738ca4d41; индекс пуст, изменены только три исходных файла DOC-001: ACTIVE_WORK, PROJECT_STATE, TASKS.
- После git fetch origin и проверки live remote подтверждено: FND-002 92f642f, FND-003 754d081, FND-004 251b4fd — предки origin/main; отчёт QA опубликован в 33610f1. Identity соответствует существующей истории, не изменялась.
- FND-002/FND-003/FND-004: DONE подтверждено LEAD после сдачи DOC-001, успешного общего check и проверки опубликованных commits и чистого дерева. Прежняя блокировка снята; результаты агентов сохранены ниже как история.
- FND-005: TODO, доступна QA/DEVOPS для повторного preflight и запуска Foundation gate. Зависимости DONE, организационных блокировок нет; сам gate не выполнялся. FND-005 не закрыта.
- Проверки сдачи: npm run check PASS — сборки contracts/AI/backend, mobile typecheck, 226 tests / 24 files. Проверяются согласованность MD, отсутствие code/config diff и git diff --check. Native/device, live AI и production readiness этой задачей не подтверждаются; независимый QA gate не заменён.
- Сдача: 91beb56dd08b3de9c3dd908f3b50c7ddbfbba184 — `docs: complete DOC-001 and unblock foundation gate`; push origin main успешен, live remote SHA совпал, git status clean, porcelain с untracked-files=all пустой. MD diff/--check и staged diff проверены; изменений кода/config нет.
- Эти подтверждённые статусы оформляются отдельным docs commit/push по AGENTS.md §14 с повторной проверкой remote и clean status. После его успешной отправки резервирование DOC-001 освобождается; Git-операции FND-005 выполняет QA/DEVOPS.

## История аудитов агентов до финальной сдачи DOC-001
Следующие блоки сохранены без перезаписи результатов. BLOCKED, DONE и IN_PROGRESS внутри этой истории отражают момент соответствующей проверки; текущие назначения определяются блоком выше и TASKS.md. FND-005-REPORT.md — исторический preflight QA, не текущий запрет запуска после снятия блокировки LEAD.

## QA / DEVOPS — FND-005 BLOCKED (предварительная проверка зависимостей)
- Поручение заказчика: Foundation gate только после завершения FND-002/FND-003/FND-004. Проверка выполнена 2026-09-19.
- Резервирование: только собственный блок здесь, статус FND-005 в TASKS, append CHANGELOG и .ai/FND-005-REPORT.md. Код, contracts, CI, lockfile и архитектура не меняются.
- Git: main → origin/main; исходный HEAD 251b4fddb39bd8220cc26a30a1daf45e520db6a6; индекс пуст. Git-операции записи QA выполняет QA последовательно, только со своими hunks. Исходные DOC-001 изменения LEAD в ACTIVE_WORK/PROJECT_STATE/TASKS остаются вне commit QA.
- PASS: git ls-remote --heads origin main вернул 251b4fddb39bd8220cc26a30a1daf45e520db6a6; commits FND-002 92f642f и FND-003 754d081 являются его предками, FND-004 — сам HEAD.
- FAIL prerequisite: все три зависимости имеют BLOCKED в TASKS и ACTIVE_WORK; подтверждение DONE от LEAD отсутствует, исходный git status содержит три изменённых .ai-файла DOC-001. Наличие опубликованного кода не подтверждает завершение задач.
- Foundation gates NOT_RUN/BLOCKED: install/ci, build, tests, mobile export, typecheck, contracts, CI, fake production data и интеграция. Старые результаты других ролей не считаются текущими проверками QA. Для записи блокировки проверяются только MD diff/согласованность; application tests/build не запускаются по условию заказчика.
- Ошибок выполненных Git-команд нет; блокировка организационная. Собственная запись подлежит commit/push; фактический SHA и результат отправки передаются в итоговом отчёте. Чистый общий status невозможен до сдачи DOC-001 владельцем; FND-005 не завершена даже при успешной отправке отчёта.
- Адресат LEAD: отдельно сдать свои DOC-001 hunks, проверить clean status и завершение FND-002/FND-003/FND-004, подтвердить их DONE; затем разрешён повторный preflight FND-005. Подробный отчёт: .ai/FND-005-REPORT.md.

## AI ENGINEER — FND-004 BLOCKED (код готов к REVIEW; ожидается сдача DOC-001)
- Прямое поручение заказчика: аудит существующего AI Foundation; без AI-001, voice, memory и feature-specific AI.
- Резервирование: packages/ai/**; собственный блок FND-004, статус задачи и append CHANGELOG. Contracts, backend и архитектура — только чтение.
- Git: main → origin/main, исходный HEAD 754d081; индекс пуст. Исходные DOC-001 hunks LEAD в ACTIVE_WORK/PROJECT_STATE/TASKS сохраняются вне commit FND-004; чистый общий status зависит от сдачи LEAD.
- Git-операции FND-004 выполняет AI ENGINEER последовательно с проверкой индекса; чужие изменения не включаются.
- Проверки: provider port, capability/consent, structured preview/contracts, unavailable/errors, отсутствие DB writes; unit tests и общий check/build.
- Исправлено: независимый от реакции провайдера timeout/cancellation, запрет вызова после pre-abort, проверка числовых лимитов, типизированные ошибки malformed/thrown status и result envelope, валидация исходного output до JSON-нормализации.
- Проверено: npm run check PASS — builds contracts/AI/backend, mobile typecheck, 226 tests / 24 files (74 AI tests). Guards consent/capability, минимальный outbound context, mandatory confirmation и disabled/unavailable сохранены. DB imports/writes отсутствуют; contracts и архитектура не менялись.
- Независимый review PASS: security_concerns/logic_errors пусты. Добавлен рекомендованный тест byte limit для schema-valid output; повторный check PASS. Live provider, native/device, voice и memory не реализовывались и не заявляются.
- Блокировка: git status --short содержит исходные DOC-001 hunks LEAD в .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md. Ошибок Git-команд нет; требуется отдельная сдача владельцем LEAD и повторный clean status. Собственные hunks FND-004 сдаются отдельно; SHA/push передаются LEAD итоговым сообщением. DONE не выставляется.

## MOBILE — FND-003 BLOCKED (реализация проверена; ожидается Git-сдача)
- Прямое поручение заказчика: продолжить существующую Mobile Foundation, не менять стек и не начинать feature-задачи.
- Резервирование: apps/mobile/**; собственный блок FND-003 в ACTIVE_WORK, статус FND-003 в TASKS и добавление в CHANGELOG. Backend/contracts/root config — только чтение.
- Git: main → origin/main, исходный HEAD 92f642f, индекс пуст. Исходные DOC-001 hunks LEAD в ACTIVE_WORK/PROJECT_STATE/TASKS сохраняются и не включаются в commit MOBILE. Финальный clean status зависит от их сдачи LEAD.
- Проверки: mobile regression tests, общий check/build, Metro export Android/iOS/web; проверка no-auto-microphone. Native device gates остаются OPS-001.
- Git-операции FND-003 выполняет MOBILE последовательно, с повторной проверкой общего индекса перед staging.
- Исправлено: timeout чтения HTTP body, изоляция публичных/устаревших 401 и успешных ответов старой сессии; публикация bearer только после успешного сохранения в SecureStore adapter.
- Проверено: `npm run check` PASS — builds, mobile typecheck, 208 tests / 24 files. `npm run build:mobile` PASS — Android/iOS Hermes bundles и web export. Новый mobile API integration test выполняет register/profile/preferences/context/logout/login через реальный HTTP и файловую SQLite. Backend/contracts/стек не менялись.
- Navigation, light/dark design system, loading/error/empty states сохранены. В mobile sources/config нет capture/permission API микрофона; кнопка «Сказать» disabled. Native cold launch и SecureStore на устройстве не заявляются: OPS-001.
- Независимый review: PASS, security_concerns и logic_errors пусты. Неблокирующие рекомендации: усилить cleanup временной SQLite при ошибке и расширить edge-case tests HTTP body.
- Блокировка: исходные незакоммиченные DOC-001 hunks LEAD в .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md препятствуют чистому общему status. Требуется отдельная сдача владельцем LEAD; MOBILE чужие hunks не включает. Результат подготовлен к REVIEW, но статус BLOCKED до чистого дерева; фактические SHA и push передаются LEAD итоговым сообщением. Ошибок Git-команд на момент подготовки нет. DONE не выставляется.

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

## LEAD / ARCHITECT — DOC-001 DONE
- Задача заказчика: исправить только MD-документацию и процесс Git/завершения задач; не повторять инициализацию и не менять архитектуру или features.
- Резервирование: MASTER_PROMPT.md, AGENTS.md, agent-roles/*.md, .ai/ACTIVE_WORK.md, .ai/TASKS.md, .ai/PROJECT_STATE.md, .ai/CHANGELOG.md. .ai/ARCHITECTURE.md — только чтение.
- Зависимости: нет; изменения документации выполняет LEAD последовательно, остальные роли не запускаются.
- Исходный Git: main, HEAD ddc735b, origin/main; рабочее дерево и индекс были чистыми. Перед основным commit проверены user.name/user.email и фактические author/committer; identity согласована с существующей конфигурацией, не изменялась.
- Найденный дефект: инструкции завершения не требовали обязательных commit, push и чистого git status; прежние .ai-записи сохранили промежуточные статусы инициализации.
- Обязательные проверки DOC-001: согласованность MD-правил, git diff/--check, только согласованные MD-файлы, отсутствие изменений архитектуры/кода, проверка identity и индекса, успешные commit/push и чистый финальный status. Независимый аудит документации — PASS; git diff --check — PASS, diff содержит только согласованные MD-файлы.
- Дополнительные проектные проверки: `npm run check` — FAIL на сборке backend; `npm test` — тесты backend падают по тайм-аутам, весь запуск остановлен по лимиту времени без итогового успешного результата; `npm run typecheck -w @everyday/mobile` — PASS. Сборки contracts и AI в составе check прошли.
- Граница приёмки: DOC-001 — исправление документации, не приёмка приложения. Ошибки существующего неизменённого кода ниже переданы заказчику; они не исправляются и не выдаются за успешные проверки. Готовность Foundation/native/production этой задачей не подтверждается.
- Основной commit: ca21ac355472642f5a96c0a6529b454160a695ba — `docs: enforce agent git workflow`; только согласованные MD-файлы, staged diff проверен.
- Push: `git push origin main` выполнен успешно; `git ls-remote --heads origin main` подтвердил тот же SHA. После push: main up to date with origin/main; `nothing to commit, working tree clean`, porcelain с untracked-files=all пустой.
- LEAD подтвердил DONE для основного результата по этим фактам. Эта запись о закрытии и статусы .ai сдаются отдельным `docs: record git workflow completion` с проверкой identity, diff, commit/push и повторным чистым git status до финального отчёта; её SHA определяется через Git, а не записывается внутрь самого commit.
- Git-блокировки: не выявлены. При сбое отправки записи о закрытии вернуть BLOCKED, сохранить диагностику и сообщить заказчику. Резервирование файлов DOC-001 освобождается после успешной отправки этой записи и финального чистого статуса.

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
