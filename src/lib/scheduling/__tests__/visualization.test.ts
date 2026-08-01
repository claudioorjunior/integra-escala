import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPlantoesPorDia, formatarHorario } from "../visualization";

test("agruparPlantoesPorDia agrupa plantões por dia em ordem crescente", () => {
  const plantoes = [
    { colaboradorId: "c2", dia: 3, horarioInicio: "19:00", horarioFim: "07:00" },
    { colaboradorId: "c1", dia: 3, horarioInicio: "07:00", horarioFim: "19:00" },
    { colaboradorId: "c1", dia: 1, horarioInicio: "07:00", horarioFim: "19:00" },
  ];
  const colabMap = {
    c1: { nome: "Ana", cor: "#1a3c34" },
    c2: { nome: "Beto", cor: "#8b5e3c" },
  };

  const dias = agruparPlantoesPorDia(plantoes, colabMap);

  assert.equal(dias.length, 2);
  assert.deepEqual(dias.map((d) => d.dia), [1, 3]);
  assert.equal(dias[1].plantoes.length, 2);
  assert.deepEqual(dias[1].plantoes[0], {
    nome: "Beto",
    cargo: "",
    horario: "19:00-07:00",
    cor: "#8b5e3c",
  });
});

test("agruparPlantoesPorDia usa fallback para colaborador desconhecido", () => {
  const dias = agruparPlantoesPorDia(
    [
      {
        colaboradorId: "x",
        dia: 5,
        horarioInicio: "07:00:00",
        horarioFim: "19:00:00",
      },
    ],
    {}
  );

  assert.equal(dias[0].plantoes[0].nome, "Externo");
  assert.equal(dias[0].plantoes[0].horario, "07:00-19:00");
  assert.equal(dias[0].plantoes[0].cor, "#999999");
});

test("formatarHorario trunca HH:MM:SS e aplica fallback", () => {
  assert.equal(formatarHorario("07:00:00", "08:00"), "07:00");
  assert.equal(formatarHorario(null, "08:00"), "08:00");
  assert.equal(formatarHorario(undefined, "08:00"), "08:00");
});
