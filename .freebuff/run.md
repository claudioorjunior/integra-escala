# Run Doc — Integra Escala (Next.js dev server)

## How to reproduce the uncommitted artifacts

1. Install dependencies (uses pnpm):
   ```bash
   pnpm install --frozen-lockfile
   ```

> **Nota:** A aplicação usa PGlite (banco local WASM) e não requer
> nenhum arquivo `.env` ou configuração de Supabase. Basta rodar o
> servidor que o banco é inicializado automaticamente no navegador.

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

Nenhuma. A aplicação usa PGlite local (IndexedDB no browser, memória no
server) e não depende de variáveis de ambiente externas.
