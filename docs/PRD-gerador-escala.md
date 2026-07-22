# PRD — Gerador de Escala para ILPIs

**Versão:** 1.0 (MVP)
**Autor:** Claudio Júnior / Integra Senior
**Data:** Julho 2026

---

## 1. Problema

Gestores de ILPIs montam escala de colaboradores manualmente no papel ou planilha, gastando uma tarde inteira por mês — realocando nomes, testando combinações e corrigindo conflitos. O processo é propenso a erro (mesma pessoa em dois turnos conflitantes, dias descobertos) e não deixa histórico.

## 2. Objetivo

Reduzir o tempo de montagem de escala de **uma tarde inteira para alguns minutos**, com um sistema web que gere a escala automaticamente em 1 clique e permita ajustes finos pelo gestor.

## 3. Público-alvo

Gestores de ILPIs — perfil não-técnico. Interface precisa ser intuitiva, com poucos cliques, e visualmente próxima ao que eles já entendem (calendário mensal).

## 4. Arquitetura (Única Fase — Supabase direto)

- Next.js hospedado na Vercel
- Supabase para autenticação + banco de dados (PostgreSQL)
- Cada usuário (gestor) vinculado a uma ILPI
- Uma ILPI por usuário no MVP, escalável para multi-unidades depois
- Histórico de meses anteriores disponível
- Impressão por navegador (Ctrl+P) com identidade visual da ILPI

## 5. Funcionalidades

### 5.1. Cadastro de Cargos e Regimes
| Cargo | Regime Padrão |
|-------|--------------|
| Técnico de Enfermagem (diurno) | 8h, 5x2 |
| Técnico de Enfermagem (noturno) | 12x36 ou 12x60 |
| Cuidador (24h) | 24/72 |
| Auxiliar | 8h, 5x2 |
| Diarista | Só dias úteis (manhã) |
| Noturnista | Só noite |

- Gestor pode **criar novos cargos** com regime personalizado
- Gestor pode **alterar o regime de um colaborador específico** sem mudar o cargo

### 5.2. Cadastro de Colaboradores
- Nome, cargo, regime (herdado do cargo ou sobrescrito)
- Dias fixos de folga (opcional)
- Restrições (ex: "não pode fazer noturno")

### 5.3. Geração Automática da Escala
- Regra central: **não repetir a mesma pessoa nos mesmos dias da semana**
- Respeitar regime de cada colaborador
- Distribuir equipe de forma equilibrada entre os dias
- Sugerir substituições automáticas para cobrir folgas/faltas

### 5.4. Edição Manual pelo Gestor
- Arrastar pessoa de um dia para outro
- Trocar duas pessoas de dia
- Adicionar/remover pessoa de um plantão
- Trocas com validação de conflito embutida

### 5.5. Visualizações
- **Modo Calendário (padrão):** colunas = dias do mês, linhas = colaboradores
- **Modo Dia:** consulta quem está em cada turno em um dia específico

### 5.6. Identidade Visual e Impressão
- Logo da ILPI no topo
- Nome da ILPI
- Cores institucionais (configurável)
- Layout otimizado para impressão A4 retrato
- Impressão = calendário mensal por colaborador

### 5.7. Visualização de Turnos
Cada célula do calendário mostra: **nome do colaborador + horário** (ex: "Maria — 07h às 19h" ou "João — plantão 24h").

O gestor vê o mês inteiro em formato calendário, com cada dia contendo os nomes e horários. O turno (manhã/tarde/noite/diurno/noturno) é definido pelo **regime do colaborador**, não por uma configuração fixa da ILPI.

## 6. Regras de Negócio (Algoritmo)

1. **Colaborador não pode estar em dois dias consecutivos se o regime for 24/72** (folga de 72h após trabalhar)
2. **Colaborador não pode estar em dois turnos no mesmo dia** (obvio, mas validado)
3. **Se o regime for 12x36**, o colaborador trabalha dia sim, dia não
4. **Se o regime for 5x2 (8h)**, o colaborador trabalha 5 dias e folga 2 (os dias de folga podem ser fixos ou rotativos)
5. **Noturnistas** só aparecem no turno da noite
6. **Diaristas** só aparecem no turno da manhã/tarde
7. **Distribuição uniforme** — o algoritmo tenta equilibrar a carga entre os colaboradores do mesmo cargo

## 7. Restrições Técnicas (MVP)

- Autenticação via Supabase (e-mail + senha)
- Banco de dados PostgreSQL (via Supabase)
- Uma ILPI por usuário (expansível depois)
- Ajustes manuais são salvos imediatamente
- Geração automática sobrescreve ajustes manuais? → **oferecer opção**: "gerar nova escala mantendo ajustes manuais" ou "gerar do zero"

## 8. Não-Escopo (MVP)

- App mobile nativo (fase futura)
- Envio de escala por WhatsApp diretamente do sistema
- Controle de ponto / bater cartão
- Cálculo de horas extras / banco de horas
- Integração com folha de pagamento
- App offline

## 9. Métricas de Sucesso

- Tempo de montagem da escala: de 1 tarde → < 5 minutos
- Zero conflitos (colaborador em dois lugares no mesmo horário)
- Gestor consegue imprimir direto do sistema
- Gestor consegue usar sem treinamento prévio

## 10. Stack Sugerida

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js (React) |
| Hospedagem | Vercel |
| Estilo | Tailwind CSS |
| Banco (fase 1) | LocalStorage + JS puro |
| Banco (fase 2) | Supabase (PostgreSQL) |
| Impressão | CSS @media print + window.print() |
| Gráficos/UI | shadcn/ui (opcional) |

---

**Próximo passo:** Protótipo funcional do algoritmo em Node.js para validar as regras de negócio.
