import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { quizzesRouter } from './quizzes/routes.js';
import { csrfProtection } from './auth/csrf.js';
import { loadAuthSession } from './auth/middleware.js';
import { authRouter } from './auth/routes.js';
import { requireSessionSecret } from './auth/session.js';
import { chatRouter } from './chat/routes.js';
import { env } from './config/env.js';
import { migrate } from './db/migrator.js';
import { legalRouter } from './legal/routes.js';
import { paymentsRouter, stripeWebhookRouter } from './payments/routes.js';
import { practiceGuidesRouter } from './practiceGuides/routes.js';
import { redirectIncompleteProfileOnboarding } from './profiles/onboardingMiddleware.js';
import { profileOnboardingRouter, profilesRouter } from './profiles/routes.js';
import { progressRouter } from './progress/routes.js';
import { resourcesRouter } from './resources/routes.js';
import { roleplaysRouter } from './roleplays/routes.js';
import { settingsRouter } from './settings/routes.js';
import { logger } from './services/logger.js';
import { registerChatSocket } from './socket/chatSocket.js';
import { superadminRouter } from './superadmin/routes.js';
import { clientTelemetryRouter } from './telemetry/clientErrors.js';

requireSessionSecret();
migrate();

export const app = express();
export const server = http.createServer(app);
export const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(env.projectRoot, 'views'));
app.set('trust proxy', 1);

app.use('/public', express.static(path.join(env.projectRoot, 'public')));
app.use(
  '/vendor/bootswatch',
  express.static(path.join(env.projectRoot, 'node_modules/bootswatch/dist')),
);
app.use(
  '/vendor/bootstrap',
  express.static(path.join(env.projectRoot, 'node_modules/bootstrap/dist')),
);
app.use(
  '/vendor/bootstrap-icons',
  express.static(path.join(env.projectRoot, 'node_modules/bootstrap-icons/font')),
);
app.use(
  '/vendor/marked',
  express.static(path.join(env.projectRoot, 'node_modules/marked/lib')),
);
app.use(
  '/vendor/dompurify',
  express.static(path.join(env.projectRoot, 'node_modules/dompurify/dist')),
);

app.use(stripeWebhookRouter);
app.use(clientTelemetryRouter);
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(csrfProtection);
app.use(loadAuthSession);

app.use(authRouter);
app.use(profileOnboardingRouter);
app.use(redirectIncompleteProfileOnboarding);
app.use(superadminRouter);
app.use(resourcesRouter);
app.use(practiceGuidesRouter);
app.use(quizzesRouter);
app.use(roleplaysRouter);
app.use(profilesRouter);
app.use(settingsRouter);
app.use(paymentsRouter);
app.use(legalRouter);
app.use(progressRouter);
app.get(/^\/chatrooms(?:\/.*)?$/, (_request, response) => {
  response.redirect('/resources');
});
app.get(/^\/chatroom-conversations(?:\/.*)?$/, (_request, response) => {
  response.redirect('/resources');
});
app.use(chatRouter);
app.get('/session', (request, response) => {
  response.json({
    isAuthenticated: Boolean(request.authUser),
    user: request.authUser
      ? {
          email: request.authUser.email,
          fullName: request.authUser.fullName,
          id: request.authUser.id,
        }
      : null,
  });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.use(
  (
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    logger.error('http_request_error', {
      error,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode >= 400 ? response.statusCode : 500,
      userId: request.authUser?.id ?? null,
    });

    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).send('Ocurrió un error inesperado.');
  },
);

registerChatSocket(io);

export function startServer(): void {
  server.listen(env.port, env.host, () => {
    logger.info('server_started', {
      host: env.host,
      port: env.port,
      url: `http://${env.host}:${env.port}`,
    });
  });
}

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  startServer();
}
