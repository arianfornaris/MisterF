import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import type { TranslationMode } from './types.js';

let systemInstruction: string | undefined;
let progressInstruction: string | undefined;
let vocabularyInstruction: string | undefined;

function getSystemInstruction(): string {
  systemInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/system-prompt.md'),
    'utf8',
  );

  return systemInstruction;
}

function getProgressInstruction(): string {
  progressInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/progress-instructions.md'),
    'utf8',
  );

  return progressInstruction;
}

function getVocabularyInstruction(): string {
  vocabularyInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/vocabulaty-instructions.md'),
    'utf8',
  );

  return vocabularyInstruction;
}

export function buildAgentSystemInstruction(options: {
  currentTitle?: string;
  titleUpdatedByUser?: boolean;
}): string {
  return getSystemInstruction()
    .replaceAll('{{CURRENT_TITLE}}', options.currentTitle || 'Nueva conversación')
    .replaceAll(
      '{{TITLE_RULE}}',
      options.titleUpdatedByUser
        ? 'The user has already changed this title manually. Do not include conversation_title.'
        : 'You may include conversation_title if the topic or purpose is clear and the current title is generic.',
    );
}

export function buildProgressSystemInstruction(): string {
  return getProgressInstruction();
}

export function buildVocabularySystemInstruction(): string {
  return getVocabularyInstruction();
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
