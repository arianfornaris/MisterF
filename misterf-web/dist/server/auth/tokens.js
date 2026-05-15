import { createHmac, randomBytes } from 'node:crypto';
import { requireSessionSecret } from './session.js';
const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const codeLength = 8;
export function createActionToken() {
    const bytes = randomBytes(codeLength);
    let code = '';
    for (const byte of bytes) {
        code += codeAlphabet[byte % codeAlphabet.length];
    }
    return code;
}
export function hashActionToken(token) {
    return createHmac('sha256', requireSessionSecret())
        .update(`action:${normalizeActionToken(token)}`)
        .digest('base64url');
}
export function normalizeActionToken(token) {
    return token.trim().toUpperCase().replaceAll(/[\s-]/g, '');
}
//# sourceMappingURL=tokens.js.map