# Contributing to Integra Escala

Thanks for your interest! This doc covers everything you need to get started.

---

## Local setup

Integra Escala uses **PGlite** — a WASM-powered PostgreSQL embedded in the browser, persisting data via IndexedDB. No Docker, no cloud service, no external database. Everything runs locally with one command.

### Prerequisites

- **Node.js** 18+
- **pnpm** (preferred) or npm / yarn

### Steps

```bash
# 1. Clone
git clone https://github.com/claudioorjunior/integra-escala.git
cd integra-escala

# 2. Install
pnpm install

# 3. No .env needed
# PGlite runs in-browser via IndexedDB. No Supabase, no external infra.
# The app works out of the box — just start the dev server.

# 4. Run
pnpm dev

# 5. Access the app at http://localhost:3000
```

### Available scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript type check (`tsc --noEmit`) |
| `pnpm test` | Run schema validation tests |

---

## Migration system

The database schema is managed by **inline migrations** in `src/lib/migrations.ts`. Migrations run automatically when the app starts.

### How it works

1. On first load, PGlite creates the database in IndexedDB (`idb://integra-escala-db`).
2. The app checks a `schema_migrations` table for already-applied migrations.
3. Unapplied migrations run in order (001 → 002 → 003).
4. Each migration is tracked by name, so re-runs are idempotent.

### Migration files

SQL source files live in `docs/migrations/` for reference:

| File | Description |
|---|---|
| `001_schema.sql` | Core schema: ILPIs, cargos, colaboradores, escala_meses, escala_dias, usuarios, usuario_ilpi, RLS policies |
| `002_security_hardening.sql` | Security fixes: INVOKER permissions, audit_log table, revoke PUBLIC grants |
| `003_convite_token.sql` | Token-based invite flow: convites table, aceitar_convite / revogar_convite functions |

### Adding a new migration

1. Create a new `.sql` file in `docs/migrations/` (e.g. `004_feature_x.sql`).
2. Import it into `src/lib/migrations.ts` by adding an entry to the `MIGRATIONS` array.
3. The migration runs automatically on next app load.

### Seed data

The app bootstraps its first user on signup via `handle_new_user()` trigger in migration 001. For development, you can create a user through the `/cadastro` page and the app will auto-create the necessary ILPI association.

---

## Project structure

```text
integra-escala/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── cadastro/        # User registration
│   │   ├── cargos/          # Role management
│   │   ├── colaboradores/   # Collaborator management
│   │   ├── config/          # ILPI configuration
│   │   ├── dashboard/       # Main scale dashboard
│   │   └── login/           # Authentication
│   ├── components/
│   │   ├── calendar/        # MonthCard, ScaleEditor
│   │   └── colaboradores/   # ColaboradorModal
│   └── lib/
│       ├── auth.ts          # Web Crypto-based auth
│       ├── db.ts            # PGlite client + queries
│       ├── migrations.ts    # Database migrations
│       ├── schemas/         # Zod validation schemas
│       └── i18n/            # Internationalization (pt-BR)
├── docs/
│   └── migrations/          # SQL reference files
└── public/                  # Static assets
```

---

## How to open a PR

1. **Pick an issue** — look for [good first issue](https://github.com/claudioorjunior/integra-escala/labels/good%20first%20issue) labels, or open a new one to discuss your idea first.
2. **Branch from `main`** — use a descriptive name (e.g. `feat/pdf-export`, `fix/login-redirect`).
3. **Make your changes** — keep them focused. One PR = one concern.
4. **Verify before committing**:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   pnpm build
   ```
5. **Open a PR** against `main` with a clear title and description in English. If the change is user-facing, include screenshots.
6. **Wait for review** — the maintainer will review and may request changes.

---

## Code conventions

- **TypeScript** — strict mode, no `any` unless unavoidable.
- **Imports** — use `@/` path alias (e.g. `import { getDB } from "@/lib/db"`).
- **Components** — React Server Components by default; add `"use client"` only when needed.
- **Database** — all queries go through `src/lib/db.ts` helpers; raw SQL is fine in this project.
- **Commits** — conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`), body in Portuguese if needed.
- **Tests** — Zod schema tests live in `src/lib/schemas/__tests__/`. Add tests for new validation logic.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
