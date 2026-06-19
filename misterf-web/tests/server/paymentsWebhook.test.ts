import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const paymentCreditMocks = vi.hoisted(() => ({
  constructStripeWebhookEvent: vi.fn(),
  createCreditsCheckoutSession: vi.fn(),
  fulfillCheckoutSession: vi.fn(),
  getCreditBalanceForUser: vi.fn(),
  getStripeConfigurationError: vi.fn(() => ''),
  getWebhookConfigurationError: vi.fn(() => ''),
}));

vi.mock('../../src/server/payments/credits.js', () => paymentCreditMocks);
vi.mock('../../src/server/payments/repository.js', () => ({
  listFulfilledCreditPurchasesForUser: vi.fn(() => []),
}));
vi.mock('../../src/server/pages/shell.js', () => ({
  appDocumentTitle: 'Mr. F, tutor de inglés',
  buildAppShellContext: vi.fn(() => ({})),
  getHomeAuthMessage: vi.fn(() => ''),
}));

describe('Stripe webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fulfills checkout.session.completed events', async () => {
    const session = { id: 'cs_test_completed' };
    paymentCreditMocks.constructStripeWebhookEvent.mockResolvedValue({
      data: { object: session },
      id: 'evt_completed',
      type: 'checkout.session.completed',
    });
    const response = createJsonResponse();
    const { handleStripeWebhook } = await import('../../src/server/payments/handlers.js');

    await handleStripeWebhook(
      {
        body: Buffer.from('{}'),
        headers: { 'stripe-signature': 'signature' },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(paymentCreditMocks.fulfillCheckoutSession).toHaveBeenCalledWith({
      eventId: 'evt_completed',
      session,
    });
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });
});

function createJsonResponse() {
  return {
    json: vi.fn(),
    send: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
}
