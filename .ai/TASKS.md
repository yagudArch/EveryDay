# Задачи — владелец LEAD / ARCHITECT

Статусы: TODO → IN_PROGRESS → REVIEW → DONE; BLOCKED при внешней зависимости. Только LEAD меняет приоритеты, зависимости и назначение. Общие файлы не редактировать одновременно.

## Foundation: исполняемый порядок

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Результат и критерий готовности |
|---|---|---|---|---|---|---|
| FND-001 | P0 | LEAD | DONE | — | package.json, tsconfig*, packages/contracts/**, .ai/** | Стек сравнен, контракты опубликованы, области ролей закреплены до параллельной реализации |
| FND-002 | P0 | BACKEND | REVIEW | FND-001 | apps/backend/**, database/** | SQLite migrations, auth/profile/preferences/context/subscription API; persistence, isolation, expiry и trial тесты |
| FND-003 | P0 | MOBILE | IN_PROGRESS | FND-001 | apps/mobile/** | Native Expo UI, navigation/design system, реальный auth/API, SecureStore, настройки и контекст; no auto-mic; typecheck и Metro bundle |
| FND-004 | P0 | AI ENGINEER | REVIEW | FND-001 | packages/ai/** | Provider port, capability/consent guards, validated structured preview, явный unavailable; unit tests; нет DB writes |
| FND-005 | P0 | QA/DEVOPS + LEAD | TODO | FND-002, FND-003, FND-004 | scripts/**, .github/**, lockfile, .ai/** | npm install/ci, build, test, mobile export, CI, diff; отчёт с честными ограничениями |
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
