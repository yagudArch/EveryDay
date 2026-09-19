# Задачи — владелец LEAD / ARCHITECT

Статусы: TODO → IN_PROGRESS → REVIEW → DONE; BLOCKED при блокировке, включая невозможность commit/push или получения чистого git status. Только LEAD меняет приоритеты, зависимости, назначение и подтверждает DONE. Общие файлы не редактировать одновременно.

Критерий завершения каждой задачи с изменениями: `git status → работа → тесты/build → git diff → git add → git commit → git push → git status` по AGENTS.md, разделам 9 и 14. Commit и push обязательны; commit без push не завершает задачу. Перед commit проверяются Git identity и состав индекса; случайные, временные и чужие изменения исключаются. После push обязателен чистый статус и подтверждение отправки commits задачи. Ошибка фиксируется в `.ai/ACTIVE_WORK.md` и передаётся LEAD/заказчику; до её устранения DONE запрещён. Изменение статуса в этом файле также требует commit/push и финальной проверки чистоты.

## Текущая задача по правилам разработки

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Результат и критерий готовности |
|---|---|---|---|---|---|---|
| DOC-001 | P0 | LEAD | REVIEW | Прямое поручение заказчика | MASTER_PROMPT.md, AGENTS.md, agent-roles/*.md, .ai/{ACTIVE_WORK,TASKS,PROJECT_STATE,CHANGELOG}.md | Согласованные обязательные Git/DoD-правила; только MD-изменения; проверки; commit `docs: enforce agent git workflow`; успешный push; чистый git status |

Записи Foundation ниже сохранены из первичной инициализации; DOC-001 не запускает её заново, не меняет архитектуру и не переоценивает готовность feature/native-задач.

## Foundation: исполняемый порядок

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Результат и критерий готовности |
|---|---|---|---|---|---|---|
| FND-001 | P0 | LEAD | DONE | — | package.json, tsconfig*, packages/contracts/**, .ai/** | Стек сравнен, контракты опубликованы, области ролей закреплены до параллельной реализации |
| FND-002 | P0 | BACKEND | BLOCKED | FND-001 | apps/backend/**, database/** | Аудит и исправления готовы к REVIEW; npm run check PASS (201 tests), compiled HTTP smoke PASS. Финальный clean status блокируют исходные DOC-001 hunks LEAD; подробности в ACTIVE_WORK. DONE подтверждает LEAD после Git-сдачи |
| FND-003 | P0 | MOBILE | BLOCKED | FND-001 | apps/mobile/** | Mobile Foundation проверена: check PASS (208 tests), Metro Android/iOS/web PASS, реальный HTTP/SQLite integration. Git-сдача и clean status ожидаются; исходные DOC-001 hunks LEAD требуют отдельной сдачи. Подробности ACTIVE_WORK; DONE подтверждает LEAD |
| FND-004 | P0 | AI ENGINEER | BLOCKED | FND-001 | packages/ai/** | Аудит готов к REVIEW: provider port/guards/contracts/unavailable, нет DB writes; исправлены timeout/cancellation/status/output validation. check PASS: 226 tests, builds/typecheck; независимый review PASS. Clean status блокируют исходные DOC-001 hunks LEAD; подробности ACTIVE_WORK. DONE подтверждает LEAD |
| FND-005 | P0 | QA/DEVOPS + LEAD | BLOCKED | FND-002, FND-003, FND-004 | scripts/**, .github/**, lockfile, .ai/** | Preflight: commits зависимостей опубликованы в origin/main, но все три задачи BLOCKED; DOC-001 hunks LEAD не сданы, clean status отсутствует. Foundation gate не запускался. См. ACTIVE_WORK и FND-005-REPORT.md; требуется завершение зависимостей LEAD |
| FND-006 | P0 | QA/DEVOPS | TODO | FND-005 | весь проект read-only | Независимый аудит, критичные дефекты устранены; отдельный вердикт о native readiness |

## Следующий цикл: завершение Foundation на устройствах

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Критерии готовности |
|---|---|---|---|---|---|---|
| OPS-001 | P0 | QA/DEVOPS | TODO | FND-006 | .github/**, apps/mobile native config | Настроить Android SDK/JDK совместимой версии и macOS/Xcode runner; debug APK + iOS simulator build; cold launch не активирует microphone; login/logout/device persistence E2E |
| BCK-001 | P0 | BACKEND | TODO | FND-006 | apps/backend/src/auth/**, database/migrations/** | Email verification, password reset, revoke-all sessions; transport/rate-limit hardening и тесты; до публичного запуска |
| OPS-002 | P0 | QA/DEVOPS | TODO | FND-006 | deployment config, scripts/** | Staging HTTPS, secret handling, backup/restore SQLite; оценить PostgreSQL migration до multi-instance; security audit зависимостей |
| MOB-001 | P1 | MOBILE | TODO | FND-003, OPS-001 | apps/mobile/** | Device accessibility, keyboard/safe areas, восстановление сессии, offline/error UX и timezone switching regression |
| AI-001 | P1 | AI ENGINEER | BLOCKED | FND-004, OPS-002 | packages/ai/providers/** | Подключить выбранный оператором provider после выдачи server-side credentials и privacy review; timeout/budget/retries, live structured-output contract test; без обхода consent |
| BCK-002 | P1 | BACKEND | TODO | BCK-001 | apps/backend/**, database/migrations/** | Memory CRUD/delete-all/disable и учёт consent; экспорт/удаление аккаунта, cascade tests |

## Этап 2 — питание (после Foundation gate)

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Критерии готовности |
|---|---|---|---|---|---|---|
| NUT-001 | P0 | BACKEND | TODO | FND-006 | database/migrations/**, apps/backend/src/nutrition/**; contracts через LEAD | Нормализованные meals/nutrition_entries/goals, CRUD, единицы/округления, локальный день, idempotency; integration tests |
| NUT-002 | P0 | MOBILE | TODO | NUT-001, MOB-001 | apps/mobile/src/features/nutrition/** | Цель → ручной приём пищи → реальные КБЖУ; loading/error/empty; UI не подменяет API |
| NUT-003 | P1 | AI ENGINEER | TODO | NUT-001, AI-001 | packages/ai/** | Текстовый meal parser, confidence, missing quantity clarification, multi-action preview; без выдуманных нутриентов |
| NUT-004 | P1 | BACKEND | TODO | NUT-003 | apps/backend/src/actions/**, database/migrations/** | Confirm/apply с ownership, idempotency, rollback и audit; provider не пишет DB |
| NUT-005 | P1 | MOBILE | TODO | NUT-004, OPS-001 | apps/mobile/src/features/voice/** | Explicit voice capture/STT, grouped confirmation, cancel, permissions; cold launch silent; shortcuts только после native gates |
| NUT-006 | P0 | QA/DEVOPS | TODO | NUT-002, NUT-004, NUT-005 | integration/E2E tests | Регистрация → цель → еда → КБЖУ; ambiguous actions не сохраняются без confirmation; timezone и ownership regression |

## Последующие этапы, не начинать параллельно с Foundation

| ID | Роль | Приоритет | Статус | Зависимость | Область | Критерий |
|---|---|---|---|---|---|---|
| FOOD-001 | BACKEND → MOBILE → AI ENGINEER → QA/DEVOPS | P1 | TODO | NUT-006 | food_inventory, recipes, shopping_* | Реальные продукты → рецепт → подтверждённый список покупок, сквозной тест |
| WTH-001 | BACKEND → AI ENGINEER → MOBILE → QA/DEVOPS | P1 | TODO | FOOD-001 | weather, wardrobe_items, outfits | Реальный прогноз; abstract/real различаются; empty wardrobe test |
| ACT-001 | MOBILE + BACKEND + QA/DEVOPS | P1 | TODO | WTH-001 | activities, native health | Явное разрешение, ручной fallback, дедупликация, timezone tests |
| DAY-001 | BACKEND + MOBILE + AI ENGINEER | P1 | TODO | ACT-001 | events, daily_context | Общий контекст всех реализованных модулей; приоритет питания без fake data |
| CHG-001 | AI ENGINEER + BACKEND + QA/DEVOPS | P1 | TODO | DAY-001 | daily_snapshots, changes | Смысловые изменения с объяснимым источником, не простой JSON diff |
| AST-001 | AI ENGINEER + MOBILE + BACKEND | P1 | TODO | CHG-001 | ai_conversations/messages/actions | Tool-based assistant использует реальные read services и confirmed write services |
| REL-001 | QA/DEVOPS + MOBILE + BACKEND | P1 | TODO | AST-001 | release, subscriptions, privacy | Billing/restore, accessibility, performance, offline, security; MVP сценарии MASTER_PROMPT |

LEAD декомпозирует последующие эпики на однозначно назначенные задачи перед их запуском; это не разрешение всем ролям менять одну область одновременно.
