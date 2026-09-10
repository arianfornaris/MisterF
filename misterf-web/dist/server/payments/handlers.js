import { translate } from '../i18n/index.js';
import { buildDocumentTitle, buildAppShellContext, getHomeAuthMessage, } from '../pages/shell.js';
import { constructStripeWebhookEvent, createCreditsCheckoutSession, getCreditBalanceForUser, getStripeConfigurationError, getWebhookConfigurationError, fulfillCheckoutSession, } from './credits.js';
import { defaultCreditPackage } from './packages.js';
import { listFulfilledCreditPurchasesForUser } from './repository.js';
import { logger } from '../services/logger.js';
function ensureVerifiedCreditsUser(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return null;
    }
    return user;
}
export async function renderCreditsPage(request, response) {
    const user = ensureVerifiedCreditsUser(request, response);
    if (!user) {
        return;
    }
    const balance = await getCreditBalanceForUser(user.id);
    const returnTo = normalizeReturnTo(request.query.returnTo);
    response.render('credits', {
        ...buildAppShellContext({
            activeProfile: request.activeProfile,
            authMessage: getHomeAuthMessage(request, user),
            currentView: 'credits',
            guestInitialGreeting: '',
            request,
            title: buildDocumentTitle(request.locale, translate(request.locale, 'credits.title')),
            user,
        }),
        balance,
        checkoutError: readQueryString(request.query.error),
        checkoutStatus: readQueryString(request.query.checkout),
        creditPackage: {
            ...defaultCreditPackage,
            description: translate(request.locale, 'credits.packageDescription'),
            label: translate(request.locale, 'credits.package200'),
        },
        purchases: listFulfilledCreditPurchasesForUser(user.id),
        returnTo,
        stripeConfigurationError: getStripeConfigurationError(),
    });
}
export async function handleCreateCreditsCheckout(request, response) {
    const user = ensureVerifiedCreditsUser(request, response);
    if (!user) {
        return;
    }
    try {
        const returnTo = normalizeReturnTo(request.body.returnTo);
        const session = await createCreditsCheckoutSession({
            returnTo,
            user,
        });
        if (!session.url) {
            throw new Error('Stripe returned no Checkout URL.');
        }
        response.redirect(303, session.url);
    }
    catch (error) {
        logger.error('credit_checkout_session_failed', {
            error,
            returnTo: normalizeReturnTo(request.body.returnTo),
            userId: user.id,
        });
        // The reason stays in the log: raw provider and configuration errors are
        // neither translated nor meant for the buyer, who gets
        // `credits.payErrorDefault` in their own language.
        response.redirect(`/credits?checkout=error&returnTo=${encodeURIComponent(normalizeReturnTo(request.body.returnTo))}`);
    }
}
export async function handleStripeWebhook(request, response) {
    if (getWebhookConfigurationError()) {
        response.status(500).send('Stripe webhook is not configured.');
        return;
    }
    try {
        const event = await constructStripeWebhookEvent({
            body: request.body,
            signature: request.headers['stripe-signature'],
        });
        logger.debug('stripe_webhook_received', {
            stripeEventId: event.id,
            type: event.type,
        });
        if (event.type === 'checkout.session.completed' ||
            event.type === 'checkout.session.async_payment_succeeded') {
            await fulfillCheckoutSession({
                eventId: event.id,
                session: event.data.object,
            });
        }
        else {
            logger.debug('stripe_webhook_ignored', {
                stripeEventId: event.id,
                type: event.type,
            });
        }
        response.json({ received: true });
    }
    catch (error) {
        logger.error('stripe_webhook_error', { error });
        response.status(400).send('Stripe webhook error.');
    }
}
function readQueryString(value) {
    return typeof value === 'string' ? value : '';
}
function normalizeReturnTo(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
        return '/credits';
    }
    const [path = ''] = raw.split('#');
    if (path.startsWith('/credits/checkout') ||
        path.startsWith('/logout') ||
        path.startsWith('/stripe')) {
        return '/credits';
    }
    return path.slice(0, 500);
}
//# sourceMappingURL=handlers.js.map