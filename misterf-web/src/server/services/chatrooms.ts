import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import type {
  StoredChatRoom,
  StoredChatRoomCharacter,
  StoredChatRoomMessage,
} from '../db/repository.js';
import {
  getLanguageModel,
  getProviderOptions,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import { renderSystemPrompt } from './systemPrompts.js';
import {
  logLlmInvalidRawResponse,
  logLlmRequest,
  logLlmResponse,
} from './llmTutor/logging.js';

const maxRecentMessages = 18;
const maxChatRoomGenerationTurns = 4;

const generatedChatRoomBlockSchema = z.object({
  messages: z.array(
    z.object({
      content: z.string().min(1),
      speakerName: z.string().min(1),
    }),
  ).min(1).max(2),
});

function logChatRoomEvent(
  event: string,
  details: Record<string, unknown>,
): void {
  console.info(
    `[chatrooms] ${event} ${JSON.stringify(details)}`,
  );
}

function appendChatRoomStructuredCorrectionRequest(
  messages: ModelMessage[],
  input: {
    invalidOutput?: string | null;
    reason: string;
    turn: number;
  },
): void {
  const invalidOutput = input.invalidOutput?.trim();

  if (invalidOutput) {
    messages.push({
      content: invalidOutput.slice(0, 6000),
      role: 'assistant',
    });
  }

  messages.push({
    content: renderSystemPrompt('chatrooms/structured-correction.md', {
      CORRECTION_REASON: input.reason,
    }),
    role: 'user',
  });

  logChatRoomEvent('generation:structured-correction-requested', {
    hadInvalidOutput: Boolean(invalidOutput),
    reason: input.reason,
    turn: input.turn,
  });
}

function formatHistory(messages: StoredChatRoomMessage[]): string {
  return messages
    .filter((message) => message.senderType !== 'system')
    .slice(-maxRecentMessages)
    .map((message) => {
      const visibleName = message.senderType === 'user' ? 'You' : message.senderName;
      return `${visibleName}: ${message.content}`;
    })
    .join('\n');
}

function isConversationStarting(messages: StoredChatRoomMessage[]): boolean {
  const visibleMessages = messages.filter((message) => message.senderType !== 'system');
  return visibleMessages.length <= 1;
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  return JSON.parse(trimmed) as unknown;
}

function buildCharacterRoster(characters: StoredChatRoomCharacter[]): string {
  return characters
    .map((character) =>
      [
        `- ${character.name}`,
        character.shortDescription ? `  Short UI description: ${character.shortDescription}` : '',
        `  Full description: ${character.fullDescription}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
}

function resolveCharacterByName(
  characters: StoredChatRoomCharacter[],
  speakerName: string,
): StoredChatRoomCharacter | null {
  const exactMatch = characters.find((character) => character.name === speakerName);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedTarget = speakerName.trim().toLowerCase();
  return (
    characters.find(
      (character) => character.name.trim().toLowerCase() === normalizedTarget,
    ) || null
  );
}

async function generateChatRoomMessageBlock(input: {
  characters: StoredChatRoomCharacter[];
  historyText: string;
  isConversationStarting: boolean;
  openRouterApiKey?: string | null;
  room: StoredChatRoom;
  userName: string;
}): Promise<
  {
    messages: Array<{
      character: StoredChatRoomCharacter;
      content: string;
    }>;
  }
> {
  const desiredTurnCount =
    input.characters.length === 1 || Math.random() < 0.5 ? 1 : 2;
  const system = renderSystemPrompt('chatrooms/master-group-chat.md', {
    CHARACTER_NAMES: input.characters.map((character) => character.name).join(', '),
    CHARACTER_ROSTER: buildCharacterRoster(input.characters),
    CONVERSATION_STATE_LINE: input.isConversationStarting
      ? 'The conversation is just starting right now.'
      : 'The conversation is already in progress.',
    DESIRED_TURN_COUNT: String(desiredTurnCount),
    ROOM_DESCRIPTION: input.room.description,
    ROOM_TITLE: input.room.title,
    STARTING_GUIDANCE: input.isConversationStarting
      ? 'Since this is the beginning, the messages should feel like greetings, quick introductions, or simple first reactions to the user.'
      : 'Reply naturally to the ongoing conversation without restarting it.',
    TOPIC_GUIDANCE: input.isConversationStarting
      ? 'Do not jump into random topics or strong opinions before the conversation has been established.'
      : 'Stay consistent with the current topic and tone.',
    TURN_COUNT_RULE: desiredTurnCount === 2
      ? 'When possible, use two different characters for the two messages.'
      : 'Use only one character for the message.',
    TURN_COUNT_SUFFIX: desiredTurnCount === 1 ? '' : 's',
    USER_NAME: input.userName,
  });
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        'Recent chat history:',
        input.historyText || '(empty)',
      ].join('\n'),
    },
  ];

  logChatRoomEvent('generation:start', {
    characterCount: input.characters.length,
    hasOpenRouterKey: Boolean(input.openRouterApiKey),
    isConversationStarting: input.isConversationStarting,
    roomId: input.room.id,
    roomTitle: input.room.title,
    userName: input.userName,
    visibleHistoryLength: input.historyText ? input.historyText.split('\n').length : 0,
  });

  try {
    for (let turn = 0; turn < maxChatRoomGenerationTurns; turn += 1) {
      logLlmRequest(
        messages,
        system,
        {
          actorLabel: 'Chatroom',
          llm: {
            modelTier: 'regular',
            openRouterApiKey: input.openRouterApiKey,
          },
        },
        turn + 1,
      );

      const result = await generateText({
        maxOutputTokens: 1000,
        model: getLanguageModel({
          modelTier: 'regular',
          openRouterApiKey: input.openRouterApiKey,
        }),
        messages,
        providerOptions: getProviderOptions(),
        system,
        temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.65 : undefined,
      });

      logLlmResponse(
        result.text,
        result.finishReason,
        result.usage,
        result.providerMetadata,
        turn + 1,
        'Chatroom',
      );

      let parsedSource: unknown;
      try {
        parsedSource = parseJsonFromModelText(result.text);
      } catch (error) {
        logLlmInvalidRawResponse({
          actorLabel: 'Chatroom',
          error,
          rawText: result.text,
          turn: turn + 1,
        });
        logChatRoomEvent('generation:invalid-json', {
          attempt: turn + 1,
          roomId: input.room.id,
          textPreview: result.text.slice(0, 300),
          error: error instanceof Error ? error.message : String(error),
        });
        if (turn >= maxChatRoomGenerationTurns - 1) {
          continue;
        }
        appendChatRoomStructuredCorrectionRequest(messages, {
          invalidOutput: result.text,
          reason:
            'Your previous response was not valid JSON because it was truncated or malformed.',
          turn: turn + 1,
        });
        continue;
      }

      const parsed = generatedChatRoomBlockSchema.safeParse(parsedSource);
      if (!parsed.success) {
        logChatRoomEvent('generation:schema-mismatch', {
          attempt: turn + 1,
          roomId: input.room.id,
          issues: parsed.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join('.'),
          })),
        });
        if (turn < maxChatRoomGenerationTurns - 1) {
          appendChatRoomStructuredCorrectionRequest(messages, {
            invalidOutput: result.text,
            reason:
              'Your previous JSON did not match the required schema for the chatroom response.',
            turn: turn + 1,
          });
        }
        continue;
      }

      const normalizedMessages: Array<{
        character: StoredChatRoomCharacter;
        content: string;
      }> = [];

      for (const message of parsed.data.messages) {
        const character = resolveCharacterByName(input.characters, message.speakerName);
        const cleanedContent = message.content.trim();

        if (!character || !cleanedContent) {
          logChatRoomEvent('generation:discarded-message', {
            attempt: turn + 1,
            roomId: input.room.id,
            speakerName: message.speakerName,
            hasCharacterMatch: Boolean(character),
            hasContent: Boolean(cleanedContent),
          });
          continue;
        }

        normalizedMessages.push({
          character,
          content: cleanedContent,
        });
      }

      if (normalizedMessages.length > 0) {
        logChatRoomEvent('generation:success', {
          attempt: turn + 1,
          messageCount: normalizedMessages.length,
          roomId: input.room.id,
          speakers: normalizedMessages.map((message) => message.character.name),
        });
        return {
          messages: normalizedMessages.slice(0, desiredTurnCount),
        };
      }

      logChatRoomEvent('generation:empty-after-validation', {
        attempt: turn + 1,
        roomId: input.room.id,
      });
      if (turn < maxChatRoomGenerationTurns - 1) {
        appendChatRoomStructuredCorrectionRequest(messages, {
          invalidOutput: result.text,
          reason:
            'The JSON was valid, but after validation there were no usable messages. Re-emit a complete valid block with real speaker names and non-empty content.',
          turn: turn + 1,
        });
      }
    }

    logChatRoomEvent('generation:no-usable-messages', {
      roomId: input.room.id,
    });
    return {
      messages: [],
    };
  } catch (error) {
    logChatRoomEvent('generation:error', {
      roomId: input.room.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      messages: [],
    };
  }
}

export async function advanceChatRoomConversation(input: {
  characters: StoredChatRoomCharacter[];
  messages: StoredChatRoomMessage[];
  openRouterApiKey?: string | null;
  room: StoredChatRoom;
  trigger: 'continue' | 'user';
  userName: string;
}): Promise<{
  messages: Array<{
    character: StoredChatRoomCharacter;
    content: string;
  }>;
}> {
  if (input.trigger !== 'user' || input.characters.length === 0) {
    return {
      messages: [],
    };
  }

  return generateChatRoomMessageBlock({
    characters: input.characters,
    historyText: formatHistory(input.messages),
    isConversationStarting: isConversationStarting(input.messages),
    openRouterApiKey: input.openRouterApiKey,
    room: input.room,
    userName: input.userName,
  });
}

export async function evaluateChatRoomUserMessage(input: {
  historyText: string;
  openRouterApiKey?: string | null;
  room: StoredChatRoom;
  userMessage: string;
  userName: string;
}): Promise<null | { status: 'ok' } | { status: 'warning'; problem: string }> {
  const system = renderSystemPrompt('chatrooms/user-message-evaluation.md', {
    ROOM_DESCRIPTION: input.room.description,
    ROOM_TITLE: input.room.title,
    USER_NAME: input.userName,
  });

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        'Recent chat history:',
        input.historyText || '(empty)',
        '',
        'Last user message to evaluate:',
        input.userMessage,
      ].join('\n'),
    },
  ];

  logChatRoomEvent('evaluation:start', {
    hasOpenRouterKey: Boolean(input.openRouterApiKey),
    roomId: input.room.id,
    userName: input.userName,
  });

  try {
    logLlmRequest(
      messages,
      system,
      {
        actorLabel: 'Chatroom evaluation',
        llm: {
          modelTier: 'regular',
          openRouterApiKey: input.openRouterApiKey,
        },
      },
      1,
    );

    const result = await generateText({
      maxOutputTokens: 500,
      model: getLanguageModel({
        modelTier: 'regular',
        openRouterApiKey: input.openRouterApiKey,
      }),
      messages,
      providerOptions: getProviderOptions(),
      system,
      temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.3 : undefined,
    });

    logLlmResponse(
      result.text,
      result.finishReason,
      result.usage,
      result.providerMetadata,
      1,
      'Chatroom evaluation',
    );

    const normalized = result.text.trim();
    if (!normalized) {
      logChatRoomEvent('evaluation:empty', {
        roomId: input.room.id,
      });
      return null;
    }

    if (normalized.toLowerCase() === 'correct') {
      logChatRoomEvent('evaluation:ok', {
        roomId: input.room.id,
      });
      return { status: 'ok' };
    }

    logChatRoomEvent('evaluation:warning', {
      roomId: input.room.id,
      preview: normalized.slice(0, 200),
    });
    return {
      status: 'warning',
      problem: normalized,
    };
  } catch (error) {
    logChatRoomEvent('evaluation:error', {
      roomId: input.room.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
