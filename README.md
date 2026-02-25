# Local Gantt MVP (single source of truth)

Tiny local-first MVP:
- Two-panel UI: editable task table + Gantt view.
- Autosave/restore via `localStorage`.
- Presentation features: KPI, today line, overdue highlight, status legend, zoom.
- Early guards against invalid tasks (empty title, invalid dates, start > end).

## Run locally

```bash
python3 -m http.server 4173
```

Open http://localhost:4173.
