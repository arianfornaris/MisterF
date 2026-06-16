import { getMailerConfigurationError, isMailerConfigured, sendEmailVerification, sendPasswordReset, } from './mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAuthActionToken, createLocalUser, createSession, deleteUserById, findUserByAuthActionToken, findUserByEmail, markAuthActionTokenUsed, markEmailVerified, normalizeEmail, revokeSession, revokeUserSessions, updateUserPassword, } from './repository.js';
import { clearSessionCookie, createSessionCookie, setKnownVisitorCookie, setSessionCookie, } from './session.js';
import { createActionToken, hashActionToken, normalizeActionToken, } from './tokens.js';
import { ensureOpenRouterKeyForUser } from '../services/openRouterUserKeys.js';
import { clearActiveProfileCookie } from './profiles.js';
import { appDocumentTitle as shellAppDocumentTitle, buildAppShellContext, getHomeAuthMessage as getShellHomeAuthMessage, } from '../pages/shell.js';
import { buildProfileOnboardingPath } from '../profiles/fields.js';
const appDocumentTitle = 'Mr. F, tutor de inglés';
const loginAttempts = new Map();
const maxAttempts = 12;
const attemptWindowMs = 10 * 60 * 1000;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const passwordResetTtlMs = 60 * 60 * 1000;
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
        body: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.',
        linkHref: '/login',
        linkText: 'Iniciar sesión',
        title: 'Contraseña actualizada',
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
    const confirmPassword = readField(request.body.confirmPassword);
    const fieldErrors = {};
    if (user.passwordHash && !currentPassword) {
        fieldErrors.currentPassword = 'Escribe tu password actual.';
    }
    if (newPassword.length < 10) {
        fieldErrors.newPassword = 'Usa al menos 10 caracteres.';
    }
    if (!confirmPassword) {
        fieldErrors.confirmPassword = 'Repite la nueva contraseña.';
    }
    else if (newPassword !== confirmPassword) {
        fieldErrors.confirmPassword = 'Las contraseñas no coinciden.';
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
        const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            renderChangePasswordForm(response.status(401), {
                error: 'El password actual no es correcto.',
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
        body: 'Tu correo ya está verificado. Completa tu perfil de aprendizaje para que Mr. F pueda adaptar mejor la práctica.',
        linkHref: buildProfileOnboardingPath(returnTo),
        linkText: 'Completar perfil',
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
        ...buildAppShellContext({
            activeProfile: view.request.activeProfile,
            authMessage: getShellHomeAuthMessage(view.request, view.user),
            currentView: 'settings',
            guestInitialGreeting: '',
            request: view.request,
            title: `Cambiar contraseña · ${shellAppDocumentTitle}`,
            user: view.user,
        }),
        csrfToken: response.locals.csrfToken,
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