import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { csrfProtection } from './auth/csrf.js';
import { loadAuthSession } from './auth/middleware.js';
import { authRouter } from './auth/routes.js';
import { requireSessionSecret } from './auth/session.js';
import { chatRouter } from './chat/routes.js';
import { chatroomsRouter } from './chatrooms/routes.js';
import { env } from './config/env.js';
import { migrate } from './db/migrator.js';
import { legalRouter } from './legal/routes.js';
import { paymentsRouter, stripeWebhookRouter } from './payments/routes.js';
import { practiceModulesRouter } from './practiceModules/routes.js';
import { redirectIncompleteProfileOnboarding } from './profiles/onboardingMiddleware.js';
import { profileOnboardingRouter, profilesRouter } from './profiles/routes.js';
import { progressRouter } from './progress/routes.js';
import { settingsRouter } from './settings/routes.js';
import { registerChatSocket } from './socket/chatSocket.js';
import { superadminRouter } from './superadmin/routes.js';

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
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(csrfProtection);
app.use(loadAuthSession);

app.use(authRouter);
app.use(profileOnboardingRouter);
app.use(redirectIncompleteProfileOnboarding);
app.use(superadminRouter);
app.use(practiceModulesRouter);
app.use(profilesRouter);
app.use(settingsRouter);
app.use(paymentsRouter);
app.use(legalRouter);
app.use(progressRouter);
app.use(chatroomsRouter);
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

registerChatSocket(io);

export function startServer(): void {
  server.listen(env.port, env.host, () => {
    console.log(`Mister F listening on http://${env.host}:${env.port}`);
  });
}

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  startServer();
}
