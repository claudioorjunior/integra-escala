# Run Doc — Integra Escala (Next.js dev server)

## How to reproduce the uncommitted artifacts

1. Copy `.env.local` from the main checkout if it exists:
   ```bash
   cp /Users/claudio/integra-escala/.env.local ./
   ```
   If missing, the app still works for public routes (landing, login, signup) — auth routes will show a "Configuração do Supabase ausente." message.

2. Install dependencies (uses pnpm):
   ```bash
   pnpm install --frozen-lockfile
   ```

## How to run the server

Pick a free port (default 3000; if busy use 3001, etc.):

```bash
PORT=3001 npx next dev -p 3001
```

The server logs to stdout. For background mode:

```bash
PORT=3001 npx next dev -p 3001 > /path/to/log.log 2>&1 &
```

## Routes

| Path | Description | Auth required |
|---|---|---|
| `/` | Landing page | No |
| `/login` | Login | No |
| `/cadastro` | Sign up | No |
| `/dashboard` | Scale management | Yes |
| `/colaboradores` | Employee list | Yes |
| `/cargos` | Job roles CRUD | Yes |
| `/convites` | Invite management | Yes |
| `/convites/aceitar?token=...` | Accept invite | No (handled client-side) |
| `/config` | Settings | Yes |
| `/auth/callback` | OAuth callback | No |

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- Without these, Supabase Auth/DB features are unavailable but the UI renders normally.
