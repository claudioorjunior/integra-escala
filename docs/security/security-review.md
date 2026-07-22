# Revisão de Segurança — Integra Escala

Data da análise: 2026-07-07  
Projeto analisado: `integra-escala`  
Stack observada: Next.js 16, React 19, TypeScript, Supabase Auth/Postgres

## Escopo analisado

- Schema SQL: [001_schema.sql](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql)
- App Next.js: [integra-escala/src](/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/src)
- Config Next.js: [next.config.ts](/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/next.config.ts)
- Variáveis locais observadas sem expor segredos: `.env.local` contém `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Resumo executivo

O projeto tem uma base razoável de isolamento por tenant via RLS no banco, mas hoje existe um problema crítico no fluxo de convite: a função `public.handle_invite_user` roda como `SECURITY DEFINER`, consulta `auth.users`, faz `INSERT/UPDATE` em `usuario_ilpi` e não valida se o chamador é admin da ILPI. Em Supabase/Postgres, isso abre caminho para abuso direto via RPC, inclusive autoelevação de privilégio e enumeração de emails.

Também faltam controles de borda no app web: não há middleware de autenticação, não há headers de segurança configurados no Next.js, e não há qualquer evidência de rate limiting para operações sensíveis. A `anon key` exposta no client é aceitável em Supabase, mas apenas se o backend/RLS estiver realmente fechado; hoje a RPC de convite enfraquece esse modelo.

## Achados

### 1. Crítico — `handle_invite_user` permite convite/vinculação sem validar o chamador

**Evidência**

Em [001_schema.sql](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:186), a função `public.handle_invite_user`:

- é `SECURITY DEFINER`;
- recebe `p_ilpi_id`, `p_email` e `p_papel`;
- consulta `auth.users` por email;
- faz `INSERT ... ON CONFLICT DO UPDATE` em `public.usuario_ilpi`;
- não checa `auth.uid()` nem valida se o chamador é `admin` da ILPI.

Trechos relevantes:

- definição: linhas 186-241
- busca de usuário por email: linhas 215-218
- vinculação em `usuario_ilpi`: linhas 228-232

**Impacto**

Um usuário autenticado pode potencialmente chamar a RPC diretamente com a `anon key` do frontend e:

- descobrir se um email já existe no `auth.users`;
- associar a si mesmo a uma ILPI existente;
- alterar papéis em vínculos já existentes;
- tentar se promover para `admin` se conhecer um `ilpi_id` válido e usar seu próprio email.

Esse é o principal risco do sistema hoje.

**Correção sugerida**

1. Restringir execução da função:
   - `REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;`
   - expor convite apenas por backend confiável.
2. Se a função continuar no banco, validar explicitamente o chamador dentro dela:
   - `IF public.user_ilpi_role(auth.uid(), p_ilpi_id) <> 'admin' THEN ... deny ... END IF;`
3. Não permitir que a função retorne diferenças entre "email existe" e "email não existe" para clientes não confiáveis.
4. Considerar mover convite para rota server-side/edge function com `service_role`, auditoria e rate limit.

### 2. Alto — enumeração de emails e abuso por ausência de rate limiting no convite

**Evidência**

Na mesma função [001_schema.sql](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:220), quando o email não existe, o retorno é:

- `erro = 'usuario_nao_encontrado'`
- `mensagem = 'Usuário não encontrado. O usuário deve se cadastrar primeiro.'`

Quando existe, o retorno é sucesso com `usuario_id` e `papel`.

Não há qualquer evidência de rate limiting no repositório analisado, nem endpoint server-side intermediando esse fluxo.

**Impacto**

- enumeração de base de usuários por email;
- tentativa massiva de associação indevida;
- coleta de identificadores internos (`usuario_id`);
- potencial violação de minimização de dados e privacidade.

**Correção sugerida**

- retorno genérico para convite: sempre responder algo como `solicitação_recebida` sem informar se o email existe;
- registrar tentativas de convite em tabela de auditoria;
- aplicar rate limiting por `auth.uid()`, IP e ILPI;
- exigir captcha ou confirmação adicional em fluxos públicos;
- preferir fluxo de convite baseado em token assinado e expiração, não lookup direto em `auth.users` por email.

### 3. Alto — `ilpis_insert` permite criação livre de tenant por qualquer usuário autenticado

**Evidência**

Em [001_schema.sql](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:292), a policy é:

```sql
CREATE POLICY ilpis_insert ON public.ilpis
    FOR INSERT WITH CHECK (true);
```

**Impacto**

Qualquer usuário autenticado pode criar novas ILPIs arbitrariamente. Isso pode ser aceitável apenas se o produto deliberadamente permitir auto-onboarding aberto. Mesmo nesse caso, falta o bootstrap seguro do primeiro vínculo admin.

**Risco adicional**

Como não existe trigger ou fluxo transacional que crie automaticamente `usuario_ilpi` com `papel='admin'` para o criador, o tenant pode nascer sem administração legítima, e o time tende a depender do `handle_invite_user`, que hoje está vulnerável.

**Correção sugerida**

- Se o onboarding não for aberto: restringir `INSERT` a backend confiável.
- Se o onboarding for aberto: criar função transacional segura `create_ilpi_with_owner()` que:
  - cria a ILPI;
  - cria o vínculo `usuario_ilpi` como `admin` para `auth.uid()`;
  - roda com validações explícitas;
  - substitui a policy aberta `WITH CHECK (true)`.

### 4. Médio — funções auxiliares `SECURITY DEFINER` provavelmente expostas para execução pública

**Evidência**

As funções abaixo são `SECURITY DEFINER`:

- [user_ilpi_role](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:143)
- [user_has_ilpi_access](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:156)
- [get_user_ilpis](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:171)
- [handle_invite_user](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:186)
- [handle_new_user](/Users/claudio/Documents/gerador-escala-ilpi/migrations/001_schema.sql:246)

No script não há `REVOKE EXECUTE` nem `GRANT EXECUTE` seletivo.

**Impacto**

Em PostgreSQL, funções novas costumam nascer executáveis por `PUBLIC` até revogação explícita. Em ambiente Supabase, isso pode significar RPC acessível além do necessário. `get_user_ilpis(p_user_id)` em especial permite consulta de vínculos de UUIDs arbitrários se exposta como RPC.

**Correção sugerida**

- revogar `EXECUTE` de todas as funções auxiliares que não devem ser RPC públicas;
- expor apenas uma superfície mínima, com grants explícitos por papel;
- para helpers usados só em policy, manter privados ao máximo.

### 5. Médio — ausência de middleware e guardas de rota no Next.js

**Evidência**

- Não há `middleware.ts` no projeto.
- Não há rotas `app/api` implementadas.
- O app em [src/app/page.tsx](/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/src/app/page.tsx) ainda é o scaffold padrão do Next.
- Não encontrei cliente Supabase inicializado nem guardas de sessão em `src/`.

**Impacto**

No estado atual, não há superfície funcional do app para proteger. Mas também não há infraestrutura pronta de proteção para quando páginas reais forem adicionadas. Se o time avançar usando apenas client-side auth checks, haverá risco de conteúdo exposto em renderização inicial ou de chamadas indevidas a RPCs.

**Correção sugerida**

- adicionar middleware para rotas privadas quando o app funcional entrar;
- validar sessão também no servidor para páginas privadas e ações sensíveis;
- centralizar criação de cliente Supabase SSR/server/client com padrões distintos.

### 6. Médio — headers de segurança ausentes no Next.js

**Evidência**

O arquivo [next.config.ts](/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/next.config.ts:3) está praticamente vazio e não há configuração de `headers()`.

Também não encontrei evidência de:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

**Impacto**

A ausência desses cabeçalhos aumenta exposição a clickjacking, MIME sniffing, políticas frouxas de origem de recursos e menor resiliência contra XSS caso o app passe a renderizar conteúdo dinâmico.

**Correção sugerida**

Adicionar `headers()` em `next.config.ts` com baseline como:

```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      ],
    },
  ]
}
```

A CSP precisa ser ajustada ao uso real de fontes, analytics e Supabase.

### 7. Baixo a Médio — `NEXT_PUBLIC_SUPABASE_ANON_KEY` exposta no client é esperada, mas hoje depende de um backend ainda vulnerável

**Evidência**

O `.env.local` contém:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

A presença em client-side é padrão do Supabase.

**Impacto**

Sozinha, essa exposição não é problema. O risco aparece quando RLS ou RPCs estão mal protegidas. Neste projeto, o problema não é a `anon key`, e sim a função de convite e grants implícitos.

**Correção sugerida**

- manter a `anon key` apenas com RLS estrita;
- nunca expor `service_role` no frontend;
- revisar grants/RPCs antes de publicar o app.

### 8. Baixo — não encontrei risco atual de SQL injection no código do app

**Evidência**

No repositório analisado, não encontrei queries SQL raw em TypeScript nem uso de `execute`, `sql` template literal, concatenação de query ou drivers SQL manuais. O app em `src/` ainda não implementa integrações de dados reais.

Na migration, a função `handle_invite_user` não usa SQL dinâmico (`EXECUTE`), então não há indício direto de SQL injection ali.

**Conclusão**

No estado atual, o risco predominante não é SQL injection, e sim autorização indevida via RPC/funções `SECURITY DEFINER`.

### 9. Baixo a Médio — dados sensíveis ainda são mínimos, mas sem controles adicionais de privacidade

**Evidência**

No schema:

- `colaboradores` armazena `nome`, regime e horários, mas não contém CPF;
- `ilpis` armazena `cnpj` em texto puro;
- não há evidência de criptografia de colunas, mascaramento, trilha de acesso ou classificação de dados.

**Impacto**

Hoje não há CPF no schema analisado, o que reduz o risco imediato. Ainda assim, `nome` de colaborador e `cnpj` são dados identificáveis e devem ser tratados com minimização, acesso por necessidade e logging de ações administrativas.

**Correção sugerida**

- manter RLS estrita por tenant;
- evitar expor `cnpj` e dados de colaboradores em telas/exports sem necessidade;
- se CPF for adicionado no futuro, considerar:
  - armazenar apenas quando necessário;
  - mascarar em UI e logs;
  - criptografia em repouso no nível de aplicação ou coluna, conforme arquitetura;
  - política de retenção e base legal explícita.

### 10. Médio — lacunas de LGPD no fluxo de convite e governança de dados

**Evidência**

Não encontrei no schema campos ou estruturas para:

- consentimento (`consentimento`, `consent_at`, etc.);
- base legal/documentação do tratamento;
- retenção/expurgo;
- auditoria de convites e acessos;
- registro de aceite do usuário ao vínculo com ILPI.

O convite atual depende de consultar `auth.users` por email e associar a pessoa diretamente à ILPI.

**Avaliação LGPD**

Isso não é automaticamente ilícito, porque relação empregatícia/contratual e controle operacional podem se apoiar em base legal diferente de consentimento. Mas o fluxo atual está fraco em:

- minimização de dados;
- transparência ao titular;
- trilha de auditoria;
- prevenção de uso indevido;
- segregação de acesso.

Usar consentimento como solução genérica seria juridicamente simplista. O mais importante aqui é definir base legal correta, informar o titular e limitar o tratamento.

**Correção sugerida**

- documentar a base legal do tratamento por categoria de dado;
- registrar auditoria de convites, aceitações, revogações e alterações de papel;
- substituir vínculo imediato por convite com token, aceite explícito e expiração;
- manter política de retenção e rotina de exclusão/desvinculação;
- se houver necessidade regulatória interna, criar tabela de aceite/ciência do usuário ao vínculo institucional.

## Avaliação objetiva por item solicitado

### 1. RLS

**Status:** Parcialmente correta, mas com um desvio crítico fora das policies.

- Todas as tabelas do schema têm `ENABLE ROW LEVEL SECURITY`.
- Todas as tabelas têm policies definidas.
- O modelo de isolamento por `ilpi_id` está bem desenhado para `SELECT/INSERT/UPDATE/DELETE` em `cargos`, `colaboradores`, `escala_meses`, `escala_dias` e `usuario_ilpi`.
- O problema é que a função `handle_invite_user` contorna a confiança do modelo ao operar como `SECURITY DEFINER` sem validar o chamador.

### 2. Autenticação

**Status:** Incompleta no app.

- Dependências Supabase estão instaladas em [package.json](/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/package.json:12).
- Há `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`.
- Não encontrei cliente Supabase implementado no app.
- Não encontrei `middleware.ts` nem guardas de rota.

### 3. SQL Injection

**Status:** Sem evidência atual no código analisado.

- Não há queries raw em TypeScript.
- Não há SQL dinâmico perigoso nas funções SQL analisadas.

### 4. Dados sensíveis

**Status:** Risco moderado por governança, não por volume atual.

- Não há CPF no schema analisado.
- Há nomes de colaboradores e CNPJ de ILPI em claro.
- Falta auditoria, classificação de dados e política de retenção.

### 5. Rate limiting do convite

**Status:** Ausente.

- A RPC atual é enumerável e não há mecanismo visível de limitação.

### 6. CORS e headers de segurança

**Status:** Headers ausentes; CORS não aplicável no estado atual do app sem API própria.

- Não há `headers()` em `next.config.ts`.
- Não há API routes Next.js para auditar CORS customizado.
- Se o frontend chamar Supabase direto, o CORS relevante passa a ser o do projeto Supabase.

### 7. Supabase anon key

**Status:** Exposição esperada, condicionada a RLS forte.

- Hoje o risco vem da RPC vulnerável, não da existência da `anon key` em si.

### 8. LGPD

**Status:** Lacunas relevantes.

- Não há campo de consentimento no schema.
- Mais importante: não há trilha de base legal, auditoria, aceite do vínculo nem retenção.
- O fluxo atual de convite por email, do jeito que está, é ruim sob a ótica de minimização e privacidade.

## Prioridades de correção

### Prioridade 0

- Corrigir ou despublicar imediatamente `handle_invite_user`.
- Revogar `EXECUTE` público de funções `SECURITY DEFINER`.

### Prioridade 1

- Criar fluxo seguro de onboarding/convite com validação server-side.
- Definir bootstrap seguro do admin da ILPI.
- Adicionar auditoria de convites e alterações de papel.

### Prioridade 2

- Adicionar middleware/guards para rotas privadas no app.
- Configurar headers de segurança no Next.js.

### Prioridade 3

- Formalizar requisitos LGPD: base legal, retenção, aceite e minimização.
- Revisar necessidade real de armazenar `cnpj` e futuros dados pessoais adicionais.

## Exemplo de hardening recomendado para a função de convite

```sql
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_invite_user(
    p_ilpi_id UUID,
    p_email TEXT,
    p_papel TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('sucesso', false, 'erro', 'nao_autenticado');
    END IF;

    IF public.user_ilpi_role(auth.uid(), p_ilpi_id) <> 'admin' THEN
        RETURN json_build_object('sucesso', false, 'erro', 'acesso_negado');
    END IF;

    IF p_papel NOT IN ('consulta', 'edicao', 'admin') THEN
        RETURN json_build_object('sucesso', false, 'erro', 'papel_invalido');
    END IF;

    -- restante do fluxo com resposta genérica e auditoria
    RETURN json_build_object('sucesso', true, 'mensagem', 'solicitacao_recebida');
END;
$$;
```

Idealmente, porém, o convite deve sair da RPC pública e ir para backend confiável com token de convite.

## Conclusão

O desenho de RLS por tenant está melhor do que a média para um projeto inicial, mas hoje ele é enfraquecido por uma RPC privilegiada exposta de forma insegura. O sistema não parece vulnerável a SQL injection no estado atual, porém está vulnerável a falhas de autorização, enumeração de usuários e governança insuficiente de dados. Antes de publicar ou integrar a UI real, a prioridade deve ser fechar `handle_invite_user`, restringir funções `SECURITY DEFINER`, introduzir fluxo de convite seguro e adicionar proteção de borda no Next.js.
