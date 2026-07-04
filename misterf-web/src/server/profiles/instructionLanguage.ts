import type { Request } from 'express';

export const instructionLanguages = ['es', 'en'] as const;

export type InstructionLanguage = (typeof instructionLanguages)[number];

export const defaultInstructionLanguage: InstructionLanguage = 'es';

export function isInstructionLanguage(
  value: unknown,
): value is InstructionLanguage {
  return (
    typeof value === 'string' &&
    (instructionLanguages as readonly string[]).includes(value)
  );
}

export function normalizeInstructionLanguage(
  value: unknown,
  fallback: InstructionLanguage = defaultInstructionLanguage,
): InstructionLanguage {
  return isInstructionLanguage(value) ? value : fallback;
}

export function resolveRequestInstructionLanguage(
  request: Request,
  fallback: InstructionLanguage = defaultInstructionLanguage,
): InstructionLanguage {
  const negotiated = request.acceptsLanguages(...instructionLanguages);
  return isInstructionLanguage(negotiated) ? negotiated : fallback;
}
