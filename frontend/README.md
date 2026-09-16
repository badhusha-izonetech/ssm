# Success Solar ERP — Frontend (Module 1: CEO Portal)

Frontend-only implementation for Success Solar Care, Trichy. Built with React 19, TypeScript, Vite, Tailwind CSS v4, react-router-dom, recharts, and lucide-react. No backend, database, or real API calls — all data is realistic mock data held in local component state.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Project structure

- `src/types/models.ts` — shared TypeScript interfaces (the reference contract for the backend team)
- `src/data/mockData.ts` — realistic Trichy-area mock data (employees, leads, projects, quotations, payments, stock, field movement, notifications, leave, performance, activity log, approvals)
- `src/components/shared/` — reusable UI: Layout/sidebar, DataTable, StageArc (signature sun-path stage tracker), Primitives (Card, Pill, KpiCard, Avatar, etc.)
- `src/pages/` — one file per CEO portal screen

## Module 1 scope

CEO Portal only, per the module-by-module execution protocol. See the completion report delivered alongside this ZIP for full detail.
