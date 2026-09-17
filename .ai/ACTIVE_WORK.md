# Активная работа

## LEAD / ARCHITECT — FND-001 DONE / FND-005 IN_PROGRESS
- Область: корневые конфигурации, packages/contracts/**, .ai/**, интеграция.
- Прочитаны все 12 исходных MD-файлов, включая MASTER_PROMPT целиком.
- Git: main, исходный commit e84bc4e, начальное дерево чистое.
- Контракты опубликованы. BACKEND и AI передали реализацию на интеграцию; MOBILE исправляет API URL/порт и проверяет typecheck.
- npm install выполнен успешно после ограничения сетевого параллелизма; LEAD запускает сборку и тесты.
- Общие конфигурации, lockfile и .ai редактирует только LEAD. Отчёты исполнителей LEAD переносит сюда последовательно, без конфликтов.

## Резервирование после FND-001
- BACKEND / FND-002: apps/backend/** и database/**.
- MOBILE / FND-003: apps/mobile/**.
- AI ENGINEER / FND-004: packages/ai/**.
- QA/DEVOPS / FND-005: scripts/**, .github/** по согласованию с LEAD; FND-006 — независимая проверка.

## Ограничения окружения
- Windows, Node 22.23.2, npm 10.9.8, Python 3.12.2, Git 2.44.0.
- Flutter/Dart, Android SDK/adb, Gradle, Docker, psql не найдены в PATH. Java доступна.
- Нативную iOS сборку на Windows не заявлять. AI ключей в репозитории нет.
- npm metadata периодически ECONNRESET; используем подтверждённые версии и lockfile, без отключения TLS.
