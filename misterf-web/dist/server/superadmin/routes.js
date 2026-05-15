import { env } from '../config/env.js';
import { findUserForSuperadmin, listUsersForSuperadmin, normalizeEmail, } from '../auth/repository.js';
import { getOpenRouterKeyRecordForUser, getOpenRouterRemoteKeyInfoForUser, updateOpenRouterUserKeyLimit, } from '../services/openRouterUserKeys.js';
export async function renderSuperadminUsers(request, response) {
    if (!requireSuperadmin(request, response)) {
        return;
    }
    response.render('superadmin', buildViewData(request, response, {
        activeUser: null,
        keyRecord: null,
        mode: 'list',
        openRouterInfo: null,
        remoteError: '',
    }));
}
export async function renderSuperadminUser(request, response) {
    if (!requireSuperadmin(request, response)) {
        return;
    }
    const userId = readParam(request.params.userId);
    const activeUser = findUserForSuperadmin(userId);
    if (!activeUser) {
        response.status(404).send('Usuario no encontrado.');
        return;
    }
    const keyRecord = getOpenRouterKeyRecordForUser(userId);
    let openRouterInfo = null;
    let remoteError = '';
    try {
        openRouterInfo = await getOpenRouterRemoteKeyInfoForUser(userId);
    }
    catch (error) {
        remoteError =
            error instanceof Error
                ? error.message
                : 'No se pudo consultar OpenRouter para esta key.';
    }
    response.render('superadmin', buildViewData(request, response, {
        activeUser,
        keyRecord,
        mode: 'detail',
        openRouterInfo,
        remoteError,
    }));
}
export async function handleOpenRouterKeyUpdate(request, response) {
    if (!requireSuperadmin(request, response)) {
        return;
    }
    const userId = readParam(request.params.userId);
    const activeUser = findUserForSuperadmin(userId);
    if (!activeUser) {
        response.status(404).send('Usuario no encontrado.');
        return;
    }
    const limitUsd = parseLimitUsd(readField(request.body.limitUsd));
    const limitReset = parseLimitReset(readField(request.body.limitReset));
    const includeByokInLimit = request.body.includeByokInLimit === 'on';
    const disabled = request.body.disabled === 'on';
    if (limitUsd instanceof Error) {
        response.redirect(`/superadmin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(limitUsd.message)}#openrouter-key`);
        return;
    }
    try {
        await updateOpenRouterUserKeyLimit({
            disabled,
            includeByokInLimit,
            limitReset,
            limitUsd,
            userId,
        });
        response.redirect(`/superadmin/users/${encodeURIComponent(userId)}?success=${encodeURIComponent('Key actualizada en OpenRouter.')}#openrouter-key`);
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'No se pudo actualizar la key en OpenRouter.';
        response.redirect(`/superadmin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(message)}#openrouter-key`);
    }
}
function requireSuperadmin(request, response) {
    if (!request.authUser) {
        response.redirect('/login');
        return false;
    }
    if (!env.superadminEmail ||
        normalizeEmail(request.authUser.email) !== env.superadminEmail) {
        response.status(403).send('No tienes permiso para ver esta página.');
        return false;
    }
    return true;
}
function buildViewData(request, response, overrides) {
    return {
        ...overrides,
        csrfToken: response.locals.csrfToken ?? '',
        error: readQueryString(request.query.error),
        formatDate,
        formatMoney,
        success: readQueryString(request.query.success),
        users: listUsersForSuperadmin(),
    };
}
function readField(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function readParam(value) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
function readQueryString(value) {
    return typeof value === 'string' ? value : '';
}
function parseLimitUsd(value) {
    if (!value) {
        return null;
    }
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return new Error('El límite debe ser un número mayor o igual a 0.');
    }
    return Math.round(parsed * 10000) / 10000;
}
function parseLimitReset(value) {
    return value === 'daily' || value === 'weekly' || value === 'monthly'
        ? value
        : null;
}
function formatDate(value) {
    if (!value) {
        return 'n/a';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
function formatMoney(value) {
    if (value === null || value === undefined) {
        return 'sin límite';
    }
    return new Intl.NumberFormat('en-US', {
        currency: 'USD',
        maximumFractionDigits: 4,
        style: 'currency',
    }).format(value);
}
//# sourceMappingURL=routes.js.map