import type { FunctionDeclaration } from '@google/genai';
import { updateMessageMetadata } from '../db/repository.js';
import type { LlmTool, LlmToolCall, ToolExecutionContext } from './types.js';

type SentencePartStatus = 'correct' | 'improve' | 'error';

type SentenceEvaluationPart = {
  explanation?: string;
  status: SentencePartStatus;
  text: string;
};

type SentenceEvaluation = {
  parts: SentenceEvaluationPart[];
};

export class UpdateSentenceEvaluationTool implements LlmTool {
  readonly name = 'update_sentence_evaluation';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description:
      'Guarda una evaluación visual por partes del último intento del usuario. Debes usar esta tool cada vez que evalúes o corrijas un intento de traducción o de corrección por parte del usuario, incluso si la oración está correcta. No la uses para preguntas laterales o mensajes que no sean intentos de traducción. Esta evaluación visual no reemplaza tu respuesta normal en el chat.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        parts: {
          type: 'array',
          description:
            'Segmentos naturales que reconstruyen la oración exacta del usuario en el mismo orden. No necesariamente palabra por palabra. No corrijas el texto dentro de los segmentos; conserva lo que escribió el usuario.',
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

function normalizeSentenceEvaluation(
  args: Record<string, unknown>,
): SentenceEvaluation | null {
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
