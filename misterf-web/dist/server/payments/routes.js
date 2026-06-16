import express from 'express';
import { handleCreateCreditsCheckout, handleStripeWebhook, renderCreditsPage, } from './handlers.js';
export const stripeWebhookRouter = express.Router();
export const paymentsRouter = express.Router();
stripeWebhookRouter.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
paymentsRouter.get('/credits', renderCreditsPage);
paymentsRouter.post('/credits/checkout', handleCreateCreditsCheckout);
//# sourceMappingURL=routes.js.map