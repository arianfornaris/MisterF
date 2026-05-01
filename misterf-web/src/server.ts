import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { csrfProtection } from './auth/csrf.js';
import {
  handleChangePassword,
  handleCreateActivity,
  handleCreateActivityConversation,
  handleCreateProfile,
  handleDeleteActivity,
  handleUpdateActivity,
  handleForgotPassword,
  handleLogin,
  handleLogout,
  handleResendVerification,
  handleResetPassword,
  handleSignup,
  handleSwitchProfile,
  handleUpdateProfile,
  handleVerifyEmail,
  renderHome,
  renderChangePassword,
  renderForgotPassword,
  renderLogin,
  renderResetPassword,
  renderSignup,
  renderVerifyNeeded,
} from './auth/forms.js';
import { finishGoogleLogin, startGoogleLogin } from './auth/google.js';
import { loadAuthSession } from './auth/middleware.js';
import { requireSessionSecret } from './auth/session.js';
import { env } from './config/env.js';
import { migrate } from './db/migrator.js';
import { registerChatSocket } from './socket/chatSocket.js';
import {
  handleOpenRouterKeyUpdate,
  renderSuperadminUser,
  renderSuperadminUsers,
} from './superadmin/routes.js';

requireSessionSecret();
migrate();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(csrfProtection);
app.use(loadAuthSession);

app.get('/login', renderLogin);
app.post('/login', handleLogin);
app.get('/signup', renderSignup);
app.post('/signup', handleSignup);
app.get('/register', renderSignup);
app.post('/register', handleSignup);
app.get('/auth/google', startGoogleLogin);
app.get('/auth/google/callback', finishGoogleLogin);
app.get('/forgot-password', renderForgotPassword);
app.post('/forgot-password', handleForgotPassword);
app.get('/reset-password', renderResetPassword);
app.post('/reset-password', handleResetPassword);
app.get('/change-password', renderChangePassword);
app.post('/change-password', handleChangePassword);
app.post('/verify-email', handleVerifyEmail);
app.get('/verify-needed', renderVerifyNeeded);
app.post('/resend-verification', handleResendVerification);
app.get('/callback', (_request, response) => {
  response.redirect('/');
});
app.post('/logout', handleLogout);
app.get('/superadmin', renderSuperadminUsers);
app.get('/superadmin/users/:userId', renderSuperadminUser);
app.post('/superadmin/users/:userId/openrouter-key', handleOpenRouterKeyUpdate);
app.get('/activities', renderHome);
app.get('/activities/new', renderHome);
app.post('/activities', handleCreateActivity);
app.get('/activities/:activityId/edit', renderHome);
app.get('/activities/:activityId', renderHome);
app.post('/activities/:activityId', handleUpdateActivity);
app.post('/activities/:activityId/delete', handleDeleteActivity);
app.post('/activities/:activityId/chats', handleCreateActivityConversation);
app.get('/profiles', renderHome);
app.get('/profiles/new', renderHome);
app.get('/profiles/:profileId/edit', renderHome);
app.post('/profiles', handleCreateProfile);
app.post('/profiles/switch', handleSwitchProfile);
app.post('/profiles/:profileId', handleUpdateProfile);
app.get('/admin-chat', (_request, response) => {
  response.redirect('/admin-chats');
});
app.get('/admin-chat/:adminChatId', (request, response) => {
  response.redirect(`/admin-chats/${encodeURIComponent(request.params.adminChatId)}`);
});
app.get('/admin-chats', renderHome);
app.get('/admin-chats/new', renderHome);
app.get('/admin-chats/:adminChatId', renderHome);
app.get('/c/:conversationId', renderHome);
app.get('/', renderHome);
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

server.listen(env.port, () => {
  console.log(`Mister F listening on http://localhost:${env.port}`);
});
