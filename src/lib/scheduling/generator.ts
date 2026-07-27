import {
  type Regime,
  type Colaborador,
  type Plantao,
  type Horario,
  type EscalaGerada,
  type Aviso,
  type DiaDaSemana,
} from "./types";

/** Regimes reconhecidos pelo motor de geração. */
export const REGIMES_VALIDOS = ["24/72", "12x36", "5x2", "noturnista", "diarista"] as const;

export function normalizarRegime(texto: string): Regime | undefined {
  const r = texto.toLowerCase().trim();
  if (r === "24/72" || r === "24h/72h") return "24/72";
  if (r === "12x36" || r === "12h/36h") return "12x36";
  if (r === "5x2" || r === "5 dias / 2 dias") return "5x2";
  if (r.includes("noturn") || r === "noturnista") return "noturnista";
  if (r.includes("diarista") || r === "diarista") return "diarista";
  return undefined;
}

export interface HorarioComTurno extends Horario {
  turno: string;
}

export function horarioPeloRegime(regime: Regime): HorarioComTurno {
  switch (regime) {
    case "24/72":
      return { inicio: "07:00", fim: "07:00", turno: "integral" };
    case "12x36":
      return { inicio: "19:00", fim: "07:00", turno: "noite" };
    case "5x2":
      return { inicio: "08:00", fim: "17:00", turno: "manha" };
    case "noturnista":
      return { inicio: "19:00", fim: "07:00", turno: "noite" };
    case "diarista":
      return { inicio: "07:00", fim: "15:00", turno: "manha" };
    default:
      return { inicio: "08:00", fim: "17:00", turno: "manha" };
  }
}

function minutosEntre(h1: string, h2: string): number {
  const parse = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const a = parse(h1);
  let b = parse(h2);
  if (b <= a) b += 24 * 60;
  return b - a;
}

function ehFimDeSemana(diaSemana: DiaDaSemana): boolean {
  return diaSemana === 0 || diaSemana === 6;
}

function gerarSeed(seed: number | undefined): () => number {
  // MINSTD LCG; 0 preso em 0 (0 * 16807 = 0), então pula
  let s = ((seed ?? Date.now()) % 2147483647) || 1;
  if (s < 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function distribuirEquilibrado(
  diasDisponiveis: number[],
  qtdNecessaria: number,
  rand: () => number
): number[] {
  if (diasDisponiveis.length <= qtdNecessaria) return [...diasDisponiveis];

  // Fisher-Yates partial shuffle — seleciona aleatório mas mantém lista estável
  const pool = [...diasDisponiveis];
  const resultado: number[] = [];
  for (let i = pool.length - 1; i >= 0 && resultado.length < qtdNecessaria; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    resultado.push(pool[i]);
  }
  return resultado.sort((a, b) => a - b);
}

function distribuirAlternado(
  diasDisponiveis: number[],
  paridade: number // 0 ou 1, derivado do índice estável do colaborador
): number[] {
  // Para 12x36: dia sim, dia não. Paridade determinística pelo índice do colaborador,
  // garantindo que colaboradores pareados recebam paridades opostas e cubram todos os dias.
  return diasDisponiveis.filter((d) => d % 2 === paridade);
}

function distribuirComEspacamento(
  diasDisponiveis: number[],
  espacamentoMinimo: number, // em dias
  qtdNecessaria: number,
  rand: () => number
): number[] {
  // Para 24/72: garante no mínimo N dias entre cada plantão
  const resultado: number[] = [];
  const pool = [...diasDisponiveis];
  let ultimoDia = -Infinity;

  // Tentativa 1: greedy a partir de um ponto aleatório
  const startIdx = Math.floor(rand() * Math.max(1, pool.length));
  const ordenado = [...pool.slice(startIdx), ...pool.slice(0, startIdx)];

  for (const d of ordenado) {
    if (resultado.length >= qtdNecessaria) break;
    if (d >= ultimoDia + espacamentoMinimo) {
      resultado.push(d);
      ultimoDia = d;
    }
  }

  // Se não conseguiu preencher, relaxa gradualmente o espaçamento
  if (resultado.length < qtdNecessaria) {
    const restantes = pool.filter((d) => !resultado.includes(d));
    for (let threshold = espacamentoMinimo - 1; threshold >= 1 && resultado.length < qtdNecessaria; threshold--) {
      for (const d of restantes) {
        if (resultado.length >= qtdNecessaria) break;
        if (!resultado.includes(d)) {
          const lastDia = resultado.length > 0 ? resultado[resultado.length - 1] : -Infinity;
          if (d >= lastDia + threshold) {
            resultado.push(d);
          }
        }
      }
    }
    // Último recurso: adiciona dias restantes quando não há alternativa
    if (resultado.length < qtdNecessaria) {
      const stillMissing = pool.filter((d) => !resultado.includes(d));
      for (const d of stillMissing) {
        if (resultado.length >= qtdNecessaria) break;
        resultado.push(d);
      }
    }
  }

  return resultado.sort((a, b) => a - b);
}

export function gerarEscala(args: {
  mes: number;
  ano: number;
  colaboradores: Colaborador[];
  existentes?: Record<number, Plantao[]>;
  manterAjustesManuais?: boolean;
  seed?: number;
}): EscalaGerada {
  const { mes, ano, colaboradores, manterAjustesManuais = false, seed } = args;
  const rand = gerarSeed(seed);
  const totalDias = new Date(ano, mes, 0).getDate();
  const avisos: Aviso[] = [];

  const inicioMes = new Date(ano, mes - 1, 1);

  const plantoes: Record<number, Plantao[]> = {};
  for (let d = 1; d <= totalDias; d++) plantoes[d] = [];

  // Seed from existing manual adjustments when preserving them
  if (manterAjustesManuais && args.existentes) {
    for (const [diaStr, ps] of Object.entries(args.existentes)) {
      const dia = parseInt(diaStr, 10);
      if (dia >= 1 && dia <= totalDias) {
        plantoes[dia] = [...(plantoes[dia] ?? []), ...ps];
      }
    }
  }

  for (const [colabIndex, colab] of colaboradores.entries()) {
    const regime = normalizarRegime(colab.regime);
    if (regime === undefined) {
      avisos.push({
        tipo: "colaborador_sem_regime",
        colaboradorId: colab.id,
        mensagem: `${colab.nome} tem regime não reconhecido: "${colab.regime}".`,
      });
      continue;
    }
    const horario = colab.horarioNominal
      ? { ...colab.horarioNominal, turno: horarioPeloRegime(regime).turno }
      : horarioPeloRegime(regime);

    const diasFolga = new Set(colab.diasFolga ?? []);
    const restricoes = new Set(colab.restricoes ?? []);

    if (regime === "noturnista" && restricoes.has("nao_noturno")) {
      avisos.push({
        tipo: "colaborador_sem_regime",
        colaboradorId: colab.id,
        mensagem: `${colab.nome} é noturnista mas tem restrição "nao_noturno" — ignorado na escala.`,
      });
      continue;
    }

    const diasDisponiveis: number[] = [];
    for (let d = 1; d <= totalDias; d++) {
      // Skip days where this collaborator already has a manual plantão
      if (manterAjustesManuais && plantoes[d].some((p) => p.colaboradorId === colab.id)) continue;
      const diaSemana = (inicioMes.getDay() + d - 1) % 7;
      const data = new Date(ano, mes - 1, d);

      if (diasFolga.has(diaSemana as 0 | 1 | 2 | 3 | 4 | 5 | 6)) continue;
      if (regime === "diarista" && ehFimDeSemana(diaSemana as DiaDaSemana)) continue;
      diasDisponiveis.push(d);
    }

    if (diasDisponiveis.length === 0) {
      avisos.push({
        tipo: "dia_descoberto",
        colaboradorId: colab.id,
        mensagem: `${colab.nome} (${regime}) não tem dias disponíveis no mês — verifique folgas.`,
      });
      continue;
    }

    const qtdDias = calcularQtdDias(regime, diasDisponiveis, totalDias, rand);
    let diasTrabalho: number[];
    if (regime === "12x36") {
      diasTrabalho = distribuirAlternado(diasDisponiveis, colabIndex % 2);
    } else if (regime === "24/72") {
      diasTrabalho = distribuirComEspacamento(diasDisponiveis, 3, qtdDias, rand);
    } else if (regime === "5x2") {
      // 5x2: apenas dias úteis (segunda a sexta)
      const diasUteis = diasDisponiveis.filter((d) => {
        const diaSemana = (inicioMes.getDay() + d - 1) % 7;
        return !ehFimDeSemana(diaSemana as DiaDaSemana);
      });
      diasTrabalho = distribuirEquilibrado(diasUteis, qtdDias, rand);
    } else {
      diasTrabalho = distribuirEquilibrado(diasDisponiveis, qtdDias, rand);
    }

    for (const dia of diasTrabalho) {
      const conflito = plantoes[dia].find(
        (p) => p.colaboradorId === colab.id && p.horario.inicio === horario.inicio && p.horario.fim === horario.fim
      );
      if (conflito) {
        avisos.push({
          tipo: "sub_cobertura",
          dia,
          colaboradorId: colab.id,
          mensagem: `${colab.nome} já escalado para o horário ${horario.inicio}-${horario.fim} no dia ${dia}.`,
        });
        continue;
      }
      plantoes[dia].push({ colaboradorId: colab.id, dia, horario: { inicio: horario.inicio, fim: horario.fim } });
    }
  }

  return { mes, ano, plantoes, avisos };
}

function calcularQtdDias(
  regime: Regime,
  diasDisponiveis: number[],
  totalDias: number,
  rand: () => number
): number {
  switch (regime) {
    case "24/72":
      return Math.max(1, Math.ceil(totalDias / 4));
    case "12x36":
      return Math.max(1, Math.floor(totalDias / 2));
    case "5x2":
      return Math.max(1, Math.ceil((totalDias * 5) / 7));
    case "noturnista": {
      const diasUteis = diasDisponiveis.length;
      return Math.max(1, Math.floor(diasUteis * 0.5));
    }
    case "diarista":
      return diasDisponiveis.length;
    default:
      return Math.ceil(diasDisponiveis.length / 2);
  }
}

export function validarEscala(args: {
  mes: number;
  ano: number;
  plantoes: Record<number, Plantao[]>;
  colaboradores: Colaborador[];
  totalDias: number;
}): Aviso[] {
  const { mes, ano, plantoes, colaboradores, totalDias } = args;
  const avisos: Aviso[] = [];
  const mapRegime = new Map(colaboradores.map((c) => [c.id, c.regime]));
  const mapNome = new Map(colaboradores.map((c) => [c.id, c.nome]));

  function nome(id: string): string {
    return mapNome.get(id) ?? id;
  }

  for (let d = 1; d <= totalDias; d++) {
    const plantoesDia = plantoes[d] ?? [];
    const plantoesOntem = plantoes[d - 1] ?? [];

    for (const p of plantoesDia) {
      const regime = mapRegime.get(p.colaboradorId);
      const mins = minutosEntre(p.horario.inicio, p.horario.fim);
      const horasTrabalhadas = mins / 60;

      // 1. Teto de horas por dia (regra 5x2)
      if (regime === "5x2" && horasTrabalhadas > 10) {
        avisos.push({
          tipo: "teto_horas",
          dia: d,
          colaboradorId: p.colaboradorId,
          mensagem: `${nome(p.colaboradorId)}: regime 5x2 com ${horasTrabalhadas.toFixed(1)}h no dia ${d} (teto 10h/dia).`,
        });
      }

      // 2. Noturnista em turno diurno
      if (regime !== undefined && regime === "noturnista") {
        const h = parseInt(p.horario.inicio.split(":")[0]);
        if (h >= 6 && h < 18) {
          avisos.push({
            tipo: "sub_cobertura",
            dia: d,
            colaboradorId: p.colaboradorId,
            mensagem: `${nome(p.colaboradorId)}: noturnista escalado para turno diurno (${p.horario.inicio}-${p.horario.fim}).`,
          });
        }
      }

      // 3. Verificar 11h entre jornadas (mínimo legal)
      const turnoOntem = plantoesOntem.find((po) => po.colaboradorId === p.colaboradorId);
      if (turnoOntem) {
        const fimOntemMin = (() => {
          const [h, m] = turnoOntem.horario.fim.split(":").map(Number);
          return h * 60 + m;
        })();
        const inicioHojeMin = (() => {
          const [h, m] = p.horario.inicio.split(":").map(Number);
          return h * 60 + m;
        })();
        let intervalo = inicioHojeMin - fimOntemMin;
        if (intervalo < 0) intervalo += 24 * 60; // turno noturno que termina dia seguinte
        if (intervalo < 11 * 60) {
          avisos.push({
            tipo: "intervalo_insuficiente",
            dia: d,
            colaboradorId: p.colaboradorId,
            mensagem: `${nome(p.colaboradorId)}: intervalo de ${Math.round(intervalo / 60)}h entre jornadas nos dias ${d - 1} e ${d} (mínimo legal: 11h).`,
          });
        }
      }
    }

    // 4. Colisão (mesmo ID em múltiplos plantões no mesmo dia)
    const colaboradorIds = new Set(plantoesDia.map((p) => p.colaboradorId));
    if (colaboradorIds.size !== plantoesDia.length) {
      avisos.push({
        tipo: "colisao",
        dia: d,
        mensagem: `Dia ${d} tem colisão de colaborador (mesmo ID em múltiplos plantões).`,
      });
    }
  }

  // 5. Carga horária semanal (>44h para 5x2)
  const horasPorSemana = new Map<string, Map<number, number>>(); // colaboradorId -> (semana -> horas)
  for (let d = 1; d <= totalDias; d++) {
    const semana = Math.floor((d - 1 + new Date(ano, mes - 1, 1).getDay()) / 7) + 1;
    for (const p of (plantoes[d] ?? [])) {
      if (mapRegime.get(p.colaboradorId) !== "5x2") continue;
      if (!horasPorSemana.has(p.colaboradorId)) horasPorSemana.set(p.colaboradorId, new Map());
      const mapSemana = horasPorSemana.get(p.colaboradorId)!;
      const mins = minutosEntre(p.horario.inicio, p.horario.fim);
      mapSemana.set(semana, (mapSemana.get(semana) ?? 0) + mins / 60);
    }
  }
  for (const [colabId, semanas] of horasPorSemana) {
    for (const [semana, horas] of semanas) {
      if (horas > 44) {
        avisos.push({
          tipo: "carga_semanal_excessiva",
          colaboradorId: colabId,
          mensagem: `${nome(colabId)}: carga horária de ${horas.toFixed(1)}h na semana ${semana} (limite 44h).`,
        });
      }
    }
  }

  // 6. DSR (Descanso Semanal Remunerado) — 5x2 precisa de ao menos 1 domingo de folga
  const domingosTrabalhados = new Map<string, number>();
  for (let d = 1; d <= totalDias; d++) {
    const diaSemana = new Date(ano, mes - 1, d).getDay();
    if (diaSemana !== 0) continue; // só domingos
    for (const p of (plantoes[d] ?? [])) {
      if (mapRegime.get(p.colaboradorId) !== "5x2") continue;
      domingosTrabalhados.set(p.colaboradorId, (domingosTrabalhados.get(p.colaboradorId) ?? 0) + 1);
    }
  }
  for (const [colabId, qtd] of domingosTrabalhados) {
    // O mês tem ~4-5 domingos; se trabalhou todos, não tem DSR
    const totalDomingos = (() => {
      let count = 0;
      for (let d = 1; d <= totalDias; d++) {
        if (new Date(ano, mes - 1, d).getDay() === 0) count++;
      }
      return count;
    })();
    if (qtd >= totalDomingos) {
      avisos.push({
        tipo: "dsr_violado",
        colaboradorId: colabId,
        mensagem: `${nome(colabId)}: trabalhou todos os ${qtd} domingos do mês — sem DSR obrigatório.`,
      });
    }
  }

  return avisos;
}
