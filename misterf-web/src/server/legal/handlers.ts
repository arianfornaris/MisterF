import type { Request, Response } from 'express';
import { buildDocumentTitle } from '../pages/shell.js';
import { translate } from '../i18n/index.js';

export function renderPrivacyPage(request: Request, response: Response): void {
  response.render('privacy', {
    title: buildDocumentTitle(request.locale, translate(request.locale, 'legal.privacyTitle')),
  });
}

export function renderTermsPage(request: Request, response: Response): void {
  response.render('terms', {
    title: buildDocumentTitle(request.locale, translate(request.locale, 'legal.termsTitle')),
  });
}
