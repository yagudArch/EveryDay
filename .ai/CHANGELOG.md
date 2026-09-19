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
