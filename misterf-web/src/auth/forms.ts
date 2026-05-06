import type { Request, Response } from 'express';
import QRCode from 'qrcode';
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
  createProfile,
  createLesson,
  createConversationFromLesson,
  deleteLessonForUser,
  findLessonById,
  findLessonShareLinkById,
  findLessonForUser,
  findConversationForUser,
  findProfileById,
  getOrCreateLessonShareLink,
  findProfileForUser,
  importLessonToProfile,
  listLessonsForProfile,
  listConversationsForLesson,
  listConversationsForProfile,
  updateProfile,
  updateLesson,
} from '../db/repository.js';
import { ensureOpenRouterKeyForUser } from '../services/openRouterUserKeys.js';
import { env } from '../config/env.js';
import {
  clearActiveProfileCookie,
  setActiveProfileCookie,
} from './profiles.js';

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

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

function buildAbsoluteAppUrl(pathname: string): string {
  return new URL(pathname, env.appBaseUrl).toString();
}

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
  clearActiveProfileCookie(response);
  response.redirect('/');
}

export async function renderHome(request: Request, response: Response): Promise<void> {
  const user = request.authUser;
  const defaultActiveProfile = request.activeProfile;
  const availableProfiles = request.availableProfiles ?? [];
  const isVerified = Boolean(user?.emailVerified);
  const socketAuthToken = user && isVerified ? createSocketAuthToken(user) : '';
  const authMessage = getHomeAuthMessage(request, user);
  const lessonFilterQueryRaw =
    typeof request.query.q === 'string' ? request.query.q : '';
  const lessonFilterQuery = lessonFilterQueryRaw.trim();
  const normalizedLessonFilterQuery = normalizeSearchText(lessonFilterQuery);
  const guestInitialGreeting = user ? '' : pickInitialGreeting();
  const requestedConversationIdRaw = request.params.conversationId;
  const requestedConversationId =
    typeof requestedConversationIdRaw === 'string'
      ? requestedConversationIdRaw.trim()
      : '';
  const requestedLessonIdRaw = request.params.lessonId;
  const requestedLessonId =
    typeof requestedLessonIdRaw === 'string'
      ? requestedLessonIdRaw.trim()
      : '';
  const requestedLessonShareIdRaw = request.params.shareId;
  const requestedLessonShareId =
    typeof requestedLessonShareIdRaw === 'string'
      ? requestedLessonShareIdRaw.trim()
      : '';
  const requestedProfileIdRaw = request.params.profileId;
  const requestedProfileId =
    typeof requestedProfileIdRaw === 'string'
      ? requestedProfileIdRaw.trim()
      : '';
  const isLessonNewPage = request.path === '/lessons/new';
  const isLessonEditPage = request.path.endsWith('/edit');
  const isProfilesRoot = request.path === '/profiles';
  const isProfileNewPage = request.path === '/profiles/new';
  const isProfileEditPage = /^\/profiles\/[^/]+\/edit$/.test(request.path);
  let initialConversationId = '';
  const chatMode = 'tutor';
  let currentView: 'chat' | 'lessons' | 'profiles' =
    request.path.startsWith('/lessons')
      ? 'lessons'
      : request.path.startsWith('/profiles')
      ? 'profiles'
      : 'chat';
  let lessonPageMode: 'list' | 'detail' | 'new' | 'edit' | 'share' = 'list';
  let profilePageMode: 'list' | 'new' | 'edit' = 'list';
  let selectedLesson = null;
  let selectedSharedLesson = null;
  let selectedLessonShareLink = null;
  let selectedLessonSharedFromProfileName = '';
  let lessonConversations: ReturnType<typeof listConversationsForLesson> = [];
  let activeProfile = defaultActiveProfile;
  let selectedProfile = null;

  if (currentView === 'lessons' && !user && (isLessonNewPage || isLessonEditPage)) {
    response.redirect('/login');
    return;
  }

  if (currentView === 'profiles' && !user) {
    response.redirect('/login');
    return;
  }

  if (requestedConversationId && user) {
    const conversation = findConversationForUser(requestedConversationId, user.id);
    if (!conversation) {
      response.redirect('/');
      return;
    }

    if (!activeProfile || conversation.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(conversation.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }
    initialConversationId = conversation.id;
  }

  if (requestedLessonId && user) {
    const lesson = findLessonForUser(requestedLessonId, user.id);
    if (!lesson) {
      response.redirect('/lessons');
      return;
    }

    if (!activeProfile || lesson.profileId !== activeProfile.id) {
      activeProfile = findProfileForUser(lesson.profileId, user.id);
      if (activeProfile) {
        setActiveProfileCookie(response, activeProfile.id);
      }
    }
    selectedLesson = lesson;
    lessonConversations = listConversationsForLesson(
      lesson.id,
      user.id,
      lesson.profileId,
    );
  }

  if (requestedLessonShareId) {
    const shareLink = findLessonShareLinkById(requestedLessonShareId);
    if (!shareLink || shareLink.revokedAt) {
      response.redirect('/lessons');
      return;
    }

    const sharedLesson = findLessonById(shareLink.lessonId);
    if (!sharedLesson) {
      response.redirect('/lessons');
      return;
    }

    selectedSharedLesson = sharedLesson;
    selectedLessonShareLink = shareLink;
  }

  if (selectedLesson) {
    selectedLessonShareLink = getOrCreateLessonShareLink(selectedLesson.id);
    if (selectedLesson.sourceProfileId) {
      selectedLessonSharedFromProfileName =
        findProfileById(selectedLesson.sourceProfileId)?.name || '';
    }
  }

  if (requestedProfileId && user) {
    const profile = findProfileForUser(requestedProfileId, user.id);
    if (!profile) {
      response.redirect('/profiles');
      return;
    }

    selectedProfile = profile;
  }

  const conversations =
    user && activeProfile
      ? listConversationsForProfile(user.id, activeProfile.id)
      : [];
  const lessons =
    user && activeProfile
      ? listLessonsForProfile(user.id, activeProfile.id)
      : [];
  const visibleLessons = user
    ? lessons
        .filter((lesson) => {
          if (!normalizedLessonFilterQuery) {
            return true;
          }

          const haystack = [
            lesson.title,
            lesson.description,
            lesson.tutorInstructions,
          ].join('\n');

          return normalizeSearchText(haystack).includes(normalizedLessonFilterQuery);
        })
        .map((lesson) => ({
          ...lesson,
          conversationCount: listConversationsForLesson(
            lesson.id,
            user.id,
            lesson.profileId,
          ).length,
        }))
    : [];
  const ownLessons = visibleLessons.filter((lesson) => !lesson.sharedVia);
  const sharedLessons = visibleLessons.filter((lesson) => Boolean(lesson.sharedVia));
  const shareTargetProfiles =
    availableProfiles.filter(
      (profile) => profile.id !== (selectedLesson?.profileId ?? activeProfile?.id),
    );
  const lessonShareUrl =
    selectedLesson && selectedLessonShareLink
      ? buildAbsoluteAppUrl(
          `/lessons/shared/${encodeURIComponent(selectedLessonShareLink.id)}`,
        )
      : '';
  const lessonShareQrDataUrl = lessonShareUrl
    ? await QRCode.toDataURL(lessonShareUrl, {
        margin: 1,
        width: 180,
      })
    : '';

  if (currentView === 'lessons') {
    if (isLessonNewPage) {
      lessonPageMode = 'new';
    } else if (selectedLesson && isLessonEditPage) {
      lessonPageMode = 'edit';
    } else if (selectedSharedLesson && selectedLessonShareLink) {
      lessonPageMode = 'share';
    } else if (selectedLesson) {
      lessonPageMode = 'detail';
    }
  }

  if (currentView === 'profiles') {
    if (isProfileNewPage) {
      profilePageMode = 'new';
    } else if (selectedProfile && isProfileEditPage) {
      profilePageMode = 'edit';
    } else {
      profilePageMode = 'list';
    }
  }

  response.render('index', {
    lessons: ownLessons,
    activeProfile,
    lessonFilterQuery,
    lessonConversations,
    lessonPageMode,
    lessonShareQrDataUrl,
    lessonShareUrl,
    authMessage,
    conversations,
    currentView,
    currentPath: request.originalUrl || request.path,
    csrfToken: response.locals.csrfToken,
    guestInitialGreeting,
    hasSession: Boolean(user),
    chatMode,
    initialConversationId,
    isAuthenticated: isVerified,
    profiles: availableProfiles,
    profilePageMode,
    shareTargetProfiles,
    sharedLessons,
    selectedLesson,
    selectedLessonShareLink,
    selectedLessonSharedFromProfileName,
    selectedProfile,
    selectedSharedLesson,
    socketAuthToken,
    title: 'Mister F',
    user,
  });
}

export function handleCreateLesson(request: Request, response: Response): void {
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();

  if (!title || !description || !tutorInstructions) {
    response.redirect('/lessons/new');
    return;
  }

  const lesson = createLesson({
    profileId: activeProfile.id,
    userId: user.id,
    title,
    description,
    tutorInstructions,
  });

  response.redirect(`/lessons/${encodeURIComponent(lesson.id)}`);
}

export function handleCreateLessonConversation(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const lessonIdRaw = request.params.lessonId;
  const lessonId =
    typeof lessonIdRaw === 'string' ? lessonIdRaw.trim() : '';
  if (!lessonId) {
    response.redirect('/lessons');
    return;
  }

  const lesson = findLessonForUser(lessonId, user.id);
  if (!lesson) {
    response.redirect('/lessons');
    return;
  }

  const conversation = createConversationFromLesson(user.id, lesson);

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

export function handleSwitchProfile(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const profileId = String(request.body.profileId || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  if (!profileId) {
    response.redirect(returnTo);
    return;
  }

  const profile = findProfileForUser(profileId, user.id);
  if (!profile) {
    response.redirect(returnTo);
    return;
  }

  setActiveProfileCookie(response, profile.id);
  response.redirect(returnTo);
}

export function handleCreateProfile(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const name = String(request.body.name || '').trim();
  const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
  if (!name) {
    response.redirect(returnTo);
    return;
  }

  const profile = createProfile({
    name: name.slice(0, 120),
    userId: user.id,
  });
  setActiveProfileCookie(response, profile.id);
  response.redirect(returnTo);
}

export function handleUpdateProfile(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const profileId = String(request.params.profileId || '').trim();
  if (!profileId) {
    response.redirect('/profiles');
    return;
  }

  const name = String(request.body.name || '').trim();
  const description = String(request.body.description || '').trim();
  if (!name) {
    response.redirect(`/profiles/${encodeURIComponent(profileId)}/edit`);
    return;
  }

  const profile = updateProfile({
    description: description.slice(0, 500),
    name: name.slice(0, 120),
    profileId,
    userId: user.id,
  });
  if (!profile) {
    response.redirect('/profiles');
    return;
  }

  response.redirect('/profiles');
}

export function handleUpdateLesson(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const lessonIdRaw = request.params.lessonId;
  const lessonId =
    typeof lessonIdRaw === 'string' ? lessonIdRaw.trim() : '';
  if (!lessonId) {
    response.redirect('/lessons');
    return;
  }

  const title = String(request.body.title || '').trim();
  const description = String(request.body.description || '').trim();
  const tutorInstructions = String(request.body.tutorInstructions || '').trim();
  if (!title || !description || !tutorInstructions) {
    response.redirect(`/lessons/${encodeURIComponent(lessonId)}/edit`);
    return;
  }

  const lesson = updateLesson({
    lessonId,
    description,
    title,
    tutorInstructions,
    userId: user.id,
  });

  if (!lesson) {
    response.redirect('/lessons');
    return;
  }

  response.redirect(`/lessons/${encodeURIComponent(lesson.id)}`);
}

export function handleDeleteLesson(request: Request, response: Response): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const lessonIdRaw = request.params.lessonId;
  const lessonId =
    typeof lessonIdRaw === 'string' ? lessonIdRaw.trim() : '';
  if (!lessonId) {
    response.redirect('/lessons');
    return;
  }

  deleteLessonForUser(lessonId, user.id);
  response.redirect('/lessons');
}

export function handleShareLessonToProfile(
  request: Request,
  response: Response,
): void {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return;
  }

  const lessonId = String(request.params.lessonId || '').trim();
  const targetProfileId = String(request.body.targetProfileId || '').trim();
  if (!lessonId || !targetProfileId) {
    response.redirect('/lessons');
    return;
  }

  const lesson = findLessonForUser(lessonId, user.id);
  if (!lesson) {
    response.redirect('/lessons');
    return;
  }

  const targetProfile = findProfileForUser(targetProfileId, user.id);
  if (!targetProfile || targetProfile.id === lesson.profileId) {
    response.redirect(`/lessons/${encodeURIComponent(lesson.id)}`);
    return;
  }

  importLessonToProfile({
    shareKind: 'profile',
    sourceLesson: lesson,
    targetProfileId: targetProfile.id,
    userId: user.id,
  });
  response.redirect(`/lessons/${encodeURIComponent(lesson.id)}`);
}

export function handleAcceptSharedLessonLink(
  request: Request,
  response: Response,
): void {
  const shareId = String(request.params.shareId || '').trim();
  if (!shareId) {
    response.redirect('/lessons');
    return;
  }

  const shareLink = findLessonShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/lessons');
    return;
  }

  const sourceLesson = findLessonById(shareLink.lessonId);
  if (!sourceLesson) {
    response.redirect('/lessons');
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return;
  }

  const imported = importLessonToProfile({
    shareKind: 'link',
    sourceLesson,
    targetProfileId: activeProfile.id,
    userId: user.id,
  });
  response.redirect(`/lessons/${encodeURIComponent(imported.id)}`);
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
