import type { Request, Response } from 'express';
import { appDocumentTitle } from '../pages/shell.js';

export function renderPrivacyPage(_request: Request, response: Response): void {
  response.render('privacy', {
    title: `Política de privacidad · ${appDocumentTitle}`,
  });
}

export function renderTermsPage(_request: Request, response: Response): void {
  response.render('terms', {
    title: `Términos y condiciones · ${appDocumentTitle}`,
  });
}
