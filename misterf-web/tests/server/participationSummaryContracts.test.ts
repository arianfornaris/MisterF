import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: generateTextMock,
  };
});

import {
  generateGuideParticipationSummary,
  generateRoleplayParticipationSummary,
} from '../../src/server/services/resourceDrafts.js';
import { computeParticipationFingerprint } from '../../src/server/resources/participationSummary.js';

const testApiKey = 'test-openrouter-key';

function modelResult(text: string, finishReason = 'stop') {
  return {
    finishReason,
    providerMetadata: undefined,
    text,
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
  };
}

function capturedMessages(callIndex: number): Array<{ content: string; role: string }> {
  const call = generateTextMock.mock.calls[callIndex] as [
    { messages: Array<{ content: string; role: string }> },
  ];
  return call[0].messages;
}

beforeEach(() => {
  generateTextMock.mockReset();
});

describe('roleplay participation summary contract', () => {
  it('returns the summary and passes the attempt aggregate as the user message', async () => {
    generateTextMock.mockResolvedValueOnce(
      modelResult(JSON.stringify({ summary: 'Most participants struggled with connectors.' })),
    );

    const result = await generateRoleplayParticipationSummary({
      openRouterApiKey: testApiKey,
      request: {
        attempts: [
          { difficulties: ['Professional tone'], turnCount: 4, turnsToImprove: 2 },
          { difficulties: ['Professional tone', 'Connectors'], turnCount: 6, turnsToImprove: 1 },
        ],
        description: 'A stand-up meeting',
        evaluatedCount: 2,
        participantCount: 3,
        title: 'Daily stand-up',
      },
    });

    expect(result.summary).toBe('Most participants struggled with connectors.');

    const userMessage = capturedMessages(0).find((message) => message.role === 'user');
    expect(userMessage?.content).toContain('Daily stand-up');
    expect(userMessage?.content).toContain('Professional tone');
    // The prompt aggregates attempts; no transcript or per-person identity is sent.
    expect(userMessage?.content).not.toContain('participantLabel');
  });

  it('recovers from a non-JSON first response through the correction call', async () => {
    generateTextMock
      .mockResolvedValueOnce(modelResult('Sure! Here is the summary you asked for.'))
      .mockResolvedValueOnce(
        modelResult(JSON.stringify({ summary: 'Two of three participants finished.' })),
      );

    const result = await generateRoleplayParticipationSummary({
      openRouterApiKey: testApiKey,
      request: {
        attempts: [{ difficulties: [], turnCount: 3, turnsToImprove: 0 }],
        description: '',
        evaluatedCount: 1,
        participantCount: 3,
        title: 'Interview practice',
      },
    });

    expect(result.summary).toBe('Two of three participants finished.');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });
});

describe('practice guide participation summary contract', () => {
  it('returns the summary and passes the report aggregate as the user message', async () => {
    generateTextMock.mockResolvedValueOnce(
      modelResult(JSON.stringify({ summary: 'Sessions focused on technical vocabulary.' })),
    );

    const result = await generateGuideParticipationSummary({
      openRouterApiKey: testApiKey,
      request: {
        description: 'Technical English for developers',
        reportCount: 2,
        reports: [
          {
            difficultyAreas: ['Register and tone'],
            nextSteps: ['Practice connectors'],
            practicedTopics: ['Describing tasks'],
          },
          {
            difficultyAreas: ['Register and tone'],
            nextSteps: ['Expand vocabulary'],
            practicedTopics: ['Explaining blockers'],
          },
        ],
        title: 'Stand-up English',
      },
    });

    expect(result.summary).toBe('Sessions focused on technical vocabulary.');

    const userMessage = capturedMessages(0).find((message) => message.role === 'user');
    expect(userMessage?.content).toContain('Stand-up English');
    expect(userMessage?.content).toContain('Register and tone');
  });
});

describe('computeParticipationFingerprint', () => {
  it('counts only finished items and tracks the latest update', () => {
    expect(
      computeParticipationFingerprint([
        { status: 'evaluated', updatedAt: '2026-07-01T00:00:00Z' },
        { status: 'evaluated', updatedAt: '2026-07-03T00:00:00Z' },
        { status: 'in_progress', updatedAt: '2026-07-09T00:00:00Z' },
      ]),
    ).toBe('2:2026-07-03T00:00:00Z');
  });

  it('treats items without a status as finished, so reports count as-is', () => {
    expect(
      computeParticipationFingerprint([
        { updatedAt: '2026-07-01T00:00:00Z' },
        { updatedAt: '2026-07-05T00:00:00Z' },
      ]),
    ).toBe('2:2026-07-05T00:00:00Z');
  });

  it('changes when new participation arrives, which is what marks a summary stale', () => {
    const before = computeParticipationFingerprint([
      { status: 'evaluated', updatedAt: '2026-07-01T00:00:00Z' },
    ]);
    const after = computeParticipationFingerprint([
      { status: 'evaluated', updatedAt: '2026-07-01T00:00:00Z' },
      { status: 'evaluated', updatedAt: '2026-07-02T00:00:00Z' },
    ]);

    expect(before).not.toBe(after);
  });

  it('is empty-safe', () => {
    expect(computeParticipationFingerprint([])).toBe('0:');
  });
});
