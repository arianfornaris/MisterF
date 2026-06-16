import express from 'express';
import {
  renderPrivacyPage,
  renderTermsPage,
} from './handlers.js';

export const legalRouter = express.Router();

legalRouter.get('/privacy', renderPrivacyPage);
legalRouter.get('/terms', renderTermsPage);
