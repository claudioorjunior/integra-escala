# Integra Escala - Revisao de Performance, SEO, Acessibilidade e Boas Praticas

Data da analise: 2026-07-07

Projeto analisado: `/Users/claudio/Documents/gerador-escala-ilpi/integra-escala/`

Stack detectada: Next.js 16.2.10, React 19.2.4, TypeScript 5, Tailwind CSS 4, Supabase, shadcn/ui

## Resumo executivo

O projeto esta com setup tecnico moderno, mas o estado atual do frontend ainda parece um bootstrap inicial de `create-next-app`, com identidade visual parcial e sem implementacao de SEO, PWA, rotas de negocio ou configuracoes de deploy mais refinadas.

Os principais riscos encontrados hoje sao:

1. A pagina inicial ainda e o template padrao do Next.js, com conteudo em ingles e links externos do boilerplate.
2. SEO basico esta incompleto: ha `title` e `description`, mas faltam Open Graph, Twitter Cards, `robots`, `sitemap` e `manifest`.
3. O bundle inicial registrado em build anterior esta alto para uma home simples: `529,769 bytes` de JS nao comprimido na rota `/`.
4. O pipeline local de qualidade nao esta confiavel neste estado: `npm run lint` falha com erro interno do ESLint e `npm run build` nao concluiu em 300s.
5. Ainda nao ha sinais de estrategia de cache, headers, middleware, ISR/SSR por caso de uso ou configuracao de Vercel.

## Evidencias principais

### Estrutura e configuracao

- `next.config.ts` esta praticamente vazio.
- `layout.tsx` usa `next/font/google` com `Outfit`, `display: "swap"` e pesos explicitos. Isso e bom para performance e CLS.
- `page.tsx` ainda e a pagina padrao do template Next.js.
- `globals.css` usa Tailwind 4 via `@import "tailwindcss"` e design tokens customizados.
- Nao foram encontrados arquivos `robots.*`, `sitemap.*`, `manifest.*`, `middleware.*` ou `vercel.json`.

### Build diagnostics encontrados em `.next`

Arquivo: `.next/diagnostics/route-bundle-stats.json`

- Rota `/`: `firstLoadUncompressedJsBytes = 529769`
- Rota `/_not-found`: `firstLoadUncompressedJsBytes = 514531`

Para uma home extremamente simples, esse numero sugere sobra relevante de dependencias/shared chunks ou residuos de build que merecem analise.

### Validacoes executadas

- `npm run lint`: falhou com erro interno do ESLint (`Cannot read properties of undefined (reading 'ConfigOps')`)
- `npm run build`: nao concluiu dentro de 300s

Isso indica que antes de qualquer otimizacao fina, o pipeline de verificacao precisa voltar a ser previsivel.

## Analise por area

## 1. Performance

### O que ja esta bom

- Uso de `next/font/google` em `src/app/layout.tsx` com `display: "swap"`.
- Uso de `next/image` em `src/app/page.tsx` em vez de `<img>`.
- App Router ativo, com metadados centralizados em `layout.tsx`.
- Tailwind 4 integrado pelo PostCSS oficial.

### O que falta ou preocupa

- `next.config.ts` nao aplica nenhuma otimizacao adicional relevante.
- A home atual nao representa o produto e ainda carrega assets do boilerplate (`next.svg`, `vercel.svg`).
- O bundle inicial de ~530 KB nao comprimido esta alto para a simplicidade da rota atual.
- Ha dependencias de UI e icones potencialmente pesadas para o escopo atual (`lucide-react`, `@tabler/icons-react`, `radix-ui`, `shadcn`), mas o app real ainda nao expoe fluxo suficiente para confirmar necessidade.
- `public/` ainda tem apenas SVGs do template.

### Recomendacoes priorizadas

#### Prioridade alta

- Substituir imediatamente o boilerplate da home por pagina real do produto, reduzindo markup, links e assets desnecessarios.
- Fazer analise de bundle com `ANALYZE=true` ou ferramenta equivalente para identificar quais chunks estao inflando o first load.
- Revisar importacoes de bibliotecas de icones e componentes para evitar carregar conjuntos redundantes.

#### Prioridade media

- Quando houver telas reais, usar dynamic import para componentes pesados de dashboard, modais, graficos e calendario.
- Garantir que componentes com `"use client"` sejam aplicados somente onde realmente houver interatividade.
- Definir estrategia de renderizacao por rota para reduzir JS no cliente em paginas predominantemente estaticas.

#### Prioridade baixa

- Considerar `next.config.ts` com ajustes de imagens remotas, headers e observabilidade conforme o produto crescer.

## 2. SEO basico

### O que ja existe

Em `src/app/layout.tsx`:

- `title`: `Integra Escala`
- `description`: `Gerador de escala institucional para ILPIs - gestao simples, segura e padronizada.`
- `lang="pt-BR"` no elemento `<html>`

### Lacunas

- Sem `metadataBase`
- Sem `openGraph`
- Sem `twitter`
- Sem canonical URL
- Sem `robots` metadata
- Sem `robots.txt`
- Sem `sitemap.xml`
- Sem imagem OG dedicada
- Favicon em data URL inline; funciona, mas nao e o ideal para branding e compartilhamento
- Home atual nao tem conteudo indexavel aderente ao negocio

### Recomendacoes priorizadas

#### Prioridade alta

- Completar `metadata` com:
  - `metadataBase`
  - `openGraph`
  - `twitter`
  - `robots`
  - `alternates.canonical`
- Criar `src/app/robots.ts` ou equivalente atual do Next 16.
- Criar `src/app/sitemap.ts` ou equivalente atual do Next 16.
- Criar imagem Open Graph real da marca/produto.

#### Prioridade media

- Substituir o favicon inline por assets reais em `public/`.
- Garantir que a homepage tenha H1, copy institucional, proposta de valor e termos de busca relevantes para ILPI, escala institucional, plantao e gestao operacional.

## 3. Acessibilidade

### O que ja esta bom

- `html lang="pt-BR"` configurado.
- `main` presente na home.
- `next/image` com `alt` informado nas imagens atuais.
- Componente `Button` possui estilos de `focus-visible`, estados `disabled` e suporte a `aria-invalid`/`aria-expanded` em classes.

### Riscos e lacunas

- A home atual nao possui estrutura semantica completa de produto real: sem `header`, `nav`, `section`, `footer`.
- Ainda nao existem formularios no app analisado, entao nao foi possivel validar `label`, `htmlFor`, mensagens de erro, agrupamento por `fieldset` ou navegacao por teclado em fluxos reais.
- `globals.css` aplica `letter-spacing: -0.03em` aos headings. Isso pode prejudicar legibilidade em alguns tamanhos, especialmente mobile.
- A paleta parece relativamente consistente, mas sem pagina funcional nao da para atestar contraste de todos os estados interativos.
- Tamanhos de toque do `Button` base (`h-8`, `h-7`, `size-8`) podem ficar pequenos para tablet/mobile em acoes primarias, dependendo do uso final.

### Recomendacoes priorizadas

#### Prioridade alta

- Nas telas reais, garantir:
  - labels associadas a todos os inputs
  - mensagens de erro vinculadas com `aria-describedby`
  - ordem de tab coerente
  - navegacao completa por teclado
  - foco visivel em todos os controles
- Incluir landmarks semanticos (`header`, `nav`, `main`, `aside`, `footer`) nas paginas principais.

#### Prioridade media

- Revisar contrastes com ferramenta automatica e teste real em tema claro/escuro.
- Revisar tracking negativo dos headings e evitar compressao excessiva em telas pequenas.
- Padronizar tamanho minimo de touch target para 44x44 px em acoes importantes de tablet.

## 4. Core Web Vitals e CSS

### Tailwind purge / tree-shaking

Com Tailwind CSS 4, a estrategia mudou em relacao ao modelo antigo de `content` em `tailwind.config.js`. O projeto usa o pipeline oficial via `@tailwindcss/postcss`, o que indica configuracao coerente com a versao atual.

Conclusao: nao ha evidencia de erro de "purge" classico. O ponto mais importante aqui nao e purge, e sim reduzir JS inicial e evitar client components desnecessarios.

### CWV - leitura objetiva do estado atual

- LCP: hoje pouco representativo porque a home e boilerplate simples.
- CLS: tende a estar razoavel pelo uso de `next/font` com `display: swap` e dimensoes explicitas em `Image`.
- INP: nao ha fluxo interativo suficiente para medir.
- Bundle inicial: ja e um sinal concreto de atencao.

### Recomendacoes priorizadas

#### Prioridade alta

- Executar bundle analysis e identificar bibliotecas/client components que entram no first load.
- Medir Lighthouse e Web Vitals em ambiente de preview/deploy, nao apenas local.

#### Prioridade media

- Introduzir `@vercel/analytics` e/ou coleta de Web Vitals para monitorar LCP, CLS e INP em producao.
- Validar se paginas autenticadas realmente precisam ser client-heavy ou se podem renderizar maior parte no servidor.

## 5. PWA

### Estado atual

- Nao ha `manifest.json` ou `app/manifest.ts`
- Nao ha service worker
- Nao ha estrategia offline

### Recomendacao

PWA so faz sentido se houver caso de uso operacional real em tablet, baixa conectividade ou necessidade de reabertura rapida do sistema. Para o contexto de gestores em ILPI, isso pode ser util, mas eu trataria como segunda fase.

#### Prioridade media

- Criar `manifest` com nome do app, icones, cor de tema e modo standalone.
- Permitir instalacao em tablet/desktop.

#### Prioridade baixa

- Avaliar service worker/offline apenas para leituras de escala, cache de assets e shell da aplicacao.
- Evitar offline complexo com dados sensiveis e sincronizacao se isso nao for requisito operacional real.

## 6. Deploy Vercel, cache, SSR/ISR

### Estado atual

- Nao ha `vercel.json`
- Nao ha `middleware`
- `next.config.ts` esta vazio
- Em `.next/prerender-manifest.json`, a rota `/` aparece com `initialRevalidateSeconds: false`, indicando pagina sem revalidacao configurada

### Recomendacoes por tipo de pagina

#### Paginas institucionais / marketing

- Preferir renderizacao estatica.
- Adicionar revalidate quando houver CMS ou conteudo semi-estatico.

#### Paginas autenticadas de escala

- Se a escala muda com frequencia e depende do usuario/logado, SSR ou fetch server-side com cache control explicito tende a ser mais adequado.
- Se houver visoes consolidadas pouco mutaveis, usar cache por segmentos ou revalidacao controlada pode reduzir custo e melhorar resposta.

### Recomendacoes priorizadas

#### Prioridade alta

- Definir estrategia por rota: publica estatica, autenticada dinamica, relatios/consultas com cache.
- Configurar headers de cache para assets estaticos e imagens.
- Adicionar security headers basicos no deploy.

#### Prioridade media

- Criar `vercel.json` apenas se houver necessidade especifica que nao esteja coberta pelo comportamento padrao do Next/Vercel.
- Documentar quais paginas usam SSR, SSG, streaming ou revalidate.

## 7. Mobile e tablet

### Estado atual

- A home atual usa layout simples com `max-w-3xl`, `px-16`, `py-32`.
- Isso funciona visualmente no template, mas nao representa fluxo real de uso operacional em tablet.

### Riscos para o produto real

- Tabelas de escala, filtros, modais e formularios longos costumam quebrar ergonomia em tablet se forem desenhados apenas para desktop.
- Os tamanhos de botao base definidos no design system podem ser pequenos para uso recorrente por gestores.
- Sem telas reais, nao foi possivel validar leitura, densidade informacional e scroll horizontal em grade de escala.

### Recomendacoes priorizadas

#### Prioridade alta

- Projetar as telas principais pensando primeiro em tablet horizontal e vertical.
- Garantir touch targets minimos de 44x44 px em acoes primarias.
- Evitar tabelas largas sem estrategia responsiva clara.

#### Prioridade media

- Para grade de escala, considerar:
  - cards por turno em mobile
  - tabela compacta com scroll controlado em tablet
  - filtros persistentes e acionaveis sem hover

## Prioridades consolidadas

## P0 - Fazer imediatamente

1. Remover o boilerplate da home e publicar conteudo real do produto.
2. Corrigir pipeline local: investigar falha do ESLint e travamento do `next build`.
3. Completar metadata SEO com Open Graph, canonical, robots e Twitter.
4. Criar `robots` e `sitemap`.
5. Rodar analise de bundle e reduzir o first load JS da rota `/`.

## P1 - Proxima iteracao

1. Definir estrategia por rota para SSG/SSR/revalidate.
2. Revisar acessibilidade de formularios, foco, contraste e landmarks nas telas reais.
3. Ajustar design system para touch targets adequados em tablet.
4. Adicionar assets reais de favicon/OG/share image.

## P2 - Fase seguinte

1. Avaliar PWA com `manifest` e instalacao em tablet.
2. Considerar offline limitado para consulta de escala.
3. Adicionar monitoramento de Web Vitals em producao.

## Observacoes finais

- O projeto nao esta mal configurado tecnicamente; ele esta mais incompleto do que problemático.
- A base moderna do Next 16 + App Router + `next/font` + `next/image` ja entrega bons fundamentos.
- O maior gap hoje nao e micro-otimizacao: e transformar o bootstrap atual em uma aplicacao real com estrategia clara de SEO, renderizacao, responsividade e operacao.

## Arquivos consultados

- `package.json`
- `next.config.ts`
- `postcss.config.mjs`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/ui/button.tsx`
- `eslint.config.mjs`
- `tsconfig.json`
- `.next/diagnostics/route-bundle-stats.json`
- `.next/prerender-manifest.json`
