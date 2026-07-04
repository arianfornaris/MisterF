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
