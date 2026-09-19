# FND-005 — отчёт QA / DEVOPS для LEAD

## Актуальный Foundation gate — 2026-09-19 — FAIL / BLOCKED

Исходный commit 31a79b8c615c2c51878a22ce529f72ed9b28a70e, main → origin/main, дерево чистое. Зависимости DONE и ancestry 92f642f/754d081/251b4fd проверены через fetch/live remote. Ниже приведены собственные запуски QA; исторический preflight сохранён отдельным разделом.

| Gate / команда | Результат |
|---|---|
| `npm ci` | FAIL, exit 1 EUSAGE: manifest/lockfile не согласованы |
| `npm run check` | PASS, exit 0: 226 tests / 24 files |
| Build contracts / AI / backend | PASS: три tsc build в составе check и повторно db:migrate |
| Mobile typecheck | PASS: tsc --noEmit в составе check |
| Contracts / OpenAPI | PASS: 4 OpenAPI tests, strict DTO parsing mobile/backend, AI output validation |
| Backend auth/session | PASS: auth 7, sessions 4, preferences 5 tests; HTTP smoke register/login/logout/401 |
| Persistence / user isolation | PASS: context 6, foundation-audit 7, migrations 8 tests; новый smoke двух пользователей и reopen файловой SQLite |
| Subscription/trial | PASS: subscription 5 tests, дополнительные paid boundaries в foundation-audit; trial start/end и mobile subscription 6 tests |
| AI package | PASS: 74 tests (service 58, privacy 8, disabled 8); backend AI 9 tests |
| HTTP health | PASS: реальный loopback HTTP, строго `{status:'ok',database:'ok'}` через mobile API |
| Backend ↔ Mobile ↔ AI | PASS: `node --import tsx --test scripts/foundation-smoke.mjs`, 2 tests; повтор после усиления assertions также 2/2 |
| Migration CLI | PASS: `DATABASE_PATH="$LOCALAPPDATA/Temp/everyday-fnd005-migrations.db" npm run db:migrate`; applied 0001. Повтор `DATABASE_PATH="$LOCALAPPDATA/Temp/everyday-fnd005-migrations.db" npm run db:migrate -w @everyday/backend`: skipped 0001 |
| `CI=1 npm run build:mobile` | PASS: Android/iOS Hermes .hbc и web JS, dist export |
| `npm exec -w @everyday/mobile -- expo install --check` | FAIL, exit 1: несовместимые установленные версии |
| Fake production data | В проверенных runtime-путях подмена не обнаружена: context modules unavailable/null, AI disabled/503, test provider только в QA script; см. замечания аудита ниже при наличии |
| CI workflow | FAIL до исправления: `npm run smoke` exit 1 Missing script. Вызов заменён реальным QA smoke, локально PASS. Pipeline всё ещё блокируют ci/Expo check |
| Remote Actions | НЕ ПОДТВЕРЖДЁН: `gh auth status` exit 127, gh отсутствует; GET GitHub Actions runs API без auth HTTP 404 |
| Git consistency | Исходное дерево чистое, зависимости опубликованы, diff --check PASS; итоговые SHA/push/status передаются после сдачи |

Успешные build/tests/export выполнены на существующем node_modules после отказа npm ci на проверке lockfile. Они не доказывают воспроизводимую установку с нуля. Числа тестов в отдельных строках — части общей suite, не дополнительные запуски. Новые smoke — отдельные 2 сценария.

### Дефекты и ответственные

1. **Blocker — LEAD (lockfile), MOBILE (совместимость зависимостей).** Воспроизведение: Node 22.23.2/npm 10.9.8, `npm ci` в корне. Expected: чистая установка exit 0. Actual: EUSAGE, Missing react-native-safe-area-context@5.7.0 и react-native-screens@4.26.2 from lock file. Root manifests/lockfile не исправлялись QA. Требуется согласованное восстановление lockfile и повтор чистой установки.
2. **High — MOBILE/LEAD.** `npm exec -w @everyday/mobile -- expo install --check`: installed → expected: @expo/metro-runtime 57.0.15 → ~57.0.16; expo 57.0.23 → ~57.0.24; react-native-safe-area-context 5.10.0 → ~5.7.0; react-native-screens 4.28.0 → ~4.26.0. Expected exit 0, actual exit 1. Не маскировать успешным Metro bundle.
3. **High — QA/DEVOPS, исправлен.** CI вызывал отсутствующий root script smoke. Воспроизведение `npm run smoke`: exit 1 Missing script. Добавлен `scripts/foundation-smoke.mjs`; workflow вызывает `node --import tsx --test scripts/foundation-smoke.mjs` после build/check. Root package.json не менялся. Независимый review PASS, security/logic concerns пусты; рекомендации assertions применены, повторный smoke PASS.

Smoke использует compiled backend и AI, настоящий mobile HttpClient/endpoints, временную файловую SQLite и реальный HTTP. Проверяет загрузку AI package без fallback warning, disabled provider, auth, изоляцию, persisted session/note/preferences после restart, consent, реальный AIService с тестовым provider seam, минимизацию outbound context, confirmationRequired и отсутствие записи preview, ошибку malformed output. Это не live provider и не UI/device E2E.

### Окружение и ограничения

### Дополнительный статический аудит — владелец MOBILE

Следующие P2 находки проверены QA по исходникам, но UI/device reproduction не выполнялся. Это не доказанные runtime FAIL тестов; необходимы воспроизведение и решение MOBILE/LEAD.

- `apps/mobile/src/hooks/useAsyncResource.ts:75`: setData не меняет requestIdRef. Если refresh GET начат до PATCH заметки, а завершился после setData результата PATCH, run принимает старый GET и перезаписывает UI. Repro: задержать GET при pull-to-refresh → сохранить новую заметку → доставить старый GET. Expected: сохранённая заметка остаётся актуальной; predicted actual: UI возвращает старую. Связанный вызов: HomeScreen.tsx:113. Проверить также reset/disabled и аналогичные read/write races в PreferencesContext.
- `apps/mobile/src/screens/HomeScreen.tsx:83`, `:93`, `apps/mobile/src/hooks/useAsyncResource.ts:59`: загрузка зависит только от enabled/run, timezone preferences не инвалидирует загруженный TodayContext. Repro: Home с заметкой Pacific/Kiritimati → Settings сменить timezone на Pacific/Honolulu → вернуться без refresh → отредактировать заметку. Expected: новый день/контекст перед записью; predicted actual: старая дата/заметка, PATCH сервер относит к новому дню. SettingsScreen.tsx:122 сохраняет timezone без обновления ресурса Home. Код MOBILE не менялся QA.

Независимый аудит не обнаружил явного обхода ownership/entitlement или fake production data в просмотренных runtime-путях. Выявленный пробел Backend→AIService интеграционных тестов закрыт новым smoke; тестовый provider не заменяет настоящий AIService. Для полного UI verdict остаются указанные сценарии, Foundation gate уже BLOCKED по воспроизводимым dependency/CI дефектам.

### Проверенное окружение

`npm run doctor`: Windows x64, Node v22.23.2, npm 10.9.8, SQLite 3.51.3, Git 2.53.0.windows.2, Java 25.0.4. adb/docker недоступны в PATH, ANDROID_HOME не задан; native iOS требует macOS/Xcode. node:sqlite выводит ExperimentalWarning. APK/IPA, device SecureStore/cold-launch и live AI не проверялись и не входят в подтверждённые PASS. Следующие feature-задачи не запускались, архитектура и код модулей не менялись.

LEAD: согласовать исправление зависимостей/lockfile, повторить npm ci и Expo check, затем полный gate и CI matrix. До этого FND-005 BLOCKED. PROJECT_STATE остаётся владельцу LEAD для синхронизации с этим результатом.

## Исторический preflight до снятия DOC-001 блокировки

Дата: 2026-09-19. Вердикт: **BLOCKED на проверке зависимостей**. Foundation gate не запускался по прямому условию заказчика.

## Проверенные Git-факты

Ветка main, upstream origin/main, remote git@github.com:yagudArch/EveryDay.git.
`git ls-remote --heads origin main` вернул `251b4fddb39bd8220cc26a30a1daf45e520db6a6`.

| Зависимость | Commit | Доступность в remote | Завершение |
|---|---|---|---|
| FND-002 | 92f642f0b45d874ff24c6f5e42d7de62a02fcbb6 | PASS: предок удалённого HEAD | FAIL: BLOCKED |
| FND-003 | 754d081207ad99418acbfa98fb661a98ecdedcb1 | PASS: предок удалённого HEAD | FAIL: BLOCKED |
| FND-004 | 251b4fddb39bd8220cc26a30a1daf45e520db6a6 | PASS: удалённый HEAD | FAIL: BLOCKED |

Проверки ancestry: `git merge-base --is-ancestor 92f642f 251b4fd` и `git merge-base --is-ancestor 754d081 251b4fd`, обе exit 0.

## Gates

NOT_RUN означает отсутствие результата проверки, а не падение команды и не PASS.

| Gate | Результат | Основание |
|---|---|---|
| Доступность commits зависимостей | PASS | Git history, ancestry, live remote ref |
| Завершение зависимостей | FAIL / BLOCKED | TASKS и ACTIVE_WORK: все три BLOCKED, нет подтверждения DONE LEAD |
| npm install / npm ci | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Build | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Tests | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Mobile export/bundle | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Typecheck | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Git diff preflight | PASS: просмотрен | Исходные изменения только DOC-001 в трёх .ai-файлах, индекс пуст |
| Чистый Git status | FAIL | Несданные изменения LEAD |
| Contracts | NOT_RUN / BLOCKED | Не пройден prerequisite |
| CI configuration / remote run | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Отсутствие fake production data | NOT_RUN / BLOCKED | Не пройден prerequisite |
| Интеграция Backend / Mobile / AI | NOT_RUN / BLOCKED | Не пройден prerequisite |

Ранее записанные результаты BACKEND/MOBILE/AI не выдаются за текущий независимый Foundation gate.

## Блокирующий дефект процесса — адресат LEAD

Severity: blocker для запуска FND-005; дефект runtime приложения этой проверкой не установлен.
Компонент: Git-сдача DOC-001 и приёмка зависимостей Foundation.
Окружение: общая рабочая копия C:/Users/Admin2/Desktop/EveryDay, main.

Воспроизведение: прочитать строки FND-002/FND-003/FND-004 в .ai/TASKS.md и их блоки .ai/ACTIVE_WORK.md; выполнить `git status --porcelain=v1 --untracked-files=all` и `git diff`.
Ожидание: зависимости завершены и приняты LEAD, результат опубликован, дерево чистое.
Факт: зависимости BLOCKED; исходные DOC-001 hunks в .ai/ACTIVE_WORK.md, .ai/PROJECT_STATE.md, .ai/TASKS.md не закоммичены. Локальная запись DOC-001 DONE не отменяет незавершённую сдачу её записи о закрытии.

Действие LEAD: сдать свои DOC-001 hunks отдельным проверенным commit/push; проверить чистоту дерева, фактическую сдачу FND-002/FND-003/FND-004 и подтвердить DONE; после этого повторить preflight и Foundation gate.

## Ограничения и команды

Ошибок выполненных Git-команд не было. Проверка условия чистоты не прошла: `git status --porcelain=v1 --untracked-files=all` возвращает непустой список (сама команда успешна).
Команды npm/build/tests не запускались, поэтому команд с подтверждённым падением build/test в этом запуске нет.
Нативные SDK, устройства, live AI и production deployment в этом preflight не проверялись. Ранее указанные в PROJECT_STATE ограничения окружения не переаттестованы. Native/production readiness не подтверждена.

## Сдача записи блокировки

Изменения QA: собственный блок ACTIVE_WORK, только строка FND-005 в TASKS, append CHANGELOG и этот отчёт. Код и конфигурации не изменялись; application tests/build намеренно не запускаются до выполнения условия заказчика. Проверка этой docs-only записи: согласованность статусов, отсутствие code/config diff, git diff --check и staged diff.

Commit записи определяется через `git log -1 --format="%H %s" -- .ai/FND-005-REPORT.md`; его SHA, фактический результат push и итоговый status передаются LEAD итоговым сообщением после выполнения Git-операций. Собственный SHA не встраивается в содержащий его commit.
Исходные DOC-001 hunks LEAD исключаются из staging QA и сохраняются в рабочем дереве. Даже успешный push отчёта не завершает FND-005: общий clean status и зависимости остаются BLOCKED.
