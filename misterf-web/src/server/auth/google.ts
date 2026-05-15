import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  createExternalUser,
  createSession,
  findUserByEmail,
  findUserByIdentity,
  linkUserIdentity,
  markEmailVerified,
  type AuthUser,
} from './repository.js';
import {
  createSessionCookie,
  requireSessionSecret,
  setSessionCookie,
} from './session.js';
import { ensureOpenRouterKeyForUser } from '../services/openRouterUserKeys.js';

const stateCookieName = 'misterf_google_oauth_state';
const returnToCookieName = 'misterf_google_oauth_return_to';
const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
const stateTtlMs = 10 * 60 * 1000;

type GoogleTokenResponse = {
  access_token?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type GoogleUserInfo = {
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  sub?: unknown;
};

export function startGoogleLogin(request: Request, response: Response): void {
  if (!isGoogleConfigured()) {
    renderGoogleConfigurationError(response);
    return;
  }

  const returnTo = normalizeReturnTo(
    typeof request.query.returnTo === 'string' ? request.query.returnTo : '/',
  );
  const state = createGoogleState();
  response.cookie(stateCookieName, state, {
    expires: new Date(Date.now() + stateTtlMs),
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appBaseUrl.startsWith('https://'),
    path: '/',
  });
  response.cookie(returnToCookieName, returnTo, {
    expires: new Date(Date.now() + stateTtlMs),
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appBaseUrl.startsWith('https://'),
    path: '/',
  });

  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: env.googleClientId,
    include_granted_scopes: 'true',
    prompt: 'select_account',
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  response.redirect(`${authorizationEndpoint}?${params.toString()}`);
}

export async function finishGoogleLogin(
  request: Request,
  response: Response,
): Promise<void> {
  if (!isGoogleConfigured()) {
    renderGoogleConfigurationError(response);
    return;
  }

  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const state = typeof request.query.state === 'string' ? request.query.state : '';
  const storedState = getCookie(request, stateCookieName);
  const returnTo = normalizeReturnTo(getCookie(request, returnToCookieName) || '/');
  response.clearCookie(stateCookieName, { path: '/' });
  response.clearCookie(returnToCookieName, { path: '/' });

  if (!code || !state || !storedState || !verifyGoogleState(state, storedState)) {
    response.status(400).render('auth_message', {
      body: 'No pude validar el inicio de sesión con Google. Intenta otra vez.',
      csrfToken: response.locals.csrfToken,
      linkHref: `/login?returnTo=${encodeURIComponent(returnTo)}`,
      linkText: 'Volver a login',
      returnTo,
      showResendVerification: false,
      showVerificationCodeForm: false,
      title: 'Login cancelado',
    });
    return;
  }

  try {
    const googleUser = await getGoogleUserInfo(code);
    if (!googleUser.emailVerified) {
      throw new Error('Google no confirmó que el correo esté verificado.');
    }

    const user = resolveGoogleUser(googleUser);
    await signInGoogleUser(request, response, user, returnTo);
  } catch (error) {
    response.status(502).render('auth_message', {
      body: toGoogleErrorMessage(error),
      csrfToken: response.locals.csrfToken,
      linkHref: `/login?returnTo=${encodeURIComponent(returnTo)}`,
      linkText: 'Volver a login',
      returnTo,
      showResendVerification: false,
      showVerificationCodeForm: false,
      title: 'Google no respondió',
    });
  }
}

function resolveGoogleUser(googleUser: {
  email: string;
  emailVerified: boolean;
  fullName: string;
  sub: string;
}): AuthUser {
  const existingIdentityUser = findUserByIdentity({
    provider: 'google',
    providerSubject: googleUser.sub,
  });
  if (existingIdentityUser) {
    if (!existingIdentityUser.emailVerified && googleUser.emailVerified) {
      markEmailVerified(existingIdentityUser.id);
      return { ...existingIdentityUser, emailVerified: true };
    }

    return existingIdentityUser;
  }

  const existingEmailUser = findUserByEmail(googleUser.email);
  if (existingEmailUser) {
    linkUserIdentity({
      email: googleUser.email,
      provider: 'google',
      providerSubject: googleUser.sub,
      userId: existingEmailUser.id,
    });

    if (!existingEmailUser.emailVerified && googleUser.emailVerified) {
      markEmailVerified(existingEmailUser.id);
      return { ...existingEmailUser, emailVerified: true };
    }

    return existingEmailUser;
  }

  return createExternalUser({
    email: googleUser.email,
    emailVerified: googleUser.emailVerified,
    fullName: googleUser.fullName,
    provider: 'google',
    providerSubject: googleUser.sub,
  });
}

async function signInGoogleUser(
  request: Request,
  response: Response,
  user: AuthUser,
  returnTo: string,
): Promise<void> {
  await ensureOpenRouterKeyForUser(user.id);
  const session = createSessionCookie();
  createSession({
    userId: user.id,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    userAgent: request.get('user-agent'),
    ipAddress: request.ip,
  });
  setSessionCookie(response, session);
  response.redirect(returnTo);
}

async function getGoogleUserInfo(code: string): Promise<{
  email: string;
  emailVerified: boolean;
  fullName: string;
  sub: string;
}> {
  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getGoogleRedirectUri(),
    }),
  });

  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || typeof tokenJson.access_token !== 'string') {
    throw new Error(
      typeof tokenJson.error_description === 'string'
        ? tokenJson.error_description
        : 'No pude obtener el token de Google.',
    );
  }

  const userResponse = await fetch(userInfoEndpoint, {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
    },
  });
  const userInfo = (await userResponse.json()) as GoogleUserInfo;
  if (!userResponse.ok) {
    throw new Error('No pude leer el perfil de Google.');
  }

  if (
    typeof userInfo.sub !== 'string' ||
    typeof userInfo.email !== 'string' ||
    typeof userInfo.name !== 'string'
  ) {
    throw new Error('Google devolvió un perfil incompleto.');
  }

  return {
    email: userInfo.email,
    emailVerified: userInfo.email_verified === true,
    fullName: userInfo.name,
    sub: userInfo.sub,
  };
}

function createGoogleState(): string {
  const expiresAt = Date.now() + stateTtlMs;
  const nonce = randomBytes(16).toString('base64url');
  const body = `${expiresAt}.${nonce}`;
  return `${body}.${signGoogleState(body)}`;
}

function verifyGoogleState(state: string, storedState: string): boolean {
  if (state !== storedState) {
    return false;
  }

  const [expiresAt, nonce, signature, extra] = state.split('.');
  if (!expiresAt || !nonce || !signature || extra) {
    return false;
  }

  const expiration = Number.parseInt(expiresAt, 10);
  if (!Number.isFinite(expiration) || expiration < Date.now()) {
    return false;
  }

  return safeEquals(signature, signGoogleState(`${expiresAt}.${nonce}`));
}

function signGoogleState(value: string): string {
  return createHmac('sha256', requireSessionSecret())
    .update(`google:${value}`)
    .digest('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = new Map(
    cookieHeader.split(';').map((cookie) => {
      const [cookieName, ...valueParts] = cookie.trim().split('=');
      return [cookieName, decodeURIComponent(valueParts.join('='))];
    }),
  );

  return cookies.get(name) ?? null;
}

function getGoogleRedirectUri(): string {
  return `${env.appBaseUrl}/auth/google/callback`;
}

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

function isGoogleConfigured(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret);
}

function renderGoogleConfigurationError(response: Response): void {
  response.status(503).render('auth_message', {
    body:
      'Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en ecosystem.config.cjs.',
    csrfToken: response.locals.csrfToken,
    linkHref: '/login',
    linkText: 'Volver a login',
    showResendVerification: false,
    showVerificationCodeForm: false,
    title: 'Google no está configurado',
  });
}

function toGoogleErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `No pude completar el login con Google: ${error.message}`;
  }

  return 'No pude completar el login con Google por un error inesperado.';
}
