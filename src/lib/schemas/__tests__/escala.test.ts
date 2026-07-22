import { describe, expect, it } from "vitest";
import { EscalaSchema } from "../escala";

const validEscala = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  colaboradorId: "col-123",
  data: "2026-01-15",
  horario: "07h-19h",
  cargo: "Cuidador",
  cor: "#1a3c34",
};

describe("EscalaSchema", () => {
  it("validates a well-formed escala", () => {
    const result = EscalaSchema.safeParse(validEscala);
    expect(result.success).toBe(true);
  });

  it("rejects a missing colaboradorId", () => {
    const { colaboradorId: _, ...withoutId } = validEscala;
    const result = EscalaSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejects an empty colaboradorId", () => {
    const result = EscalaSchema.safeParse({ ...validEscala, colaboradorId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong data format", () => {
    const result = EscalaSchema.safeParse({ ...validEscala, data: "15/01/2026" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid hex color", () => {
    const result = EscalaSchema.safeParse({ ...validEscala, cor: "green" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid UUID", () => {
    const result = EscalaSchema.safeParse({ ...validEscala, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
