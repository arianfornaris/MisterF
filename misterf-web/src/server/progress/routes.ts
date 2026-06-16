import express from 'express';
import { renderProgressPage } from './handlers.js';

export const progressRouter = express.Router();

progressRouter.get('/progress', renderProgressPage);
