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
