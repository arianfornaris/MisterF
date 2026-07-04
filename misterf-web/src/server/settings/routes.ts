import express from 'express';
import { handleUpdateSettingsLanguage, renderSettingsPage } from './handlers.js';

export const settingsRouter = express.Router();

settingsRouter.get('/settings', renderSettingsPage);
settingsRouter.post('/settings/language', handleUpdateSettingsLanguage);
