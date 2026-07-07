import {
  createQuiz,
  createPracticeGuide,
  createRoleplay,
  findProfileForUser,
} from '../db/repository.js';
import { translate, type Locale } from '../i18n/index.js';
import {
  generateQuizDraft,
  generatePracticeGuideDraft,
  generateRoleplayDraft,
} from './resourceDrafts.js';

export type ContextResourceType = 'quiz' | 'practice_guide' | 'roleplay';

// The prompt intros are model-facing meta text and follow the project
// convention of English meta-prompts; the draft system prompt makes the
// model author the resource itself in the profile's instruction language.
const contextResourceTypeMeta: Record<
  ContextResourceType,
  {
    articledLabelKey: string;
    detailPath: (id: string) => string;
    labelKey: string;
    promptIntro: string;
  }
> = {
  quiz: {
    articledLabelKey: 'msg.resourceQuizArticled',
    detailPath: (id) => `/quizzes/${encodeURIComponent(id)}`,
    labelKey: 'msg.resourceQuizLabel',
    promptIntro: 'Create a gradable quiz using the provided context.',
  },
  practice_guide: {
    articledLabelKey: 'msg.resourcePracticeGuideArticled',
    detailPath: (id) => `/practice-guides/${encodeURIComponent(id)}`,
    labelKey: 'msg.resourcePracticeGuideLabel',
    promptIntro: 'Create a reusable practice guide using the provided context.',
  },
  roleplay: {
    articledLabelKey: 'msg.resourceRoleplayArticled',
    detailPath: (id) => `/roleplays/${encodeURIComponent(id)}`,
    labelKey: 'msg.resourceRoleplayLabel',
    promptIntro: 'Create a roleplay using the provided context.',
  },
};

export function normalizeContextResourceType(value: unknown): ContextResourceType | null {
  return value === 'quiz' || value === 'practice_guide' || value === 'roleplay'
    ? value
    : null;
}

export function contextResourceTypeLabel(
  type: ContextResourceType,
  locale: Locale,
): string {
  return translate(locale, contextResourceTypeMeta[type].labelKey);
}

export function articledContextResourceTypeLabel(
  type: ContextResourceType,
  locale: Locale,
): string {
  return translate(locale, contextResourceTypeMeta[type].articledLabelKey);
}

/**
 * Builds the seed prompt for AI authoring from a free-form context. The learner
 * instruction is primary; the context (a conversation, a summary, or an attempt
 * result) is supporting material.
 */
export function buildResourceFromContextPrompt(input: {
  context: string;
  contextLabel: string;
  instruction: string;
  type: ContextResourceType;
}): string {
  const lines = [
    contextResourceTypeMeta[input.type].promptIntro,
    'The user instruction is the primary input. Use the context as supporting material to infer the topic, the goals, and the kind of practice that fits the learner best.',
  ];
  if (input.instruction) {
    lines.push(`User instruction: ${input.instruction}`);
  }
  lines.push('', `${input.contextLabel}:`, input.context || '(no context)');

  return lines.join('\n');
}

/**
 * Generates the matching AI draft for the resource type and persists it. Returns
 * the new resource detail path and title so callers can link or redirect to it.
 */
export async function createResourceFromContextDraft(input: {
  openRouterApiKey: string | null;
  profileId: string;
  prompt: string;
  type: ContextResourceType;
  userId: string;
}): Promise<{ detailPath: string; title: string }> {
  const { openRouterApiKey, profileId, prompt, type, userId } = input;
  const meta = contextResourceTypeMeta[type];
  const instructionLanguage = findProfileForUser(profileId, userId)
    ?.instructionLanguage;

  if (type === 'practice_guide') {
    const draft = await generatePracticeGuideDraft({
      instructionLanguage,
      openRouterApiKey,
      prompt,
    });
    const practiceGuide = createPracticeGuide({
      description: draft.description,
      profileId,
      title: draft.title,
      tutorInstructions: draft.tutorInstructions,
      userId,
    });
    return { detailPath: meta.detailPath(practiceGuide.id), title: practiceGuide.title };
  }

  if (type === 'quiz') {
    const draft = await generateQuizDraft({
      instructionLanguage,
      openRouterApiKey,
      prompt,
    });
    const quiz = createQuiz({
      description: draft.description,
      instructions: draft.instructions,
      level: draft.level,
      profileId,
      quiz: draft,
      targetTopic: draft.targetTopic,
      title: draft.title,
      userId,
    });
    return { detailPath: meta.detailPath(quiz.id), title: quiz.title };
  }

  const draft = await generateRoleplayDraft({
    instructionLanguage,
    openRouterApiKey,
    prompt,
  });
  const roleplay = createRoleplay({ ...draft, profileId, userId });
  return { detailPath: meta.detailPath(roleplay.id), title: roleplay.title };
}
