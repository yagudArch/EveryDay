# OPS-001 — native device/emulator gate checklist

This document defines exactly what the native gate proves and what it does not, so
"native readiness" is never overstated.

## Where it runs

Native artifacts and device checks cannot run on the local Windows/MINGW64 host
(no Android SDK/adb/gradle, JDK 25 not 17, no macOS/Xcode). They run on
GitHub-hosted runners via `.github/workflows/native-build.yml`:

- `android` job — ubuntu-latest, JDK 17, Android SDK → `expo prebuild -p android` →
  Gradle `assembleDebug` → uploads `everyday-android-debug-apk`.
- `android-device` job — ubuntu-latest, boots an emulator (reactivecircus/android-emulator-runner),
  runs `scripts/native/android-device-check.mjs` against the built APK.
- `ios` job — macos-latest, Xcode → `expo prebuild -p ios` → `pod install` →
  `xcodebuild` simulator build → uploads `everyday-ios-simulator-app`.

## Automated device checks (android-device job)

`scripts/native/android-device-check.mjs` performs REAL checks and writes
`device-check-report.json`. It fails the job on any failed assertion:

1. **manifest-no-microphone** — the built APK declares no `android.permission.RECORD_AUDIO`.
2. **cold-launch-process-alive** — install, force-stop, launch; process must be up and not crash.
3. **runtime-microphone-not-granted** — after cold launch, RECORD_AUDIO is not granted/held.
4. **data-dir-persists-across-restart** — app data dir exists and the app relaunches after force-stop.

## Explicit gaps (NOT proven yet — do not claim)

- **Full SecureStore login/logout/restart E2E** through the UI needs a UI driver
  (Detox or Maestro) that is not yet in the repo. Checks 2 and 4 prove the process
  and data-dir lifecycle, not the end-to-end credential round-trip in the UI.
  Adding Detox/Maestro is a follow-up (candidate for MOB-001 / a new QA task; needs LEAD).
- **Real iOS device** (as opposed to the simulator) and **App Store signing** are out of scope here.
- **Physical Android device** behaviour may differ from the emulator.

## Status gating

Creating this workflow does NOT close OPS-001. OPS-001 is closed only after the
workflow actually runs on approved runners and the artifacts + green device-check
report are produced. Until then OPS-001 stays BLOCKED pending a real run, and the
UI-driver E2E gap above remains open.
