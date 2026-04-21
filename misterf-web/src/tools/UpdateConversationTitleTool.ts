import {
  findConversationForUser,
  renameConversationForUser,
} from '../db/repository.js';
import type {
  LlmTool,
  LlmToolCall,
  LlmToolDeclaration,
  ToolExecutionContext,
} from './types.js';

export class UpdateConversationTitleTool implements LlmTool {
  readonly name = 'update_conversation_title';

  readonly declaration: LlmToolDeclaration = {
    name: this.name,
    description:
      'Actualiza el título visible de la conversación. OBLIGATORIA cuando el título actual sea genérico y el tema o propósito de la conversación ya esté claro. OPCIONAL si el título actual sigue siendo útil. NO USAR si el usuario renombró la conversación manualmente, si todavía no hay suficiente contexto, si el título actual ya describe bien la práctica o si solo estás respondiendo a una pregunta lateral.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description:
            'Título breve en español, de 2 a 6 palabras, sin comillas ni fecha.',
        },
      },
      required: ['title'],
    },
  };

  execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Record<string, unknown> {
    const conversation = findConversationForUser(
      context.conversationId,
      context.userId,
    );
    if (!conversation) {
      return { ok: false, error: 'Conversation not found.' };
    }

    if (conversation.titleUpdatedByUser) {
      return {
        ok: false,
        skipped: true,
        reason: 'The user manually renamed this conversation.',
      };
    }

    const update = normalizeConversationTitleUpdate(call.args);
    if (!update) {
      return { ok: false, error: 'Invalid title payload.' };
    }

    const renamedConversation = renameConversationForUser(
      context.conversationId,
      context.userId,
      update.title,
    );
    if (!renamedConversation) {
      return { ok: false, error: 'Conversation could not be renamed.' };
    }

    context.io.to(context.conversationId).emit('conversation:renamed', {
      conversation: renamedConversation,
      conversationId: context.conversationId,
    });

    return { ok: true, title: renamedConversation.title };
  }
}

function normalizeConversationTitleUpdate(
  args: Record<string, unknown>,
): { title: string } | null {
  const title = normalizeShortText(args.title).slice(0, 60);
  if (!title || title.toLowerCase() === 'nueva conversación') {
    return null;
  }

  return { title };
}

function normalizeShortText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
}
