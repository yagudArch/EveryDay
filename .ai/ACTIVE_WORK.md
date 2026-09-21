# Активная работа

## LEAD / ARCHITECT — Цикл 1: BCK-002 разблокирована публикацией контрактов
- Состояние Git: HEAD == origin/main == c998b60, дерево чистое (проверено fetch). Foundation закрыт; аудит не повторялся.
- **BCK-002 (BACKEND) — РАЗБЛОКИРОВАНА (TODO ready).** Прежняя блокировка «нет контрактов memory/export/delete-account» СНЯТА: LEAD опубликовал контракты в c998b60 (feat(contracts): publish memory and account privacy contracts), npm run check 247/247 PASS. Backend-код не менялся.
- Опубликованные endpoints (все auth:true, ownership из principal): GET `/memory` (MemoryList), POST `/memory` (CreateMemoryFact→MemoryFact 201), DELETE `/memory` (MemoryDeleteAll 200), DELETE `/memory/{id}` (204, memoryFactById), GET `/account/export` (AccountExport 200), DELETE `/account` (DeleteAccount body с текущим паролем → 204). MemoryFactSchema переиспользован (source: user_confirmed).
- Решение по consent (зафиксировано в контракте): memoryEnabled/aiConsent остаются в PreferencesSchema и меняются существующим PATCH /preferences; новых consent-endpoints нет. Disable-memory ≠ стирание фактов; стирание — DELETE /memory (один/все).
- Зависимости и ownership сохранены. BACKEND реализует BCK-002 (миграция 0004 + routes→services→repositories→database, cascade/ownership/privacy tests). LEAD задачу НЕ стартует. account deletion требует текущий пароль и revoke всех сессий.
- Прочие статусы без изменений: BCK-001/NUT-001 DONE; OPS-001 BLOCKED (native toolchain); MOB-001 ← OPS-001; AI-001 ← OPS-002 + credentials/privacy; NUT-002 ← NUT-001 ✓ + MOB-001; NUT-003 ← NUT-001 ✓ + AI-001. Housekeeping debt `tatus --short` не в этом commit.

## LEAD / ARCHITECT — Цикл 1: BCK-001 DONE, разблокировка BCK-002 (история)
- Состояние Git: HEAD == origin/main == 6742ae2, дерево чистое (проверено fetch). Foundation закрыт (FND-001…006 DONE); Foundation-аудит НЕ повторялся.
- **BCK-001 (BACKEND) — DONE.** Implementation 6742ae2 в origin/main (auth hardening: email verify, password reset, revoke-all; миграция 0003). Реализовано по опубликованному LEAD контракту 6a02032; packages/contracts НЕ менялся — проверено `git diff 6a02032..6742ae2 -- packages/contracts` = пусто. Проверено: npm run check PASS — builds contracts/AI/backend + mobile typecheck + 247 tests/26 files (+14, 0 регрессий), working tree clean. LEAD подтвердил DONE.
- **BCK-002 (BACKEND) — РАЗБЛОКИРОВАНА (TODO ready).** Зависимость BCK-001 выполнена; миграция 0003 опубликована → следующая 0004. Роль BACKEND свободна. Memory CRUD/delete-all/disable + consent, экспорт/удаление аккаунта, cascade tests. Готова к запуску (LEAD её здесь НЕ стартует).
- **OPS-001 (QA/DEVOPS) — остаётся BLOCKED** (локальный хост без native toolchain; путь через GitHub Actions native runners, см. TASKS/OPS-001-REPORT). Прочие зависимости не менялись: MOB-001 ← OPS-001; AI-001 ← OPS-002 + credentials/privacy; NUT-002 ← NUT-001 ✓ + MOB-001; NUT-003 ← NUT-001 ✓ + AI-001.
- Housekeeping debt (не в этом commit): ошибочный файл `tatus --short` в корне остаётся отдельным долгом на удаление.
- Следующее к запуску: **BCK-002 (BACKEND)** — готова прямо сейчас. Параллельно возможна подготовка native-workflow для OPS-001 (QA/DEVOPS, `.github/workflows/**`) — другая роль, другие файлы.

## BACKEND — BCK-002 REVIEW (memory / privacy / account) — на приёмку LEAD
- Роль BACKEND, задача BCK-002. Реализация по опубликованному LEAD контракту c998b60 (packages/contracts НЕ менялся). Исходный Git: main → origin/main, HEAD == origin/main == 2c39a2c, дерево чистое (проверено fetch). Git identity: yagudArch <ilya.khokhlov.2017@gmail.com>.
- Ранняя запись BCK-002 BLOCKED (нет контрактов, commit 0877874) снята: LEAD опубликовал контракты memory/account (c998b60) и разблокировал (2c39a2c). Инструменты в этой сессии временами теряли аргументы при patch/write_file — каждый раз повторял вызов с полными аргументами, потери НЕ привели к неверным правкам; систематической блокировки нет.
- Архитектура routes → services → repositories → database соблюдена. Изменённые/новые файлы:
  - НОВОЕ: apps/backend/src/services/memory-service.ts, apps/backend/src/routes/memory.ts, apps/backend/tests/memory-account.test.ts.
  - ИЗМЕНЕНО: apps/backend/src/db/repositories/profile-data.ts (memory.insert/deleteOwnedById/deleteAllForUser + InsertMemoryInput), apps/backend/src/db/repositories/users.ts (deleteById), apps/backend/src/services/account-service.ts (exportAccount, deleteAccount), apps/backend/src/routes/account.ts (GET /account/export, DELETE /account), apps/backend/src/app.ts (registerMemoryRoutes + CORS methods += DELETE).
  - Собственный блок ACTIVE_WORK, статус BCK-002 в TASKS (→ REVIEW), append CHANGELOG.
- Endpoints по контракту: GET /memory (200 MemoryList), POST /memory (201 MemoryFact, source всегда 'user_confirmed'), DELETE /memory (200 MemoryDeleteAll{deletedCount}), DELETE /memory/{id} (204). GET /account/export (200 AccountExport), DELETE /account (204, body DeleteAccountSchema{password}).
- БЕЗ новой миграции: таблица user_memory уже создана в 0001_foundation.sql, и ВСЕ user-owned таблицы объявлены FK ON DELETE CASCADE при foreign_keys=ON. Поэтому account deletion = один DELETE FROM users, каскад удаляет sessions/preferences/preference_values/goals/memory/daily_context/subscriptions/meals/nutrition_goals/auth_tokens и тем самым отзывает все сессии. Fake-миграция не изобреталась.
- Privacy/ownership соблюдены: userId только из session principal, никогда из body/query/header; DTO strict — лишний userId → 400. memory.deleteOwnedById и все запросы scoped по user_id: чужой факт по угаданному id → 404, не удаляется. account deletion требует текущий пароль (verifyPassword против stored hash), неверный → 401 и ничего не удаляет; необратимо (нет soft-delete). export не выдумывает недоступные модули — только profile/preferences/goals/memory/subscription; memory включается в export и управление независимо от memoryEnabled (флаг влияет только на выдачу в day context, не на хранение/экспорт).
- DELETE /memory/{id}: контрактный path сохранён ({id} в endpoints/OpenAPI через memoryFactById), Fastify-роут зарегистрирован с runtime-конвенцией :id (memoryFactById(':id')); delete-all (DELETE /memory) и delete-one (DELETE /memory/:id) — различные роуты, не конфликтуют. CORS добавлен метод DELETE.
- Проверки: npm run check PASS — builds contracts/AI/backend + mobile typecheck + vitest 260 tests / 27 files (было 247; +13 тестов memory/account: CRUD, 400 на strict/empty, 204/404 delete-one, delete-all count+идемпотентность, 401 без auth, ownership cross-user, memoryEnabled vs day context, export real-data-only, deletion wrong-password 401 / success 204 + cascade проверка всех таблиц + session revoke + login невозможен, isolation, auth/body). 0 регрессий.
- Далее Git-сдача по AGENTS.md §9/§14: diff/identity → адресный staging только файлов BCK-002 → commit → push origin/main → чистый статус. SHA/push/status — в финальном сообщении. DONE подтверждает LEAD.

## BACKEND — BCK-001 REVIEW (auth hardening) — принято LEAD (история)
- Задача BCK-001, роль BACKEND. Реализация по опубликованному LEAD контракту 6a02032 (packages/contracts НЕ менялся).
- Изменённые/новые файлы: database/migrations/0003_auth_hardening.sql (new); apps/backend/src/db/repositories/auth-tokens.ts (new), users.ts, sessions.ts; apps/backend/src/auth/crypto.ts; apps/backend/src/services/{auth-hardening-service.ts (new), token-delivery.ts (new)}, auth-service.ts; apps/backend/src/routes/auth.ts; apps/backend/src/{context.ts, app.ts}; apps/backend/tests/{auth-hardening.test.ts (new), helpers.ts, migrations.test.ts}; собственный блок ACTIVE_WORK, статус BCK-001 в TASKS, append CHANGELOG.
- Реализовано: email verification (POST request 202 auth / confirm 200 public), password reset (request 202 public / confirm 204 public), revoke-all sessions (POST 200 auth). Миграция 0003: users.email_verified/email_verified_at + таблица auth_tokens (purpose CHECK email_verify|password_reset, token_hash UNIQUE, consumed_at, FK users ON DELETE CASCADE, индексы). Opaque single-use токены: хранится только SHA-256, доставка через инъектируемый TokenDelivery seam (default noop, НЕ логирует токен), токен никогда не эхонится API. Password reset request не раскрывает существование аккаунта (no user enumeration) и всегда 202; confirm заменяет hash и revoke-all сессий. Confirm single-use и atomic. Strict credential rate-limit применён к новым sensitive endpoints (email verify request/confirm, password reset request/confirm) поверх глобального.
- Исходный Git: main → origin/main, HEAD 6a02032, дерево чистое. Git-сдачу BCK-001 выполняю последовательно один я.
- Проверки: npm run check PASS — builds contracts/AI/backend + mobile typecheck + vitest 247 tests / 26 files (было 233; +14 auth-hardening тестов, 0 регрессий). Далее diff/identity → адресный staging → commit/push origin/main → чистый статус. DONE подтверждает LEAD.

## LEAD / ARCHITECT — Цикл 1: NUT-001 DONE, синхронизация зависимостей
- Состояние Git: HEAD == origin/main == 9d9e1e0, дерево чистое (проверено fetch). Foundation закрыт (FND-001…006 DONE); Foundation-аудиты и полный regression НЕ повторяются.
- **NUT-001 (BACKEND) — DONE.** Implementation 8467216 в origin/main (nutrition goals/meals/daily summary, миграция 0002). Проверено: npm run check 233/233 PASS, builds contracts/AI/backend + mobile typecheck PASS, working tree clean. LEAD подтвердил DONE.
- **BCK-001 (BACKEND) — РАЗБЛОКИРОВАНА (TODO ready).** Зависимость NUT-001 выполнена; миграция 0002 опубликована → следующая 0003. Роль BACKEND свободна, конфликт по database/migrations/** снят. Готова к запуску.
- **OPS-001 (QA/DEVOPS) — остаётся BLOCKED.** Локальный хост без native toolchain (Windows/MINGW64, нет Android SDK/adb/gradle, JDK 25 вместо 17, нет macOS/Xcode) — см. .ai/OPS-001-REPORT.md. Решение LEAD: путь через GitHub Actions native runners (workflow native-build.yml: android=ubuntu-latest JDK17+setup-android+expo prebuild+Gradle assembleDebug+APK artifact; ios=macos-latest Xcode+expo prebuild+xcodebuild simulator; cold-launch/SecureStore E2E на эмуляторе-runner или устройстве). QA готовит workflow; DONE только после зелёного native-прогона с artifacts. Metro export ≠ APK/IPA (ARCHITECTURE).
- НЕ запускать (зависимости не выполнены):
  - **NUT-002 (MOBILE)** ← NUT-001 ✓ + MOB-001 (ждёт OPS-001). Не стартовать до разблокировки MOB-001.
  - **MOB-001 (MOBILE)** ← OPS-001 (BLOCKED, native runner/E2E не готовы).
  - **AI-001 (AI ENGINEER)** ← OPS-002 + server-side credentials + privacy review. НЕ запускать преждевременно. Разблокирует NUT-003.
  - **NUT-003 (AI)** ← NUT-001 ✓ + AI-001 (BLOCKED).
  - **BCK-002 (BACKEND)** ← BCK-001.
- Готова, но одна роль с OPS-001: **OPS-002** — брать после OPS-001 либо вторым QA/DEVOPS-агентом по согласованию LEAD; разблокирует AI-001.
- Правила цикла для агентов: работать только над назначенной задачей; общий database/migrations/** и packages/contracts менять только по согласованию с LEAD; каждая задача завершается по AGENTS.md §9/§14 (commit+push+чистый статус); о новых проблемах — запись сюда и эскалация LEAD.
- Гигиена репозитория: в корне обнаружен ошибочный файл `tatus --short` (артефакт shell-редиректа). Удаление — отдельным согласованным действием владельца корня (LEAD); в этот коммит не включается.
- Следующее к запуску: **BCK-001 (BACKEND)** — готова прямо сейчас. Native-путь OPS-001 — подготовка workflow QA. Остальное ждёт зависимостей.

## История (Foundation закрыт) — блоки ниже архивные, не текущие назначения

## BACKEND — FND-005 portability repair REVIEW
- Прямое поручение заказчика: исправить только зависимость migration path test от имени каталога checkout; FND-005 не закрывать, после push передать повторный Foundation Gate QA.
- Резервирование: apps/backend/tests/migrations.test.ts, собственный блок ACTIVE_WORK, append CHANGELOG. Runtime paths.ts, SQL migrations, архитектура, TASKS и отчёт QA не меняются.
- Исходный Git: main → origin/main, HEAD c4590e8, дерево/индекс чистые. Git-сдачу этого исправления выполняет BACKEND последовательно.
- Проверки: воспроизведение исходного FAIL в переименованной копии, затем полный npm run check в исходном checkout и независимой копии с другим именем, diff/identity, commit/push/clean status.
- Воспроизведён исходный FAIL: vitest migrations.test.ts -t 'resolves stable repository paths' в C:/Users/Admin2/AppData/Local/Temp/migration-portability-regression (1 failed / 7 skipped). Копия создана git clone --no-hardlinks, обычный npm ci PASS (610 packages); прежние 12 moderate audit findings не исправлялись в этой узкой задаче.
- Изменён только тест путей: точный projectRoot относительно import.meta.url файла теста вместо endsWith('EveryDay'); проверка defaultMigrationsDir сохранена, добавлена проверка наличия 0001_foundation.sql как файла. Runtime и SQL не менялись; исключений для QA нет.
- npm run check PASS в C:/Users/Admin2/Desktop/EveryDay и C:/Users/Admin2/AppData/Local/Temp/migration-portability-regression: в каждом 226 tests / 24 files, builds contracts/AI/backend и mobile typecheck. Исправленный файл одинаков в обеих копиях (git diff применён без дополнительных изменений).
- Передача LEAD/QA: после опубликованного исправления повторить Foundation Gate. FND-005 остаётся BLOCKED до решения QA/LEAD; этот REVIEW относится только к portability repair. Фактические commit SHA/push/clean status передаются итоговым сообщением после Git-сдачи.

## QA / DEVOPS — OPS-001 BLOCKED (нет native toolchain)
- Область: .github/**, apps/mobile native config, собственный блок ACTIVE_WORK, строка OPS-001 TASKS, append CHANGELOG, .ai/OPS-001-REPORT.md. OPS-002 не берётся (одна роль). Прикладной код не менялся.
- Проверка окружения (собственные запуски): Windows MINGW64_NT (не macOS); Temurin JDK 25 (Android Gradle требует JDK 17); ANDROID_HOME/ANDROID_SDK_ROOT пусты; adb/sdkmanager/gradle отсутствуют в PATH; eas.json и native android/ios dirs отсутствуют (managed Expo, .gitignore).
- Следствие: Android debug APK, iOS simulator build, device cold-launch (микрофон не активируется) и login/logout device-persistence E2E НЕ выполнимы в этой среде; iOS на Windows принципиально невозможен. Фабриковать результаты запрещено — по AGENTS.md §9/§14 недоступность обязательной проверки = блокировка.
- Косвенное (не заменяет device): mobile API integration и foundation-smoke на Node-уровне (register/login/logout/persist/restart через HTTP+файловую SQLite) — уже зелёные в FND-005/006; статически нет microphone capture/permission в mobile, кнопка «Сказать» disabled (FND-006).
- Требуемое действие LEAD/заказчик: предоставить CI-runner (ubuntu-latest Android SDK + JDK 17 для expo prebuild + Gradle assembleDebug; macos-latest Xcode для iOS simulator) с правами на Actions, либо окружение с Android SDK/устройством. До этого OPS-001 BLOCKED, MOB-001 остаётся BLOCKED.
- Гигиена репо: в корне обнаружен ошибочный файл `tatus --short` (артефакт shell-редиректа, в дереве с сен 17, untracked/или трекнут). Владелец корня LEAD; QA не удаляет без согласования.
- Git-сдача этой записи: адресный add .ai/{OPS-001-REPORT,TASKS,ACTIVE_WORK,CHANGELOG}.md, commit/push origin/main, чистый статус; SHA — в финальном сообщении.

## QA / DEVOPS — FND-006 DONE; Foundation закрыт
- Независимый аудит origin/main 6c8fd84 (прикладной код Foundation неизменён с 4297502). Область: чтение исходников BACKEND/MOBILE/AI + contracts; повторный полный FND-005 не переигрывался.
- Не найдено: критичных дефектов, архитектурных нарушений, проблем безопасности, разрывов интеграции Backend/Mobile/AI, fake production data. SQL bound-параметрами; scrypt+соль+timingSafeEqual; opaque sessions SHA-256; identity только из principal; contract-schemas на обеих сторонах; AI disabled→503 и preview-only без DB writes; consent/микрофон по правилам; loopback+CORS allowlist+helmet+rate limit+bodyLimit.
- Не-блокирующее с владельцами: npm audit 12 moderate (LEAD/OPS-002), P2 MOBILE race/timezone (MOB-001), backend hardening (BCK-001), HomeScreen wardrobe wording (MOBILE).
- Native readiness отдельным вердиктом: НЕ готов (APK/IPA, device SecureStore/cold-launch, live AI) — OPS-001/OPS-002/AI-001; по ARCHITECTURE не блокер Foundation.
- Foundation закрыт, проект передаётся LEAD для этапа 2 (питание). Следующие задачи QA не начинает. Отчёт .ai/FND-006-REPORT.md. Git-сдача: адресный add .ai/{FND-006-REPORT,TASKS,ACTIVE_WORK,CHANGELOG,PROJECT_STATE}.md, commit/push origin/main, чистый статус; SHA — в финальном сообщении.

## История: QA / DEVOPS — FND-005 DONE; финальный Foundation gate
- Повторный gate после portability-фикса BACKEND на origin/main 4297502 (local HEAD == origin/main, дерево чистое). FND-006 и feature-задачи не запускались.
- Проверки в новой чистой копии с ДРУГИМ именем C:/Users/Admin2/AppData/Local/Temp/everyday-fnd005-gate-4297502 (без node_modules/build): обычный npm ci (610 packages), npm run check 226/226 PASS, builds contracts/AI/backend, mobile typecheck. Прежний basename-blocker migrations.test.ts снят и не воспроизводится.
- PASS: smoke HTTP/Mobile/Backend/AI/SQLite 2/2, migration CLI applied 0001 / повтор skipped 0001, Expo install --check up to date, CI=1 build:mobile Android/iOS/web. Remote CI run 35466855284 (ubuntu-latest, windows-latest) success через GitHub API, упавших шагов нет.
- Все обязательные Foundation Gate пройдены. Не-блокирующие пункты переданы владельцам: npm audit 12 moderate (LEAD dependency/security), P2 MOBILE GET/PATCH race и timezone invalidation (MOB-001), native APK/IPA + device SecureStore/cold-launch + live AI (отдельные native/production gates).
- Git-сдача: адресный add .ai/{ACTIVE_WORK,TASKS,CHANGELOG,FND-005-REPORT}.md, commit/push origin/main, проверка чистого статуса. Отчёт FND-005-REPORT.md. Итоговый SHA/push/status — в финальном сообщении.

## История: QA / DEVOPS — FND-005 BLOCKED; повторный Foundation gate cd55dcd
- Заказчик подтвердил передачу FND-005 и Git-сдачи этому чату; другой QA остановлен. Его исходная незакоммиченная запись о FND-006 заменена этой согласованной передачей. FND-006 и feature-задачи здесь не выполнялись.
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

## BACKEND-A — NUT-001 REVIEW (nutrition vertical slice)
- Реализован backend-срез питания по опубликованному LEAD контракту (packages/contracts не менялся).
- Владение соблюдено: database/migrations/0002_nutrition.sql (таблицы meals + nutrition_goals, FK ON DELETE CASCADE, конвенции 0001), apps/backend/src/nutrition/{repository,service}.ts, apps/backend/src/routes/nutrition.ts, регистрация в apps/backend/src/app.ts, apps/backend/tests/nutrition.test.ts.
- Обновлены только собственные backend-тесты apps/backend/tests/migrations.test.ts (счётчик миграций 0001→0001+0002) — прямое следствие новой миграции; production-код Foundation и SQL 0001 не тронуты.
- Эндпоинты: GET/PUT /nutrition/goals, GET/POST /nutrition/meals, GET /nutrition/summary. Владелец всегда из session principal; local_date считается сервером по timezone профиля (reuse localDateFor из context-service); макросы/калории округляются до 0.1; ?date=YYYY-MM-DD с валидацией, дефолт — локальное «сегодня»; summary: consumed, remaining=goal−consumed (null без цели), mealCount.
- OpenAPI генерируется из endpoints-каталога contracts автоматически — ручных правок openapi.ts не требовалось.
- Идемпотентность POST meal: в кодовой базе НЕТ существующего механизма Idempotency-Key на уровне HTTP; согласно ТЗ fake-механизм не изобретался — POST создаёт новую запись. Требует решения LEAD, если идемпотентность нужна (кандидат под BCK-002).
- Проверка: npm run check PASS — builds contracts/AI/backend + mobile typecheck + vitest 233 tests / 25 files (было 226; +7 nutrition тестов).
- Git-сдача по AGENTS.md §9/§14 выполняется этим же коммитом; DONE подтверждает LEAD.
