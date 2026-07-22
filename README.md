# 🗓️ Integra Escala — Gerador de Escala para ILPIs

> Sistema web para geração automática de escalas de trabalho em Instituições de Longa Permanência para Idosos (ILPIs).

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## O Problema

Gestores de ILPIs montam escala de colaboradores **manualmente** no papel ou planilha, gastando uma tarde inteira por mês — realocando nomes, testando combinações e corrigindo conflitos. O processo é propenso a erro (mesma pessoa em dois turnos conflitantes, dias descobertos) e não deixa histórico.

## A Solução

O **Integra Escala** reduz o tempo de montagem de escala de **uma tarde inteira para alguns minutos**, com um sistema web que:

- ✅ Gera a escala automaticamente em **1 clique**
- ✅ Permite ajustes finos pelo gestor (arrastar/soltar)
- ✅ Suporta múltiplos regimes: 12×36, 12×60, 24/72, 8h 5×2, diarista, noturnista
- ✅ Detecta conflitos automaticamente
- ✅ Mantém histórico de meses anteriores
- ✅ Interface intuitiva para perfil não-técnico

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| UI | shadcn/ui, Radix UI, Lucide Icons |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |

## Quick Start

```bash
# Clone
git clone https://github.com/integaborni/integra-escala.git
cd integra-escala

# Instale dependências
pnpm install

# Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# Execute as migrations no Supabase
# (veja docs/migrations/)

# Inicie o servidor de desenvolvimento
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute as migrations em `docs/migrations/` na ordem:
   - `001_schema.sql` — Tabelas base
   - `002_security_hardening.sql` — Políticas RLS
   - `003_convite_token.sql` — Sistema de convites
3. Copie a URL e a chave anon para `.env.local`

## Estrutura do Projeto

```
src/
├── app/
│   ├── auth/callback/     # OAuth callback
│   ├── cadastro/          # Tela de cadastro
│   ├── colaboradores/     # Gestão de colaboradores
│   ├── dashboard/         # Dashboard principal
│   ├── login/             # Tela de login
│   └── page.tsx           # Landing page
├── components/
│   ├── calendar/          # Componentes de calendário/escala
│   ├── colaboradores/     # Modais de colaboradores
│   ├── layout/            # Layout components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── supabase/          # Client e server helpers
│   └── types/             # TypeScript types
└── middleware.ts          # Auth middleware
```

## Documentação

- [PRD — Product Requirements](docs/PRD-gerador-escala.md)
- [Guia de Marca](docs/branding/guia-de-marca.md)
- [Revisão de Segurança](docs/security/security-review.md)
- [SEO & Performance](docs/optimization/seo-performance-review.md)

## Cargos e Regimes Suportados

| Cargo | Regime Padrão |
|-------|--------------|
| Técnico de Enfermagem (diurno) | 8h, 5×2 |
| Técnico de Enfermagem (noturno) | 12×36 ou 12×60 |
| Cuidador (24h) | 24/72 |
| Auxiliar | 8h, 5×2 |
| Diarista | Só dias úteis (manhã) |
| Noturnista | Só noite |

O gestor pode criar novos cargos com regime personalizado.

## Contribuindo

Contribuições são bem-vindas! Veja como participar:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona minha feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## Roadmap

- [ ] Motor de geração automática de escala (constraint solver)
- [ ] Drag-and-drop para ajustes manuais
- [ ] Impressão com identidade visual da ILPI
- [ ] Suporte a multi-unidades
- [ ] Notificações de conflitos em tempo real
- [ ] PWA para acesso mobile offline

## Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE).

---

**Integra Escala** é um projeto da [Integra Senior](https://integrasenior.com.br) 🇧🇷
