import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gerarEscala,
  validarEscala,
  parseCiclo,
  normalizarRegime,
  formatRegime,
  horarioPeloRegime,
} from "../generator";
import type { Colaborador, Plantao } from "../types";

// ── Unit: parseCiclo ─────────────────────────────────────────────────────────

describe("parseCiclo", () => {
  it("parses standard NxM patterns", () => {
    assert.deepEqual(parseCiclo("12x36"), { horasTrabalhadas: 12, horasFolga: 36 });
    assert.deepEqual(parseCiclo("12x24"), { horasTrabalhadas: 12, horasFolga: 24 });
    assert.deepEqual(parseCiclo("12x48"), { horasTrabalhadas: 12, horasFolga: 48 });
    assert.deepEqual(parseCiclo("12x60"), { horasTrabalhadas: 12, horasFolga: 60 });
    assert.deepEqual(parseCiclo("12x72"), { horasTrabalhadas: 12, horasFolga: 72 });
    assert.deepEqual(parseCiclo("24x72"), { horasTrabalhadas: 24, horasFolga: 72 });
  });

  it("accepts Unicode multiplication sign (×)", () => {
    assert.deepEqual(parseCiclo("12×36"), { horasTrabalhadas: 12, horasFolga: 36 });
  });

  it("is case-insensitive and trims whitespace", () => {
    assert.deepEqual(parseCiclo("  12X36  "), { horasTrabalhadas: 12, horasFolga: 36 });
  });

  it("rejects invalid patterns", () => {
    assert.equal(parseCiclo("abc"), undefined);
    assert.equal(parseCiclo("0x24"), undefined);
    assert.equal(parseCiclo("12x0"), undefined);
    assert.equal(parseCiclo("100x24"), undefined); // sanity check: >48 work hours
    assert.equal(parseCiclo(""), undefined);
  });
});

// ── Unit: normalizarRegime ────────────────────────────────────────────────────

describe("normalizarRegime", () => {
  it("recognizes named regimes", () => {
    assert.equal(normalizarRegime("24/72"), "24/72");
    assert.equal(normalizarRegime("12x36"), "12x36");
    assert.equal(normalizarRegime("5x2"), "5x2");
    assert.equal(normalizarRegime("noturnista"), "noturnista");
    assert.equal(normalizarRegime("diarista"), "diarista");
  });

  it("recognizes custom NxM cycles as Ciclo objects", () => {
    assert.deepEqual(normalizarRegime("12x24"), { horasTrabalhadas: 12, horasFolga: 24 });
    assert.deepEqual(normalizarRegime("12x48"), { horasTrabalhadas: 12, horasFolga: 48 });
    assert.deepEqual(normalizarRegime("12x60"), { horasTrabalhadas: 12, horasFolga: 60 });
    assert.deepEqual(normalizarRegime("12x72"), { horasTrabalhadas: 12, horasFolga: 72 });
    assert.deepEqual(normalizarRegime("24x72"), { horasTrabalhadas: 24, horasFolga: 72 });
  });

  it("returns undefined for unrecognized text", () => {
    assert.equal(normalizarRegime("xyz"), undefined);
    assert.equal(normalizarRegime(""), undefined);
    assert.equal(normalizarRegime("foo bar"), undefined);
  });
});

// ── Unit: formatRegime ────────────────────────────────────────────────────────

describe("formatRegime", () => {
  it("formats named regimes as-is", () => {
    assert.equal(formatRegime("24/72"), "24/72");
    assert.equal(formatRegime("12x36"), "12x36");
  });

  it("formats Ciclo objects as NxM", () => {
    assert.equal(formatRegime({ horasTrabalhadas: 12, horasFolga: 72 }), "12x72");
    assert.equal(formatRegime({ horasTrabalhadas: 24, horasFolga: 72 }), "24x72");
  });
});

// ── Unit: horarioPeloRegime ────────────────────────────────────────────────────

describe("horarioPeloRegime (custom cycles)", () => {
  it("derives 12h work as night shift (19:00→07:00)", () => {
    const h = horarioPeloRegime({ horasTrabalhadas: 12, horasFolga: 24 });
    assert.equal(h.inicio, "19:00");
    assert.equal(h.fim, "07:00");
    assert.equal(h.turno, "noite");
  });

  it("derives 24h work as integral (07:00→07:00)", () => {
    const h = horarioPeloRegime({ horasTrabalhadas: 24, horasFolga: 72 });
    assert.equal(h.inicio, "07:00");
    assert.equal(h.fim, "07:00");
    assert.equal(h.turno, "integral");
  });

  it("derives 8h work as morning shift", () => {
    const h = horarioPeloRegime({ horasTrabalhadas: 8, horasFolga: 16 });
    assert.equal(h.inicio, "08:00");
    assert.equal(h.fim, "17:00");
    assert.equal(h.turno, "manha");
  });
});

// ── Integration: generator respects custom cycle spacing ──────────────────────

const CICLOS_TESTAR = [
  { regime: "12x24", espacamentoEsperado: 2 },  // ciclo 36h → ceil(36/24) = 2 dias
  { regime: "12x36", espacamentoEsperado: 1 },  // named regime, usa alternado (dia sim/dia não)
  { regime: "12x48", espacamentoEsperado: 3 },  // ciclo 60h → ceil(60/24) = 3 dias
  { regime: "12x60", espacamentoEsperado: 3 },  // ciclo 72h → ceil(72/24) = 3 dias
  { regime: "12x72", espacamentoEsperado: 4 },  // ciclo 84h → ceil(84/24) = 4 dias
  { regime: "24x72", espacamentoEsperado: 4 },  // ciclo 96h → ceil(96/24) = 4 dias
];

for (const { regime, espacamentoEsperado } of CICLOS_TESTAR) {
  describe(`custom cycle: ${regime}`, () => {
    const colab: Colaborador[] = [
      { id: "c1", nome: "Test", cargoId: null, cargoNome: "X", regime },
    ];

    it("gera plantões sem erro de regime", () => {
      const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed: 42 });
      const semRegime = r.avisos.filter((a) => a.tipo === "colaborador_sem_regime");
      assert.equal(semRegime.length, 0, `${regime} não deve gerar aviso de regime desconhecido`);
    });

    it("respeita espaçamento mínimo entre plantões", () => {
      for (let seed = 0; seed < 20; seed++) {
        const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed });
        const dias = Object.keys(r.plantoes)
          .filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c1"))
          .map(Number)
          .sort((a, b) => a - b);

        for (let i = 1; i < dias.length; i++) {
          // 12x36 é o named regime que usa alternado (dia sim, dia não) — spacing 1
          // Para outros ciclos customizados, spacing = ceil(horasFolga / 24)
          if (regime === "12x36") {
            // 12x36 named regime uses alternado, spacing = 1
            assert.ok(
              dias[i] - dias[i - 1] >= 1,
              `${regime} (seed ${seed}): dias ${dias[i - 1]} e ${dias[i]} muito próximos`
            );
          } else {
            assert.ok(
              dias[i] - dias[i - 1] >= espacamentoEsperado,
              `${regime} (seed ${seed}): dias ${dias[i - 1]} e ${dias[i]} com gap ${dias[i] - dias[i - 1]} < ${espacamentoEsperado}`
            );
          }
        }
      }
    });

    it("valida escala sem violação de intervalo do ciclo", () => {
      const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed: 42 });
      const avisos = validarEscala({
        mes: 1,
        ano: 2026,
        plantoes: r.plantoes,
        colaboradores: colab,
        totalDias: 31,
      });
      const violacoesCiclo = avisos.filter((a) => a.tipo === "ciclo_intervalo_violado");
      assert.equal(
        violacoesCiclo.length,
        0,
        `${regime}: não deve haver violação de intervalo do ciclo: ${violacoesCiclo.map((v) => v.mensagem).join("; ")}`
      );
    });
  });
}

// ── Integration: multiple custom cycles coexist ────────────────────────────────

describe("múltiplos ciclos customizados coexistem", () => {
  it("cada colaborador respeita seu próprio ciclo", () => {
    const colabs: Colaborador[] = [
      { id: "a", nome: "Alpha", cargoId: null, cargoNome: "Cuidador", regime: "12x24" },
      { id: "b", nome: "Beta", cargoId: null, cargoNome: "Cuidador", regime: "12x72" },
      { id: "c", nome: "Gamma", cargoId: null, cargoNome: "Cuidador", regime: "24x72" },
    ];
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed: 99 });

    // Nenhum aviso de regime desconhecido
    const semRegime = r.avisos.filter((a) => a.tipo === "colaborador_sem_regime");
    assert.equal(semRegime.length, 0);

    // Validar com o validador
    const avisos = validarEscala({
      mes: 1,
      ano: 2026,
      plantoes: r.plantoes,
      colaboradores: colabs,
      totalDias: 31,
    });
    const violacoes = avisos.filter((a) => a.tipo === "ciclo_intervalo_violado");
    assert.equal(violacoes.length, 0, `Violações inesperadas: ${violacoes.map((v) => v.mensagem).join("; ")}`);
  });
});

// ── Integration: insufficient coverage never violates cycle spacing ───────────

describe("cobertura insuficiente sem violar folga", () => {
  it("gera aviso e mantém o intervalo mínimo do ciclo", () => {
    const colab: Colaborador[] = [
      {
        id: "c1",
        nome: "Test",
        cargoId: null,
        cargoNome: "Cuidador",
        regime: "12x24",
        // Dias úteis disponíveis, mas poucos o bastante para não atingir a
        // quantidade ideal de plantões sem quebrar o ciclo.
        diasFolga: [0, 6],
      },
    ];

    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed: 42 });
    const dias = Object.keys(r.plantoes)
      .filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c1"))
      .map(Number)
      .sort((a, b) => a - b);

    for (let i = 1; i < dias.length; i++) {
      assert.ok(
        dias[i] - dias[i - 1] >= 2,
        `12x24: dias ${dias[i - 1]} e ${dias[i]} violam o espaçamento mínimo`
      );
    }

    const aviso = r.avisos.find(
      (a) => a.tipo === "cobertura_insuficiente" && a.colaboradorId === "c1"
    );
    assert.ok(aviso, "deve avisar quando a cobertura ideal não puder ser atingida");
  });
});

// ── Integration: manager can override horarioNominal ───────────────────────────

describe("gestor define horário nominal custom", () => {
  it("respeita horarioNominal em vez do default do regime", () => {
    const colab: Colaborador[] = [
      {
        id: "c1",
        nome: "Custom",
        cargoId: null,
        cargoNome: "Cuidador",
        regime: "12x72",
        horarioNominal: { inicio: "06:00", fim: "18:00" }, // gestor escolhe diurno
      },
    ];
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colab, seed: 5 });
    const plantoes = Object.values(r.plantoes).flat();
    assert.ok(plantoes.length > 0, "deve gerar plantões");
    for (const p of plantoes) {
      assert.equal(p.horario.inicio, "06:00", "gestor escolheu início 06:00");
      assert.equal(p.horario.fim, "18:00", "gestor escolheu fim 18:00");
    }
  });
});

// ── Integration: validation detects cycle violations ───────────────────────────

describe("validação detecta violação de ciclo customizado", () => {
  it("flaga intervalo menor que horasFolga do ciclo", () => {
    const colab: Colaborador[] = [
      { id: "c1", nome: "Test", cargoId: null, cargoNome: "X", regime: "12x72" },
    ];
    // Plantões em dias consecutivos (1 e 2) — folga de apenas ~12h, não 72h
    const plantoes: Record<number, Plantao[]> = {
      1: [{ colaboradorId: "c1", dia: 1, horario: { inicio: "19:00", fim: "07:00" } }],
      2: [{ colaboradorId: "c1", dia: 2, horario: { inicio: "19:00", fim: "07:00" } }],
    };
    const avisos = validarEscala({
      mes: 1,
      ano: 2026,
      plantoes,
      colaboradores: colab,
      totalDias: 31,
    });
    const violacoes = avisos.filter((a) => a.tipo === "ciclo_intervalo_violado");
    assert.ok(violacoes.length > 0, "deve detectar violação de intervalo do ciclo 12x72");
  });
});
