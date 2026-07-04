import type { Request, Response } from 'express';
import { appDocumentTitle } from '../pages/shell.js';
import { translate } from '../i18n/index.js';

export function renderPrivacyPage(request: Request, response: Response): void {
  response.render('privacy', {
    title: `${translate(request.locale, 'legal.privacyTitle')} · ${appDocumentTitle}`,
  });
}

export function renderTermsPage(request: Request, response: Response): void {
  response.render('terms', {
    title: `${translate(request.locale, 'legal.termsTitle')} · ${appDocumentTitle}`,
  });
}
