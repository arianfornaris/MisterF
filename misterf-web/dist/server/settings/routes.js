import express from 'express';
import { renderSettingsPage } from './handlers.js';
export const settingsRouter = express.Router();
settingsRouter.get('/settings', renderSettingsPage);
//# sourceMappingURL=routes.js.map