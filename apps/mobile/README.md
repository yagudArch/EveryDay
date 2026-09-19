# @everyday/mobile — «Каждый день»

Мобильное приложение (iOS / Android) на Expo SDK 57 + React Native + TypeScript.
Foundation (FND-003): навигация, design system, реальный auth/API, SecureStore, настройки и
контекст дня. Продуктовые модули (питание, погода, активность, AI actions) ещё не
реализованы и показаны честными состояниями «данных нет».

## Команды

Из корня репозитория (npm workspaces):

```bash
npm run start -w @everyday/mobile      # expo start (dev server)
npm run typecheck -w @everyday/mobile  # tsc --noEmit
npm run export -w @everyday/mobile     # expo export --platform all (android/ios/web bundles)
npm test                               # vitest run из корня (включает apps/mobile/src/**/*.test.ts)
```

Внутри `apps/mobile` те же команды: `npm start` (expo start), `npm run typecheck`, `npm run export`, `npm test`.

Порядок для чистой машины: `npm install` → `npm run build -w @everyday/contracts` (нужно для
`tsc`/Metro, если пакет не собран) → `npm run typecheck -w @everyday/mobile` → `npm run export -w @everyday/mobile`.

## Переменные окружения

`.env` в `apps/mobile` (шаблон — `.env.example`):

| Переменная | Значение |
|---|---|
| `EXPO_PUBLIC_API_URL` | origin backend **без** пути, например `http://10.0.2.2:3000` |

Правила (реализованы в `src/config/apiBase.ts` и покрыты тестами):

- development, переменная не задана → fallback `http://10.0.2.2:3000` (Android emulator) или `http://localhost:3000` (iOS simulator, web), с предупреждением в логе;
- production (`__DEV__ === false`) → переменная **обязательна** и должна быть HTTPS;
- HTTP разрешён только для loopback и адресов эмулятора (`localhost`, `127.0.0.1`, `::1`, `10.0.2.2`, `10.0.3.2`);
- пути/query в значении запрещены: `/api/v1` уже содержится в `packages/contracts` (`routes`);
- при некорректной конфигурации приложение показывает экран ошибки конфигурации и **не** ходит в выдуманный API.

## API-клиент

- `src/api/client.ts` — платформенно-независимый HTTP-клиент: bearer-токен, timeout 15 c, разбор тела ответа через схемы `packages/contracts`, `ApiError` с `code/status/requestId/retryable`, обработка 401 (очистка сессии) и сетевых ошибок.
- `src/api/endpoints.ts` — только контрактные routes и схемы (`@everyday/contracts`), без дублирования путей и полей.
- `src/api/session.ts` — токен и `expiresAt` в памяти процесса; на 401 AuthContext очищает контекст пользователя.
- `src/storage/tokenStorage.ts` — native: `expo-secure-store`; **web preview: только память**, без localStorage-fallback и без имитации защищённого хранилища.

## Навигация

- Вкладки: **Главная → Питание → Еда и покупки → Активность → AI** (порядок соответствует приоритету питания: питание сразу после главной).
- Отдельный экран **Настройки** (из хедера главного экрана) — профиль, тема, локаль, часовой пояс, город, приватность, диагностика, выход.
- Обычный запуск никогда не активирует микрофон; кнопка «Сказать» отключена с объяснением (голос — этап NUT-005).

## Design system

`src/theme/tokens.ts` (light/dark токены, spacing, радиусы, типографика) + `ThemeProvider`
(`system/light/dark` из серверных настроек) + базовые компоненты `Button`, `Card`, `TextField`,
`Screen`, `ConfirmDialog`, состояния `LoadingState/ErrorState/EmptyState/ModulePlaceholder`.
Минимальная зона нажатия 48 pt, тексты используют системное масштабирование, у интерактивных
элементов заданы `accessibilityRole/Label/Hint/State`.

## Данные и честность состояний

- Экран «Главная» работает с реальным `GET /api/v1/context/today`: дата, часовой пояс, город, trial/подписка, заметка дня (`PATCH /api/v1/context/today`) и статусы модулей от backend.
- Не реализованные модули показывают «нет данных» и этап реализации. Примерные продукты, погода, КБЖУ, тренировки и «примерные» рекомендации не отображаются никогда.
- AI-экран использует реальные `GET /api/v1/ai/status` и `POST /api/v1/ai/parse`: показывается провайдер, флаг `configured` и preview действий без сохранения. Если провайдер не подключён — честная ошибка сервиса, без mock-ответов.
- Согласие на внешний AI (`aiConsent`) по умолчанию `false` и включается только через явный диалог подтверждения; `memoryEnabled` тоже `false` по умолчанию.

## Тесты

Чистые TS-модули покрыты Vitest и не требуют native runtime:
`src/config/apiBase.test.ts`, `src/api/client.test.ts`, `src/api/session.test.ts`,
`src/storage/tokenStorage.test.ts`, `src/utils/asyncState.test.ts`, `src/utils/timezone.test.ts`,
`src/utils/subscription.test.ts`, `src/features/auth/validation.test.ts`, `src/theme/tokens.test.ts`.

`src/api/foundation.test.ts` проверяет mobile API-клиент через настоящий HTTP и временную
файловую SQLite: регистрацию, профиль, preferences, контекст, logout и повторный login.
Перед ним необходим `npm run build`; `npm run check` выполняет этот шаг автоматически.
Это проверка API-интеграции, а не device E2E или проверка native SecureStore.

Регрессии FND-003: timeout действует до завершения чтения тела ответа; 401 публичного
endpoint или старого токена не сбрасывает новую сессию; успешные ответы предыдущей
сессии отклоняются. Токен активируется только после успешной записи в хранилище.

## Идентификаторы и CNG

- Отображаемое имя: **Каждый день**; slug `everyday`; scheme `everyday`.
- Временный dev-идентификатор приложения: `com.everyday.app.dev` (iOS `bundleIdentifier`, Android `package`). Перед публикацией его нужно заменить на production-идентификатор, поэтому `.dev`-суффикс указан явно.
- Проект использует Expo CNG: `apps/mobile/android` и `apps/mobile/ios` не хранятся в репозитории и не создаются без необходимости (`npx expo prebuild` запускается только на машине с нужным SDK).
- `apps/mobile/metro.config.js` включает `watchFolders` для npm workspaces и резолвит `@everyday/contracts` из исходника `packages/contracts/src/index.ts` (тот же файл, что в `tsconfig.paths`).

## Подтверждённые версии зависимостей

Проверено через `npm view` на момент FND-003 (npm official Expo-шаблон: `expo ~57.0.23`,
`expo-status-bar ~57.0.1`, `@types/react ~19.2.2`):

| Пакет | Версия |
|---|---|
| expo | 57.0.23 |
| expo-status-bar | 57.0.1 |
| expo-secure-store | 57.0.4 |
| @expo/metro-runtime | 57.0.15 |
| react / react-dom | 19.2.3 |
| react-native | 0.86.3 |
| react-native-web | 0.21.2 (`~0.21.0`) |
| react-native-safe-area-context | ~5.7.0 (согласовано с expo install --check) |
| react-native-screens | ~4.26.0 (согласовано с expo install --check) |
| @react-navigation/native | 7.4.1 |
| @react-navigation/bottom-tabs | 7.19.1 |
| @react-navigation/native-stack | 7.19.1 |
| @types/react | 19.2.18 (`~19.2.2`) |
| typescript | ~6.0.3 (из корня workspaces) |

## Ограничения Foundation

- `expo export --platform all` — это Metro-бандлы, **не** APK/IPA. Нативные сборки требуют Android SDK/JDK и macOS/Xcode (задача OPS-001).
- На Windows нативная iOS-сборка не выполнялась и не заявляется.
- Провайдер AI не подключён (нет ключей); голосовой ввод, здоровье, геолокация и уведомления не реализованы, соответствующие разрешения не запрашиваются.
- Дизайн без иконок из icon-пакетов: вкладки подписаны текстом, изображения/ассеты не добавлены.
