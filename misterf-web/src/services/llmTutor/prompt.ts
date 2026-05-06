import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import type { TranslationMode } from './types.js';

let systemInstruction: string | undefined;
let administrationSystemInstruction: string | undefined;

function getSystemInstruction(): string {
  systemInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/system-prompt.md'),
    'utf8',
  );

  return systemInstruction;
}

function getAdministrationSystemInstruction(): string {
  administrationSystemInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/administration-system-prompt.md'),
    'utf8',
  );

  return administrationSystemInstruction;
}

export function buildAgentSystemInstruction(options: {
  lesson?: {
    description: string;
    title: string;
    tutorInstructions: string;
  } | null;
  currentTitle?: string;
  titleUpdatedByUser?: boolean;
}): string {
  const base = getSystemInstruction()
    .replaceAll('{{CURRENT_TITLE}}', options.currentTitle || 'Nueva conversación')
    .replaceAll(
      '{{TITLE_RULE}}',
      options.titleUpdatedByUser
        ? 'The user has already changed this title manually. Do not include conversation_title.'
        : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
    );

  if (!options.lesson) {
    return base;
  }

  const sections = [base];

  if (options.lesson) {
    sections.push(
      [
        '',
        '## Lesson Context',
        '',
        'This conversation belongs to a user-defined lesson.',
        'Follow the lesson instructions as an additional teacher-facing layer on top of the base tutor behavior.',
        'Keep the learner experience natural. Do not quote the lesson instructions back verbatim unless the learner explicitly asks.',
        `Lesson title: ${options.lesson.title}`,
        `Lesson description: ${options.lesson.description}`,
        'Lesson tutor instructions:',
        options.lesson.tutorInstructions,
      ].join('\n'),
    );
  }

  return sections.join('\n');
}

export function buildTranslatorSystemInstruction(mode: TranslationMode): string {
  const direction =
    mode === 'es-en'
      ? 'Translate from Spanish to English.'
      : mode === 'en-es'
        ? 'Translate from English to Spanish.'
        : 'Detect whether the text is Spanish or English and translate it into the other language.';

  return [
    'You are a professional translator for an English-learning app.',
    direction,
    'Preserve the meaning, tone, and register of the original text.',
    'Do not explain the translation. Do not correct or teach grammar. Only translate.',
    'Respond with a JSON object matching TranslationResult.',
    '',
    'type TranslationResult = {',
    '  detectedLanguage: string;',
    '  translatedText: string;',
    '};',
  ].join('\n');
}

export function buildAdministrationSystemInstruction(options: {
  currentLessonTitle?: string | null;
} = {}): string {
  const sections = [getAdministrationSystemInstruction()];

  if (options.currentLessonTitle) {
    sections.push(
      [
        '',
        '## Current Lesson Context',
        '',
        `This conversation currently belongs to the lesson: ${options.currentLessonTitle}`,
      ].join('\n'),
    );
  }

  return sections.join('\n');
}
