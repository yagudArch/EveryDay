# Архитектура «Каждый день»

## Решение LEAD — Foundation

Требования: MASTER_PROMPT.md, особенно разделы 34–38 и этап 1 раздела 42. Этапы внедрения берём из раздела 42: Foundation → питание → продукты/рецепты/покупки → погода/образ → активность → план дня → изменения → AI Assistant → polish. Это порядок разработки, не изменение продуктового приоритета питания.

### Сравнение mobile stack

| Вариант | Пригодность | Ограничение текущего окружения | Решение |
|---|---|---|---|
| Flutter | Общий UI и бизнес-логика, отдельный Dart SDK | Flutter/Dart отсутствуют; отдельный язык контрактов | Не выбран |
| React Native + Expo | Общий TypeScript с backend и runtime-контрактами; Android/iOS; Metro можно проверить без Android SDK | Для нативных SDK, widgets, Health и signing потребуются development builds и native tooling | Выбран |
| Kotlin Multiplatform | Общая Kotlin-логика и возможность native UI/Compose, прямые platform integrations | Нет Gradle/Android SDK; iOS требует Apple toolchain; нет общего TS-контракта без генерации | Не выбран |

Документация проверена при INITIALIZATION:
- https://docs.expo.dev/versions/latest/
- https://kotlinlang.org/docs/multiplatform/kotlin-multiplatform-react-native.html
- https://docs.flutter.dev/install/manual
- https://nodejs.org/api/sqlite.html

### Технический стек
- npm workspaces, TypeScript strict, единый lockfile.
- apps/mobile: React Native / Expo SDK 57; React 19.2.3, RN 0.86.3 по официальному blank-typescript шаблону. Native приложение, web только дополнительная проверочная цель.
- apps/backend: Node 22.23.2, Fastify, REST /api/v1, модульный монолит. Границы HTTP → application services → persistence, без микросервисов на Foundation.
- database: SQLite через node:sqlite с foreign keys, WAL, транзакциями и версионированными SQL-миграциями. Это реальная файловая реляционная БД, не in-memory подмена runtime. node:sqlite в Node 22 имеет экспериментальный статус; runtime закреплён. Однопроцессная Foundation-среда, не обещание production-scale.
- PostgreSQL — целевой кандидат перед multi-instance deployment, но сейчас НЕ реализован и НЕ обозначается как работающий. Переход отдельной задачей с миграцией данных и integration suite.
- packages/contracts: Zod runtime schemas, TS DTO и централизованные HTTP route constants; сервер и mobile обязаны использовать их.
- packages/ai: независимый от UI и DB provider port; capability checks; disabled provider по умолчанию; никаких выдуманных ответов при отсутствии ключей.

## Контуры и ownership

```text
apps/mobile -> packages/contracts <- apps/backend
                                      |      |
                               packages/ai   database/migrations
```

LEAD владеет contracts, корневым package.json/lockfile, .ai. BACKEND — apps/backend и database. MOBILE — apps/mobile. AI ENGINEER — packages/ai. QA/DEVOPS — scripts и .github; независимый аудит после интеграции.

Будущие доменные таблицы из MASTER_PROMPT не реализуем пустой имитацией модулей. Foundation создаёт users, sessions, user_preferences, user_preference_values, user_goals, user_memory, daily_context, subscriptions. Дальнейшие миграции добавят daily_snapshots, changes, wardrobe_items, outfits, outfit_feedback, food_items, food_inventory, recipes, meals, nutrition_entries, shopping_lists, shopping_items, activities, events, ai_conversations, ai_messages, ai_actions.

## API Foundation

- GET /api/v1/health — доступность сервера/БД.
- POST /api/v1/auth/register — account + preferences + trial в одной транзакции.
- POST /api/v1/auth/login — opaque bearer session.
- POST /api/v1/auth/logout — отзыв текущей сессии.
- GET /api/v1/me; PATCH /api/v1/me — профиль текущего пользователя.
- GET /api/v1/preferences; PATCH /api/v1/preferences — настройки, timezone, ограничения, consent.
- GET /api/v1/context/today; PATCH /api/v1/context/today — общий контекст и явная заметка дня.
- GET /api/v1/subscription — вычисленное entitlement.
- GET /api/v1/ai/status; POST /api/v1/ai/parse — возможности / validated preview; без провайдера честный 503, не mock-success.
- GET /api/v1/openapi.json — документ контракта (реализуется при интеграции).

Ошибки: {error:{code,message,requestId}}. Даты ISO-8601 UTC; локальная дата дня вычисляется на сервере по timezone профиля. Все private endpoints используют principal сессии, не принимают userId клиента. Незнакомые поля отклоняются. Секреты и пользовательские тексты не логируются.

## Auth, privacy, subscription

Пароли: async scrypt + уникальная соль, constant-time comparison. Session token: криптографически случайный, в БД только SHA-256, срок действия и отзыв. Это осознанный отказ от JWT/refresh complexity на Foundation. Native storage — SecureStore; web preview — только память. При недействительной сессии клиент очищает пользовательский контекст. HTTPS обязателен для удалённого production API; localhost HTTP только development.

Trial: 7 × 24 часа от регистрации по серверным UTC timestamps; start <= now < end. Статусы trial, active, expired_trial, expired_subscription, cancelled, grace. Платёжные webhook, restore и billing UI пока не включены; клиент не может менять entitlement.

AI external consent по умолчанию false. Memory выключена по умолчанию. Нет скрытого включения микрофона, health или геолокации. В Foundation microphone permission не запрашивается вообще.

## Общий контекст и AI

Контекст объединяет только реальные profile/preferences/goals/subscription/заметку дня и известные memory facts. Неизвестные доменные данные обозначаются unavailable/null, а не нулевым рационом или вымышленной погодой.

AI pipeline: явный ввод → capability/consent → provider → Zod structured output → preview с confirmationRequired=true. Ни provider, ни pipeline не получают DB handle. Применение действий — будущий application service с ownership, idempotency, транзакцией и журналом после подтверждения. Foundation НЕ исполняет AI actions.

Provider port резервирует text, vision, STT, structured output, embeddings и tools. Реальных model identifiers и ключей в клиенте нет. Базовый disabled provider должен выдавать явную unavailable ошибку, test doubles допустимы только в тестах.

## Готовность

Foundation проверяется компиляцией TS, API integration tests на реальной SQLite, cross-user auth tests, trial boundary tests, AI schema/consent tests и Metro export. Metro bundle не равен APK/IPA. Native/device E2E, production deployment, backup/restore и живой AI являются отдельными воротами готовности.

