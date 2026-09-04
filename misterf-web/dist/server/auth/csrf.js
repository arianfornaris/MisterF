import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { logger } from '../services/logger.js';
import { requireSessionSecret } from './session.js';
const tokenTtlMs = 2 * 60 * 60 * 1000;
export function csrfProtection(request, response, next) {
    response.locals.csrfToken = createCsrfToken();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        next();
        return;
    }
    const token = readCsrfToken(request);
    const sameOrigin = isSameOrigin(request);
    const tokenValidation = validateCsrfToken(token);
    if (!sameOrigin || !tokenValidation.valid) {
        let reason = 'cross_origin';
        if (sameOrigin && !tokenValidation.valid) {
            reason = tokenValidation.reason;
        }
        logCsrfValidationFailure(request, {
            reason,
            sameOrigin,
            token,
        });
        response.status(403).send('Invalid CSRF token.');
        return;
    }
    next();
}
/**
 * Reads the CSRF token from the request.
 *
 * Form posts carry it in the urlencoded body. Requests whose body is not a form
 * — a binary upload streamed through `express.raw`, for instance — have no
 * parsed body to read it from, so they send the same token in a header instead.
 * Both are same-origin checked identically; the header is not a weaker path,
 * just a different carrier for requests where a body field cannot exist.
 */
function readCsrfToken(request) {
    if (typeof request.body?._csrf === 'string') {
        return request.body._csrf;
    }
    const header = request.get('x-csrf-token');
    return typeof header === 'string' ? header : '';
}
function createCsrfToken() {
    const exp = Date.now() + tokenTtlMs;
    const nonce = randomBytes(16).toString('base64url');
    const body = `${exp}.${nonce}`;
    return `${body}.${sign(body)}`;
}
function validateCsrfToken(token) {
    if (!token) {
        return { reason: 'missing_token', valid: false };
    }
    const [exp, nonce, signature, extra] = token.split('.');
    if (!exp || !nonce || !signature || extra) {
        return { reason: 'malformed_token', valid: false };
    }
    const expiresAt = Number.parseInt(exp, 10);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return { reason: 'expired_token', valid: false };
    }
    if (!safeEquals(signature, sign(`${exp}.${nonce}`))) {
        return { reason: 'invalid_signature', valid: false };
    }
    return { valid: true };
}
function isSameOrigin(request) {
    const origin = request.get('origin');
    if (!origin) {
        return true;
    }
    const host = request.get('host');
    return Boolean(host && origin === `${request.protocol}://${host}`);
}
function sign(value) {
    return createHmac('sha256', requireSessionSecret())
        .update(`csrf:${value}`)
        .digest('base64url');
}
function safeEquals(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (leftBuffer.length === rightBuffer.length &&
        timingSafeEqual(leftBuffer, rightBuffer));
}
function logCsrfValidationFailure(request, details) {
    logger.warn('csrf_validation_failed', {
        contentType: request.get('content-type') ?? null,
        hasToken: Boolean(details.token),
        host: request.get('host') ?? null,
        method: request.method,
        origin: request.get('origin') ?? null,
        path: request.path,
        reason: details.reason,
        requestCredentialsPresent: Boolean(request.get('cookie')),
        sameOrigin: details.sameOrigin,
        statusCode: 403,
    });
}
//# sourceMappingURL=csrf.js.map