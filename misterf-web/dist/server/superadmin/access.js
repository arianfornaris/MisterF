import { normalizeEmail } from '../auth/repository.js';
import { env } from '../config/env.js';
import { translate } from '../i18n/index.js';
export function requireSuperadmin(request, response) {
    if (!request.authUser) {
        response.redirect('/login');
        return false;
    }
    if (!env.superadminEmail ||
        normalizeEmail(request.authUser.email) !== env.superadminEmail) {
        response.status(403).send(translate(request.locale, 'superadmin.noPermission'));
        return false;
    }
    return true;
}
//# sourceMappingURL=access.js.map