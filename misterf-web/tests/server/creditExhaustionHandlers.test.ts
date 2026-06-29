import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const creditGateMocks = vi.hoisted(() => {
  class MockCreditExhaustedError extends Error {
    constructor() {
      super('No credits available.');
      this.name = 'CreditExhaustedError';
    }
  }

  return {
    CreditExhaustedError: MockCreditExhaustedError,
    getCreditCheckedOpenRouterApiKeyForUser: vi.fn(),
    getCreditExhaustedMessage: vi.fn(() => 'No credits available.'),
    isCreditExhaustedError: vi.fn((error: unknown) => error instanceof MockCreditExhaustedError),
  };
});

const repositoryMocks = vi.hoisted(() => ({
  closeConversationForUser: vi.fn(),
  createConversationFromTutorReport: vi.fn(),
  createPracticeGuide: vi.fn(),
  deleteConversationForUser: vi.fn(),
  deleteConversationTutorPlan: vi.fn(),
  ensureUserHasProfile: vi.fn(),
  findConversationForUser: vi.fn(),
  findMessageInConversation: vi.fn(),
  findPracticeGuideForUser: vi.fn(),
  findProfileById: vi.fn(),
  findProfileForUser: vi.fn(),
  findTutorConversationReport: vi.fn(),
  getConversationPracticeGuideSnapshot: vi.fn(),
  getConversationTutorPlan: vi.fn(),
  getConversationTutorReportSnapshot: vi.fn(),
  importAssignmentToProfile: vi.fn(),
  listConversationsForProfile: vi.fn(),
  listMessages: vi.fn(),
  renameConversationForUser: vi.fn(),
  saveTutorConversationReport: vi.fn(),
  setTutorConversationReportPracticeGuide: vi.fn(),
  updateConversationModelTierForUser: vi.fn(),
  updateMessageMetadata: vi.fn(),
}));

const tutorReportMocks = vi.hoisted(() => ({
  generatePracticeGuideFromTutorConversationReport: vi.fn(),
  generateTutorConversationReport: vi.fn(),
}));

vi.mock('../../src/server/db/repository.js', () => repositoryMocks);
vi.mock('../../src/server/services/creditGate.js', () => creditGateMocks);
vi.mock('../../src/server/services/tutorReports.js', () => tutorReportMocks);
vi.mock('../../src/server/services/learnerProgress.js', () => ({
  recordTutorConversationReportProgress: vi.fn(),
}));
vi.mock('../../src/server/auth/profiles.js', () => ({
  setActiveProfileCookie: vi.fn(),
}));
vi.mock('../../src/server/pages/shell.js', () => ({
  appDocumentTitle: 'Mr. F, tutor de inglés',
  buildAppShellContext: vi.fn(() => ({})),
  getHomeAuthMessage: vi.fn(() => ''),
  resolveGuestInitialGreeting: vi.fn(() => ''),
}));

describe('credit exhaustion web handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects tutor report generation to product credit UI instead of exposing errors', async () => {
    repositoryMocks.findConversationForUser.mockReturnValue({
      closedAt: null,
      id: 'conversation-1',
      profileId: 'profile-1',
      title: 'New conversation',
      titleUpdatedByUser: false,
      userId: 'user-1',
    });
    repositoryMocks.findTutorConversationReport.mockReturnValue(null);
    repositoryMocks.listMessages.mockReturnValue([]);
    creditGateMocks.getCreditCheckedOpenRouterApiKeyForUser.mockRejectedValue(
      new creditGateMocks.CreditExhaustedError(),
    );
    const response = createRedirectResponse();
    const { handleFinalizeTutorConversation } = await import('../../src/server/chat/handlers.js');

    await handleFinalizeTutorConversation(
      {
        authUser: verifiedUser(),
        params: { conversationId: 'conversation-1' },
      } as unknown as Request,
      response as unknown as Response,
    );

    const location = getRedirectLocation(response);
    expect(location).toMatch(/^\/c\/conversation-1\?/);
    expect(location).toContain('credit=exhausted');
    expect(readRedirectParam(location, 'creditMessage')).toBe('No credits available.');
    expect(location).not.toContain('CreditExhaustedError');
    expect(tutorReportMocks.generateTutorConversationReport).not.toHaveBeenCalled();
  });

});

function verifiedUser() {
  return {
    email: 'learner@example.com',
    emailVerified: true,
    fullName: 'Learner',
    id: 'user-1',
    passwordHash: 'hash',
  };
}

function activeProfile() {
  return {
    id: 'profile-1',
    modelTier: 'regular',
    name: 'Default',
    userId: 'user-1',
  };
}

function createRedirectResponse() {
  return {
    redirect: vi.fn(),
  };
}

function getRedirectLocation(response: ReturnType<typeof createRedirectResponse>): string {
  expect(response.redirect).toHaveBeenCalledOnce();
  return String(response.redirect.mock.calls[0][0]);
}

function readRedirectParam(location: string, name: string): string | null {
  return new URLSearchParams(location.split('?')[1] ?? '').get(name);
}
