import { buildDocumentTitle } from '../pages/shell.js';
import { translate } from '../i18n/index.js';
export function renderPrivacyPage(request, response) {
    response.render('privacy', {
        title: buildDocumentTitle(request.locale, translate(request.locale, 'legal.privacyTitle')),
    });
}
export function renderTermsPage(request, response) {
    response.render('terms', {
        title: buildDocumentTitle(request.locale, translate(request.locale, 'legal.termsTitle')),
    });
}
//# sourceMappingURL=handlers.js.map