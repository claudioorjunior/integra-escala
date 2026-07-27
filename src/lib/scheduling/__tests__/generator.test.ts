import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gerarEscala, validarEscala } from "../generator";
import type { Colaborador, Plantao } from "../types";

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
    const avisos = validarEscala({ plantoes, colaboradores: COLABS_FIXOS, totalDias: 30 });
    assert.ok(avisos.length >= 1);
    assert.equal(avisos[0].tipo, "sub_cobertura");
  });
});
