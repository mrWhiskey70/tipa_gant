# React + Vite + TypeScript локальный Gantt planner

Приложение для импорта Excel, редактирования задач в гриде + Gantt и экспорта обратно в Excel.

## Запуск

```bash
npm install
npm run dev
npm run build
```

## Формат Excel

Ожидается лист `TasksTable` c колонками:

- `id` (string)
- `phase` (string)
- `task` (string)
- `start` (date)
- `end` (date)
- `completion` (0..100)
- `dependencies` (строка вида `SH-1,SH-2` без пробелов или пусто)
- `status` (`ToDo` / `InProgress` / `Blocked` / `Done`)
- `sp_plan` (number)
- `sp_fact` (number)

## Что умеет

- Upload `.xlsx` через SheetJS (`xlsx`).
- Валидация: уникальность `id`, корректные даты, `end >= start`, `completion` 0..100, `status` из допустимого списка, зависимости только на существующие `id`.
- Если есть ошибки, выводится список, приложение не падает.
- KPI-карточки: SP Plan, SP Fact, Delta, Fact%.
- Две панели: слева grid по phase (сворачиваемый), справа Gantt.
- Цвета задач по status + легенда, отдельная подсветка overdue.
- Zoom: day/week/month.
- Редактирование:
  - drag&drop/resize дат на Gantt;
  - изменение completion на Gantt и в гриде;
  - inline-редактирование полей в гриде;
  - dependencies через боковую панель.
- Добавление/удаление задач.
- Autosave в `localStorage` после каждого изменения.
- При старте предлагается восстановление последней сессии.
- Download Excel c листом `TasksTable`.

## Пример

Тестовый файл: `samples/sample.xlsx` (текстовый CSV-совместимый пример с требуемыми колонками).
