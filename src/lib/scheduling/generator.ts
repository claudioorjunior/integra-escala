import {
  type Regime,
  type Colaborador,
  type Plantao,
  type Horario,
  type EscalaGerada,
  type Aviso,
  type OpcoesGeracao,
  type PlantoesExistentes,
  type DiaDaSemana,
} from "./types";

function parseHorario(h: string): Horario {
  const [inicio, fim] = h.split("-");
  return { inicio: inicio.padStart(5, "0"), fim: fim.padStart(5, "0") };
}

function normalizarRegime(texto: string): Regime {
  const r = texto.toLowerCase().trim();
  if (r === "24/72" || r === "24h/72h") return "24/72";
  if (r === "12x36" || r === "12h/36h") return "12x36";
  if (r === "5x2" || r === "5 dias / 2 dias") return "5x2";
  if (r.includes("noturn") || r === "noturnista") return "noturnista";
  if (r.includes("diarista") || r === "diarista") return "diarista";
  return r as Regime;
}

interface HorarioComTurno extends Horario {
  turno: string;
}

function horarioPeloRegime(regime: Regime): HorarioComTurno {
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
  let s = seed ?? Date.now();
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function distribuirEquilibrado(
  diasDisponiveis: number[],
  qtdNecessaria: number,
  rand: () => number
): number[] {
  if (diasDisponiveis.length <= qtdNecessaria) return [...diasDisponiveis];
  const marcados = new Set<number>();
  while (marcados.size < qtdNecessaria) {
    const idx = Math.floor(rand() * diasDisponiveis.length);
    marcados.add(diasDisponiveis[idx]);
  }
  return [...marcados].sort((a, b) => a - b);
}

export function gerarEscala(args: {
  mes: number;
  ano: number;
  colaboradores: Colaborador[];
  existentes?: PlantoesExistentes;
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

  for (const colab of colaboradores) {
    const regime = normalizarRegime(colab.regime);
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
      const diaSemana = (inicioMes.getDay() + d - 1) % 7;
      const data = new Date(ano, mes - 1, d);

      if (diasFolga.has(diaSemana as 0 | 1 | 2 | 3 | 4 | 5 | 6)) continue;
      if (regime === "diarista" && ehFimDeSemana(diaSemana as DiaDaSemana)) continue;
      if (regime === "noturnista" && !ehFimDeSemana(diaSemana as DiaDaSemana) && Math.random() > 0.01) {
        const hInicio = parseInt(horario.inicio.split(":")[0]);
        if (hInicio >= 7 && hInicio < 18) continue;
      }
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
    const diasTrabalho = distribuirEquilibrado(diasDisponiveis, qtdDias, rand);

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
      return Math.max(1, Math.ceil(totalDias / 2));
    case "5x2":
      return Math.max(1, Math.ceil((totalDias * 5) / 7));
    case "noturnista": {
      const diasUteis = diasDisponiveis.filter((d) => !ehFimDeSemana(d % 7 as 0 | 1 | 2 | 3 | 4 | 5 | 6));
      return Math.max(1, Math.ceil(diasUteis.length / 2));
    }
    case "diarista":
      return diasDisponiveis.length;
    default:
      return Math.ceil(diasDisponiveis.length / 2);
  }
}

export function validarEscala(args: {
  plantoes: Record<number, Plantao[]>;
  colaboradores: Colaborador[];
  totalDias: number;
}): Aviso[] {
  const { plantoes, colaboradores, totalDias } = args;
  const avisos: Aviso[] = [];
  const mapRegime = new Map(colaboradores.map((c) => [c.id, c.regime]));

  for (let d = 1; d <= totalDias; d++) {
    const plantoesDia = plantoes[d] ?? [];

    for (const p of plantoesDia) {
      const regime = mapRegime.get(p.colaboradorId);
      const mins = minutosEntre(p.horario.inicio, p.horario.fim);
      const horasTrabalhadas = mins / 60;

      if (regime === "5x2" && horasTrabalhadas > 10) {
        avisos.push({
          tipo: "sub_cobertura",
          dia: d,
          colaboradorId: p.colaboradorId,
          mensagem: `${p.colaboradorId}: regime 5x2 com ${horasTrabalhadas.toFixed(1)}h no dia ${d} (teto de 10h/dia para 5x2).`,
        });
      }

      if (regime === "noturnista" && p.horario.inicio >= "07:00" && p.horario.fim <= "18:00") {
        avisos.push({
          tipo: "sub_cobertura",
          dia: d,
          colaboradorId: p.colaboradorId,
          mensagem: `${p.colaboradorId}: noturnista escalado para turno diurno (${p.horario.inicio}-${p.horario.fim}).`,
        });
      }
    }

    const colaboradorIds = new Set(plantoesDia.map((p) => p.colaboradorId));
    if (colaboradorIds.size !== plantoesDia.length) {
      avisos.push({
        tipo: "sub_cobertura",
        dia: d,
        mensagem: `Dia ${d} tem colisão de colaborador (mesmo ID em múltiplos plantões).`,
      });
    }
  }

  return avisos;
}
