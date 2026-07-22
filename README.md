# Integra Escala

<p align="center">
  <img src="public/logo-integra-escala.png" alt="Integra Escala" width="420">
</p>

<p align="center">
  <a href="#english">🇺🇸 English</a> · <a href="README.pt-BR.md">🇧🇷 Português (Brasil)</a>
</p>

<p align="center">
  <strong>Automatic shift scheduling for elderly care facilities (ILPIs).</strong><br>
  Generate compliant, balanced monthly work schedules in seconds — not hours.
</p>

<p align="center">
  <a href="https://github.com/claudioorjunior/integra-escala/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <a href="https://github.com/claudioorjunior/integra-escala/stargazers"><img src="https://img.shields.io/github/stars/claudioorjunior/integra-escala?style=social" alt="Stars"></a>
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3FCF8E?logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css" alt="Tailwind 4">
</p>

---

<a name="english"></a>
## 🇺🇸 English

**Integra Escala** is an open-source web app that automates monthly work-shift scheduling for **ILPIs** (*Instituições de Longa Permanência para Idosos* — Brazilian long-term care facilities for the elderly).

It replaces error-prone spreadsheets and manual grid-building with a fast, constraint-aware generator that respects Brazilian labor rules commonly applied in this sector: minimum rest between shifts (11h), 44h/week cap, mandatory day off (DSR), and per-role coverage.

### Why this exists

ILPIs must staff 24/7 with limited personnel and tight budgets. Building the monthly schedule by hand is one of the most time-consuming, error-prone tasks a manager faces — and a single mistake can put the facility in violation. Integra Escala turns a 4–6 hour monthly chore into a one-click operation.

### Features

- **One-click monthly schedule generation** with constraint validation
- **Drag-and-drop adjustments** when reality doesn't match the plan
- **Multi-role coverage** (nurses, technicians, caregivers, cleaning)
- **Per-collaborator workload tracking** (hours, shifts, days off)
- **Multi-tenant by design** — each facility's data is isolated via Supabase RLS
- **Invite-based onboarding** — managers invite caregivers by email
- **Public landing page** with auth (login/signup)
- **Mobile-responsive** — managers can adjust on the floor

### Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth & DB | Supabase (Postgres + Auth + RLS) |
| Forms | React Hook Form + Zod |
| Deployment | Vercel-ready |

### Quick start

```bash
# 1. Clone
git clone https://github.com/claudioorjunior/integra-escala.git
cd integra-escala

# 2. Install
pnpm install          # or npm install / yarn

# 3. Configure
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# (create a free project at https://supabase.com)

# 4. Apply migrations
# Run the .sql files in /docs/migrations against your Supabase project

# 5. Run
pnpm dev
# open http://localhost:3000
```

### Project structure

```
integra-escala/
├── src/
│   ├── app/                 # Next.js App Router (landing, login, dashboard, ...)
│   ├── components/          # UI components (shadcn/ui + custom)
│   └── lib/
│       ├── supabase/        # Supabase client (browser/server/middleware)
│       └── scheduling/      # Shift-generation engine
├── docs/
│   ├── migrations/          # SQL migrations (apply to Supabase)
│   ├── prd.md               # Product Requirements Document
│   ├── security-review.md   # Threat model + mitigations
│   ├── seo.md               # SEO/marketing playbook
│   └── banner.png           # README header image
└── public/                  # Static assets
```

### Roadmap

- [x] MVP: auth, dashboard, monthly view, collaborators
- [x] Invitation system
- [ ] Schedule generation engine (in progress)
- [ ] PDF export
- [ ] Push notifications
- [ ] Multi-facility dashboards

### Contributing

PRs welcome! This is a small, focused project — if you've ever worked in healthcare ops or built scheduling tools, your input is gold. Open an issue first to discuss the approach.

### License

MIT — see [LICENSE](LICENSE). Use it, fork it, sell services around it.

### Maintainer

Built by [@claudioorjunior](https://github.com/claudioorjunior) as part of the **Integra** family of open-source tools for Brazilian eldercare.

---

<p align="center">
  <a href="README.pt-BR.md">🇧🇷 Ler em Português (Brasil)</a>
</p>
