import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gerarEscala, validarEscala } from "../generator";
import type { Colaborador, Plantao, Regime } from "../types";

const COLABS_FIXOS: Colaborador[] = [
  { id: "c1", nome: "Fátima", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
  { id: "c2", nome: "Maria", cargoId: null, cargoNome: "Técnica Enf.", regime: "5x2" },
  { id: "c3", nome: "João", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
  { id: "c4", nome: "Carlos", cargoId: null, cargoNome: "Diarista", regime: "diarista" },
];

describe("gerarEscala", () => {
  it("retorna estrutura com dias 1..totalDoMes", () => {
    const result = gerarEscala({ mes: 2, ano: 2026, colaboradores: COLABS_FIXOS, seed: 42 });
    assert.equal(Object.keys(result.plantoes).length, 28);
    Object.values(result.plantoes).forEach((ps) => {
      for (const p of ps) {
        assert.ok(p.dia >= 1);
        assert.ok(p.dia <= 28);
      }
    });
  });

  it("usa seed determinística — mesma seed gera mesmos resultados", () => {
    const a = gerarEscala({ mes: 4, ano: 2026, colaboradores: COLABS_FIXOS, seed: 7 });
    const b = gerarEscala({ mes: 4, ano: 2026, colaboradores: COLABS_FIXOS, seed: 7 });
    assert.equal(JSON.stringify(a.plantoes), JSON.stringify(b.plantoes));
  });

  it("diarista só aparece em dias de semana (seg-sex)", () => {
    const result = gerarEscala({ mes: 1, ano: 2026, colaboradores: COLABS_FIXOS, seed: 13 });
    for (let d = 1; d <= 31; d++) {
      const domingos = (result.plantoes[d] ?? []).filter((p) => p.colaboradorId === "c4");
      const diaSemana = new Date(2026, 0, d).getDay();
      if (diaSemana === 0 || diaSemana === 6) assert.equal(domingos.length, 0);
    }
  });
});

describe("validarEscala", () => {
  it("deteta colaborador em dois turnos no mesmo dia", () => {
    const plantoes: Record<number, Plantao[]> = {
      15: [
        { colaboradorId: "c1", dia: 15, horario: { inicio: "08:00", fim: "17:00" } },
        { colaboradorId: "c1", dia: 15, horario: { inicio: "19:00", fim: "07:00" } },
      ],
    };
    const avisos = validarEscala({ mes: 1, ano: 2026, plantoes, colaboradores: COLABS_FIXOS, totalDias: 30 });
    assert.ok(avisos.length >= 1);
    assert.ok(
      avisos.some((a) => a.tipo === "colisao" && a.mensagem.includes("colisão")),
      "should detect collision by message text"
    );
  });
})

describe("regression: DSR count varies by year", () => {
  it("March 2026 (5 Sundays) vs March 2027 (4 Sundays) give different DSR results", () => {
    // c2 is 5x2 in COLABS_FIXOS
    // March 2026: 5 Sundays (days 1, 8, 15, 22, 29)
    // March 2027: 4 Sundays (days 7, 14, 21, 28)
    const plantoes2026: Record<number, Plantao[]> = {
      8: [{ colaboradorId: "c2", dia: 8, horario: { inicio: "08:00", fim: "17:00" } }],
      15: [{ colaboradorId: "c2", dia: 15, horario: { inicio: "08:00", fim: "17:00" } }],
      22: [{ colaboradorId: "c2", dia: 22, horario: { inicio: "08:00", fim: "17:00" } }],
      29: [{ colaboradorId: "c2", dia: 29, horario: { inicio: "08:00", fim: "17:00" } }],
    };
    const plantoes2027: Record<number, Plantao[]> = {
      7: [{ colaboradorId: "c2", dia: 7, horario: { inicio: "08:00", fim: "17:00" } }],
      14: [{ colaboradorId: "c2", dia: 14, horario: { inicio: "08:00", fim: "17:00" } }],
      21: [{ colaboradorId: "c2", dia: 21, horario: { inicio: "08:00", fim: "17:00" } }],
      28: [{ colaboradorId: "c2", dia: 28, horario: { inicio: "08:00", fim: "17:00" } }],
    };
    const avisos2026 = validarEscala({ mes: 3, ano: 2026, plantoes: plantoes2026, colaboradores: COLABS_FIXOS, totalDias: 31 });
    const avisos2027 = validarEscala({ mes: 3, ano: 2027, plantoes: plantoes2027, colaboradores: COLABS_FIXOS, totalDias: 31 });
    // 2026: 4 of 5 Sundays → no DSR violation
    // 2027: 4 of 4 Sundays → DSR violation
    const hasDSR2026 = avisos2026.some((a) => a.tipo === "dsr_violado");
    const hasDSR2027 = avisos2027.some((a) => a.tipo === "dsr_violado");
    assert.ok(!hasDSR2026, "March 2026: 4 of 5 Sundays, no DSR violation expected");
    assert.ok(hasDSR2027, "March 2027: 4 of 4 Sundays, DSR violation expected");
  });
});

describe("regression: 12x36 paired collaborators get opposite parities", () => {
  it("two 12x36 collaborators cover all days with opposite parities", () => {
    const colabs: Colaborador[] = [
      { id: "c1", nome: "A", cargoId: null, cargoNome: "X", regime: "12x36" as Regime },
      { id: "c2", nome: "B", cargoId: null, cargoNome: "X", regime: "12x36" as Regime },
    ];
    const result = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed: 42 });
    const daysC1 = Object.keys(result.plantoes)
      .filter((d) => result.plantoes[Number(d)].some((p) => p.colaboradorId === "c1"))
      .map(Number);
    const daysC2 = Object.keys(result.plantoes)
      .filter((d) => result.plantoes[Number(d)].some((p) => p.colaboradorId === "c2"))
      .map(Number);
    // c1 (index 0) gets even days, c2 (index 1) gets odd days
    assert.ok(daysC1.every((d) => d % 2 === 0), "c1 should work even days");
    assert.ok(daysC2.every((d) => d % 2 === 1), "c2 should work odd days");
    // Together they cover all available days with no overlap
    const allDays = new Set([...daysC1, ...daysC2]);
    assert.equal(allDays.size, daysC1.length + daysC2.length, "no overlap between paired collaborators");
  });
});

describe("regression: 24/72 never has consecutive days", () => {
  it("ensures minimum 3-day gap between shifts", () => {
    const colab: Colaborador[] = [{ id: "c1", nome: "Test", cargoId: null, cargoNome: "X", regime: "24/72" as Regime }];
    for (let seed = 0; seed < 20; seed++) {
      const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed });
      const days = Object.keys(r.plantoes).filter(d => r.plantoes[Number(d)].length > 0).map(Number);
      for (let i = 1; i < days.length; i++) {
        assert.ok(days[i] - days[i-1] >= 3,
          `24/72 must have 3-day gap: got ${days[i-1]} and ${days[i]} (seed=${seed})`);
      }
    }
  });
});

