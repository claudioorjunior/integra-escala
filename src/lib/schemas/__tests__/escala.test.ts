import test from "node:test";
import assert from "node:assert/strict";

import { EscalaSchema } from "../escala";

const validEscala = {
  id: "0f273d5e-04c8-4283-a354-24702f6f6385",
  colaboradorId: "66ce95a5-64ac-4fa0-9d7f-02d5f96fd876",
  data: "2026-07-22",
};

test("EscalaSchema aceita payload válido", () => {
  const result = EscalaSchema.safeParse(validEscala);
  assert.equal(result.success, true);
});

test("EscalaSchema rejeita payload sem colaboradorId", () => {
  const { colaboradorId: _colaboradorId, ...payload } = validEscala;
  const result = EscalaSchema.safeParse(payload);
  assert.equal(result.success, false);
});

test("EscalaSchema rejeita data em formato inválido", () => {
  const result = EscalaSchema.safeParse({
    ...validEscala,
    data: "22/07/2026",
  });

  assert.equal(result.success, false);
});

test("EscalaSchema rejeita datas inválidas de calendário", () => {
  const result = EscalaSchema.safeParse({
    ...validEscala,
    data: "2026-02-31",
  });

  assert.equal(result.success, false);
});
