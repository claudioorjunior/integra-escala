import { z } from "zod";

/**
 * Zod schema for an Escala (schedule entry) — a single shift assignment
 * for a collaborator on a specific date.
 *
 * Used at the API boundary (Supabase returns) and the form boundary
 * (ScaleEditor saves) to guarantee runtime-shaped data matches the
 * TypeScript type.
 */
export const EscalaSchema = z.object({
  id: z.string().uuid(),
  colaboradorId: z.string().min(1, "colaboradorId is required"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data must be in YYYY-MM-DD format"),
  horario: z.string().min(1, "horario is required"),
  cargo: z.string().min(1, "cargo is required"),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "cor must be a valid hex color (e.g. #1a3c34)"),
});

export type Escala = z.infer<typeof EscalaSchema>;
