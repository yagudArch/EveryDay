# FND-006 — независимый аудит Foundation (QA / DEVOPS)

## Вердикт — 2026-09-20 — PASS, критичных блокеров нет

Аудируемый код: `6c8fd847d627fe64bba00be9f547143f5189250d`, main → origin/main (local HEAD == origin/main, дерево чистое). Прикладной код Foundation не менялся после `4297502` (FND-005 PASS); `6c8fd84` — docs-only. Аудит независимый: чтение исходников по областям BACKEND/MOBILE/AI + contracts, без повторного полного прогона FND-005.

FND-005 уже подтвердил на этом коде: чистый npm ci, npm run check 226/226 в переименованной копии, smoke 2/2, migration apply/skip, Expo check, Metro Android/iOS/web export, remote CI Ubuntu/Windows success. Эти результаты не переигрываются; FND-006 оценивает дефекты/архитектуру/безопасность по коду.

### Проверенные области

| Область | Результат | Основание |
|---|---|---|
| Критичные дефекты | Не найдено | Прочитаны auth, account, ai routes; services auth/subscription/context/account; db connection/migrate/repositories; errors/validation/env |
| Архитектурные нарушения | Не найдено | Слои HTTP → application services → persistence соблюдены; provider port без DB handle; contracts — единственный источник схем для backend и mobile |
| Безопасность | Приемлемо для Foundation | Пароли scrypt + уникальная соль + timingSafeEqual; сессии opaque, хранится только SHA-256; login timing выровнен dummy hash; identity только из session principal, userId клиента отклоняется strict-схемами; ошибки без утечки SQL/stack/user text; логи redact authorization/cookie/password/email/text/dayNote/fact |
| Инъекции / eval / secrets | Не найдено | Все SQL через bound-параметры (`prepare().run/get/all`); нет eval/child_process/innerHTML в mobile/backend; нет хардкод-секретов; .gitignore покрывает .env, *.db, data/, native dirs |
| Интеграция Backend/Mobile/AI | Согласована | routes/DTO из @everyday/contracts на обеих сторонах; mobile парсит ответы Zod-схемами (расхождение → ApiError, не подмена); AI gateway ревалидирует provider output ActionPreviewSchema; disabled provider → честный 503 |
| Fake production data | Не найдено | context modules возвращают unavailable/null; goals/memory только реальные; AI preview без применения (confirmationRequired), без DB writes; test provider только в *.test.ts и smoke |
| Trial / subscription | Корректно | 7×24ч half-open, entitlement всегда пересчитывается по серверному времени; клиент не может изменить entitlement (PATCH → 404) |
| Privacy / consent / микрофон | Соблюдено | aiConsent и memoryEnabled default false; AI outbound только {schemaVersion,date,timezone,text}; в mobile нет microphone capture/permission, кнопка «Сказать» disabled |
| CORS / rate limit / транспорт | Приемлемо для Foundation | Loopback по умолчанию, CORS allowlist (`*` только по явному opt-in), helmet, global + стрикт credential rate limiter, bodyLimit 64KB, register/login cache-control no-store |

### Не-блокирующие пункты (переданы LEAD для следующего цикла, вне критериев Foundation gate)

1. **npm audit — 12 moderate** (Vitest mocker GHSA-82fw-gwwq-j7x9 в dev-tooling; uuid GHSA-w5hq-g745-h8pq через xcode/Expo config tooling). Не runtime backend/mobile; `audit fix --force` тянет breaking downgrade. Владелец LEAD/OPS-002 (dependency/security).
2. **P2 MOBILE (MOB-001):** useAsyncResource.setData не инвалидирует pending GET (запоздалый GET перезаписывает PATCH); Home не перезагружает TodayContext при смене timezone. Статический аудит, runtime reproduction не выполнялся. Владелец MOBILE.
3. **HomeScreen формулировка «Сейчас гардероб пуст»** при contract-статусе unavailable — предпочтительно «нет данных»/unknown. Не выдумывание данных, косметика. Владелец MOBILE.
4. **Backend hardening (BCK-001):** email verification, password reset, revoke-all sessions, transport/rate-limit hardening — до публичного запуска.

### Native readiness — отдельный вердикт

НЕ готов к native release, и это не блокер Foundation (по ARCHITECTURE Metro export ≠ APK/IPA). Не подтверждены и вынесены в OPS-001/OPS-002/MOB-001:
- Android SDK/adb и ANDROID_HOME отсутствуют; iOS требует macOS/Xcode; APK/IPA не собирались.
- Device SecureStore, cold-launch (микрофон не активируется), session persistence на устройстве — не проверялись на железе.
- Live AI provider не подключён (AI-001); production HTTPS/secrets/backup/restore — OPS-002.

### Заключение

Обязательные критерии FND-006 выполнены: критичных дефектов, архитектурных нарушений, проблем безопасности, разрывов интеграции и fake production data в текущем origin/main не обнаружено. Реальных оставшихся блокеров Foundation нет. Оставшиеся пункты не-блокирующие и уже имеют владельцев в TASKS. Foundation закрывается; проект передаётся LEAD для запуска продуктового цикла (этап 2 — питание). FND-006 → DONE. Следующие задачи QA не начинает.
