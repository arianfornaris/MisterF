import { appDocumentTitle } from '../pages/shell.js';
import { translate } from '../i18n/index.js';
export function renderPrivacyPage(request, response) {
    response.render('privacy', {
        title: `${translate(request.locale, 'legal.privacyTitle')} · ${appDocumentTitle}`,
    });
}
export function renderTermsPage(request, response) {
    response.render('terms', {
        title: `${translate(request.locale, 'legal.termsTitle')} · ${appDocumentTitle}`,
    });
}
//# sourceMappingURL=handlers.js.map