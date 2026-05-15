import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
const tokenTtlSeconds = 60 * 60;
export function createSocketAuthToken(user) {
    const payload = {
        exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
        sub: user.id,
    };
    const body = encode(JSON.stringify(payload));
    const signature = sign(body);
    return `${body}.${signature}`;
}
export function verifySocketAuthToken(token) {
    if (typeof token !== 'string') {
        return null;
    }
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) {
        return null;
    }
    const expectedSignature = sign(body);
    if (!safeEquals(signature, expectedSignature)) {
        return null;
    }
    const payload = parsePayload(body);
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }
    return payload;
}
function parsePayload(body) {
    try {
        const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (typeof decoded.exp !== 'number' || typeof decoded.sub !== 'string') {
            return null;
        }
        return {
            exp: decoded.exp,
            sub: decoded.sub,
        };
    }
    catch {
        return null;
    }
}
function sign(value) {
    return createHmac('sha256', env.sessionSecret).update(value).digest('base64url');
}
function encode(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
}
function safeEquals(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (leftBuffer.length === rightBuffer.length &&
        timingSafeEqual(leftBuffer, rightBuffer));
}
//# sourceMappingURL=socketAuth.js.map