import { gerarEscala, validarEscala, normalizarRegime, horarioPeloRegime, REGIMES_VALIDOS } from "../generator";
import type { Colaborador, Plantao, Regime } from "../types";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(desc: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(detail ? `${desc} — ${detail}` : desc);
  }
  console.log(`${condition ? "✔" : "✗"} ${desc}${detail && !condition ? " — " + detail : ""}`);
}

// ─── PRD Regra 1: 24/72 não pode ter dias consecutivos (folga de 72h) ───
function test24x72() {
  console.log("\n=== 24/72: folga mínima de 72h (3 dias entre plantões) ===");
  for (let seed = 0; seed < 30; seed++) {
    const colabs: Colaborador[] = [
      { id: "c1", nome: "Cuidador", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    ];
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    const days = Object.keys(r.plantoes)
      .filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c1"))
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 1; i < days.length; i++) {
      const gap = days[i] - days[i - 1];
      check(`24/72 seed=${seed}: gap ${days[i-1]}→${days[i]} ≥ 3`, gap >= 3, `gap=${gap}`);
    }
  }

  // Horário: 07:00 às 07:00 (24h)
  const horario = horarioPeloRegime("24/72");
  check("24/72 horário 07:00→07:00 (24h)", horario.inicio === "07:00" && horario.fim === "07:00",
    `got ${horario.inicio}-${horario.fim}`);
  check("24/72 turno=integral", horario.turno === "integral");
}

// ─── PRD Regra 3: 12x36 trabalha dia sim, dia não ───
function test12x36() {
  console.log("\n=== 12x36: dia sim, dia não (paridade alternada) ===");
  for (let seed = 0; seed < 30; seed++) {
    const colabs: Colaborador[] = [
      { id: "c1", nome: "Noturnista", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
    ];
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    const days = Object.keys(r.plantoes)
      .filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c1"))
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 1; i < days.length; i++) {
      const gap = days[i] - days[i - 1];
      check(`12x36 seed=${seed}: gap ${days[i-1]}→${days[i]} ≥ 2`, gap >= 2, `gap=${gap} (consecutive shifts!)`);
    }
  }

  // Two paired 12x36 should cover all days
  const colabs: Colaborador[] = [
    { id: "c1", nome: "A", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
    { id: "c2", nome: "B", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
  ];
  const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed: 42 });
  const daysC1 = Object.keys(r.plantoes).filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c1")).map(Number);
  const daysC2 = Object.keys(r.plantoes).filter((d) => r.plantoes[Number(d)].some((p) => p.colaboradorId === "c2")).map(Number);
  check("12x36 paired: c1 even days", daysC1.every((d) => d % 2 === 0), `odd days found: ${daysC1.filter((d) => d % 2 !== 0)}`);
  check("12x36 paired: c2 odd days", daysC2.every((d) => d % 2 !== 0), `even days found: ${daysC2.filter((d) => d % 2 === 0)}`);
  const allDays = new Set([...daysC1, ...daysC2]);
  check("12x36 paired: no overlap", allDays.size === daysC1.length + daysC2.length);

  // Horário: 19:00 às 07:00 (12h noturno)
  const horario = horarioPeloRegime("12x36");
  check("12x36 horário 19:00→07:00 (12h)", horario.inicio === "19:00" && horario.fim === "07:00",
    `got ${horario.inicio}-${horario.fim}`);
  check("12x36 turno=noite", horario.turno === "noite");
}

// ─── PRD Regra 4: 5x2 trabalha 5 dias, folga 2 ───
function test5x2() {
  console.log("\n=== 5x2: segunda a sexta, sem fds ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "Téc Enf", cargoId: null, cargoNome: "Téc Enf", regime: "5x2" },
  ];
  for (let seed = 0; seed < 20; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    for (let d = 1; d <= 31; d++) {
      const diaSemana = new Date(2026, 0, d).getDay();
      const hasPlantao = (r.plantoes[d] ?? []).some((p) => p.colaboradorId === "c1");
      if (diaSemana === 0 || diaSemana === 6) {
        check(`5x2 seed=${seed} dia ${d} (fds) sem plantão`, !hasPlantao, "trabalhou no fim de semana!");
      }
    }
  }

  // Carga semanal ≤ 44h
  for (let seed = 0; seed < 20; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    const avisos = validarEscala({ mes: 1, ano: 2026, plantoes: r.plantoes, colaboradores: colabs, totalDias: 31 });
    const carga = avisos.filter((a) => a.tipo === "carga_semanal_excessiva" && a.colaboradorId === "c1");
    check(`5x2 seed=${seed}: sem carga semanal > 44h`, carga.length === 0, `${carga.length} violações`);
  }

  // Horário: 08:00 às 17:00 (9h diurno)
  const horario = horarioPeloRegime("5x2");
  check("5x2 horário 08:00→17:00", horario.inicio === "08:00" && horario.fim === "17:00",
    `got ${horario.inicio}-${horario.fim}`);
  check("5x2 turno=manha", horario.turno === "manha");
}

// ─── PRD Regra 5: Noturnistas só no turno da noite ───
function testNoturnista() {
  console.log("\n=== Noturnista: só turno noturno ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "Noturno", cargoId: null, cargoNome: "Noturnista", regime: "noturnista" },
  ];
  for (let seed = 0; seed < 20; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    for (const [diaStr, plantoes] of Object.entries(r.plantoes)) {
      for (const p of plantoes) {
        if (p.colaboradorId !== "c1") continue;
        const h = parseInt(p.horario.inicio.split(":")[0]);
        check(`noturnista seed=${seed} dia ${diaStr}: início ≥ 18h ou < 6h`,
          h >= 18 || h < 6, `início às ${p.horario.inicio}`);
      }
    }
  }
  const horario = horarioPeloRegime("noturnista");
  check("noturnista horário 19:00→07:00", horario.inicio === "19:00" && horario.fim === "07:00");
  check("noturnista turno=noite", horario.turno === "noite");
}

// ─── PRD Regra 6: Diarista só dias úteis, manhã ───
function testDiarista() {
  console.log("\n=== Diarista: só dias úteis, manhã ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "Diarista", cargoId: null, cargoNome: "Diarista", regime: "diarista" },
  ];
  for (let seed = 0; seed < 20; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    for (let d = 1; d <= 31; d++) {
      const diaSemana = new Date(2026, 0, d).getDay();
      const hasPlantao = (r.plantoes[d] ?? []).some((p) => p.colaboradorId === "c1");
      if (diaSemana === 0 || diaSemana === 6) {
        check(`diarista seed=${seed} dia ${d} (fds) sem plantão`, !hasPlantao, "diarista no fim de semana!");
      }
    }
  }
  const horario = horarioPeloRegime("diarista");
  check("diarista horário 07:00→15:00", horario.inicio === "07:00" && horario.fim === "15:00");
  check("diarista turno=manha", horario.turno === "manha");
}

// ─── PRD Regra 2: Colaborador não pode estar em dois turnos no mesmo dia ───
function testSemColisaoMesmoDia() {
  console.log("\n=== Sem colisão no mesmo dia ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "A", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    { id: "c2", nome: "B", cargoId: null, cargoNome: "Téc", regime: "5x2" },
    { id: "c3", nome: "C", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
  ];
  for (let seed = 0; seed < 30; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    for (let d = 1; d <= 31; d++) {
      const plantoes = r.plantoes[d] ?? [];
      const byColab = new Map<string, number>();
      for (const p of plantoes) {
        byColab.set(p.colaboradorId, (byColab.get(p.colaboradorId) ?? 0) + 1);
      }
      for (const [id, count] of byColab) {
        check(`seed=${seed} dia ${d}: ${id} sem colisão`, count <= 1, `${id} aparece ${count}x no dia ${d}`);
      }
    }
  }
}

// ─── PRD Regra 7: Distribuição uniforme ───
function testDistribuicaoUniforme() {
  console.log("\n=== Distribuição uniforme entre colaboradores do mesmo cargo ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "A", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    { id: "c2", nome: "B", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    { id: "c3", nome: "C", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    { id: "c4", nome: "D", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
  ];
  const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed: 42 });
  const counts = new Map<string, number>();
  for (let d = 1; d <= 31; d++) {
    for (const p of r.plantoes[d] ?? []) {
      counts.set(p.colaboradorId, (counts.get(p.colaboradorId) ?? 0) + 1);
    }
  }
  const vals = [...counts.values()];
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const spread = max - min;
  check(`24/72 ×4: distribuição equilibrada (spread ≤ 2)`, spread <= 2, `min=${min} max=${max} spread=${spread}`);
  console.log(`    Plantões por colaborador: ${[...counts.entries()].map(([id, n]) => `${id}=${n}`).join(", ")}`);
}

// ─── Validação: 11h mínimas entre jornadas (legal) ───
function testIntervalo11h() {
  console.log("\n=== Intervalo mínimo de 11h entre jornadas ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "A", cargoId: null, cargoNome: "Téc", regime: "5x2" },
    { id: "c2", nome: "B", cargoId: null, cargoNome: "Noturnista", regime: "12x36" },
  ];
  for (let seed = 0; seed < 20; seed++) {
    const r = gerarEscala({ mes: 1, ano: 2026, colaboradores: colabs, seed });
    const avisos = validarEscala({ mes: 1, ano: 2026, plantoes: r.plantoes, colaboradores: colabs, totalDias: 31 });
    const intervalos = avisos.filter((a) => a.tipo === "intervalo_insuficiente");
    check(`seed=${seed}: sem intervalo < 11h`, intervalos.length === 0, `${intervalos.length} violações: ${intervalos.map((a) => a.mensagem).join("; ")}`);
  }
}

// ─── Normalização de regimes alternativos ───
function testNormalizacao() {
  console.log("\n=== Normalização de regimes ===");
  check("normalizar '24h/72h' → 24/72", normalizarRegime("24h/72h") === "24/72");
  check("normalizar '12h/36h' → 12x36", normalizarRegime("12h/36h") === "12x36");
  check("normalizar '5 dias / 2 dias' → 5x2", normalizarRegime("5 dias / 2 dias") === "5x2");
  check("normalizar 'Noturno' → noturnista", normalizarRegime("Noturno") === "noturnista");
  check("normalizar regime inválido → undefined", normalizarRegime("xyz") === undefined);

  // Ciclos personalizados aceitos pelo gerador
  console.log("\n=== CICLOS PERSONALIZADOS RECONHECIDOS ===");
  const ciclosPersonalizados = ["12x24", "12x72", "12x60", "12x48", "24x72"];
  for (const r of ciclosPersonalizados) {
    const norm = normalizarRegime(r);
    check(`normalizar '${r}'`, norm !== undefined, `não reconhecido pelo gerador`);
  }
  console.log(`\nRegimes nomeados no sistema: ${REGIMES_VALIDOS.join(", ")}`);
  console.log(`Ciclos personalizados aceitos: ${ciclosPersonalizados.join(", ")}`);
}

// ─── Multi-mês: funciona em todos os meses ───
function testMultiMes() {
  console.log("\n=== Geração em todos os meses (2026) ===");
  const colabs: Colaborador[] = [
    { id: "c1", nome: "A", cargoId: null, cargoNome: "Cuidador", regime: "24/72" },
    { id: "c2", nome: "B", cargoId: null, cargoNome: "Téc", regime: "5x2" },
  ];
  for (let mes = 1; mes <= 12; mes++) {
    const totalDias = new Date(2026, mes, 0).getDate();
    const r = gerarEscala({ mes, ano: 2026, colaboradores: colabs, seed: 42 });
    check(`mês ${mes} (${totalDias} dias): ${Object.keys(r.plantoes).length} dias`, Object.keys(r.plantoes).length === totalDias);
  }
}

// ─── Executa tudo ───
test24x72();
test12x36();
test5x2();
testNoturnista();
testDiarista();
testSemColisaoMesmoDia();
testDistribuicaoUniforme();
testIntervalo11h();
testNormalizacao();
testMultiMes();

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTADO: ${pass} pass, ${fail} fail`);
if (failures.length > 0) {
  console.log(`\nFALHAS:`);
  for (const f of failures) console.log(`  ✗ ${f}`);
}
console.log(`${"=".repeat(60)}`);
process.exit(fail > 0 ? 1 : 0);
