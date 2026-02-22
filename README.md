# React + Vite + TypeScript локальный Gantt planner

Локальное (без backend) приложение для импорта Excel, редактирования задач и экспорта обратно в Excel.

## Запуск

```bash
npm install
npm run dev
npm run build
```

## Если видите белый экран

В новой версии добавлен `ErrorBoundary` и `Errors panel`. Если при импорте есть проблемы с данными, приложение **не падает**: смотрите сообщения в `Errors panel` и исправьте строки в Excel.

## Формат Excel

Ожидается лист `TasksTable` со столбцами:

- `id` (обязательный string, уникальный)
- `phase` (string)
- `task` (string)
- `start` (date: Date / Excel serial / ISO / `dd.mm.yyyy`)
- `end` (date: Date / Excel serial / ISO / `dd.mm.yyyy`, и `end >= start`)
- `completion` (0..100)
- `dependencies` (строка вида `SH-1,SH-2` без пробелов или пусто)
- `status` (`ToDo` / `InProgress` / `Blocked` / `Done`)
- `sp_plan` (number, пусто = 0)
- `sp_fact` (number, пусто = 0)

## Что реализовано

- Устойчивый рендер: Gantt отображается только когда есть валидные `safeTasks`.
- Empty State, если валидных задач нет: “Загрузите .xlsx с листом TasksTable”.
- Импорт через SheetJS (`cellDates: true`) + расширенная валидация.
- Ошибки/предупреждения импорта в UI (строка/колонка), без падения.
- KPI-карточки: SP Plan, SP Fact, Delta, Fact%.
- Слева grid (группировка по `phase`, сортировка по `start`), справа Gantt.
- Цвета задач по статусу, легенда, today line, подсветка overdue.
- Редактирование (inline + Gantt drag/resize/progress), dependencies через боковую панель.
- Добавление и удаление задач.
- Autosave в `localStorage` + восстановление сессии.
- Экспорт обратно в `.xlsx` с листом `TasksTable`.
- Кнопка `Load sample` грузит `public/samples/sample.xlsx`.

## Sample

- `public/samples/sample.xlsx` — файл для демо-импорта через UI.
- `samples/sample.xlsx` — копия для репозитория/тестов.
