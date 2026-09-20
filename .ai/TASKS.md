# Задачи — владелец LEAD / ARCHITECT

Статусы: TODO → IN_PROGRESS → REVIEW → DONE; BLOCKED при блокировке, включая невозможность commit/push или получения чистого git status. Только LEAD меняет приоритеты, зависимости, назначение и подтверждает DONE. Общие файлы не редактировать одновременно.

Критерий завершения каждой задачи с изменениями: `git status → работа → тесты/build → git diff → git add → git commit → git push → git status` по AGENTS.md, разделам 9 и 14. Commit и push обязательны; commit без push не завершает задачу. Перед commit проверяются Git identity и состав индекса; случайные, временные и чужие изменения исключаются. После push обязателен чистый статус и подтверждение отправки commits задачи. Ошибка фиксируется в `.ai/ACTIVE_WORK.md` и передаётся LEAD/заказчику; до её устранения DONE запрещён. Изменение статуса в этом файле также требует commit/push и финальной проверки чистоты.

## Текущая задача по правилам разработки

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Результат и критерий готовности |
|---|---|---|---|---|---|---|
| DOC-001 | P0 | LEAD | DONE | Прямое поручение заказчика | .ai/{ACTIVE_WORK,TASKS,PROJECT_STATE,CHANGELOG}.md | Правила ca21ac3; финальная сдача 91beb56 опубликована в origin/main, live remote SHA подтверждён, status clean. npm run check PASS (226 tests), MD diff/check PASS. LEAD подтвердил закрытие; запись статусов сдаётся отдельно по §14 |

Записи Foundation синхронизируются LEAD с опубликованными implementation commits и отчётами агентов. DOC-001 не повторяет инициализацию, не меняет код/архитектуру и не заменяет независимый Foundation gate или native-проверки.

## Foundation: исполняемый порядок

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Результат и критерий готовности |
|---|---|---|---|---|---|---|
| FND-001 | P0 | LEAD | DONE | — | package.json, tsconfig*, packages/contracts/**, .ai/** | Стек сравнен, контракты опубликованы, области ролей закреплены до параллельной реализации |
| FND-002 | P0 | BACKEND | DONE | FND-001 | apps/backend/**, database/** | Implementation 92f642f в origin/main. Отчёт BACKEND: check PASS (201 tests), compiled HTTP smoke PASS, независимый review PASS. LEAD принял после сдачи DOC-001 91beb56, общего check PASS (226 tests) и clean status |
| FND-003 | P0 | MOBILE | DONE | FND-001 | apps/mobile/** | Implementation 754d081 в origin/main. Отчёт MOBILE: check PASS (208 tests), Metro Android/iOS/web PASS, реальный HTTP/SQLite integration, независимый review PASS. LEAD принял после сдачи DOC-001 91beb56, общего check PASS и clean status; native gate остаётся отдельным |
| FND-004 | P0 | AI ENGINEER | DONE | FND-001 | packages/ai/** | Implementation 251b4fd в origin/main. Отчёт AI: check PASS (226 tests), builds/typecheck, независимый review PASS; guards/contracts/unavailable, timeout/cancellation/output validation, без DB writes. LEAD принял после сдачи DOC-001 91beb56, общего check PASS и clean status |
| FND-005 | P0 | QA/DEVOPS + LEAD | DONE | FND-002, FND-003, FND-004 | scripts/**, .github/**, apps/mobile/package.json, lockfile, .ai/** | Финальный gate на origin/main 4297502 после portability-фикса BACKEND: чистый npm ci и npm run check 226/226 PASS в переименованной чистой копии (прежний basename-blocker снят), smoke 2/2, migration apply/skip, Expo check, Metro Android/iOS/web export PASS; remote CI run 35466855284 Ubuntu/Windows success. Не-блокирующее: npm audit 12 moderate (LEAD), P2 MOBILE (MOB-001), native/live AI отдельными gates. Отчёт FND-005-REPORT.md |
| FND-006 | P0 | QA/DEVOPS | DONE | FND-005 | весь проект read-only | Независимый аудит origin/main 6c8fd84 (код Foundation неизменён с 4297502): критичных дефектов, архитектурных нарушений, проблем безопасности, разрывов интеграции Backend/Mobile/AI и fake production data не найдено. Не-блокирующее с владельцами: npm audit 12 moderate (LEAD/OPS-002), P2 MOBILE (MOB-001), backend hardening (BCK-001). Native readiness отдельно: НЕ готов (APK/IPA, device, live AI — OPS-001/OPS-002/AI-001), не блокер Foundation. Отчёт FND-006-REPORT.md. Foundation закрыт |

## Следующий цикл: завершение Foundation на устройствах

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Критерии готовности |
|---|---|---|---|---|---|---|
| OPS-001 | P0 | QA/DEVOPS | IN_PROGRESS | FND-006 ✓ | .github/**, apps/mobile native config | ЗАПУЩЕНА (цикл 1). Настроить Android SDK/JDK совместимой версии и macOS/Xcode runner; debug APK + iOS simulator build; cold launch не активирует microphone; login/logout/device persistence E2E. Владелец QA/DEVOPS-A; не пересекается с NUT-001 (backend) |
| OPS-002 | P0 | QA/DEVOPS | TODO | FND-006 ✓ | deployment config, scripts/** | ГОТОВА к запуску, но одна роль с OPS-001: брать после OPS-001 либо вторым QA/DEVOPS-агентом по согласованию с LEAD. Staging HTTPS, secret handling, backup/restore SQLite; оценить PostgreSQL migration до multi-instance; security audit зависимостей (включая 12 moderate npm audit). Разблокирует AI-001 |
| BCK-001 | P0 | BACKEND | TODO | FND-006 ✓ | apps/backend/src/auth/**, database/migrations/** | ГОТОВА, но конфликт владения database/migrations/** и роли BACKEND с активной NUT-001: брать ПОСЛЕ NUT-001 (миграция 0002 раньше 0003) либо по согласованию с LEAD последовательно. Email verification, password reset, revoke-all sessions; transport/rate-limit hardening и тесты |
| MOB-001 | P1 | MOBILE | BLOCKED | FND-003 ✓, OPS-001 ⏳ | apps/mobile/** | Ждёт OPS-001 (native runner/E2E). Device accessibility, keyboard/safe areas, восстановление сессии, offline/error UX и timezone switching regression. Отдельные P2 QA-риски: stale TodayContext после смены timezone; pending GET перезаписывает результат PATCH (useAsyncResource.setData). Требуются reproduction/regression tests, включая PreferencesContext; UI/runtime FAIL пока не подтверждён |
| AI-001 | P1 | AI ENGINEER | BLOCKED | FND-004 ✓, OPS-002 ⏳ | packages/ai/providers/** | НЕ ЗАПУСКАТЬ: ждёт OPS-002 + server-side credentials оператора и privacy review. Подключить provider; timeout/budget/retries, live structured-output contract test; без обхода consent. Разблокирует NUT-003 |
| BCK-002 | P1 | BACKEND | BLOCKED | BCK-001 ⏳ | apps/backend/**, database/migrations/** | Ждёт BCK-001. Memory CRUD/delete-all/disable и учёт consent; экспорт/удаление аккаунта, cascade tests |

## Этап 2 — питание (после Foundation gate)

| ID | Приоритет | Роль | Статус | Зависимости | Файлы | Критерии готовности |
|---|---|---|---|---|---|---|
| NUT-001 | P0 | BACKEND | IN_PROGRESS | FND-006 ✓ | database/migrations/0002_nutrition.sql, apps/backend/src/nutrition/**, apps/backend/src/routes/nutrition.ts, tests; contracts LEAD-опубликованы | ЗАПУЩЕНА (цикл 1, первый продуктовый срез). Contracts опубликованы LEAD в packages/contracts (Meal/NutritionGoal/Summary + routes nutrition/*). BACKEND: миграция 0002 (meals, nutrition_goals; FK users, CASCADE), сервис+роуты goals PUT/GET, meals POST/GET, summary GET; локальный день по timezone профиля, округление до 0.1, ownership из principal, idempotency; integration tests. Владелец BACKEND-A. Разблокирует NUT-002 |
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
