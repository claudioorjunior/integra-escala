/**
 * Pure helpers for the schedule visualization UI (MonthCard / dashboard).
 * Kept free of React/Next so they can be tested with `tsx --test`.
 */

export interface PlantaoVisualizacao {
  colaboradorId: string;
  dia: number;
  horarioInicio: string;
  horarioFim: string;
}

export interface ColaboradorInfo {
  nome: string;
  cor: string;
}

export interface PlantaoRender {
  nome: string;
  cargo: string;
  horario: string;
  cor: string;
}

export interface DiaEscalaRender {
  dia: number;
  plantoes: PlantaoRender[];
}

/** Normalize a DB timestamp ("07:00:00") or null into "HH:MM" display text. */
export function formatarHorario(
  horario: string | null | undefined,
  fallback: string
): string {
  return (horario ?? fallback).slice(0, 5);
}

/**
 * Group raw `escala_dias` rows into per-day render lists, joining collaborator
 * display info (name + color) from a map. Days come out sorted ascending.
 */
export function agruparPlantoesPorDia(
  plantoes: PlantaoVisualizacao[],
  colabMap: Record<string, ColaboradorInfo>
): DiaEscalaRender[] {
  const porDia = new Map<number, PlantaoRender[]>();

  for (const p of plantoes) {
    const info = colabMap[p.colaboradorId] ?? {
      nome: "Externo",
      cor: "#999999",
    };
    const render: PlantaoRender = {
      nome: info.nome,
      cargo: "",
      horario: `${formatarHorario(p.horarioInicio, "07:00")}-${formatarHorario(
        p.horarioFim,
        "19:00"
      )}`,
      cor: info.cor,
    };
    const lista = porDia.get(p.dia) ?? [];
    lista.push(render);
    porDia.set(p.dia, lista);
  }

  return [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, plantoesList]) => ({ dia, plantoes: plantoesList }));
}
