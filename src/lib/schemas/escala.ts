import { z } from "zod";

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidCalendarDate = (value: string) => {
  if (!YYYY_MM_DD_REGEX.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export const EscalaSchema = z.object({
  id: z.string().uuid(),
  colaboradorId: z.string().uuid(),
  data: z.string().refine(isValidCalendarDate, {
    message: "Data deve estar no formato YYYY-MM-DD",
  }),
});

export type Escala = z.infer<typeof EscalaSchema>;
