import type { Request, Response } from 'express';
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
  setKnownVisitorCookie,
  setSessionCookie,
} from './session.js';
import {
  createActionToken,
  hashActionToken,
  normalizeActionToken,
} from './tokens.js';
import { ensureOpenRouterKeyForUser } from '../services/openRouterUserKeys.js';
import { clearActiveProfileCookie } from './profiles.js';
import {
  appDocumentTitle as shellAppDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage as getShellHomeAuthMessage,
} from '../pages/shell.js';
import { buildProfileOnboardingPath } from '../profiles/fields.js';
import { logger } from '../services/logger.js';
import {
  createTranslator,
  defaultLocale,
  type Locale,
  type Translator,
} from '../i18n/index.js';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const appDocumentTitle = 'Mr. F, tutor de inglés';

function tr(response: Response): Translator {
  return createTranslator(response.req?.locale ?? defaultLocale);
}

type AuthFormView = {
  error: string;
  fieldErrors: Record<string, string>;
  mode: AuthMode;
  returnTo?: string;
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
  request: Request;
  user: AuthUser;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 12;
const attemptWindowMs = 10 * 60 * 1000;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;

function normalizeReturnTo(value: string | undefined): string {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return '/';
  }

  return trimmed;
}

function logAuthReturnTo(event: string, details: Record<string, unknown>) {
  logger.debug('auth_return_to', {
    authEvent: event,
    ...details,
  });
}

export function renderLogin(request: Request, response: Response): void {
  const returnTo = normalizeReturnTo(
    typeof request.query.returnTo === 'string' ? request.query.returnTo : '/',
  );
  logAuthReturnTo('renderLogin', {
    authenticated: Boolean(request.authUser),
    path: request.originalUrl || request.path,
    returnTo,
  });
  if (request.authUser?.emailVerified) {
    response.redirect(returnTo);
    return;
  }

  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'login',
    returnTo,
    values: { code: '', email: '', fullName: '' },
  });
}

export function renderSignup(request: Request, response: Response): void {
  const returnTo = normalizeReturnTo(
    typeof request.query.returnTo === 'string' ? request.query.returnTo : '/',
  );
  logAuthReturnTo('renderSignup', {
    authenticated: Boolean(request.authUser),
    path: request.originalUrl || request.path,
    returnTo,
  });
  if (request.authUser?.emailVerified) {
    response.redirect(returnTo);
    return;
  }

  renderAuthForm(response, {
    error: '',
    fieldErrors: {},
    mode: 'signup',
    returnTo,
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
  const user = request.authUser;
  if (!user) {
    response.redirect('/login');
    return;
  }

  renderChangePasswordForm(response, {
    error: '',
    fieldErrors: {},
    hasPassword: Boolean(user.passwordHash),
    request,
    user,
  });
}

export async function handleLogin(
  request: Request,
  response: Response,
): Promise<void> {
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  logAuthReturnTo('handleLogin:start', {
    email: normalizeEmail(readField(request.body.email)),
    returnTo,
  });
  const email = normalizeEmail(readField(request.body.email));
  const password = readField(request.body.password);
  const t = tr(response);
  const fieldErrors: Record<string, string> = {};

  if (!email) {
    fieldErrors.email = t('auth.field.emailRequired');
  }

  if (!password) {
    fieldErrors.password = t('auth.field.passwordRequired');
  }

  if (Object.keys(fieldErrors).length > 0) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors,
      mode: 'login',
      returnTo,
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  if (isRateLimited(request)) {
    renderAuthForm(response.status(429), {
      error: t('auth.error.tooManyAttempts'),
      fieldErrors: {},
      mode: 'login',
      returnTo,
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  const user = findUserByEmail(email);
  const isPasswordValid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !isPasswordValid) {
    registerFailedAttempt(request);
    renderAuthForm(response.status(401), {
      error: t('auth.error.invalidCredentials'),
      fieldErrors: {},
      mode: 'login',
      returnTo,
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  logAuthReturnTo('handleLogin:success', {
    returnTo,
    userId: user.id,
  });
  await signInUser(request, response, user.id, returnTo);
}

export async function handleSignup(
  request: Request,
  response: Response,
): Promise<void> {
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  logAuthReturnTo('handleSignup:start', {
    email: normalizeEmail(readField(request.body.email)),
    returnTo,
  });
  const email = normalizeEmail(readField(request.body.email));
  const fullName = readField(request.body.fullName);
  const password = readField(request.body.password);
  const confirmPassword = readField(request.body.confirmPassword);
  const t = tr(response);
  const fieldErrors = validateSignup(
    {
      confirmPassword,
      email,
      fullName,
      password,
    },
    t,
  );

  if (Object.keys(fieldErrors).length > 0) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors,
      mode: 'signup',
      returnTo,
      values: { code: '', email, fullName },
    });
    return;
  }

  if (findUserByEmail(email)) {
    renderAuthForm(response.status(409), {
      error: '',
      fieldErrors: {
        email: t('auth.field.emailExists'),
      },
      mode: 'signup',
      returnTo,
      values: { code: '', email, fullName },
    });
    return;
  }

  if (!isMailerConfigured()) {
    renderAuthForm(response.status(503), {
      error: getMailerConfigurationError(request.locale),
      fieldErrors: {},
      mode: 'signup',
      returnTo,
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
      error: toOpenRouterProvisioningErrorMessage(error, t),
      fieldErrors: {},
      mode: 'signup',
      returnTo,
      values: { code: '', email, fullName },
    });
    return;
  }

  try {
    await issueEmailVerification(user, request.locale);
  } catch (error) {
    renderAuthForm(response.status(503), {
      error: toMailErrorMessage(error, t),
      fieldErrors: {},
      mode: 'signup',
      returnTo,
      values: { code: '', email, fullName },
    });
    return;
  }

  const verifyReturnTo =
    returnTo && returnTo !== '/'
      ? `/verify-needed?returnTo=${encodeURIComponent(returnTo)}`
      : '/verify-needed';
  logAuthReturnTo('handleSignup:success', {
    returnTo,
    userId: user.id,
    verifyReturnTo,
  });
  await signInUser(request, response, user.id, verifyReturnTo);
}

export async function handleForgotPassword(
  request: Request,
  response: Response,
): Promise<void> {
  const t = tr(response);
  const email = normalizeEmail(readField(request.body.email));
  if (!isEmail(email)) {
    renderAuthForm(response.status(422), {
      error: '',
      fieldErrors: { email: t('auth.field.emailInvalid') },
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  if (!isMailerConfigured()) {
    renderAuthForm(response.status(503), {
      error: getMailerConfigurationError(request.locale),
      fieldErrors: {},
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  try {
    const user = findUserByEmail(email);
    if (user) {
      await issuePasswordReset(user, request.locale);
    }
  } catch (error) {
    renderAuthForm(response.status(503), {
      error: toMailErrorMessage(error, t),
      fieldErrors: {},
      mode: 'forgot',
      values: { code: '', email, fullName: '' },
    });
    return;
  }

  renderAuthMessage(response, {
    body: t('auth.message.forgotSentBody'),
    linkHref: '/reset-password',
    linkText: t('auth.message.forgotSentLink'),
    title: t('auth.message.forgotSentTitle'),
  });
}

export async function handleResetPassword(
  request: Request,
  response: Response,
): Promise<void> {
  const email = normalizeEmail(readField(request.body.email));
  const code = normalizeActionToken(readField(request.body.code));
  const password = readField(request.body.password);
  const t = tr(response);
  const fieldErrors: Record<string, string> = {};

  if (!isEmail(email)) {
    fieldErrors.email = t('auth.field.resetEmailRequired');
  }

  if (!code) {
    fieldErrors.code = t('auth.field.codeRequired');
  }

  if (password.length < 10) {
    fieldErrors.password = t('auth.field.passwordTooShort');
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
      error: t('auth.error.invalidOrExpiredCode'),
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
    body: t('auth.message.passwordUpdatedResetBody'),
    linkHref: '/login',
    linkText: t('auth.message.signInLink'),
    title: t('auth.message.passwordUpdatedTitle'),
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
  const confirmPassword = readField(request.body.confirmPassword);
  const t = tr(response);
  const fieldErrors: Record<string, string> = {};

  if (user.passwordHash && !currentPassword) {
    fieldErrors.currentPassword = t('auth.field.currentPasswordRequired');
  }

  if (newPassword.length < 10) {
    fieldErrors.newPassword = t('auth.field.passwordTooShort');
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = t('auth.field.confirmNewRequired');
  } else if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = t('auth.field.newPasswordsMismatch');
  }

  if (Object.keys(fieldErrors).length > 0) {
    renderChangePasswordForm(response.status(422), {
      error: '',
      fieldErrors,
      hasPassword: Boolean(user.passwordHash),
      request,
      user,
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
        error: t('auth.error.wrongCurrentPassword'),
        fieldErrors: {},
        hasPassword: true,
        request,
        user,
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
    body: t('auth.message.passwordUpdatedChangeBody'),
    linkHref: '/login',
    linkText: t('auth.message.signInLink'),
    title: t('auth.message.passwordUpdatedTitle'),
  });
}

export async function handleVerifyEmail(
  request: Request,
  response: Response,
): Promise<void> {
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  logAuthReturnTo('handleVerifyEmail:start', {
    authenticated: Boolean(request.authUser),
    returnTo,
  });
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  const t = tr(response);
  const code = normalizeActionToken(readField(request.body.code));
  if (!code) {
    renderAuthMessage(response.status(422), {
      body: t('auth.message.verifyEnterCode'),
      returnTo,
      showVerificationCodeForm: true,
      title: t('auth.message.verifyTitle'),
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
      body: t('auth.message.invalidCodeBody'),
      returnTo,
      showVerificationCodeForm: true,
      title: t('auth.message.invalidCodeTitle'),
    });
    return;
  }

  markEmailVerified(user.id);
  markAuthActionTokenUsed(tokenHash);
  logAuthReturnTo('handleVerifyEmail:success', {
    returnTo,
    userId: user.id,
  });

  renderAuthMessage(response, {
    body: t('auth.message.verifiedBody'),
    linkHref: buildProfileOnboardingPath(returnTo),
    linkText: t('auth.message.completeProfileLink'),
    returnTo,
    title: t('auth.message.verifiedTitle'),
  });
}

export async function handleResendVerification(
  request: Request,
  response: Response,
): Promise<void> {
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  logAuthReturnTo('handleResendVerification', {
    authenticated: Boolean(request.authUser),
    returnTo,
  });
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  if (request.authUser.emailVerified) {
    response.redirect('/');
    return;
  }

  const t = tr(response);
  if (!isMailerConfigured()) {
    renderAuthMessage(response.status(503), {
      body: getMailerConfigurationError(request.locale),
      returnTo,
      title: t('auth.message.mailFailTitle'),
    });
    return;
  }

  try {
    await issueEmailVerification(request.authUser, request.locale);
  } catch (error) {
    renderAuthMessage(response.status(503), {
      body: toMailErrorMessage(error, t),
      returnTo,
      title: t('auth.message.mailFailTitle'),
    });
    return;
  }

  renderAuthMessage(response, {
    body: t('auth.message.resentBody'),
    returnTo,
    showVerificationCodeForm: true,
    title: t('auth.message.forgotSentTitle'),
  });
}

export function renderVerifyNeeded(
  request: Request,
  response: Response,
): void {
  const returnTo = normalizeReturnTo(
    typeof request.query.returnTo === 'string' ? request.query.returnTo : '/',
  );
  logAuthReturnTo('renderVerifyNeeded', {
    authenticated: Boolean(request.authUser),
    path: request.originalUrl || request.path,
    returnTo,
  });
  if (!request.authUser) {
    response.redirect('/login');
    return;
  }

  if (request.authUser.emailVerified) {
    response.redirect(returnTo);
    return;
  }

  renderAuthMessage(response, {
    body: tr(response)('auth.message.verifyNeededBody', {
      email: request.authUser.email,
    }),
    returnTo,
    showVerificationCodeForm: true,
    showResendVerification: true,
    title: tr(response)('auth.message.verifyTitle'),
  });
}

export function handleLogout(request: Request, response: Response): void {
  if (request.sessionTokenHash) {
    revokeSession(request.sessionTokenHash);
  }

  clearSessionCookie(response);
  clearActiveProfileCookie(response);
  setKnownVisitorCookie(response);
  response.redirect('/');
}

async function signInUser(
  request: Request,
  response: Response,
  userId: string,
  returnTo = '/',
): Promise<void> {
  logAuthReturnTo('signInUser', {
    returnTo,
    userId,
  });
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
  setKnownVisitorCookie(response);
  response.redirect(returnTo);
}

function toOpenRouterProvisioningErrorMessage(
  error: unknown,
  t: Translator,
): string {
  logger.error('openrouter_user_key_provisioning_failed', { error });
  return error instanceof Error
    ? t('auth.serviceError.openrouterWithReason', { reason: error.message })
    : t('auth.serviceError.openrouter');
}

async function issueEmailVerification(user: AuthUser, locale: Locale): Promise<void> {
  const token = createActionToken();
  createAuthActionToken({
    expiresAt: new Date(Date.now() + verificationTtlMs),
    tokenHash: hashActionToken(token),
    type: 'email_verification',
    userId: user.id,
  });
  await sendEmailVerification(user, token, locale);
}

async function issuePasswordReset(user: AuthUser, locale: Locale): Promise<void> {
  const token = createActionToken();
  createAuthActionToken({
    expiresAt: new Date(Date.now() + passwordResetTtlMs),
    tokenHash: hashActionToken(token),
    type: 'password_reset',
    userId: user.id,
  });
  await sendPasswordReset(user, token, locale);
}

function renderAuthForm(response: Response, view: AuthFormView): void {
  const documentTitle = tr(response)(`auth.documentTitle.${view.mode}`);
  response.render('auth', {
    ...view,
    csrfToken: response.locals.csrfToken,
    title: `${documentTitle} · ${appDocumentTitle}`,
  });
}

function renderChangePasswordForm(
  response: Response,
  view: ChangePasswordView,
): void {
  response.render('change_password', {
    ...view,
    ...buildAppShellContext({
      activeProfile: view.request.activeProfile,
      authMessage: getShellHomeAuthMessage(view.request, view.user),
      currentView: 'settings',
      guestInitialGreeting: '',
      request: view.request,
      title: `${tr(response)('auth.message.changePasswordTitle')} · ${shellAppDocumentTitle}`,
      user: view.user,
    }),
    csrfToken: response.locals.csrfToken,
  });
}

function renderAuthMessage(
  response: Response,
  view: {
    body: string;
    linkHref?: string;
    linkText?: string;
    returnTo?: string;
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
    returnTo: view.returnTo ?? '/',
    showVerificationCodeForm: Boolean(view.showVerificationCodeForm),
    showResendVerification: Boolean(view.showResendVerification),
    title: `${view.title} · ${appDocumentTitle}`,
  });
}

function validateSignup(
  input: {
    confirmPassword: string;
    email: string;
    fullName: string;
    password: string;
  },
  t: Translator,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isEmail(input.email)) {
    errors.email = t('auth.field.emailInvalid');
  }

  if (input.fullName.trim().length < 2) {
    errors.fullName = t('auth.field.fullNameRequired');
  }

  if (input.password.length < 10) {
    errors.password = t('auth.field.passwordTooShort');
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = t('auth.field.confirmRequired');
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = t('auth.field.passwordsMismatch');
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

function toMailErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof Error) {
    return t('auth.serviceError.mailWithReason', { reason: error.message });
  }

  return t('auth.serviceError.mail');
}
