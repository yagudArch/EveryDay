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

### Обновление — 2026-09-23 — native workflow подготовлен, ожидается реальный прогон

Реализовано (зона QA/DEVOPS, .github/workflows + scripts/native):
- `.github/workflows/native-build.yml` (workflow_dispatch): job **android** (ubuntu-latest, JDK17 temurin, android-actions/setup-android, `npm ci`, `expo prebuild -p android --no-install`, Gradle `assembleDebug`, upload APK artifact); job **android-device** (эмулятор reactivecircus/android-emulator-runner API 34, скачивает APK, гоняет device-check, грузит report); job **ios** (macos-latest, Xcode, `expo prebuild -p ios`, `pod install`, `xcodebuild -sdk iphonesimulator` CODE_SIGNING_ALLOWED=NO, упаковка и upload .app artifact).
- `scripts/native/android-device-check.mjs` — реальные проверки на эмуляторе (не фабрикуются): (1) манифест APK без RECORD_AUDIO; (2) cold launch — процесс жив/не падает; (3) runtime RECORD_AUDIO не granted; (4) data-dir переживает force-stop+relaunch. Пишет device-check-report.json, падает при любом FAIL.
- `scripts/native/device-checklist.md` — что gate доказывает и что НЕТ.

Локально проверено: `node --check` скрипта PASS; YAML разбирается (jobs android/android-device/ios, on: workflow_dispatch); `npm run check` 260/260 PASS (feature-код не менялся).

ЯВНОЕ ОГРАНИЧЕНИЕ (не фабрикую device E2E):
- Реальный прогон workflow и создание artifacts НЕ подтверждены в этой среде: нет `gh` CLI, нет GH_TOKEN/GITHUB_TOKEN, workflow только `workflow_dispatch` (push его не запускает). Триггер и проверка artifacts возможны лишь после доступа к Actions с правами (оператор/LEAD запускает вручную или включает pull_request-триггер).
- Полный SecureStore login/logout/restart E2E через UI требует UI-драйвера (Detox/Maestro), которого в репозитории нет; текущий device-check покрывает manifest/permission/process/data-dir lifecycle, но не UI-раунд-трип логина. Это отдельный follow-up (кандидат в MOB-001 или новую QA-задачу; решает LEAD).

Итог: OPS-001 остаётся **BLOCKED** — создание workflow не закрывает native gate. Закрытие возможно только после зелёного реального прогона (APK + iOS simulator .app + device-check report) на одобренных runner'ах. Передано LEAD для запуска native-прогона.
