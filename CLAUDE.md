# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TravelTrax is a personal travel expense and loyalty-points tracker: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + Supabase. See `AGENTS.md`: this Next.js version has breaking changes, so read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. `next dev` keeps rewriting `AGENTS.md`; commit it rather than reverting it.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint    # type check only (tsc --noEmit); there is no ESLint
```

There is no test suite.

Without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.example`), the app runs in **demo mode**: sample data, stored in `localStorage` only. This is the fastest way to run and check UI changes.

## Architecture

**Everything runs on the client.** Every page and component is a `"use client"` module. There are no API routes, server actions or server-side data fetching. The browser talks to Supabase directly, and row-level security (`user_id = auth.uid()`) is the only access control.

**Data layer (`src/lib/`):**
- `backend.ts` defines a `Backend` interface with two implementations: `supabaseBackend` (paginated 1000-row loads, inserts in batches of 500) and `demoBackend` (`localStorage` key `traveltrax-demo-v2`, seeded from `sample.ts`). The mode is chosen once, depending on whether the Supabase env vars are set. Any new persistence operation must be added to **both** implementations.
- `store.tsx` is the `DataProvider` / `useStore()` React context, mounted in `app/layout.tsx`. It loads all of a user's trips and expenses into memory, writes to the backend first and then updates local state, and handles auth plus the redirect to `/login` in Supabase mode. It reloads when the tab becomes visible again. Pages read from and write to this store; they don't call the backend directly.
- `calc.ts` → `summarize()` / `summarizeByTrip()` compute every total. Do the math here, not in components. Its **double-counting rule** is central: if a category has any `category_total` entries, those totals *are* the category's totals and its `transaction` / `additional` entries are shown as "included" but not added. Otherwise the category total = transactions + additional. Points follow the same rule, and `overflow` flags itemized entries that exceed the declared total.
- Dollars spent for an entry = `amount` (cash) + `fees` + `baggage` (`dollars()` in `calc.ts`). Points are tracked separately, per `program`.
- `types.ts` defines categories, entry types and the points-program lists. The internal category keys differ from their labels (`lodging` = "Hotel", `transport`, `other` = "Food, shopping & other"). Legacy `food` / `shopping` values are folded into `other` by `normCategory()` when data loads.
- `spreadsheet.ts` handles CSV/XLSX import parsing (ExcelJS) and export. The import UI (column mapping, preview, splitting rows into trips) is in `app/import/page.tsx`.

**UI:** The routes are `/` (dashboard), `/trips/[id]`, `/import` and `/login`. Expenses are added through the step-by-step `AddExpenseWizard`; `ExpenseForm` is used for editing. Each flight leg (departing and return) is a separate expense; a hotel stores its check-out date in `end_date`. Shared building blocks (modal, charts, stat boxes, export menu) are in `components/ui.tsx`. Destination autocomplete (`PlaceInput`) calls `photon.komoot.io` (no API key needed).

**Styling:** Design tokens are CSS variables in `app/globals.css`, exposed through Tailwind `@theme` as `bg-surface`, `text-muted`, `border-edge`, `accent`, and so on. Prefer these tokens over raw colors. Dark mode is class-based (`.dark` on `<html>`), set by an inline script in `layout.tsx` and the toggle in `AppShell`.

## Database changes

`supabase/schema.sql` is the full schema for new projects, and it ends with idempotent `alter table ... add column if not exists` statements. For a schema change, update `schema.sql`, add a numbered migration in `supabase/migrations/`, add the column to `expenseCols`/`tripCols` and `clean()` in `backend.ts`, update `types.ts`, and handle missing values in demo data and in imports and exports. Migrations are run by hand in the Supabase SQL editor, so call out new ones in commit messages.

## Deploy

Vercel deploys production from `main`, with the two `NEXT_PUBLIC_SUPABASE_*` env vars set. Features deliberately left out of V1 (AI features, bank integrations, budgets, currency conversion, receipt scanning, point valuations) are listed in the README.
