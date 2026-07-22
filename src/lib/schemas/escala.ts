import { z } from "zod";

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_REGEX = /^\d{2}:\d{2}$/;

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

const isValidTime = (value: string) => {
  if (!HH_MM_REGEX.test(value)) return false;

  const [hours, minutes] = value.split(":").map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const toMinutes = (value: string) => {
  if (!isValidTime(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const EscalaSchema = z.object({
  id: z.string().uuid(),
  colaboradorId: z.string().uuid(),
  data: z.string().refine(isValidCalendarDate, {
    message: "Data deve estar no formato YYYY-MM-DD",
  }),
  turno: z.enum(["manha", "tarde", "noite", "plantao"]),
  horarioInicio: z.string().refine(isValidTime, {
    message: "Horário deve estar no formato HH:MM válido",
  }),
  horarioFim: z.string().refine(isValidTime, {
    message: "Horário deve estar no formato HH:MM válido",
  }),
  status: z.enum(["confirmada", "pendente", "cancelada"]),
  criadoPor: z.string().uuid(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime().nullable(),
  observacoes: z.string().max(500).optional(),
}).superRefine((value, context) => {
  const inicio = toMinutes(value.horarioInicio);
  const fim = toMinutes(value.horarioFim);

  if (inicio === null || fim === null) return;

  if (fim <= inicio) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horarioFim"],
      message: "Horário fim deve ser maior que o horário início",
    });
  }
});

export type Escala = z.infer<typeof EscalaSchema>;
