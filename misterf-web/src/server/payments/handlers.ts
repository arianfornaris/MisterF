import type { Request, Response } from 'express';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';
import {
  constructStripeWebhookEvent,
  createCreditsCheckoutSession,
  getCreditBalanceForUser,
  getStripeConfigurationError,
  getWebhookConfigurationError,
  fulfillCheckoutSession,
} from './credits.js';
import { defaultCreditPackage } from './packages.js';
import { listCreditPurchasesForUser } from './repository.js';

function ensureVerifiedCreditsUser(
  request: Request,
  response: Response,
): NonNullable<Request['authUser']> | null {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return null;
  }

  return user;
}

export async function renderCreditsPage(
  request: Request,
  response: Response,
): Promise<void> {
  const user = ensureVerifiedCreditsUser(request, response);
  if (!user) {
    return;
  }

  const balance = await getCreditBalanceForUser(user.id);

  response.render('credits', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'credits',
      guestInitialGreeting: '',
      request,
      title: `Créditos · ${appDocumentTitle}`,
      user,
    }),
    balance,
    checkoutError: readQueryString(request.query.error),
    checkoutStatus: readQueryString(request.query.checkout),
    creditPackage: defaultCreditPackage,
    purchases: listCreditPurchasesForUser(user.id),
    stripeConfigurationError: getStripeConfigurationError(),
  });
}

export async function handleCreateCreditsCheckout(
  request: Request,
  response: Response,
): Promise<void> {
  const user = ensureVerifiedCreditsUser(request, response);
  if (!user) {
    return;
  }

  try {
    const session = await createCreditsCheckoutSession({
      user,
    });

    if (!session.url) {
      throw new Error('Stripe no devolvió una URL de Checkout.');
    }

    response.redirect(303, session.url);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo iniciar el pago con Stripe.';
    response.redirect(
      `/credits?checkout=error&error=${encodeURIComponent(message)}`,
    );
  }
}

export async function handleStripeWebhook(
  request: Request,
  response: Response,
): Promise<void> {
  if (getWebhookConfigurationError()) {
    response.status(500).send('Stripe webhook is not configured.');
    return;
  }

  try {
    const event = await constructStripeWebhookEvent({
      body: request.body as Buffer,
      signature: request.headers['stripe-signature'],
    });

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      await fulfillCheckoutSession({
        eventId: event.id,
        session: event.data.object,
      });
    }

    response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    response.status(400).send('Stripe webhook error.');
  }
}

function readQueryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
