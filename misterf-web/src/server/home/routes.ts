import express from 'express';
import { handleSwitchHomeMode, renderHomePage } from './handlers.js';

export const homeRouter = express.Router();

homeRouter.post('/home/mode', handleSwitchHomeMode);
// `/` belongs to the home dispatcher, not to the chat router: which composition
// opens depends on the active profile's mode. `/chat` stays the chat router's
// explicit entry to a tutor conversation, in either mode.
homeRouter.get('/', renderHomePage);
