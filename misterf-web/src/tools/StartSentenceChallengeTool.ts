import {
  createSentenceChallenge,
  findActiveSentenceChallenge,
  listSentenceChallenges,
} from '../db/repository.js';
import type {
  LlmTool,
  LlmToolCall,
  LlmToolDeclaration,
  ToolExecutionContext,
} from './types.js';

type SentenceChallengeInput = {
  level?: string;
  sourceSentence: string;
  topic?: string;
};

export class StartSentenceChallengeTool implements LlmTool {
  readonly name = 'start_sentence_challenge';

  readonly declaration: LlmToolDeclaration = {
    name: this.name,
    description:
      'Registra la oración en español que el usuario debe traducir al inglés. Debes llamar esta tool cada vez que propongas una nueva oración en español para traducir, antes o junto con tu mensaje normal al usuario. No la uses para explicaciones, saludos ni preguntas de tema/nivel.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        sourceSentence: {
          type: 'string',
          description:
            'La oración exacta en español que el usuario debe traducir.',
        },
        topic: {
          type: 'string',
          description:
            'Tema breve de la oración, en español. Opcional si todavía no está claro.',
        },
        level: {
          type: 'string',
          description:
            'Nivel de dificultad: principiante, intermedio o avanzado. Opcional.',
        },
      },
      required: ['sourceSentence'],
    },
  };

  execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Record<string, unknown> {
    const input = normalizeSentenceChallengeInput(call.args);
    if (!input) {
      return { ok: false, error: 'Invalid sentence challenge payload.' };
    }

    const current = findActiveSentenceChallenge(context.conversationId);
    if (current && current.sourceSentence === input.sourceSentence) {
      return { challenge: current, ok: true, skipped: true };
    }

    const challenge = createSentenceChallenge({
      conversationId: context.conversationId,
      level: input.level,
      sourceSentence: input.sourceSentence,
      topic: input.topic,
    });
    const challenges = listSentenceChallenges(context.conversationId);

    context.io.to(context.conversationId).emit('practice:updated', {
      challenges,
      conversationId: context.conversationId,
    });

    return { challenge, ok: true };
  }
}

function normalizeSentenceChallengeInput(
  args: Record<string, unknown>,
): SentenceChallengeInput | null {
  const sourceSentence = normalizeLongText(args.sourceSentence, 320);
  if (!sourceSentence) {
    return null;
  }

  return {
    level: normalizeShortText(args.level),
    sourceSentence,
    topic: normalizeShortText(args.topic),
  };
}

function normalizeShortText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
}

function normalizeLongText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}
