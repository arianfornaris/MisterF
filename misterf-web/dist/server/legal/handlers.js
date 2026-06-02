import { appDocumentTitle } from '../pages/shell.js';
export function renderPrivacyPage(_request, response) {
    response.render('privacy', {
        title: `Política de privacidad · ${appDocumentTitle}`,
    });
}
export function renderTermsPage(_request, response) {
    response.render('terms', {
        title: `Términos y condiciones · ${appDocumentTitle}`,
    });
}
//# sourceMappingURL=handlers.js.map