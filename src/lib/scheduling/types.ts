/**
 * Tipos do motor de geração de escala do Integra Escala.
 *
 * Mantidos isolados de React/Next para permitir testes puros (Node `tsx --test`).
 */

/** Turno derivado do regime, não configurado por ILPI. */
export type Turno = "manha" | "tarde" | "noite" | "diurno" | "integral";

/** Regime reconhecido. Texto livre da UI é normalizado para um destes. */
export type Regime = "24/72" | "12x36" | "5x2" | "noturnista" | "diarista";

/** Horário (HH:MM) de início e fim de um plantão. Fim pode ser no dia seguinte. */
export interface Horario {
  inicio: string; // HH:MM
  fim: string; // HH:MM
}

export interface Colaborador {
  id: string;
  nome: string;
  cargoId: string | null;
  cargoNome: string;
  /** Regime efetivo — pode sobrescrever o do cargo. */
  regime: Regime;
  diasFolga?: number[];
  restricoes?: string[];
  horarioNominal?: Horario;
}

/** Plantão efetivo atribuído a um colaborador em um dia do mês. */
export interface Plantao {
  colaboradorId: string;
  dia: number; // 1..31
  horario: Horario;
}

export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EscalaGerada {
  mes: number; // 1..12
  ano: number;
  plantoes: Record<number, Plantao[]>;
  avisos: Aviso[];
}

export interface Aviso {
  tipo: "sub_cobertura" | "colaborador_sem_regime" | "dia_descoberto";
  dia?: number;
  colaboradorId?: string;
  mensagem: string;
}

export interface OpcoesGeracao {
  manterAjustesManuais?: boolean;
  seed?: number;
}

export type PlantoesExistentes = Record<number, Plantao[]>;
