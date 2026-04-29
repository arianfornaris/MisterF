import type { Request, Response } from 'express';
import { createSocketAuthToken } from './socketAuth.js';
import { pickInitialGreeting } from '../socket/initialGreetings.js';
import {
  getMailerConfigurationError,
  isMailerConfigured,
  sendEmailVerification,
  sendPasswordReset,
} from './mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  createAuthActionToken,
  createLocalUser,
  createSession,
  deleteUserById,
  findUserByAuthActionToken,
  findUserByEmail,
  markAuthActionTokenUsed,
  markEmailVerified,
  normalizeEmail,
  revokeSession,
  revokeUserSessions,
  updateUserPassword,
  type AuthUser,
} from './repository.js';
import {
  clearSessionCookie,
  createSessionCookie,
  setSessionCookie,
} from './session.js';
import {
  createActionToken,
  hashActionToken,
  normalizeActionToken,
} from './tokens.js';
import {
  createActivity,
  createConversationFromActivity,
  findActivityForUser,
  findConversationForUser,
  listActivitiesForUser,
  listConversationsForActivity,
  listConversationsForUser,
  updateActivity,
} from '../db/repository.js';
import { ensureOpenRouterKeyForUser } from '../services/openRouterUserKeys.js';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

type AuthFormView = {
  error: string;
  fieldErrors: Record<string, string>;
  mode: AuthMode;
  values: {
    code: string;
    email: string;
    fullName: string;
  };
};

type ChangePasswordView = {
  error: string;
  fieldErrors: Record<string, string>;
  hasPassword: boolean;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 12;
const attemptWindowMs = 10 * 60 * 1000;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;

export function renderLogin(request: Request, response: Response): void {
  if (request.authUser?.emailVerified) {
    response.redirect('/');
    return;
  }

  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'login',
    values: { code: '', email: '', fullName: '' },
  });
}

export function renderSignup(request: Request, response: Response): void {
  if (request.authUser?.emailVerified) {
    response.redirect('/');
    return;
  }

  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'signup',
    values: { code: '', email: '', fullName: '' },
  });
}

export function renderForgotPassword(_request: Request, response: Response): void {
  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'forgot',
    values: { code: '', email: '', fullName: '' },
  });
}

export function renderResetPassword(_request: Request, response: Response): void {
  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'reset',
    values: { code: '', email: '', fullName: '' },
  });
}

export function renderChangePassword(
  request: Request,
  response: Response,
): void {
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  renderChangePasswordForm(response, {
    error: '',
    fieldErrors: {},
    hasPassword: Boolean(request.authUser.passwordHash),
  });
}

export async function handleLogin(
  request: Request,
  response: Response,
): Promise<void> {
  const email = normalizeEmail(readField(request.body.email));
  const password = readField(request.body.password);
  const fieldErrors: Record<string, string> = {};

  if (!email) {
    fieldErrors.email = 'Escribe tu correo.';
  }

  if (!password) {
    fieldErrors.password = 'Escribe tu password.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors,
      mode: 'login',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  if (isRateLimited(request)) {
    renderAuthForm(response.status(429), {
      error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
      fieldErrors: {},
      mode: 'login',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  const user = findUserByEmail(email);
  const isPasswordValid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !isPasswordValid) {
    registerFailedAttempt(request);
    renderAuthForm(response.status(401), {
      error: 'El correo o el password no son correctos.',
      fieldErrors: {},
      mode: 'login',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  await signInUser(request, response, user.id);
}

export async function handleSignup(
  request: Request,
  response: Response,
): Promise<void> {
  const email = normalizeEmail(readField(request.body.email));
  const fullName = readField(request.body.fullName);
  const password = readField(request.body.password);
  const fieldErrors = validateSignup({ email, fullName, password });

  if (Object.keys(fieldErrors).length > 0) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors,
      mode: 'signup',
      values: { code: '', email, fullName },
    });
    return;
  }

  if (findUserByEmail(email)) {
    renderAuthForm(response.status(409), {
      error: '',
      fieldErrors: {
        email: 'Ya existe una cuenta con este correo.',
      },
      mode: 'signup',
      values: { code: '', email, fullName },
    });
    return;
  }

  if (!isMailerConfigured()) {
    renderAuthForm(response.status(503), {
      error: getMailerConfigurationError(),
      fieldErrors: {},
      mode: 'signup',
      values: { code: '', email, fullName },
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = createLocalUser({ email, fullName, passwordHash });
  try {
    await ensureOpenRouterKeyForUser(user.id);
  } catch (error) {
    deleteUserById(user.id);
    renderAuthForm(response.status(503), {
      error: toOpenRouterProvisioningErrorMessage(error),
      fieldErrors: {},
      mode: 'signup',
      values: { code: '', email, fullName },
    });
    return;
  }

  try {
    await issueEmailVerification(user);
  } catch (error) {
    renderAuthForm(response.status(503), {
      error: toMailErrorMessage(error),
      fieldErrors: {},
      mode: 'signup',
      values: { code: '', email, fullName },
    });
    return;
  }

  await signInUser(request, response, user.id, '/verify-needed');
}

export async function handleForgotPassword(
  request: Request,
  response: Response,
): Promise<void> {
  const email = normalizeEmail(readField(request.body.email));
  if (!isEmail(email)) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors: { email: 'Escribe un correo válido.' },
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  if (!isMailerConfigured()) {
    renderAuthForm(response.status(503), {
      error: getMailerConfigurationError(),
      fieldErrors: {},
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  try {
    const user = findUserByEmail(email);
    if (user) {
      await issuePasswordReset(user);
    }
  } catch (error) {
    renderAuthForm(response.status(503), {
      error: toMailErrorMessage(error),
      fieldErrors: {},
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  renderAuthMessage(response, {
    body: 'Si existe una cuenta con ese correo, enviamos un código para recuperar el password.',
    linkHref: '/reset-password',
    linkText: 'Escribir código',
    title: 'Revisa tu correo',
  });
}

export async function handleResetPassword(
  request: Request,
  response: Response,
): Promise<void> {
  const email = normalizeEmail(readField(request.body.email));
  const code = normalizeActionToken(readField(request.body.code));
  const password = readField(request.body.password);
  const fieldErrors: Record<string, string> = {};

  if (!isEmail(email)) {
    fieldErrors.email = 'Escribe el correo de tu cuenta.';
  }

  if (!code) {
    fieldErrors.code = 'Escribe el código que recibiste.';
  }

  if (password.length < 10) {
    fieldErrors.password = 'Usa al menos 10 caracteres.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors,
      mode: 'reset',
      values: { code, email, fullName: '' },
    });
    return;
  }

  const tokenHash = hashActionToken(code);
  const user = findUserByAuthActionToken({
    tokenHash,
    type: 'password_reset',
  });
  if (!user || user.email !== email) {
    renderAuthForm(response.status(400), {
      error: 'El código no es válido o ya expiró.',
      fieldErrors: {},
      mode: 'reset',
      values: { code, email, fullName: '' },
    });
    return;
  }

  updateUserPassword({
    passwordHash: await hashPassword(password),
    userId: user.id,
  });
  markAuthActionTokenUsed(tokenHash);
  revokeUserSessions(user.id);
  clearSessionCookie(response);

  renderAuthMessage(response, {
    body: 'Tu password fue actualizado. Ya puedes iniciar sesión.',
    linkHref: '/login',
    linkText: 'Iniciar sesión',
    title: 'Password actualizado',
  });
}

export async function handleChangePassword(
  request: Request,
  response: Response,
): Promise<void> {
  const user = request.authUser;
  if (!user) {
    response.redirect('/login');
    return;
  }

  const currentPassword = readField(request.body.currentPassword);
  const newPassword = readField(request.body.newPassword);
  const fieldErrors: Record<string, string> = {};

  if (user.passwordHash && !currentPassword) {
    fieldErrors.currentPassword = 'Escribe tu password actual.';
  }

  if (newPassword.length < 10) {
    fieldErrors.newPassword = 'Usa al menos 10 caracteres.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    renderChangePasswordForm(response.status(422), {
      error: '',
      fieldErrors,
      hasPassword: Boolean(user.passwordHash),
    });
    return;
  }

  if (user.passwordHash) {
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      renderChangePasswordForm(response.status(401), {
        error: 'El password actual no es correcto.',
        fieldErrors: {},
        hasPassword: true,
      });
      return;
    }
  }

  updateUserPassword({
    passwordHash: await hashPassword(newPassword),
    userId: user.id,
  });

  revokeUserSessions(user.id);
  clearSessionCookie(response);

  renderAuthMessage(response, {
    body: 'Tu contraseña fue actualizada. Vuelve a iniciar sesión.',
    linkHref: '/login',
    linkText: 'Iniciar sesión',
    title: 'Contraseña actualizada',
  });
}

export async function handleVerifyEmail(
  request: Request,
  response: Response,
): Promise<void> {
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  const code = normalizeActionToken(readField(request.body.code));
  if (!code) {
    renderAuthMessage(response.status(422), {
      body: 'Escribe el código que enviamos a tu correo.',
      showVerificationCodeForm: true,
      title: 'Verifica tu correo',
    });
    return;
  }

  const tokenHash = hashActionToken(code);
  const user = findUserByAuthActionToken({
    tokenHash,
    type: 'email_verification',
  });

  if (!user || user.id !== request.authUser.id) {
    renderAuthMessage(response.status(400), {
      body: 'El código de verificación no es válido o ya expiró.',
      showVerificationCodeForm: true,
      title: 'Código inválido',
    });
    return;
  }

  markEmailVerified(user.id);
  markAuthActionTokenUsed(tokenHash);

  renderAuthMessage(response, {
    body: 'Tu correo ya está verificado. Puedes empezar a practicar.',
    linkHref: '/',
    linkText: 'Ir al chat',
    title: 'Correo verificado',
  });
}

export async function handleResendVerification(
  request: Request,
  response: Response,
): Promise<void> {
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  if (request.authUser.emailVerified) {
    response.redirect('/');
    return;
  }

  if (!isMailerConfigured()) {
    renderAuthMessage(response.status(503), {
      body: getMailerConfigurationError(),
      title: 'No pude enviar el email',
    });
    return;
  }

  try {
    await issueEmailVerification(request.authUser);
  } catch (error) {
    renderAuthMessage(response.status(503), {
      body: toMailErrorMessage(error),
      title: 'No pude enviar el email',
    });
    return;
  }

  renderAuthMessage(response, {
    body: 'Enviamos otro código de verificación a tu correo.',
    showVerificationCodeForm: true,
    title: 'Revisa tu correo',
  });
}

export function renderVerifyNeeded(
  request: Request,
  response: Response,
): void {
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  if (request.authUser.emailVerified) {
    response.redirect('/');
    return;
  }

  renderAuthMessage(response, {
    body: `Antes de usar el tutor, escribe el código que enviamos a ${request.authUser.email}.`,
    showVerificationCodeForm: true,
    showResendVerification: true,
    title: 'Verifica tu correo',
  });
}

export function handleLogout(request: Request, response: Response): void {
  if (request.sessionTokenHash) {
    revokeSession(request.sessionTokenHash);
  }

  clearSessionCookie(response);
  response.redirect('/');
}

export function renderHome(request: Request, response: Response): void {
  const user = request.authUser;
  const isVerified = Boolean(user?.emailVerified);
  const socketAuthToken = user && isVerified ? createSocketAuthToken(user) : '';
  const authMessage = getHomeAuthMessage(request, user);
  const conversations = user ? listConversationsForUser(user.id) : [];
  const activities = user ? listActivitiesForUser(user.id) : [];
  const activitiesWithCounts = user
    ? activities.map((activity) => ({
        ...activity,
        conversationCount: listConversationsForActivity(activity.id, user.id).length,
      }))
    : [];
  const guestInitialGreeting = user ? '' : pickInitialGreeting();
  const requestedConversationIdRaw = request.params.conversationId;
  const requestedConversationId =
    typeof requestedConversationIdRaw === 'string'
      ? requestedConversationIdRaw.trim()
      : '';
  const requestedActivityIdRaw = request.params.activityId;
  const requestedActivityId =
    typeof requestedActivityIdRaw === 'string'
      ? requestedActivityIdRaw.trim()
      : '';
  const isActivityNewPage = request.path === '/activities/new';
  const isActivityEditPage = request.path.endsWith('/edit');
  let initialConversationId = '';
  let currentView: 'chat' | 'activities' = request.path.startsWith('/activities')
    ? 'activities'
    : 'chat';
  let activityPageMode: 'list' | 'detail' | 'new' | 'edit' = 'list';
  let selectedActivity = null;
  let activityConversations: ReturnType<typeof listConversationsForActivity> = [];

  if (currentView === 'activities' && !user && (isActivityNewPage || isActivityEditPage)) {
    response.redirect('/login');
    return;
  }

  if (requestedConversationId && user) {
    const conversation = findConversationForUser(requestedConversationId, user.id);
    if (!conversation) {
      response.redirect('/');
      return;
    }

    initialConversationId = conversation.id;
  }

  if (requestedActivityId && user) {
    const activity = findActivityForUser(requestedActivityId, user.id);
    if (!activity) {
      response.redirect('/activities');
      return;
    }

    selectedActivity = activity;
    activityConversations = listConversationsForActivity(activity.id, user.id);
  }

  if (currentView === 'activities') {
    if (isActivityNewPage) {
      activityPageMode = 'new';
    } else if (selectedActivity && isActivityEditPage) {
      activityPageMode = 'edit';
    } else if (selectedActivity) {
      activityPageMode = 'detail';
    }
  }

  response.render('index', {
    activities: activitiesWithCounts,
    activityConversations,
    activityPageMode,
    authMessage,
    conversations,
    currentView,
    csrfToken: response.locals.csrfToken,
    guestInitialGreeting,
    hasSession: Boolean(user),
    initialConversationId,
    isAuthenticated: isVerified,
    selectedActivity,
    socketAuthToken,
    title: 'Mister F',
    user,
  });
}

export function handleCreateActivity(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();

  if (!title || !description || !tutorInstructions) {
    response.redirect('/activities/new');
    return;
  }

  const activity = createActivity({
    userId: user.id,
    title,
    description,
    tutorInstructions,
  });

  response.redirect(`/activities/${encodeURIComponent(activity.id)}`);
}

export function handleCreateActivityConversation(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const activityIdRaw = request.params.activityId;
  const activityId =
    typeof activityIdRaw === 'string' ? activityIdRaw.trim() : '';
  if (!activityId) {
    response.redirect('/activities');
    return;
  }

  const activity = findActivityForUser(activityId, user.id);
  if (!activity) {
    response.redirect('/activities');
    return;
  }

  const conversation = createConversationFromActivity(user.id, activity);

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

export function handleUpdateActivity(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const activityIdRaw = request.params.activityId;
  const activityId =
    typeof activityIdRaw === 'string' ? activityIdRaw.trim() : '';
  if (!activityId) {
    response.redirect('/activities');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();
  if (!title || !description || !tutorInstructions) {
    response.redirect(`/activities/${encodeURIComponent(activityId)}/edit`);
    return;
  }

  const activity = updateActivity({
    activityId,
    description,
    title,
    tutorInstructions,
    userId: user.id,
  });

  if (!activity) {
    response.redirect('/activities');
    return;
  }

  response.redirect(`/activities/${encodeURIComponent(activity.id)}`);
}

async function signInUser(
  request: Request,
  response: Response,
  userId: string,
  returnTo = '/',
): Promise<void> {
  await ensureOpenRouterKeyForUser(userId);
  const session = createSessionCookie();
  createSession({
    userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    userAgent: request.get('user-agent'),
    ipAddress: request.ip,
  });
  setSessionCookie(response, session);
  response.redirect(returnTo);
}

function toOpenRouterProvisioningErrorMessage(error: unknown): string {
  console.error('OpenRouter user key provisioning failed during auth.', error);
  return error instanceof Error
    ? `No pude preparar la cuenta de IA para este usuario: ${error.message}`
    : 'No pude preparar la cuenta de IA para este usuario.';
}

async function issueEmailVerification(user: AuthUser): Promise<void> {
  const token = createActionToken();
  createAuthActionToken({
    expiresAt: new Date(Date.now() + verificationTtlMs),
    tokenHash: hashActionToken(token),
    type: 'email_verification',
    userId: user.id,
  });
  await sendEmailVerification(user, token);
}

async function issuePasswordReset(user: AuthUser): Promise<void> {
  const token = createActionToken();
  createAuthActionToken({
    expiresAt: new Date(Date.now() + passwordResetTtlMs),
    tokenHash: hashActionToken(token),
    type: 'password_reset',
    userId: user.id,
  });
  await sendPasswordReset(user, token);
}

function renderAuthForm(response: Response, view: AuthFormView): void {
  response.render('auth', {
    ...view,
    csrfToken: response.locals.csrfToken,
    title: getFormTitle(view.mode),
  });
}

function renderChangePasswordForm(
  response: Response,
  view: ChangePasswordView,
): void {
  response.render('change_password', {
    ...view,
    csrfToken: response.locals.csrfToken,
    title: 'Cambiar password',
  });
}

function renderAuthMessage(
  response: Response,
  view: {
    body: string;
    linkHref?: string;
    linkText?: string;
    showVerificationCodeForm?: boolean;
    showResendVerification?: boolean;
    title: string;
  },
): void {
  response.render('auth_message', {
    body: view.body,
    csrfToken: response.locals.csrfToken,
    linkHref: view.linkHref ?? '',
    linkText: view.linkText ?? '',
    showVerificationCodeForm: Boolean(view.showVerificationCodeForm),
    showResendVerification: Boolean(view.showResendVerification),
    title: view.title,
  });
}

function getFormTitle(mode: AuthMode): string {
  if (mode === 'signup') {
    return 'Crear cuenta';
  }

  if (mode === 'forgot') {
    return 'Recuperar password';
  }

  if (mode === 'reset') {
    return 'Nuevo password';
  }

  return 'Iniciar sesión';
}

function getHomeAuthMessage(request: Request, user: AuthUser | null): string {
  if (typeof request.query.auth_error === 'string') {
    return request.query.auth_error;
  }

  if (user && !user.emailVerified) {
    return [
      `Antes de practicar, verifica tu correo: **${user.email}**.`,
      '[Escribir código de verificación](/verify-needed).',
    ].join('\n\n');
  }

  return '';
}

function validateSignup(input: {
  email: string;
  fullName: string;
  password: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isEmail(input.email)) {
    errors.email = 'Escribe un correo válido.';
  }

  if (input.fullName.trim().length < 2) {
    errors.fullName = 'Escribe tu nombre completo.';
  }

  if (input.password.length < 10) {
    errors.password = 'Usa al menos 10 caracteres.';
  }

  return errors;
}

function readField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRateLimited(request: Request): boolean {
  const key = request.ip ?? 'unknown';
  const item = loginAttempts.get(key);
  return Boolean(item && item.resetAt > Date.now() && item.count >= maxAttempts);
}

function registerFailedAttempt(request: Request): void {
  const key = request.ip ?? 'unknown';
  const now = Date.now();
  const item = loginAttempts.get(key);

  if (!item || item.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + attemptWindowMs });
    return;
  }

  item.count += 1;
}

function toMailErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `No pude enviar el email: ${error.message}`;
  }

  return 'No pude enviar el email por un error inesperado.';
}
