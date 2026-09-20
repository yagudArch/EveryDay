# OPS-001 — native runner / Android / iOS / cold-launch / persistence

## Вердикт — 2026-09-20 — BLOCKED (окружение без native toolchain)

Роль: QA/DEVOPS. Задача OPS-001 требует: настроить Android SDK/JDK совместимый runner и macOS/Xcode runner; собрать debug APK и iOS simulator build; проверить, что cold launch не активирует микрофон; прогнать login/logout/device persistence E2E на устройстве/эмуляторе.

### Проверка окружения (собственные запуски)

| Инструмент | Ожидание OPS-001 | Факт на хосте |
|---|---|---|
| OS | Android SDK runner + macOS/Xcode runner | Windows, `MINGW64_NT-10.0-26200` — не macOS |
| Java (JDK) | JDK 17 LTS (RN 0.86 / AGP) | Temurin JDK **25.0.4** — несовместим с текущим Android Gradle |
| ANDROID_HOME / ANDROID_SDK_ROOT | заданы, указывают на SDK | **пусто (не заданы)** |
| adb | в PATH | **отсутствует** |
| sdkmanager | в PATH | **отсутствует** |
| gradle | в PATH | **отсутствует** |
| Xcode / iOS simulator | macOS | **невозможно на Windows** |
| eas.json / EAS build | опционально для облачной сборки | **отсутствует** |
| native dirs apps/mobile/android, apps/mobile/ios | генерируются prebuild | не в репозитории (managed Expo; .gitignore исключает android/, ios/) |

### Что это означает для критериев OPS-001

- **Android debug APK** — НЕ выполнено: нет Android SDK/adb/gradle и совместимого JDK. Локальная сборка невозможна; фабриковать результат нельзя.
- **iOS simulator build** — НЕ выполнено и принципиально невозможно на Windows (требуется macOS/Xcode).
- **Cold launch без микрофона на устройстве** — НЕ выполнено: нет эмулятора/устройства и adb. Статически (FND-006) подтверждено, что в коде mobile нет microphone capture/permission API и кнопка «Сказать» disabled, но это НЕ заменяет device cold-launch проверку.
- **login/logout/device persistence E2E** — НЕ выполнено на устройстве. Есть косвенное покрытие: mobile API integration (apps/mobile/src/api/foundation.test.ts) через реальный HTTP + файловую SQLite и foundation-smoke (register/login/logout/persist/restart) — это Node-уровень, НЕ device SecureStore/cold-launch.

Недоступность обязательной проверки по AGENTS.md §9/§14 и MASTER_PROMPT §48 — это блокировка, а не успешный результат. Ни APK, ни IPA, ни device E2E не были получены, поэтому OPS-001 не может быть закрыта в этой среде.

### Необходимое действие (адресат LEAD/заказчик)

Требуется одно из:
1. CI на GitHub-hosted runners: `ubuntu-latest` с `android-actions/setup-android` (SDK + JDK 17) для `expo prebuild` + Gradle `assembleDebug`; `macos-latest` с Xcode для iOS simulator build. QA может подготовить workflow, но его реальный прогон и вывод artifacts подтверждаются только после доступности Actions с нужными правами; локально этот прогон не воспроизвести.
2. Либо предоставить окружение с установленным Android SDK (ANDROID_HOME, adb, JDK 17) и macOS/Xcode для device/simulator E2E.
3. Device cold-launch (микрофон не активируется) и SecureStore persistence требуют реального устройства/эмулятора — вне текущего Windows-хоста.

До предоставления такого окружения OPS-001 остаётся BLOCKED. MOB-001 (зависит от OPS-001) остаётся BLOCKED. OPS-002 не начинается (одна роль, брать после OPS-001 по правилам TASKS).

Замечание по гигиене репозитория: обнаружен ошибочный файл `tatus --short` в корне (артефакт неудачного shell-редиректа из прошлой сессии). Требует удаления отдельным согласованным действием (владелец корня — LEAD); QA не удаляет чужой артефакт без согласования.
