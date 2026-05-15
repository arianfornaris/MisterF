import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  findUserForSuperadmin,
  listUsersForSuperadmin,
  normalizeEmail,
  type SuperadminUser,
} from '../auth/repository.js';
import {
  getOpenRouterKeyRecordForUser,
  getOpenRouterRemoteKeyInfoForUser,
  updateOpenRouterUserKeyLimit,
  type OpenRouterRemoteKeyInfo,
  type OpenRouterUserKeyRecord,
} from '../services/openRouterUserKeys.js';

type SuperadminViewBase = {
  activeUser: SuperadminUser | null;
  csrfToken: string;
  error: string;
  formatDate: (value?: string | null) => string;
  formatMoney: (value?: number | null) => string;
  keyRecord: OpenRouterUserKeyRecord | null;
  mode: 'list' | 'detail';
  openRouterInfo: OpenRouterRemoteKeyInfo | null;
  remoteError: string;
  success: string;
  users: SuperadminUser[];
};

export async function renderSuperadminUsers(
  request: Request,
  response: Response,
): Promise<void> {
  if (!requireSuperadmin(request, response)) {
    return;
  }

  response.render('superadmin', buildViewData(request, response, {
    activeUser: null,
    keyRecord: null,
    mode: 'list',
    openRouterInfo: null,
    remoteError: '',
  }));
}

export async function renderSuperadminUser(
  request: Request,
  response: Response,
): Promise<void> {
  if (!requireSuperadmin(request, response)) {
    return;
  }

  const userId = readParam(request.params.userId);
  const activeUser = findUserForSuperadmin(userId);
  if (!activeUser) {
    response.status(404).send('Usuario no encontrado.');
    return;
  }

  const keyRecord = getOpenRouterKeyRecordForUser(userId);
  let openRouterInfo: OpenRouterRemoteKeyInfo | null = null;
  let remoteError = '';

  try {
    openRouterInfo = await getOpenRouterRemoteKeyInfoForUser(userId);
  } catch (error) {
    remoteError =
      error instanceof Error
        ? error.message
        : 'No se pudo consultar OpenRouter para esta key.';
  }

  response.render('superadmin', buildViewData(request, response, {
    activeUser,
    keyRecord,
    mode: 'detail',
    openRouterInfo,
    remoteError,
  }));
}

export async function handleOpenRouterKeyUpdate(
  request: Request,
  response: Response,
): Promise<void> {
  if (!requireSuperadmin(request, response)) {
    return;
  }

  const userId = readParam(request.params.userId);
  const activeUser = findUserForSuperadmin(userId);
  if (!activeUser) {
    response.status(404).send('Usuario no encontrado.');
    return;
  }

  const limitUsd = parseLimitUsd(readField(request.body.limitUsd));
  const limitReset = parseLimitReset(readField(request.body.limitReset));
  const includeByokInLimit = request.body.includeByokInLimit === 'on';
  const disabled = request.body.disabled === 'on';

  if (limitUsd instanceof Error) {
    response.redirect(
      `/superadmin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(limitUsd.message)}#openrouter-key`,
    );
    return;
  }

  try {
    await updateOpenRouterUserKeyLimit({
      disabled,
      includeByokInLimit,
      limitReset,
      limitUsd,
      userId,
    });

    response.redirect(
      `/superadmin/users/${encodeURIComponent(userId)}?success=${encodeURIComponent('Key actualizada en OpenRouter.')}#openrouter-key`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo actualizar la key en OpenRouter.';
    response.redirect(
      `/superadmin/users/${encodeURIComponent(userId)}?error=${encodeURIComponent(message)}#openrouter-key`,
    );
  }
}

function requireSuperadmin(request: Request, response: Response): boolean {
  if (!request.authUser) {
    response.redirect('/login');
    return false;
  }

  if (
    !env.superadminEmail ||
    normalizeEmail(request.authUser.email) !== env.superadminEmail
  ) {
    response.status(403).send('No tienes permiso para ver esta página.');
    return false;
  }

  return true;
}

function buildViewData(
  request: Request,
  response: Response,
  overrides: Pick<
    SuperadminViewBase,
    'activeUser' | 'keyRecord' | 'mode' | 'openRouterInfo' | 'remoteError'
  >,
): SuperadminViewBase {
  return {
    ...overrides,
    csrfToken: response.locals.csrfToken ?? '',
    error: readQueryString(request.query.error),
    formatDate,
    formatMoney,
    success: readQueryString(request.query.success),
    users: listUsersForSuperadmin(),
  };
}

function readField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readQueryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseLimitUsd(value: string): number | null | Error {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return new Error('El límite debe ser un número mayor o igual a 0.');
  }

  return Math.round(parsed * 10000) / 10000;
}

function parseLimitReset(
  value: string,
): 'daily' | 'weekly' | 'monthly' | null {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
    ? value
    : null;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) {
    return 'sin límite';
  }

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 4,
    style: 'currency',
  }).format(value);
}
