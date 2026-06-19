import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/server/config/env.js';
import {
  normalizeLogLevel,
  sanitizeLogValue,
  shouldWriteLogLevel,
} from '../../src/server/services/logger.js';
import {
  logLlmRequest,
  normalizeLlmTraceMode,
  shouldLogFullLlmTrace,
} from '../../src/server/services/llmTutor/logging.js';

const originalLoggingEnv = {
  llmTraceFullConversationIds: [...env.llmTraceFullConversationIds],
  llmTraceFullUserIds: [...env.llmTraceFullUserIds],
  llmTraceMode: env.llmTraceMode,
  logLevel: env.logLevel,
};

afterEach(() => {
  env.llmTraceFullConversationIds = [
    ...originalLoggingEnv.llmTraceFullConversationIds,
  ];
  env.llmTraceFullUserIds = [...originalLoggingEnv.llmTraceFullUserIds];
  env.llmTraceMode = originalLoggingEnv.llmTraceMode;
  env.logLevel = originalLoggingEnv.logLevel;
  vi.restoreAllMocks();
});

describe('server logger policy', () => {
  it('normalizes log levels and preserves useful non-secret identifiers', () => {
    expect(normalizeLogLevel('debug')).toBe('debug');
    expect(normalizeLogLevel('bad-value')).toBe('info');
    expect(shouldWriteLogLevel('debug', 'info')).toBe(false);
    expect(shouldWriteLogLevel('error', 'info')).toBe(true);

    expect(
      sanitizeLogValue({
        inputTokens: 120,
        openRouterApiKey: 'sk-secret',
        sessionTokenHash: 'session-hash',
        stripeCheckoutSessionId: 'cs_test_123',
      }),
    ).toEqual({
      inputTokens: 120,
      openRouterApiKey: '[redacted]',
      sessionTokenHash: '[redacted]',
      stripeCheckoutSessionId: 'cs_test_123',
    });
  });

  it('supports metadata, full, off, and targeted LLM trace modes', () => {
    expect(normalizeLlmTraceMode('full')).toBe('full');
    expect(normalizeLlmTraceMode('bad-value')).toBe('metadata');

    env.llmTraceMode = 'metadata';
    env.llmTraceFullUserIds = ['user-1'];
    env.llmTraceFullConversationIds = ['conversation-1'];

    expect(shouldLogFullLlmTrace({ userId: 'user-1' })).toBe(true);
    expect(
      shouldLogFullLlmTrace({ conversationId: 'conversation-1' }),
    ).toBe(true);
    expect(shouldLogFullLlmTrace({ userId: 'user-2' })).toBe(false);

    env.llmTraceMode = 'full';
    expect(shouldLogFullLlmTrace({ userId: 'user-2' })).toBe(true);

    env.llmTraceMode = 'off';
    expect(shouldLogFullLlmTrace({ userId: 'user-1' })).toBe(false);
  });

  it('keeps learner text and system prompts out of metadata LLM request logs', () => {
    env.logLevel = 'debug';
    env.llmTraceMode = 'metadata';
    env.llmTraceFullConversationIds = [];
    env.llmTraceFullUserIds = [];
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    logLlmRequest(
      [{ content: 'secret learner text', role: 'user' }],
      'secret system prompt',
      {
        actorLabel: 'Test',
        conversationId: 'conversation-2',
        llm: { modelTier: 'regular' },
        userId: 'user-2',
      },
      1,
    );

    const metadataLine = String(consoleLog.mock.calls[0]?.[0] ?? '');
    expect(metadataLine).not.toContain('secret learner text');
    expect(metadataLine).not.toContain('secret system prompt');
    expect(JSON.parse(metadataLine)).toMatchObject({
      event: 'llm_request',
      fullTrace: false,
      messageCount: 1,
    });

    consoleLog.mockClear();
    env.llmTraceMode = 'full';
    logLlmRequest(
      [{ content: 'secret learner text', role: 'user' }],
      'secret system prompt',
      {
        actorLabel: 'Test',
        conversationId: 'conversation-2',
        llm: { modelTier: 'regular' },
        userId: 'user-2',
      },
      1,
    );

    const fullLine = String(consoleLog.mock.calls[0]?.[0] ?? '');
    expect(fullLine).toContain('secret learner text');
    expect(fullLine).toContain('secret system prompt');
    expect(JSON.parse(fullLine)).toMatchObject({
      event: 'llm_request',
      fullTrace: true,
      messageCount: 1,
    });
  });
});
