import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderTutorBlockProtocol } from '../../src/server/services/llmTutor/blockProtocol.js';
import {
  instructionLanguageEnglishName,
  quizEvaluationSupportLanguageRules,
  tutorSystemLanguagePlaceholders,
} from '../../src/server/services/llmTutor/languagePack.js';
import { buildRoleplayCharacterAvatarPromptOptions } from '../../src/server/roleplays/avatarRegistry.js';
import { renderSystemPrompt } from '../../src/server/services/systemPrompts.js';

/**
 * Renders every prompt under `system-prompts/` with the placeholder set its
 * real call site provides and fails on any `{{PLACEHOLDER}}` left behind.
 * This is the guard that would have caught the `{{ASSIGNMENT_*}}` rename bug:
 * `renderSystemPrompt` silently keeps unknown placeholders, so a renamed
 * variable on either side (code or .md) leaves literal braces in the prompt.
 *
 * Coverage is enforced by enumeration: every `.md` file on disk must have an
 * entry below (or belong to a composition-covered group). Adding a prompt
 * without registering it here fails the test.
 */

const locales = ['es', 'en', 'ht'] as const;
type TestLocale = (typeof locales)[number];

const leftoverPlaceholderPattern = /\{\{[A-Z_]+\}\}/;

const systemPromptsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../system-prompts',
);

const correctionReason = 'Your previous JSON did not match the required schema.';
const avatarOptions = buildRoleplayCharacterAvatarPromptOptions();

function languageName(locale: TestLocale): string {
  return instructionLanguageEnglishName(locale);
}

/**
 * Placeholder values per prompt, mirroring the real call sites. Values keyed
 * by file path relative to `system-prompts/`. Each renderer runs once per
 * locale so language-parametrized prompts are checked in all three languages.
 */
const promptRenderers: Record<string, (locale: TestLocale) => string> = {
  'resources/practice-guide-draft-correction.md': (locale) =>
    renderSystemPrompt('resources/practice-guide-draft-correction.md', {
      CORRECTION_REASON: correctionReason,
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/practice-guide-draft.md': (locale) =>
    renderSystemPrompt('resources/practice-guide-draft.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/practice-guide-revision-correction.md': (locale) =>
    renderSystemPrompt('resources/practice-guide-revision-correction.md', {
      CORRECTION_REASON: correctionReason,
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/practice-guide-revision.md': (locale) =>
    renderSystemPrompt('resources/practice-guide-revision.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/quiz-draft-correction.md': () =>
    renderSystemPrompt('resources/quiz-draft-correction.md', {
      CORRECTION_REASON: correctionReason,
    }),
  'resources/quiz-draft.md': (locale) =>
    renderSystemPrompt('resources/quiz-draft.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/quiz-revision-correction.md': () =>
    renderSystemPrompt('resources/quiz-revision-correction.md', {
      CORRECTION_REASON: correctionReason,
    }),
  'resources/quiz-revision.md': (locale) =>
    renderSystemPrompt('resources/quiz-revision.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/roleplay-draft-correction.md': () =>
    renderSystemPrompt('resources/roleplay-draft-correction.md', {
      CORRECTION_REASON: correctionReason,
      ROLEPLAY_AVATAR_OPTIONS: avatarOptions,
    }),
  'resources/roleplay-draft.md': (locale) =>
    renderSystemPrompt('resources/roleplay-draft.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
      ROLEPLAY_AVATAR_OPTIONS: avatarOptions,
    }),
  'resources/roleplay-evaluation.md': (locale) =>
    renderSystemPrompt('resources/roleplay-evaluation.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'resources/roleplay-revision-correction.md': () =>
    renderSystemPrompt('resources/roleplay-revision-correction.md', {
      CORRECTION_REASON: correctionReason,
      ROLEPLAY_AVATAR_OPTIONS: avatarOptions,
    }),
  'resources/roleplay-revision.md': (locale) =>
    renderSystemPrompt('resources/roleplay-revision.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
      ROLEPLAY_AVATAR_OPTIONS: avatarOptions,
    }),
  'resources/roleplay-turn.md': () =>
    renderSystemPrompt('resources/roleplay-turn.md', {}),
  'tutor/block-repair.md': (locale) =>
    renderSystemPrompt('tutor/block-repair.md', {
      BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, locale),
      DETECTED_ISSUES_JSON: '[]',
      ORIGINAL_BLOCKS_JSON: '{"blocks":[]}',
    }),
  'tutor/conversation-report-correction.md': (locale) =>
    renderSystemPrompt('tutor/conversation-report-correction.md', {
      CORRECTION_REASON: correctionReason,
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'tutor/conversation-report.md': (locale) =>
    renderSystemPrompt('tutor/conversation-report.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
    }),
  'tutor/practice-guide-context.md': () =>
    renderSystemPrompt('tutor/practice-guide-context.md', {
      PRACTICE_GUIDE_DESCRIPTION: 'Practicar presente perfecto.',
      PRACTICE_GUIDE_TITLE: 'Presente perfecto',
      PRACTICE_GUIDE_TUTOR_INSTRUCTIONS: 'Ejercicios progresivos.',
    }),
  'tutor/profile-context.md': () =>
    renderSystemPrompt('tutor/profile-context.md', {
      PROFILE_DESCRIPTION: 'Perfil de prueba.',
      PROFILE_LEARNING_CONTEXT: 'Practica para el trabajo.',
      PROFILE_NAME: 'Arian',
    }),
  'tutor/quiz-attempt-context.md': () =>
    renderSystemPrompt('tutor/quiz-attempt-context.md', {
      QUIZ_DESCRIPTION: 'Quiz de verbos.',
      QUIZ_SNAPSHOT_JSON: '{"blocks":[]}',
      QUIZ_TARGET_TOPIC: 'Verbos irregulares',
      QUIZ_TITLE: 'Irregular verbs',
      RESPONSES_JSON: '[]',
      RESULT_JSON: '{"items":[]}',
    }),
  'tutor/quiz-result-evaluation-correction.md': () =>
    renderSystemPrompt('tutor/quiz-result-evaluation-correction.md', {
      CORRECTION_REASON: correctionReason,
    }),
  'tutor/quiz-result-evaluation.md': (locale) =>
    renderSystemPrompt('tutor/quiz-result-evaluation.md', {
      INSTRUCTION_LANGUAGE_NAME: languageName(locale),
      SUPPORT_LANGUAGE_EVALUATION_RULES: quizEvaluationSupportLanguageRules(locale),
    }),
  'tutor/roleplay-attempt-context.md': () =>
    renderSystemPrompt('tutor/roleplay-attempt-context.md', {
      RESULT_JSON: '{"entries":[]}',
      ROLEPLAY_DESCRIPTION: 'Pedir comida.',
      ROLEPLAY_SNAPSHOT_JSON: '{"characters":[]}',
      ROLEPLAY_TITLE: 'En el restaurante',
      TURNS_JSON: '[]',
    }),
  'tutor/structured-correction.md': (locale) =>
    renderSystemPrompt('tutor/structured-correction.md', {
      BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, locale),
      CORRECTION_REASON: correctionReason,
    }),
  'tutor/system.md': (locale) =>
    renderSystemPrompt('tutor/system.md', {
      ...tutorSystemLanguagePlaceholders(locale),
      BLOCK_PROTOCOL: renderTutorBlockProtocol(undefined, locale),
      CURRENT_TITLE: 'Nueva conversación',
      TITLE_RULE: 'The current title is generic.',
    }),
  'tutor/translator.md': () =>
    renderSystemPrompt('tutor/translator.md', {
      TRANSLATION_DIRECTION: 'Translate from Spanish to English.',
    }),
  'tutor/tutor-report-context.md': () =>
    renderSystemPrompt('tutor/tutor-report-context.md', {
      REPORT_JSON: '{"practicedTopics":[]}',
      REPORT_SUMMARY_DESCRIPTION: 'Resumen previo.',
      REPORT_SUMMARY_TITLE: 'Práctica previa',
      SOURCE_CONVERSATION_ID: 'conv-1',
    }),
  'tutor/tutor-report-start.md': () =>
    renderSystemPrompt('tutor/tutor-report-start.md', {}),
  'tutor/visible-plan-context.md': () =>
    renderSystemPrompt('tutor/visible-plan-context.md', {
      TUTOR_PLAN_TEXT: 'title: Plan\nsteps:\n- s1: active',
    }),
};

/**
 * Files rendered only as fragments inside a composed prompt. `tutor/blocks/*`
 * render through `renderTutorBlockProtocol` (the Spanish protocol includes
 * every block file) and `tutor/language-rules/*` render inside `system.md`'s
 * `LANGUAGE_RULES`; both compositions are asserted below.
 */
const compositionCoveredPrefixes = ['tutor/blocks/', 'tutor/language-rules/'];

function listPromptFiles(): string[] {
  return fs
    .readdirSync(systemPromptsRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) =>
      path
        .relative(systemPromptsRoot, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/'),
    )
    .sort();
}

describe('prompt placeholder contracts', () => {
  it('has a renderer entry for every prompt file on disk', () => {
    const unregistered = listPromptFiles().filter(
      (file) =>
        !promptRenderers[file] &&
        !compositionCoveredPrefixes.some((prefix) => file.startsWith(prefix)),
    );

    expect(
      unregistered,
      'New prompt files must be registered in promptRenderers with their call-site placeholders',
    ).toEqual([]);
  });

  it('has no stale renderer entries for deleted prompt files', () => {
    const files = new Set(listPromptFiles());
    expect(Object.keys(promptRenderers).filter((file) => !files.has(file))).toEqual([]);
  });

  it('renders every prompt without leftover placeholders in all languages', () => {
    for (const [file, render] of Object.entries(promptRenderers)) {
      for (const locale of locales) {
        const rendered = render(locale);
        const leftover = rendered.match(leftoverPlaceholderPattern);
        expect(
          leftover,
          `${file} rendered for '${locale}' left ${leftover?.[0] ?? ''} unreplaced`,
        ).toBeNull();
      }
    }
  });

  it('renders the block protocol and language rules without leftover placeholders', () => {
    for (const locale of locales) {
      expect(renderTutorBlockProtocol(undefined, locale)).not.toMatch(
        leftoverPlaceholderPattern,
      );
      expect(
        tutorSystemLanguagePlaceholders(locale).LANGUAGE_RULES,
      ).not.toMatch(leftoverPlaceholderPattern);
    }
  });
});
