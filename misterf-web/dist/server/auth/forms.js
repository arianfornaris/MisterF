import QRCode from 'qrcode';
import { createSocketAuthToken } from './socketAuth.js';
import { pickInitialGreeting, pickKnownVisitorGreeting, } from '../socket/initialGreetings.js';
import { getMailerConfigurationError, isMailerConfigured, sendEmailVerification, sendPasswordReset, } from './mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAuthActionToken, createLocalUser, createSession, deleteUserById, findUserByAuthActionToken, findUserByEmail, markAuthActionTokenUsed, markEmailVerified, normalizeEmail, revokeSession, revokeUserSessions, updateUserPassword, } from './repository.js';
import { clearSessionCookie, createSessionCookie, hasKnownVisitorCookie, setKnownVisitorCookie, setSessionCookie, } from './session.js';
import { createActionToken, hashActionToken, normalizeActionToken, } from './tokens.js';
import { addPracticeModuleToCollection, addChatRoomMessage, updateChatRoomMessageEvaluation, archivePracticeModuleForUser, archivePracticeModuleCollectionForUser, createChatRoom, createChatRoomConversation, createProfile, createPracticeModuleCollection, createPracticeModule, createConversationFromPracticeModule, deletePracticeModuleForUser, findChatRoomConversationForUser, findChatRoomMessage, findChatRoomById, findChatRoomForUser, findChatRoomShareLinkById, findPracticeModuleById, findPracticeModuleCollectionById, findPracticeModuleCollectionForUser, findPracticeModuleCollectionShareLinkById, findPracticeModuleShareLinkById, findPracticeModuleForUser, findConversationForUser, findProfileById, getOrCreateChatRoomShareLink, getOrCreatePracticeModuleCollectionShareLink, getOrCreatePracticeModuleShareLink, findProfileForUser, importChatRoomToProfile, importPracticeModuleCollectionToProfile, importPracticeModuleToProfile, listChatRoomCharacters, listChatRoomConversationsForRoom, listChatRoomMessages, listChatRoomsForProfile, listPracticeModuleCollectionsContainingModule, listPracticeModuleCollectionsForProfile, listPracticeModulesForCollection, listPracticeModulesForProfile, listConversationsForPracticeModule, listConversationsForProfile, movePracticeModuleCollectionItem, removePracticeModuleFromCollection, restorePracticeModuleForUser, restorePracticeModuleCollectionForUser, setPracticeModuleFavoriteForUser, setPracticeModuleCollectionFavoriteForUser, updateProfile, updateChatRoomForUser, updatePracticeModuleCollection, updatePracticeModule, } from '../db/repository.js';
import { ensureOpenRouterKeyForUser, getOpenRouterApiKeyForUser, } from '../services/openRouterUserKeys.js';
import { env } from '../config/env.js';
import { clearActiveProfileCookie, setActiveProfileCookie, } from './profiles.js';
import { advanceChatRoomConversation, evaluateChatRoomUserMessage, } from '../services/chatrooms.js';
const appDocumentTitle = 'Mr. F, tutor de inglés';
const loginAttempts = new Map();
const maxAttempts = 12;
const attemptWindowMs = 10 * 60 * 1000;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;
const spanishRelativeTimeFormatter = new Intl.RelativeTimeFormat('es', {
    numeric: 'auto',
});
function normalizeSearchText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizeReturnTo(value) {
    if (!value) {
        return '/';
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) {
        return '/';
    }
    return trimmed;
}
function formatRelativeTime(value) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return value;
    }
    const diffMs = timestamp - Date.now();
    const diffSeconds = Math.round(diffMs / 1000);
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 60) {
        return spanishRelativeTimeFormatter.format(diffSeconds, 'second');
    }
    const diffMinutes = Math.round(diffSeconds / 60);
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 60) {
        return spanishRelativeTimeFormatter.format(diffMinutes, 'minute');
    }
    const diffHours = Math.round(diffMinutes / 60);
    const absHours = Math.abs(diffHours);
    if (absHours < 24) {
        return spanishRelativeTimeFormatter.format(diffHours, 'hour');
    }
    const diffDays = Math.round(diffHours / 24);
    const absDays = Math.abs(diffDays);
    if (absDays < 7) {
        return spanishRelativeTimeFormatter.format(diffDays, 'day');
    }
    const diffWeeks = Math.round(diffDays / 7);
    const absWeeks = Math.abs(diffWeeks);
    if (absWeeks < 5) {
        return spanishRelativeTimeFormatter.format(diffWeeks, 'week');
    }
    const diffMonths = Math.round(diffDays / 30);
    const absMonths = Math.abs(diffMonths);
    if (absMonths < 12) {
        return spanishRelativeTimeFormatter.format(diffMonths, 'month');
    }
    const diffYears = Math.round(diffDays / 365);
    return spanishRelativeTimeFormatter.format(diffYears, 'year');
}
function buildAbsoluteAppUrl(pathname) {
    return new URL(pathname, env.appBaseUrl).toString();
}
function logAuthReturnTo(event, details) {
    console.log(`[auth returnTo] ${event}`, details);
}
export function renderLogin(request, response) {
    const returnTo = normalizeReturnTo(typeof request.query.returnTo === 'string' ? request.query.returnTo : '/');
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
export function renderSignup(request, response) {
    const returnTo = normalizeReturnTo(typeof request.query.returnTo === 'string' ? request.query.returnTo : '/');
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
export function renderForgotPassword(_request, response) {
    renderAuthForm(response, {
        error: '',
        fieldErrors: {},
        mode: 'forgot',
        values: { code: '', email: '', fullName: '' },
    });
}
export function renderResetPassword(_request, response) {
    renderAuthForm(response, {
        error: '',
        fieldErrors: {},
        mode: 'reset',
        values: { code: '', email: '', fullName: '' },
    });
}
export function renderChangePassword(request, response) {
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
export async function handleLogin(request, response) {
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
    logAuthReturnTo('handleLogin:start', {
        email: normalizeEmail(readField(request.body.email)),
        returnTo,
    });
    const email = normalizeEmail(readField(request.body.email));
    const password = readField(request.body.password);
    const fieldErrors = {};
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
            returnTo,
            values: { code: '', email, fullName: '' },
        });
        return;
    }
    if (isRateLimited(request)) {
        renderAuthForm(response.status(429), {
            error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
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
            error: 'El correo o el password no son correctos.',
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
export async function handleSignup(request, response) {
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
    logAuthReturnTo('handleSignup:start', {
        email: normalizeEmail(readField(request.body.email)),
        returnTo,
    });
    const email = normalizeEmail(readField(request.body.email));
    const fullName = readField(request.body.fullName);
    const password = readField(request.body.password);
    const confirmPassword = readField(request.body.confirmPassword);
    const fieldErrors = validateSignup({
        confirmPassword,
        email,
        fullName,
        password,
    });
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
                email: 'Ya existe una cuenta con este correo.',
            },
            mode: 'signup',
            returnTo,
            values: { code: '', email, fullName },
        });
        return;
    }
    if (!isMailerConfigured()) {
        renderAuthForm(response.status(503), {
            error: getMailerConfigurationError(),
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
    }
    catch (error) {
        deleteUserById(user.id);
        renderAuthForm(response.status(503), {
            error: toOpenRouterProvisioningErrorMessage(error),
            fieldErrors: {},
            mode: 'signup',
            returnTo,
            values: { code: '', email, fullName },
        });
        return;
    }
    try {
        await issueEmailVerification(user);
    }
    catch (error) {
        renderAuthForm(response.status(503), {
            error: toMailErrorMessage(error),
            fieldErrors: {},
            mode: 'signup',
            returnTo,
            values: { code: '', email, fullName },
        });
        return;
    }
    const verifyReturnTo = returnTo && returnTo !== '/'
        ? `/verify-needed?returnTo=${encodeURIComponent(returnTo)}`
        : '/verify-needed';
    logAuthReturnTo('handleSignup:success', {
        returnTo,
        userId: user.id,
        verifyReturnTo,
    });
    await signInUser(request, response, user.id, verifyReturnTo);
}
export async function handleForgotPassword(request, response) {
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
    }
    catch (error) {
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
export async function handleResetPassword(request, response) {
    const email = normalizeEmail(readField(request.body.email));
    const code = normalizeActionToken(readField(request.body.code));
    const password = readField(request.body.password);
    const fieldErrors = {};
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
export async function handleChangePassword(request, response) {
    const user = request.authUser;
    if (!user) {
        response.redirect('/login');
        return;
    }
    const currentPassword = readField(request.body.currentPassword);
    const newPassword = readField(request.body.newPassword);
    const fieldErrors = {};
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
        const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
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
export async function handleVerifyEmail(request, response) {
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/'));
    logAuthReturnTo('handleVerifyEmail:start', {
        authenticated: Boolean(request.authUser),
        returnTo,
    });
    if (!request.authUser) {
        response.redirect('/login');
        return;
    }
    const code = normalizeActionToken(readField(request.body.code));
    if (!code) {
        renderAuthMessage(response.status(422), {
            body: 'Escribe el código que enviamos a tu correo.',
            returnTo,
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
            returnTo,
            showVerificationCodeForm: true,
            title: 'Código inválido',
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
        body: 'Tu correo ya está verificado. Puedes empezar a practicar.',
        linkHref: returnTo,
        linkText: 'Ir al chat',
        returnTo,
        title: 'Correo verificado',
    });
}
export async function handleResendVerification(request, response) {
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
    if (!isMailerConfigured()) {
        renderAuthMessage(response.status(503), {
            body: getMailerConfigurationError(),
            returnTo,
            title: 'No pude enviar el email',
        });
        return;
    }
    try {
        await issueEmailVerification(request.authUser);
    }
    catch (error) {
        renderAuthMessage(response.status(503), {
            body: toMailErrorMessage(error),
            returnTo,
            title: 'No pude enviar el email',
        });
        return;
    }
    renderAuthMessage(response, {
        body: 'Enviamos otro código de verificación a tu correo.',
        returnTo,
        showVerificationCodeForm: true,
        title: 'Revisa tu correo',
    });
}
export function renderVerifyNeeded(request, response) {
    const returnTo = normalizeReturnTo(typeof request.query.returnTo === 'string' ? request.query.returnTo : '/');
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
        body: `Antes de usar el tutor, escribe el código que enviamos a ${request.authUser.email}.`,
        returnTo,
        showVerificationCodeForm: true,
        showResendVerification: true,
        title: 'Verifica tu correo',
    });
}
export function handleLogout(request, response) {
    if (request.sessionTokenHash) {
        revokeSession(request.sessionTokenHash);
    }
    clearSessionCookie(response);
    clearActiveProfileCookie(response);
    setKnownVisitorCookie(response);
    response.redirect('/');
}
export async function renderHome(request, response) {
    const user = request.authUser;
    const defaultActiveProfile = request.activeProfile;
    const availableProfiles = request.availableProfiles ?? [];
    const isVerified = Boolean(user?.emailVerified);
    const socketAuthToken = user && isVerified ? createSocketAuthToken(user) : '';
    const authMessage = getHomeAuthMessage(request, user);
    const practiceModuleFilterQueryRaw = typeof request.query.q === 'string' ? request.query.q : '';
    const practiceModuleShareModeRaw = typeof request.query.share === 'string' ? request.query.share : '';
    const chatRoomShareModeRaw = typeof request.query.share === 'string' ? request.query.share : '';
    const practiceModuleFilterQuery = practiceModuleFilterQueryRaw.trim();
    const practiceModuleShareMode = practiceModuleShareModeRaw === 'profile' || practiceModuleShareModeRaw === 'link'
        ? practiceModuleShareModeRaw
        : '';
    const practiceModuleLayout = request.query.layout === 'list' ? 'list' : 'cards';
    const chatRoomShareMode = chatRoomShareModeRaw === 'profile' || chatRoomShareModeRaw === 'link'
        ? chatRoomShareModeRaw
        : '';
    const chatRoomLayout = request.query.layout === 'list' ? 'list' : 'cards';
    const normalizedpracticeModuleFilterQuery = normalizeSearchText(practiceModuleFilterQuery);
    const showArchivedPracticeModules = String(request.query.archived || '').trim() === '1';
    const guestInitialGreeting = user
        ? ''
        : hasKnownVisitorCookie(request)
            ? pickKnownVisitorGreeting()
            : pickInitialGreeting();
    const requestedConversationIdRaw = request.params.conversationId;
    const requestedConversationId = typeof requestedConversationIdRaw === 'string'
        ? requestedConversationIdRaw.trim()
        : '';
    const requestedLessonIdRaw = request.params.practiceModuleId;
    const requestedLessonId = typeof requestedLessonIdRaw === 'string'
        ? requestedLessonIdRaw.trim()
        : '';
    const requestedLessonShareIdRaw = request.params.shareId;
    const requestedLessonShareId = typeof requestedLessonShareIdRaw === 'string'
        ? requestedLessonShareIdRaw.trim()
        : '';
    const requestedChatRoomShareIdRaw = request.params.shareId;
    const requestedChatRoomShareId = typeof requestedChatRoomShareIdRaw === 'string'
        ? requestedChatRoomShareIdRaw.trim()
        : '';
    const isPracticeModuleSharePath = /^\/practice-modules\/shared\/[^/]+$/.test(request.path);
    const isCollectionSharePath = /^\/practice-modules\/collections\/shared\/[^/]+$/.test(request.path);
    const requestedCollectionShareId = isCollectionSharePath ? requestedLessonShareId : '';
    const requestedPracticeModuleShareId = isPracticeModuleSharePath
        ? requestedLessonShareId
        : '';
    const isChatRoomSharePath = /^\/chatrooms\/shared\/[^/]+$/.test(request.path);
    const effectiveRequestedChatRoomShareId = isChatRoomSharePath
        ? requestedChatRoomShareId
        : '';
    const requestedCollectionIdRaw = request.params.collectionId;
    const requestedCollectionId = typeof requestedCollectionIdRaw === 'string'
        ? requestedCollectionIdRaw.trim()
        : '';
    const requestedProfileIdRaw = request.params.profileId;
    const requestedProfileId = typeof requestedProfileIdRaw === 'string'
        ? requestedProfileIdRaw.trim()
        : '';
    const requestedChatRoomIdRaw = request.params.roomId;
    const requestedChatRoomId = typeof requestedChatRoomIdRaw === 'string'
        ? requestedChatRoomIdRaw.trim()
        : '';
    const requestedChatRoomConversationIdRaw = request.params.roomConversationId;
    const requestedChatRoomConversationId = typeof requestedChatRoomConversationIdRaw === 'string'
        ? requestedChatRoomConversationIdRaw.trim()
        : '';
    const isLessonNewPage = request.path === '/practice-modules/new';
    const isLessonEditPage = request.path.endsWith('/edit');
    const isCollectionNewPage = request.path === '/practice-modules/collections/new';
    const isCollectionEditPage = /^\/practice-modules\/collections\/[^/]+\/edit$/.test(request.path);
    const isProfilesRoot = request.path === '/profiles';
    const isProfileNewPage = request.path === '/profiles/new';
    const isProfileEditPage = /^\/profiles\/[^/]+\/edit$/.test(request.path);
    const isChatRoomsRoot = request.path === '/chatrooms';
    const isChatRoomNewPage = request.path === '/chatrooms/new';
    const isChatRoomEditPage = /^\/chatrooms\/[^/]+\/edit$/.test(request.path);
    const isChatRoomHistoryPage = /^\/chatrooms\/[^/]+\/history$/.test(request.path);
    const isChatRoomConversationPage = /^\/chatroom-conversations\/[^/]+$/.test(request.path);
    let initialConversationId = '';
    const chatMode = 'tutor';
    let currentView = request.path.startsWith('/practice-modules')
        ? 'practiceModules'
        : request.path.startsWith('/chatrooms') ||
            request.path.startsWith('/chatroom-conversations')
            ? 'chatrooms'
            : request.path.startsWith('/profiles')
                ? 'profiles'
                : 'chat';
    let practiceModulePageMode = 'list';
    let profilePageMode = 'list';
    let selectedPracticeModule = null;
    let selectedPracticeModuleCollection = null;
    let selectedSharedPracticeModule = null;
    let selectedPracticeModuleShareLink = null;
    let selectedPracticeModuleSharedFromProfileName = '';
    let selectedSharedPracticeModuleCollection = null;
    let selectedPracticeModuleCollectionShareLink = null;
    let selectedPracticeModuleCollectionSharedFromProfileName = '';
    let practiceModuleConversations = [];
    let practiceModuleCollectionModules = [];
    let activeProfile = defaultActiveProfile;
    let selectedProfile = null;
    let chatRoomPageMode = 'list';
    let selectedChatRoom = null;
    let selectedSharedChatRoom = null;
    let selectedChatRoomShareLink = null;
    let selectedChatRoomSharedFromProfileName = '';
    let selectedChatRoomConversation = null;
    let selectedChatRoomCharacters = [];
    let selectedChatRoomMessages = [];
    let chatRoomConversations = [];
    if (currentView === 'practiceModules' && !user && !requestedPracticeModuleShareId && !requestedCollectionShareId) {
        response.redirect('/');
        return;
    }
    if (currentView === 'profiles' && !user) {
        response.redirect('/login');
        return;
    }
    if (currentView === 'chatrooms' && !user && !effectiveRequestedChatRoomShareId) {
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
        const practiceModule = findPracticeModuleForUser(requestedLessonId, user.id);
        if (!practiceModule) {
            response.redirect('/practice-modules');
            return;
        }
        if (!activeProfile || practiceModule.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(practiceModule.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        selectedPracticeModule = practiceModule;
        practiceModuleConversations = listConversationsForPracticeModule(practiceModule.id, user.id, practiceModule.profileId);
    }
    if (requestedCollectionId && user) {
        const collection = findPracticeModuleCollectionForUser(requestedCollectionId, user.id);
        if (!collection) {
            response.redirect('/practice-modules');
            return;
        }
        if (!activeProfile || collection.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(collection.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        selectedPracticeModuleCollection = collection;
        practiceModuleCollectionModules = listPracticeModulesForCollection(collection.id, user.id);
    }
    if (requestedPracticeModuleShareId) {
        const shareLink = findPracticeModuleShareLinkById(requestedPracticeModuleShareId);
        if (!shareLink || shareLink.revokedAt) {
            response.redirect('/practice-modules');
            return;
        }
        const sharedLesson = findPracticeModuleById(shareLink.practiceModuleId);
        if (!sharedLesson) {
            response.redirect('/practice-modules');
            return;
        }
        selectedSharedPracticeModule = sharedLesson;
        selectedPracticeModuleShareLink = shareLink;
    }
    if (requestedCollectionShareId) {
        const shareLink = findPracticeModuleCollectionShareLinkById(requestedCollectionShareId);
        if (!shareLink || shareLink.revokedAt) {
            response.redirect('/practice-modules');
            return;
        }
        const sharedCollection = findPracticeModuleCollectionById(shareLink.collectionId);
        if (!sharedCollection) {
            response.redirect('/practice-modules');
            return;
        }
        selectedSharedPracticeModuleCollection = sharedCollection;
        selectedPracticeModuleCollectionShareLink = shareLink;
        practiceModuleCollectionModules = listPracticeModulesForCollection(sharedCollection.id, sharedCollection.userId);
    }
    if (effectiveRequestedChatRoomShareId) {
        const shareLink = findChatRoomShareLinkById(effectiveRequestedChatRoomShareId);
        if (!shareLink || shareLink.revokedAt) {
            response.redirect('/chatrooms');
            return;
        }
        const sharedRoom = findChatRoomById(shareLink.roomId);
        if (!sharedRoom) {
            response.redirect('/chatrooms');
            return;
        }
        selectedSharedChatRoom = sharedRoom;
        selectedChatRoomShareLink = shareLink;
        selectedChatRoomCharacters = listChatRoomCharacters(sharedRoom.id);
    }
    if (selectedPracticeModule) {
        selectedPracticeModuleShareLink = getOrCreatePracticeModuleShareLink(selectedPracticeModule.id);
        if (selectedPracticeModule.sourceProfileId) {
            selectedPracticeModuleSharedFromProfileName =
                findProfileById(selectedPracticeModule.sourceProfileId)?.name || '';
        }
    }
    if (selectedPracticeModuleCollection) {
        selectedPracticeModuleCollectionShareLink = getOrCreatePracticeModuleCollectionShareLink(selectedPracticeModuleCollection.id);
        if (selectedPracticeModuleCollection.sourceProfileId) {
            selectedPracticeModuleCollectionSharedFromProfileName =
                findProfileById(selectedPracticeModuleCollection.sourceProfileId)?.name || '';
        }
    }
    if (selectedSharedChatRoom && selectedSharedChatRoom.sourceProfileId) {
        selectedChatRoomSharedFromProfileName =
            findProfileById(selectedSharedChatRoom.sourceProfileId)?.name || '';
    }
    if (selectedSharedPracticeModuleCollection &&
        selectedSharedPracticeModuleCollection.sourceProfileId) {
        selectedPracticeModuleCollectionSharedFromProfileName =
            findProfileById(selectedSharedPracticeModuleCollection.sourceProfileId)?.name || '';
    }
    if (requestedProfileId && user) {
        const profile = findProfileForUser(requestedProfileId, user.id);
        if (!profile) {
            response.redirect('/profiles');
            return;
        }
        selectedProfile = profile;
    }
    if (requestedChatRoomConversationId && user) {
        const conversation = findChatRoomConversationForUser(requestedChatRoomConversationId, user.id);
        if (!conversation) {
            response.redirect('/chatrooms');
            return;
        }
        selectedChatRoomConversation = conversation;
        selectedChatRoom = findChatRoomForUser(conversation.roomId, user.id);
        if (!selectedChatRoom) {
            response.redirect('/chatrooms');
            return;
        }
        if (!activeProfile || selectedChatRoom.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(selectedChatRoom.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        selectedChatRoomCharacters = listChatRoomCharacters(selectedChatRoom.id);
        selectedChatRoomMessages = listChatRoomMessages(selectedChatRoomConversation.id);
        chatRoomConversations = listChatRoomConversationsForRoom(selectedChatRoom.id, user.id);
    }
    else if (requestedChatRoomId && user) {
        const room = findChatRoomForUser(requestedChatRoomId, user.id);
        if (!room) {
            response.redirect('/chatrooms');
            return;
        }
        selectedChatRoom = room;
        if (!activeProfile || room.profileId !== activeProfile.id) {
            activeProfile = findProfileForUser(room.profileId, user.id);
            if (activeProfile) {
                setActiveProfileCookie(response, activeProfile.id);
            }
        }
        selectedChatRoomCharacters = listChatRoomCharacters(room.id);
        chatRoomConversations = listChatRoomConversationsForRoom(room.id, user.id);
    }
    if (selectedChatRoom) {
        selectedChatRoomShareLink = getOrCreateChatRoomShareLink(selectedChatRoom.id);
        if (selectedChatRoom.sourceProfileId) {
            selectedChatRoomSharedFromProfileName =
                findProfileById(selectedChatRoom.sourceProfileId)?.name || '';
        }
    }
    const conversations = user && activeProfile
        ? listConversationsForProfile(user.id, activeProfile.id)
        : [];
    const practiceModuleCollections = user && activeProfile
        ? listPracticeModuleCollectionsForProfile(user.id, activeProfile.id)
        : [];
    const practiceModules = user && activeProfile
        ? listPracticeModulesForProfile(user.id, activeProfile.id)
        : [];
    const allLessons = user
        ? practiceModules.map((practiceModule) => ({
            ...practiceModule,
            conversationCount: listConversationsForPracticeModule(practiceModule.id, user.id, practiceModule.profileId).length,
            sourceProfileName: practiceModule.sourceProfileId
                ? findProfileById(practiceModule.sourceProfileId)?.name || ''
                : '',
        }))
        : [];
    const visibleLessons = allLessons.filter((practiceModule) => {
        if (practiceModule.archivedAt && !showArchivedPracticeModules) {
            return false;
        }
        if (!normalizedpracticeModuleFilterQuery) {
            return true;
        }
        const haystack = [
            practiceModule.title,
            practiceModule.description,
            practiceModule.tutorInstructions,
        ].join('\n');
        return normalizeSearchText(haystack).includes(normalizedpracticeModuleFilterQuery);
    });
    const allPracticeModuleCollections = practiceModuleCollections.map((collection) => ({
        ...collection,
        moduleCount: listPracticeModulesForCollection(collection.id, user?.id || '').length,
        sourceProfileName: collection.sourceProfileId
            ? findProfileById(collection.sourceProfileId)?.name || ''
            : '',
    }));
    const visiblePracticeModuleCollections = allPracticeModuleCollections.filter((collection) => {
        if (collection.archivedAt && !showArchivedPracticeModules) {
            return false;
        }
        if (!normalizedpracticeModuleFilterQuery) {
            return true;
        }
        const haystack = [collection.title, collection.description].join('\n');
        return normalizeSearchText(haystack).includes(normalizedpracticeModuleFilterQuery);
    });
    const activeVisiblePracticeModuleCollections = visiblePracticeModuleCollections
        .filter((collection) => !collection.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const activeVisibleLessons = visibleLessons.filter((practiceModule) => !practiceModule.archivedAt);
    const archivedPracticeModules = visibleLessons
        .filter((practiceModule) => Boolean(practiceModule.archivedAt))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const favoritePracticeModuleCollections = activeVisiblePracticeModuleCollections
        .filter((collection) => collection.isFavorite)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const archivedPracticeModuleCollections = visiblePracticeModuleCollections
        .filter((collection) => Boolean(collection.archivedAt))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const hasArchivedPracticeModules = allPracticeModuleCollections.some((collection) => Boolean(collection.archivedAt)) ||
        allLessons.some((practiceModule) => Boolean(practiceModule.archivedAt));
    const favoritePracticeModules = activeVisibleLessons
        .filter((practiceModule) => !practiceModule.sharedVia && !practiceModule.collectionId && practiceModule.isFavorite)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const ownLessons = activeVisibleLessons
        .filter((practiceModule) => !practiceModule.sharedVia && !practiceModule.isFavorite && !practiceModule.collectionId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const sharedLessons = activeVisibleLessons
        .filter((practiceModule) => Boolean(practiceModule.sharedVia) && !practiceModule.collectionId)
        .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
    });
    const availablePracticeModulesForCollection = user && activeProfile && selectedPracticeModuleCollection
        ? activeVisibleLessons.filter((practiceModule) => practiceModule.profileId === selectedPracticeModuleCollection.profileId &&
            !practiceModule.collectionId)
        : [];
    const containingCollectionsForSelectedPracticeModule = user && selectedPracticeModule
        ? listPracticeModuleCollectionsContainingModule(selectedPracticeModule.id, user.id)
        : [];
    const availableCollectionsForSelectedPracticeModule = selectedPracticeModule && activeProfile
        ? activeVisiblePracticeModuleCollections.filter((collection) => collection.profileId === selectedPracticeModule.profileId &&
            !containingCollectionsForSelectedPracticeModule.some((existingCollection) => existingCollection.id === collection.id))
        : [];
    const shareTargetPracticeModuleProfiles = availableProfiles.filter((profile) => profile.id !== (selectedPracticeModule?.profileId ?? activeProfile?.id));
    const shareTargetPracticeModuleCollectionProfiles = availableProfiles.filter((profile) => profile.id !== (selectedPracticeModuleCollection?.profileId ?? activeProfile?.id));
    const shareTargetChatRoomProfiles = availableProfiles.filter((profile) => profile.id !== (selectedChatRoom?.profileId ?? activeProfile?.id));
    const chatRooms = user && activeProfile
        ? listChatRoomsForProfile(user.id, activeProfile.id).map((room) => ({
            ...room,
            characters: listChatRoomCharacters(room.id),
            sourceProfileName: room.sourceProfileId
                ? findProfileById(room.sourceProfileId)?.name || ''
                : '',
        }))
        : [];
    const hasArchivedChatRooms = chatRooms.some((room) => Boolean(room.archivedAt));
    const chatRoomConversationsWithRelativeTime = chatRoomConversations.map((conversation) => ({
        ...conversation,
        relativeUpdatedAt: formatRelativeTime(conversation.updatedAt),
    }));
    const practiceModuleShareUrl = selectedPracticeModule && selectedPracticeModuleShareLink
        ? buildAbsoluteAppUrl(`/practice-modules/shared/${encodeURIComponent(selectedPracticeModuleShareLink.id)}`)
        : '';
    const practiceModuleCollectionShareUrl = selectedPracticeModuleCollection && selectedPracticeModuleCollectionShareLink
        ? buildAbsoluteAppUrl(`/practice-modules/collections/shared/${encodeURIComponent(selectedPracticeModuleCollectionShareLink.id)}`)
        : '';
    const practiceModuleShareQrDataUrl = practiceModuleShareUrl
        ? await QRCode.toDataURL(practiceModuleShareUrl, {
            margin: 1,
            width: 180,
        })
        : '';
    const practiceModuleCollectionShareQrDataUrl = practiceModuleCollectionShareUrl
        ? await QRCode.toDataURL(practiceModuleCollectionShareUrl, {
            margin: 1,
            width: 180,
        })
        : '';
    const activeChatRoomShareLink = selectedChatRoomShareLink;
    const chatRoomShareUrl = activeChatRoomShareLink
        ? buildAbsoluteAppUrl(`/chatrooms/shared/${encodeURIComponent(activeChatRoomShareLink.id)}`)
        : '';
    const chatRoomShareQrDataUrl = chatRoomShareUrl
        ? await QRCode.toDataURL(chatRoomShareUrl, {
            margin: 1,
            width: 180,
        })
        : '';
    if (currentView === 'practiceModules') {
        if (isCollectionNewPage) {
            practiceModulePageMode = 'collectionNew';
        }
        else if (selectedPracticeModuleCollection && isCollectionEditPage) {
            practiceModulePageMode = 'collectionEdit';
        }
        else if (selectedPracticeModuleCollection) {
            practiceModulePageMode = 'collectionDetail';
        }
        else if (isLessonNewPage) {
            practiceModulePageMode = 'new';
        }
        else if (selectedPracticeModule && isLessonEditPage) {
            practiceModulePageMode = 'edit';
        }
        else if (selectedSharedPracticeModule && selectedPracticeModuleShareLink) {
            practiceModulePageMode = 'share';
        }
        else if (selectedSharedPracticeModuleCollection && selectedPracticeModuleCollectionShareLink) {
            practiceModulePageMode = 'collectionShare';
        }
        else if (selectedPracticeModule) {
            practiceModulePageMode = 'detail';
        }
    }
    if (currentView === 'profiles') {
        if (isProfileNewPage) {
            profilePageMode = 'new';
        }
        else if (selectedProfile && isProfileEditPage) {
            profilePageMode = 'edit';
        }
        else {
            profilePageMode = 'list';
        }
    }
    if (currentView === 'chatrooms') {
        if (selectedChatRoomConversation && selectedChatRoom) {
            chatRoomPageMode = 'conversation';
        }
        else if (isChatRoomNewPage) {
            chatRoomPageMode = 'new';
        }
        else if (selectedChatRoom && isChatRoomEditPage) {
            chatRoomPageMode = 'edit';
        }
        else if (selectedChatRoom && isChatRoomHistoryPage) {
            chatRoomPageMode = 'history';
        }
        else if (selectedSharedChatRoom && selectedChatRoomShareLink) {
            chatRoomPageMode = 'share';
        }
        else {
            chatRoomPageMode = 'list';
        }
    }
    const viewTemplate = currentView === 'practiceModules'
        ? 'practice-modules'
        : currentView === 'chatrooms'
            ? chatRoomPageMode === 'new' || chatRoomPageMode === 'edit'
                ? 'chatrooms-form'
                : chatRoomPageMode === 'history'
                    ? 'chatrooms-history'
                    : chatRoomPageMode === 'conversation'
                        ? 'chatrooms-conversation'
                        : chatRoomPageMode === 'share'
                            ? 'chatrooms-share'
                            : 'chatrooms-list'
            : currentView === 'profiles'
                ? profilePageMode === 'new' || profilePageMode === 'edit'
                    ? 'profiles-form'
                    : 'profiles-list'
                : 'chat';
    response.render(viewTemplate, {
        practiceModules: ownLessons,
        activeProfile,
        archivedPracticeModules,
        archivedPracticeModuleCollections,
        practiceModuleFilterQuery,
        practiceModuleConversations,
        practiceModuleCollectionModules,
        practiceModuleCollections: activeVisiblePracticeModuleCollections,
        availablePracticeModulesForCollection,
        availableCollectionsForSelectedPracticeModule,
        practiceModulePageMode,
        practiceModuleLayout,
        chatRooms,
        chatRoomConversations: chatRoomConversationsWithRelativeTime,
        chatRoomPageMode,
        chatRoomLayout,
        chatRoomShareMode,
        chatRoomShareQrDataUrl,
        chatRoomShareUrl,
        shareTargetChatRoomProfiles,
        selectedChatRoom,
        selectedChatRoomCharacters,
        selectedChatRoomConversation,
        selectedChatRoomMessages,
        selectedChatRoomShareLink,
        selectedChatRoomSharedFromProfileName,
        selectedSharedChatRoom,
        practiceModuleShareQrDataUrl,
        practiceModuleShareUrl,
        practiceModuleShareMode,
        practiceModuleCollectionShareQrDataUrl,
        practiceModuleCollectionShareUrl,
        favoritePracticeModules,
        favoritePracticeModuleCollections,
        hasArchivedPracticeModules,
        hasArchivedChatRooms,
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
        showArchivedPracticeModules,
        shareTargetPracticeModuleProfiles,
        shareTargetPracticeModuleCollectionProfiles,
        sharedLessons,
        selectedPracticeModule,
        selectedPracticeModuleCollection,
        selectedPracticeModuleCollectionShareLink,
        selectedPracticeModuleCollectionSharedFromProfileName,
        selectedPracticeModuleShareLink,
        selectedPracticeModuleSharedFromProfileName,
        selectedProfile,
        selectedSharedPracticeModuleCollection,
        selectedSharedPracticeModule,
        socketAuthToken,
        containingCollectionsForSelectedPracticeModule,
        title: appDocumentTitle,
        user,
    });
}
export function handleCreateChatRoom(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const payload = readChatRoomFormPayload(request);
    const error = validateChatRoomFormPayload(payload);
    if (error) {
        response.redirect('/chatrooms/new');
        return;
    }
    const room = createChatRoom({
        characters: payload.characters,
        description: payload.description,
        profileId: activeProfile.id,
        title: payload.title,
        userId: user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(room.id)}/history`);
}
export function handleUpdateChatRoom(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const existingRoom = findChatRoomForUser(roomId, user.id);
    if (!existingRoom) {
        response.redirect('/chatrooms');
        return;
    }
    const payload = readChatRoomFormPayload(request);
    const error = validateChatRoomFormPayload(payload);
    if (error) {
        response.redirect(`/chatrooms/${encodeURIComponent(roomId)}/edit`);
        return;
    }
    updateChatRoomForUser({
        characters: payload.characters,
        description: payload.description,
        roomId,
        title: payload.title,
        userId: user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(roomId)}/history`);
}
export function handleJoinChatRoom(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const room = findChatRoomForUser(roomId, user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const conversation = createChatRoomConversation(user.id, room);
    seedChatRoomConversation(conversation.id, room, user.fullName);
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export function handleCreateChatRoomConversation(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const room = findChatRoomForUser(roomId, user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const conversation = createChatRoomConversation(user.id, room);
    seedChatRoomConversation(conversation.id, room, user.fullName);
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export function handleShareChatRoomToProfile(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const roomId = String(request.params.roomId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!roomId || !targetProfileId) {
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(roomId, user.id);
    if (!room) {
        response.redirect('/chatrooms');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, user.id);
    if (!targetProfile || targetProfile.id === room.profileId) {
        response.redirect(`/chatrooms/${encodeURIComponent(room.id)}?share=profile`);
        return;
    }
    importChatRoomToProfile({
        shareKind: 'profile',
        sourceRoom: room,
        targetProfileId: targetProfile.id,
        userId: user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(room.id)}?share=profile`);
}
export function handleAcceptSharedChatRoomLink(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/chatrooms');
        return;
    }
    const shareLink = findChatRoomShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/chatrooms');
        return;
    }
    const sourceRoom = findChatRoomById(shareLink.roomId);
    if (!sourceRoom) {
        response.redirect('/chatrooms');
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const imported = importChatRoomToProfile({
        shareKind: 'link',
        sourceRoom,
        targetProfileId: activeProfile.id,
        userId: user.id,
    });
    response.redirect(`/chatrooms/${encodeURIComponent(imported.id)}/history`);
}
export async function handleChatRoomSendMessage(request, response) {
    const wantsJson = request.accepts(['html', 'json']) === 'json';
    const user = request.authUser;
    if (!user?.emailVerified) {
        if (wantsJson) {
            response.status(401).json({ ok: false, redirect: '/login' });
            return;
        }
        response.redirect('/login');
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, user.id);
    if (!conversation) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, user.id);
    if (!room) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    const content = readField(request.body.content);
    if (!content) {
        if (wantsJson) {
            response.status(400).json({ ok: false, error: 'Escribe un mensaje.' });
            return;
        }
        response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
        return;
    }
    const userMessage = addChatRoomMessage(conversation.id, 'user', user.fullName, content);
    const stepResult = await advanceChatRoomConversationStep({
        conversationId: conversation.id,
        room,
        trigger: 'user',
        userId: user.id,
        userName: user.fullName,
    });
    void evaluateChatRoomUserMessageStep({
        conversationId: conversation.id,
        room,
        userId: user.id,
        userMessage: content,
        userName: user.fullName,
    })
        .then((userMessageEvaluation) => persistChatRoomUserMessageEvaluation({
        conversationId: conversation.id,
        evaluation: userMessageEvaluation,
        messageId: userMessage.id,
    }))
        .catch((error) => {
        console.info(`[chatrooms] evaluation:background-error ${JSON.stringify({
            conversationId: conversation.id,
            error: error instanceof Error ? error.message : String(error),
            messageId: userMessage.id,
            roomId: room.id,
            userId: user.id,
        })}`);
    });
    if (wantsJson) {
        response.json({
            appendedMessages: stepResult.appendedMessages,
            ok: true,
            userMessage,
        });
        return;
    }
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export function handleGetChatRoomMessageEvaluation(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.status(401).json({ ok: false, redirect: '/login' });
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const messageId = Number(request.params.messageId);
    if (!conversationId || !Number.isInteger(messageId) || messageId <= 0) {
        response.status(400).json({ ok: false, error: 'Invalid message id.' });
        return;
    }
    const conversation = findChatRoomConversationForUser(conversationId, user.id);
    if (!conversation) {
        response.status(404).json({ ok: false, redirect: '/chatrooms' });
        return;
    }
    const message = findChatRoomMessage(conversation.id, messageId);
    if (!message || message.senderType !== 'user') {
        response.status(404).json({ ok: false, error: 'Message not found.' });
        return;
    }
    response.json({
        message,
        ok: true,
        pending: !message.evaluationStatus,
    });
}
export async function handleChatRoomContinue(request, response) {
    const wantsJson = request.accepts(['html', 'json']) === 'json';
    const user = request.authUser;
    if (!user?.emailVerified) {
        if (wantsJson) {
            response.status(401).json({ ok: false, redirect: '/login' });
            return;
        }
        response.redirect('/login');
        return;
    }
    const conversationId = String(request.params.roomConversationId || '').trim();
    const conversation = findChatRoomConversationForUser(conversationId, user.id);
    if (!conversation) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    const room = findChatRoomForUser(conversation.roomId, user.id);
    if (!room) {
        if (wantsJson) {
            response.status(404).json({ ok: false, redirect: '/chatrooms' });
            return;
        }
        response.redirect('/chatrooms');
        return;
    }
    if (wantsJson) {
        response.json({
            ok: true,
            messages: listChatRoomMessages(conversation.id),
        });
        return;
    }
    response.redirect(`/chatroom-conversations/${encodeURIComponent(conversation.id)}`);
}
export function handleCreateLesson(request, response) {
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
        response.redirect('/practice-modules/new');
        return;
    }
    const practiceModule = createPracticeModule({
        profileId: activeProfile.id,
        userId: user.id,
        title,
        description,
        tutorInstructions,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleCreateLessonConversation(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleIdRaw = request.params.practiceModuleId;
    const practiceModuleId = typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
    if (!practiceModuleId) {
        response.redirect('/practice-modules');
        return;
    }
    const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/practice-modules');
        return;
    }
    const conversation = createConversationFromPracticeModule(user.id, practiceModule);
    response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
export function handleSwitchProfile(request, response) {
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
export function handleCreateProfile(request, response) {
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
export function handleUpdateProfile(request, response) {
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
export function handleUpdateLesson(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleIdRaw = request.params.practiceModuleId;
    const practiceModuleId = typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
    if (!practiceModuleId) {
        response.redirect('/practice-modules');
        return;
    }
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    const tutorInstructions = String(request.body.tutorInstructions || '').trim();
    if (!title || !description || !tutorInstructions) {
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModuleId)}/edit`);
        return;
    }
    const practiceModule = updatePracticeModule({
        practiceModuleId,
        description,
        title,
        tutorInstructions,
        userId: user.id,
    });
    if (!practiceModule) {
        response.redirect('/practice-modules');
        return;
    }
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleSetLessonFavorite(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
    if (!practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    const favoriteValue = String(request.body.favorite || '').trim();
    const isFavorite = favoriteValue === '1' || favoriteValue === 'true';
    setPracticeModuleFavoriteForUser(practiceModuleId, user.id, isFavorite);
    response.redirect(returnTo);
}
export function handleArchiveLesson(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
    if (!practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    archivePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect(returnTo);
}
export function handleRestoreLesson(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules?archived=1'));
    if (!practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    restorePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect(returnTo);
}
export function handleDeleteLesson(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleIdRaw = request.params.practiceModuleId;
    const practiceModuleId = typeof practiceModuleIdRaw === 'string' ? practiceModuleIdRaw.trim() : '';
    if (!practiceModuleId) {
        response.redirect('/practice-modules');
        return;
    }
    deletePracticeModuleForUser(practiceModuleId, user.id);
    response.redirect('/practice-modules');
}
export function handleCreatePracticeModuleCollection(request, response) {
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    if (!title) {
        response.redirect('/practice-modules/collections/new');
        return;
    }
    const collection = createPracticeModuleCollection({
        description,
        profileId: activeProfile.id,
        title,
        userId: user.id,
    });
    response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}
export function handleUpdatePracticeModuleCollection(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const title = String(request.body.title || '').trim();
    const description = String(request.body.description || '').trim();
    if (!collectionId || !title) {
        response.redirect(collectionId ? `/practice-modules/collections/${encodeURIComponent(collectionId)}/edit` : '/practice-modules');
        return;
    }
    const collection = updatePracticeModuleCollection({
        collectionId,
        description,
        title,
        userId: user.id,
    });
    if (!collection) {
        response.redirect('/practice-modules');
        return;
    }
    response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}
export function handleSetPracticeModuleCollectionFavorite(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
    if (!collectionId) {
        response.redirect(returnTo);
        return;
    }
    const favoriteValue = String(request.body.favorite || '').trim();
    const isFavorite = favoriteValue === '1' || favoriteValue === 'true';
    setPracticeModuleCollectionFavoriteForUser(collectionId, user.id, isFavorite);
    response.redirect(returnTo);
}
export function handleArchivePracticeModuleCollection(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules'));
    if (!collectionId) {
        response.redirect(returnTo);
        return;
    }
    archivePracticeModuleCollectionForUser(collectionId, user.id);
    response.redirect(returnTo);
}
export function handleRestorePracticeModuleCollection(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || '/practice-modules?archived=1'));
    if (!collectionId) {
        response.redirect(returnTo);
        return;
    }
    restorePracticeModuleCollectionForUser(collectionId, user.id);
    response.redirect(returnTo);
}
export function handleAddPracticeModuleToCollection(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const practiceModuleIdsRaw = request.body.practiceModuleId;
    const returnTo = normalizeReturnTo(String(request.body.returnTo || `/practice-modules/collections/${collectionId}`));
    const practiceModuleIds = Array.isArray(practiceModuleIdsRaw)
        ? practiceModuleIdsRaw.map((value) => String(value || '').trim()).filter(Boolean)
        : [String(practiceModuleIdsRaw || '').trim()].filter(Boolean);
    if (!collectionId || practiceModuleIds.length === 0) {
        response.redirect(returnTo);
        return;
    }
    for (const practiceModuleId of practiceModuleIds) {
        addPracticeModuleToCollection({
            collectionId,
            practiceModuleId,
            userId: user.id,
        });
    }
    response.redirect(returnTo);
}
export function handleRemovePracticeModuleFromCollection(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const returnTo = normalizeReturnTo(String(request.body.returnTo || `/practice-modules/collections/${collectionId}`));
    if (!collectionId || !practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    removePracticeModuleFromCollection({
        collectionId,
        practiceModuleId,
        userId: user.id,
    });
    response.redirect(returnTo);
}
export function handleMovePracticeModuleCollectionItem(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const direction = request.path.endsWith('/move-up') ? 'up' : 'down';
    const returnTo = normalizeReturnTo(String(request.body.returnTo || `/practice-modules/collections/${collectionId}`));
    if (!collectionId || !practiceModuleId) {
        response.redirect(returnTo);
        return;
    }
    movePracticeModuleCollectionItem({
        collectionId,
        direction,
        practiceModuleId,
        userId: user.id,
    });
    response.redirect(returnTo);
}
export function handleShareLessonToProfile(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const practiceModuleId = String(request.params.practiceModuleId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!practiceModuleId || !targetProfileId) {
        response.redirect('/practice-modules');
        return;
    }
    const practiceModule = findPracticeModuleForUser(practiceModuleId, user.id);
    if (!practiceModule) {
        response.redirect('/practice-modules');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, user.id);
    if (!targetProfile || targetProfile.id === practiceModule.profileId) {
        response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
        return;
    }
    importPracticeModuleToProfile({
        shareKind: 'profile',
        sourcePracticeModule: practiceModule,
        targetProfileId: targetProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(practiceModule.id)}`);
}
export function handleSharePracticeModuleCollectionToProfile(request, response) {
    const user = request.authUser;
    if (!user?.emailVerified) {
        response.redirect('/login');
        return;
    }
    const collectionId = String(request.params.collectionId || '').trim();
    const targetProfileId = String(request.body.targetProfileId || '').trim();
    if (!collectionId || !targetProfileId) {
        response.redirect('/practice-modules');
        return;
    }
    const collection = findPracticeModuleCollectionForUser(collectionId, user.id);
    if (!collection) {
        response.redirect('/practice-modules');
        return;
    }
    const targetProfile = findProfileForUser(targetProfileId, user.id);
    if (!targetProfile || targetProfile.id === collection.profileId) {
        response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
        return;
    }
    importPracticeModuleCollectionToProfile({
        shareKind: 'profile',
        sourceCollection: collection,
        targetProfileId: targetProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/collections/${encodeURIComponent(collection.id)}`);
}
export function handleAcceptSharedPracticeModuleLink(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/practice-modules');
        return;
    }
    const shareLink = findPracticeModuleShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/practice-modules');
        return;
    }
    const sourcePracticeModule = findPracticeModuleById(shareLink.practiceModuleId);
    if (!sourcePracticeModule) {
        response.redirect('/practice-modules');
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const imported = importPracticeModuleToProfile({
        shareKind: 'link',
        sourcePracticeModule,
        targetProfileId: activeProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/${encodeURIComponent(imported.id)}`);
}
export function handleAcceptSharedPracticeModuleCollectionLink(request, response) {
    const shareId = String(request.params.shareId || '').trim();
    if (!shareId) {
        response.redirect('/practice-modules');
        return;
    }
    const shareLink = findPracticeModuleCollectionShareLinkById(shareId);
    if (!shareLink || shareLink.revokedAt) {
        response.redirect('/practice-modules');
        return;
    }
    const sourceCollection = findPracticeModuleCollectionById(shareLink.collectionId);
    if (!sourceCollection) {
        response.redirect('/practice-modules');
        return;
    }
    const user = request.authUser;
    const activeProfile = request.activeProfile;
    if (!user?.emailVerified || !activeProfile) {
        response.redirect('/login');
        return;
    }
    const imported = importPracticeModuleCollectionToProfile({
        shareKind: 'link',
        sourceCollection,
        targetProfileId: activeProfile.id,
        userId: user.id,
    });
    response.redirect(`/practice-modules/collections/${encodeURIComponent(imported.id)}`);
}
async function signInUser(request, response, userId, returnTo = '/') {
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
function toOpenRouterProvisioningErrorMessage(error) {
    console.error('OpenRouter user key provisioning failed during auth.', error);
    return error instanceof Error
        ? `No pude preparar la cuenta de IA para este usuario: ${error.message}`
        : 'No pude preparar la cuenta de IA para este usuario.';
}
async function issueEmailVerification(user) {
    const token = createActionToken();
    createAuthActionToken({
        expiresAt: new Date(Date.now() + verificationTtlMs),
        tokenHash: hashActionToken(token),
        type: 'email_verification',
        userId: user.id,
    });
    await sendEmailVerification(user, token);
}
async function issuePasswordReset(user) {
    const token = createActionToken();
    createAuthActionToken({
        expiresAt: new Date(Date.now() + passwordResetTtlMs),
        tokenHash: hashActionToken(token),
        type: 'password_reset',
        userId: user.id,
    });
    await sendPasswordReset(user, token);
}
function readChatRoomFormPayload(request) {
    const characters = [1, 2, 3]
        .map((index) => ({
        fullDescription: readField(request.body[`characterFullDescription${index}`]),
        name: readField(request.body[`characterName${index}`]),
        shortDescription: readField(request.body[`characterShortDescription${index}`]),
    }))
        .filter((character) => character.name || character.fullDescription);
    return {
        characters,
        description: readField(request.body.description),
        title: readField(request.body.title),
    };
}
function validateChatRoomFormPayload(input) {
    if (input.title.length < 2) {
        return 'Escribe un nombre para la sala.';
    }
    if (input.description.length < 10) {
        return 'Describe un poco mejor la sala.';
    }
    if (input.characters.length < 1) {
        return 'Agrega al menos un personaje.';
    }
    if (input.characters.length > 3) {
        return 'Solo se permiten hasta tres personajes.';
    }
    for (const character of input.characters) {
        if (!character.name) {
            return 'Cada personaje necesita un nombre.';
        }
        if (character.fullDescription.length < 10) {
            return 'Cada personaje necesita una descripción completa.';
        }
    }
    return null;
}
function seedChatRoomConversation(conversationId, room, userName) {
    const characters = listChatRoomCharacters(room.id);
    for (const character of characters) {
        addChatRoomMessage(conversationId, 'system', 'Sistema', `${character.name} se unió al chat...`);
    }
    addChatRoomMessage(conversationId, 'system', 'Sistema', `${userName} se unió al chat...`);
}
async function advanceChatRoomConversationStep(input) {
    const characters = listChatRoomCharacters(input.room.id);
    const messages = listChatRoomMessages(input.conversationId);
    const openRouterApiKey = await getOpenRouterApiKeyForUser(input.userId);
    console.info(`[chatrooms] step:start ${JSON.stringify({
        characterCount: characters.length,
        conversationId: input.conversationId,
        hasOpenRouterKey: Boolean(openRouterApiKey),
        messageCount: messages.length,
        roomId: input.room.id,
        trigger: input.trigger,
        userId: input.userId,
    })}`);
    const nextTurn = await advanceChatRoomConversation({
        characters,
        messages,
        openRouterApiKey,
        room: input.room,
        trigger: input.trigger,
        userName: input.userName,
    });
    if (nextTurn.messages.length === 0) {
        console.info(`[chatrooms] step:no-turn ${JSON.stringify({
            conversationId: input.conversationId,
            roomId: input.room.id,
            trigger: input.trigger,
            userId: input.userId,
        })}`);
        return {
            appendedMessages: [],
        };
    }
    const appendedMessages = [];
    for (const turn of nextTurn.messages) {
        appendedMessages.push(addChatRoomMessage(input.conversationId, 'character', turn.character.name, turn.content));
    }
    console.info(`[chatrooms] step:stored-turn ${JSON.stringify({
        appendedCount: appendedMessages.length,
        conversationId: input.conversationId,
        roomId: input.room.id,
        speakers: appendedMessages.map((message) => message.senderName),
        trigger: input.trigger,
        userId: input.userId,
    })}`);
    return {
        appendedMessages,
    };
}
async function evaluateChatRoomUserMessageStep(input) {
    const messages = listChatRoomMessages(input.conversationId);
    const openRouterApiKey = await getOpenRouterApiKeyForUser(input.userId);
    return evaluateChatRoomUserMessage({
        historyText: messages
            .filter((message) => message.senderType !== 'system')
            .slice(-18)
            .map((message) => {
            const visibleName = message.senderType === 'user' ? 'You' : message.senderName;
            return `${visibleName}: ${message.content}`;
        })
            .join('\n'),
        openRouterApiKey,
        room: input.room,
        userMessage: input.userMessage,
        userName: input.userName,
    });
}
async function persistChatRoomUserMessageEvaluation(input) {
    if (!input.evaluation) {
        return;
    }
    updateChatRoomMessageEvaluation({
        conversationId: input.conversationId,
        messageId: input.messageId,
        problem: input.evaluation.status === 'warning'
            ? input.evaluation.problem
            : null,
        status: input.evaluation.status,
    });
}
function renderAuthForm(response, view) {
    response.render('auth', {
        ...view,
        csrfToken: response.locals.csrfToken,
        title: `${getFormTitle(view.mode)} · ${appDocumentTitle}`,
    });
}
function renderChangePasswordForm(response, view) {
    response.render('change_password', {
        ...view,
        csrfToken: response.locals.csrfToken,
        title: `Cambiar password · ${appDocumentTitle}`,
    });
}
function renderAuthMessage(response, view) {
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
function getFormTitle(mode) {
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
function getHomeAuthMessage(request, user) {
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
function validateSignup(input) {
    const errors = {};
    if (!isEmail(input.email)) {
        errors.email = 'Escribe un correo válido.';
    }
    if (input.fullName.trim().length < 2) {
        errors.fullName = 'Escribe tu nombre completo.';
    }
    if (input.password.length < 10) {
        errors.password = 'Usa al menos 10 caracteres.';
    }
    if (!input.confirmPassword) {
        errors.confirmPassword = 'Repite tu password.';
    }
    else if (input.password !== input.confirmPassword) {
        errors.confirmPassword = 'Los passwords no coinciden.';
    }
    return errors;
}
function readField(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isRateLimited(request) {
    const key = request.ip ?? 'unknown';
    const item = loginAttempts.get(key);
    return Boolean(item && item.resetAt > Date.now() && item.count >= maxAttempts);
}
function registerFailedAttempt(request) {
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const item = loginAttempts.get(key);
    if (!item || item.resetAt <= now) {
        loginAttempts.set(key, { count: 1, resetAt: now + attemptWindowMs });
        return;
    }
    item.count += 1;
}
function toMailErrorMessage(error) {
    if (error instanceof Error) {
        return `No pude enviar el email: ${error.message}`;
    }
    return 'No pude enviar el email por un error inesperado.';
}
//# sourceMappingURL=forms.js.map