import type {
  TutorChallengeStartedBlock,
  TutorCharacterMessageBlock,
  TutorMessage,
  TutorMessageBlock,
  TutorResponseBlock,
  TutorSentenceEvaluationBlock,
} from './types.js';
import { tutorResponseSchema } from './schemas.js';

export function toModelMessage(message: TutorMessage) {
  return {
    content: message.content,
    role: message.role === 'model' ? 'assistant' : 'user',
  } as const;
}

export function validateTutorResponseBlocks(value: unknown): TutorResponseBlock[] {
  const parsed = tutorResponseSchema.safeParse(value);
  if (!parsed.success) {
    console.error('[Mr. F LLM response validation failed]', JSON.stringify({
      issues: parsed.error.issues,
      value,
    }, null, 2));
    throw new Error(
      'El modelo no devolvió una respuesta estructurada válida. Intenta de nuevo en unos segundos.',
    );
  }

  const blocks = parsed.data.blocks as TutorResponseBlock[];
  assertValidTutorBlockSequence(blocks);

  return blocks;
}

function assertValidTutorBlockSequence(blocks: TutorResponseBlock[]): void {
  const completedIndex = blocks.findIndex(
    (block) => block.type === 'challenge_completed',
  );
  const startedIndex = blocks.findIndex(
    (block) => block.type === 'challenge_started',
  );

  if (completedIndex >= 0 && startedIndex >= 0) {
    console.error('[Mr. F LLM response sequence invalid]', JSON.stringify({
      blocks,
      reason: 'challenge_completed_and_challenge_started_same_response',
    }, null, 2));
    throw new Error(
      'No debes completar un reto y empezar otro en la misma respuesta. Completa el reto, pregunta si el usuario quiere seguir con variantes o pasar al siguiente, y espera su respuesta.',
    );
  }

  const latestEvaluation = [...blocks]
    .reverse()
    .find(
      (block): block is TutorSentenceEvaluationBlock =>
        block.type === 'sentence_evaluation',
    );
  const hasCharacterMessage = blocks.some(
    (block) => block.type === 'character_message',
  );
  const evaluationHasProblems =
    latestEvaluation?.parts.some((part) => part.status !== 'correct') ?? false;

  if (hasCharacterMessage && evaluationHasProblems) {
    console.error('[Mr. F LLM response sequence invalid]', JSON.stringify({
      blocks,
      reason: 'dialogue_character_advanced_while_evaluation_has_problems',
    }, null, 2));
    throw new Error(
      'En un dialogue_scene, si sentence_evaluation tiene algun part con status improve o error, no puedes incluir character_message. Da feedback como tutor y espera otro intento del usuario.',
    );
  }
}

export function blocksToMarkdown(blocks: TutorResponseBlock[]): string {
  const messageMarkdown = blocks
    .filter(
      (block): block is TutorMessageBlock | TutorCharacterMessageBlock =>
        block.type === 'message' || block.type === 'character_message',
    )
    .map((block) =>
      block.type === 'character_message'
        ? `**${block.name}:** ${block.markdown.trim()}`
        : block.markdown.trim(),
    )
    .filter(Boolean);

  if (messageMarkdown.length > 0) {
    return messageMarkdown.join('\n\n');
  }

  const started = [...blocks]
    .reverse()
    .find(
      (block): block is TutorChallengeStartedBlock =>
        block.type === 'challenge_started',
    );
  if (started) {
    if (started.challengeType === 'dialogue_scene' && started.dialogue) {
      return [
        'Vamos con esta escena:',
        `**${started.dialogue.scenario}**`,
        '',
        `Tú eres: ${started.dialogue.learnerRole}.`,
        `${started.dialogue.characterName} es ${started.dialogue.characterRole}.`,
      ].join('\n');
    }

    if ('sourceSentence' in started) {
      return `Vamos con esta oración:\n\n**${started.sourceSentence}**`;
    }
  }

  return 'Listo.';
}
