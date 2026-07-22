# AGENTS.md

Guidance for coding agents working in this repository.

## Project summary

- **Name:** Integra Escala
- **Type:** Next.js 15 + React 19 web app
- **Goal:** Automate monthly shift scheduling for ILPIs (elderly care facilities)
- **Backend:** Supabase (Auth + Postgres + RLS)

## Repository map

- `src/app` — App Router pages, layouts, route segments
- `src/components` — UI components (shadcn/ui + custom)
- `src/lib/supabase` — Supabase browser/server/middleware clients
- `src/lib/scheduling` — schedule generation logic
- `docs/migrations` — SQL migrations to run in Supabase

## Setup and run

```bash
pnpm install
pnpm dev
```

If `pnpm` is unavailable, `npm install` and `npm run dev` are acceptable.

## Validation commands

- Lint: `pnpm lint` (or `npm run lint`)
- Build: `pnpm build` (or `npm run build`)

Run lint and build after code changes when possible.

## Coding expectations

- Keep changes focused and minimal.
- Preserve App Router conventions and existing folder structure.
- Reuse existing components/utilities before introducing new ones.
- Do not commit secrets; keep Supabase keys only in environment files.
- Keep UI responsive and compatible with desktop/mobile layouts.

## Data and security notes

- This is a multi-tenant app; avoid changes that can weaken tenant isolation.
- Respect Supabase RLS assumptions when touching auth/data flows.
- Treat schedule rules (rest windows, weekly limits, day-off rules) as business-critical constraints.

## Pull request checklist for agents

- Explain user-visible impact.
- Mention any migration, env, or configuration changes.
- Include validation results (lint/build).
- Keep documentation in sync when behavior changes.
