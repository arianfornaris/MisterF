import {
  completeSentenceChallenge,
  createSentenceChallenge,
  findActiveSentenceChallenge,
  listMessages,
  listSentenceChallenges,
  type SentenceEvaluation,
  type SentenceEvaluationPart,
  updateMessageMetadata,
  upsertSentenceAttempt,
} from '../db/repository.js';
import type {
  LlmTool,
  LlmToolCall,
  LlmToolDeclaration,
  ToolExecutionContext,
} from './types.js';

type SentencePartStatus = SentenceEvaluationPart['status'];
const fallbackCompletionScore = 1;

export class UpdateSentenceEvaluationTool implements LlmTool {
  readonly name = 'update_sentence_evaluation';

  readonly declaration: LlmToolDeclaration = {
    name: this.name,
    description:
      'ALTA PRIORIDAD, USO MANDATORIO: guarda una evaluación visual por partes del último intento del usuario. Esta es la herramienta que controla todo el ciclo de vida del reto: si no hay reto abierto, la app abre uno automáticamente y guarda esta evaluación como el primer intento; si todas las partes tienen status "correct", la app marca automáticamente la oración como completada, actualiza Intentos y lanza confeti. OBLIGATORIA en cada interacción donde el usuario presente un intento de traducción o una corrección, sin excepción, antes de dar retroalimentación textual. Úsala aunque la oración esté correcta, incorrecta o casi perfecta. NO USAR para preguntas laterales, selección de tema/nivel, saludos, explicaciones generales ni mensajes que no sean intentos de traducción. Si omites esta tool, la app pierde el registro visual y pedagógico del intento. Las partes deben reconstruir la oración del usuario en el mismo orden, sin duplicar, omitir ni inventar texto. Esta evaluación visual no reemplaza tu respuesta normal en el chat.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        parts: {
          type: 'array',
          description:
            'Segmentos naturales que reconstruyen la oración del usuario en el mismo orden. No necesariamente palabra por palabra. No corrijas el texto dentro de los segmentos; conserva lo que escribió el usuario.',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description:
                  'Fragmento exacto de la oración del usuario. Puede ser una palabra, expresión o grupo natural.',
              },
              status: {
                type: 'string',
                enum: ['correct', 'improve', 'error'],
                description:
                  'correct si la parte está correcta; improve si se entiende pero puede sonar más natural, precisa o idiomática; error si está incorrecta o si contiene una palabra mal escrita, por ejemplo "cal" en vez de "call".',
              },
              explanation: {
                type: 'string',
                description:
                  'Explicación breve en español. Obligatoria para improve y error; omítela o déjala vacía para correct.',
              },
            },
            required: ['text', 'status'],
          },
        },
      },
      required: ['parts'],
    },
  };

  execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Record<string, unknown> {
    if (!context.lastUserMessageId) {
      return {
        ok: false,
        error: 'No last user message is available for sentence evaluation.',
      };
    }

    const evaluation = normalizeSentenceEvaluation(call.args);
    if (!evaluation) {
      return { ok: false, error: 'Invalid sentence evaluation payload.' };
    }

    const message = updateMessageMetadata(
      context.lastUserMessageId,
      context.conversationId,
      { sentenceEvaluation: evaluation },
    );
    if (!message) {
      return { ok: false, error: 'Could not update message evaluation.' };
    }

    const activeChallenge =
      findActiveSentenceChallenge(context.conversationId) ??
      createFallbackChallenge(context.conversationId, context.lastUserMessageId);
    if (activeChallenge) {
      const isCorrect = evaluation.parts.every(
        (part) => part.status === 'correct',
      );
      upsertSentenceAttempt({
        attemptText: message.content,
        challengeId: activeChallenge.id,
        conversationId: context.conversationId,
        evaluation,
        isCorrect,
        userMessageId: message.id,
      });

      let completionPayload: Record<string, unknown> | null = null;
      if (isCorrect) {
        const completedChallenge = completeSentenceChallenge(
          activeChallenge.id,
          context.conversationId,
          fallbackCompletionScore,
        );
        if (context.turnState) {
          context.turnState.challengeCompletedThisTurn = true;
        }
        completionPayload = {
          automatic: true,
          challenge: completedChallenge,
          conversationId: context.conversationId,
          score: fallbackCompletionScore,
          source: this.name,
        };
      }

      context.io.to(context.conversationId).emit('practice:updated', {
        challenges: listSentenceChallenges(context.conversationId),
        conversationId: context.conversationId,
      });

      if (completionPayload) {
        console.log('[Mr. F confetti emit]', completionPayload);
        context.io
          .to(context.conversationId)
          .emit('sentence_challenge:completed', completionPayload);
      }
    }

    context.io.to(context.conversationId).emit('message:evaluation_updated', {
      conversationId: context.conversationId,
      message,
      messageId: message.id,
      sentenceEvaluation: evaluation,
    });

    return {
      messageId: message.id,
      ok: true,
    };
  }
}

function normalizeSentenceEvaluation(args: Record<string, unknown>): SentenceEvaluation | null {
  const parts = Array.isArray(args.parts)
    ? args.parts
        .map(normalizeSentencePart)
        .filter((part): part is SentenceEvaluationPart => Boolean(part))
        .slice(0, 32)
    : [];

  if (parts.length === 0) {
    return null;
  }

  return {
    parts,
  };
}

function createFallbackChallenge(
  conversationId: string,
  lastUserMessageId?: number,
) {
  const sourceSentence =
    inferLatestSourceSentence(conversationId, lastUserMessageId) ??
    'Oración pendiente de identificar';
  const challenge = createSentenceChallenge({
    conversationId,
    sourceSentence,
  });

  console.log('[Mr. F fallback challenge created]', {
    conversationId,
    challengeId: challenge.id,
    lastUserMessageId,
    sourceSentence,
  });

  return challenge;
}

function inferLatestSourceSentence(
  conversationId: string,
  lastUserMessageId?: number,
): string | null {
  const messages = listMessages(conversationId);
  const lastUserIndex = lastUserMessageId
    ? messages.findIndex((message) => message.id === lastUserMessageId)
    : messages.length;
  const searchEndIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length;
  const previousModelMessages = messages
    .slice(0, searchEndIndex)
    .filter((message) => message.role === 'model')
    .reverse();

  for (const message of previousModelMessages) {
    const quotedSentence = extractBestSpanishQuotedSentence(message.content);
    if (quotedSentence) {
      return quotedSentence;
    }
  }

  return null;
}

function extractBestSpanishQuotedSentence(content: string): string | null {
  const quotedSegments = [...content.matchAll(/["“”]([^"“”]{8,240})["“”]/g)]
    .map((match) => normalizeLongText(match[1], 240))
    .filter(Boolean);

  return quotedSegments.find(isLikelySpanishChallengeSentence) ?? null;
}

function isLikelySpanishChallengeSentence(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  if (!/[.!?¿¡]$/.test(value)) {
    return false;
  }

  const spanishSignals = [
    /[¿¡áéíóúñü]/i,
    /\b(el|la|los|las|un|una|unos|unas|de|del|que|con|para|por|donde|dónde|cuando|cuándo|cuanto|cuánto|me|mi|quiero|gustaria|gustaría|esta|está|son|es)\b/i,
  ];
  const englishSignals =
    /\b(the|would|like|ticket|please|where|nearest|bus|stop|train|to|from|round-trip|return)\b/i;

  return spanishSignals.some((pattern) => pattern.test(value)) &&
    !englishSignals.test(value);
}

function normalizeSentencePart(value: unknown): SentenceEvaluationPart | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Record<string, unknown>;
  const text = normalizeLongText(data.text, 120);
  const status = normalizeStatus(data.status);
  const explanation = normalizeLongText(data.explanation, 260);
  if (!text || !status) {
    return null;
  }

  if (status === 'correct') {
    return { status, text };
  }

  return {
    explanation:
      explanation || 'Esta parte necesita ajuste para sonar correcta o natural.',
    status,
    text,
  };
}

function normalizeStatus(value: unknown): SentencePartStatus | null {
  if (value === 'correct' || value === 'improve' || value === 'error') {
    return value;
  }

  if (value === 'yellow') {
    return 'improve';
  }

  if (value === 'red') {
    return 'error';
  }

  if (value === 'none' || value === 'no color') {
    return 'correct';
  }

  return null;
}

function normalizeLongText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}
