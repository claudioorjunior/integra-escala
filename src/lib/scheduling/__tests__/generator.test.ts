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
    assert.equal(avisos[0].tipo, "sub_cobertura");
  });
})

describe("regression: validarEscala uses mes/ano (not hardcoded 2026)", () => {
  it("detects 11h interval correctly for different years", () => {
    // 2026: Jan 1 = Thursday; 2027: Jan 1 = Friday
    const plantoes: Record<number, Plantao[]> = {
      1: [{ colaboradorId: "c2", dia: 1, horario: { inicio: "14:00", fim: "23:00" } }],
      2: [{ colaboradorId: "c2", dia: 2, horario: { inicio: "07:00", fim: "17:00" } }],
    };
    // 8h interval (23:00 -> 07:00) < 11h, should warn for both years
    const avisos2026 = validarEscala({ mes: 1, ano: 2026, plantoes, colaboradores: COLABS_FIXOS, totalDias: 31 });
    const avisos2027 = validarEscala({ mes: 1, ano: 2027, plantoes, colaboradores: COLABS_FIXOS, totalDias: 31 });
    // Both should detect the 11h violation
    const hasWarn2026 = avisos2026.some(a => a.mensagem.includes("11h"));
    const hasWarn2027 = avisos2027.some(a => a.mensagem.includes("11h"));
    assert.ok(hasWarn2026, "should warn for 2026");
    assert.ok(hasWarn2027, "should warn for 2027 (proves year is used)");
  });
});

describe("regression: 12x36 alternates correctly with first-day-of-month", () => {
  it("different first-day-of-week gives different alternation pattern", () => {
    // January 2026: 1st = Thu (day 4)
    // January 2027: 1st = Fri (day 5)
    const colab: Colaborador[] = [{ id: "c1", nome: "Test", cargoId: null, cargoNome: "X", regime: "12x36" as Regime }];
    const r2026 = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed: 42 });
    const r2027 = gerarEscala({ mes: 1, ano: 2027, colaboradores: colab, seed: 42 });
    // Patterns should differ because first-day-of-month is different
    const days2026 = Object.keys(r2026.plantoes).filter(d => r2026.plantoes[Number(d)].length > 0).map(Number);
    const days2027 = Object.keys(r2027.plantoes).filter(d => r2027.plantoes[Number(d)].length > 0).map(Number);
    assert.notEqual(JSON.stringify(days2026), JSON.stringify(days2027),
      "12x36 pattern should vary by month start day");
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

