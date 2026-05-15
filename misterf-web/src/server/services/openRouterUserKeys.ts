import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { getDb } from '../db/database.js';
import { findUserById } from '../auth/repository.js';

type UserOpenRouterKeyRow = {
  encrypted_api_key: string | null;
  last_error: string | null;
  key_hash: string | null;
  limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  limit_usd: number | null;
  name: string;
  status: 'active' | 'disabled' | 'error' | 'pending';
  updated_at: string;
  created_at: string;
  user_id: string;
};

export type OpenRouterUserKeyRecord = {
  createdAt: string;
  keyHash: string | null;
  lastError: string | null;
  limitReset: 'daily' | 'weekly' | 'monthly' | null;
  limitUsd: number | null;
  name: string;
  status: 'active' | 'disabled' | 'error' | 'pending';
  updatedAt: string;
  userId: string;
};

export type OpenRouterRemoteKeyInfo = {
  byokUsage?: number;
  byokUsageDaily?: number;
  byokUsageMonthly?: number;
  byokUsageWeekly?: number;
  createdAt?: string;
  disabled?: boolean;
  hash?: string;
  includeByokInLimit?: boolean;
  label?: string;
  limit?: number | null;
  limitRemaining?: number | null;
  limitReset?: 'daily' | 'weekly' | 'monthly' | null;
  name?: string;
  updatedAt?: string;
  usage?: number;
  usageDaily?: number;
  usageMonthly?: number;
  usageWeekly?: number;
};

type OpenRouterCreateKeyResponse = {
  data?: {
    hash?: unknown;
    name?: unknown;
  };
  error?: unknown;
  key?: unknown;
  message?: unknown;
};

type OpenRouterKeyInfoResponse = {
  data?: Record<string, unknown>;
  error?: unknown;
  message?: unknown;
};

export class OpenRouterKeyProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterKeyProvisioningError';
  }
}

export async function ensureOpenRouterKeyForUser(userId: string): Promise<void> {
  const existing = findUserOpenRouterKeyRow(userId);
  if (existing?.status === 'active' && existing.encrypted_api_key) {
    return;
  }

  await provisionOpenRouterKeyForUser(userId);
}

export async function getOpenRouterApiKeyForUser(
  userId: string,
): Promise<string | null> {
  await ensureOpenRouterKeyForUser(userId);
  const row = findUserOpenRouterKeyRow(userId);
  if (!row?.encrypted_api_key || row.status !== 'active') {
    return null;
  }

  return decryptApiKey(row.encrypted_api_key);
}

export function getOpenRouterKeyRecordForUser(
  userId: string,
): OpenRouterUserKeyRecord | null {
  const row = findUserOpenRouterKeyRow(userId);
  return row ? toOpenRouterUserKeyRecord(row) : null;
}

export async function getOpenRouterRemoteKeyInfoForUser(
  userId: string,
): Promise<OpenRouterRemoteKeyInfo | null> {
  const row = findUserOpenRouterKeyRow(userId);
  if (!row?.key_hash) {
    return null;
  }

  return getOpenRouterRemoteKeyInfo(row.key_hash);
}

export async function updateOpenRouterUserKeyLimit(input: {
  disabled: boolean;
  includeByokInLimit: boolean;
  limitReset: 'daily' | 'weekly' | 'monthly' | null;
  limitUsd: number | null;
  userId: string;
}): Promise<OpenRouterRemoteKeyInfo> {
  const row = findUserOpenRouterKeyRow(input.userId);
  if (!row?.key_hash) {
    throw new OpenRouterKeyProvisioningError(
      'Este usuario todavía no tiene una key de OpenRouter administrable.',
    );
  }

  const remoteInfo = await patchOpenRouterRemoteKey(row.key_hash, {
    disabled: input.disabled,
    include_byok_in_limit: input.includeByokInLimit,
    limit: input.limitUsd,
    limit_reset: input.limitReset,
  });

  getDb()
    .prepare(
      `
        UPDATE user_openrouter_keys
        SET
          limit_usd = ?,
          limit_reset = ?,
          status = ?,
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `,
    )
    .run(
      remoteInfo.limit ?? input.limitUsd,
      remoteInfo.limitReset ?? input.limitReset,
      remoteInfo.disabled ? 'disabled' : 'active',
      input.userId,
    );

  return remoteInfo;
}

async function provisionOpenRouterKeyForUser(userId: string): Promise<void> {
  if (!env.openrouterManagementApiKey) {
    markOpenRouterKeyError(
      userId,
      'Missing OPENROUTER_MANAGEMENT_API_KEY for user key provisioning.',
    );
    throw new OpenRouterKeyProvisioningError(
      'Falta configurar OPENROUTER_MANAGEMENT_API_KEY para crear keys por usuario.',
    );
  }

  if (!env.openrouterKeyEncryptionSecret) {
    markOpenRouterKeyError(
      userId,
      'Missing OPENROUTER_KEY_ENCRYPTION_SECRET for user key storage.',
    );
    throw new OpenRouterKeyProvisioningError(
      'Falta configurar OPENROUTER_KEY_ENCRYPTION_SECRET para guardar keys de OpenRouter.',
    );
  }

  const name = buildOpenRouterKeyName(userId);
  markOpenRouterKeyPending(userId, name);

  try {
    const result = await createOpenRouterApiKey(name);
    saveOpenRouterUserKey({
      apiKey: result.apiKey,
      keyHash: result.keyHash,
      name,
      userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown OpenRouter key error.';
    markOpenRouterKeyError(userId, message);
    throw error;
  }
}

async function createOpenRouterApiKey(name: string): Promise<{
  apiKey: string;
  keyHash: string;
}> {
  const body: Record<string, unknown> = {
    include_byok_in_limit: env.openrouterUserKeyIncludeByokInLimit,
    limit: env.openrouterUserKeyLimitUsd,
    limit_reset: null,
    name,
  };

  const response = await fetch(`${env.openrouterBaseUrl}/keys`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${env.openrouterManagementApiKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const json = (await response.json().catch(() => ({}))) as OpenRouterCreateKeyResponse;
  if (!response.ok || typeof json.key !== 'string') {
    const message =
      typeof json.message === 'string'
        ? json.message
        : typeof json.error === 'string'
          ? json.error
          : `OpenRouter key creation failed with HTTP ${response.status}.`;
    throw new OpenRouterKeyProvisioningError(message);
  }

  const keyHash =
    typeof json.data?.hash === 'string'
      ? json.data.hash
      : createHash('sha256').update(json.key).digest('hex');

  return {
    apiKey: json.key,
    keyHash,
  };
}

function findUserOpenRouterKeyRow(userId: string): UserOpenRouterKeyRow | null {
  const row = getDb()
    .prepare(
      `
        SELECT
          user_id,
          key_hash,
          encrypted_api_key,
          name,
          limit_usd,
          limit_reset,
          status,
          last_error,
          created_at,
          updated_at
        FROM user_openrouter_keys
        WHERE user_id = ?
      `,
    )
    .get(userId) as UserOpenRouterKeyRow | undefined;

  return row ?? null;
}

async function getOpenRouterRemoteKeyInfo(
  keyHash: string,
): Promise<OpenRouterRemoteKeyInfo> {
  const response = await fetch(
    `${env.openrouterBaseUrl}/keys/${encodeURIComponent(keyHash)}`,
    {
      headers: {
        authorization: `Bearer ${env.openrouterManagementApiKey}`,
      },
      method: 'GET',
    },
  );

  const json = (await response.json().catch(() => ({}))) as OpenRouterKeyInfoResponse;
  if (!response.ok || !json.data) {
    throw new OpenRouterKeyProvisioningError(
      parseOpenRouterMessage(json, response.status),
    );
  }

  return toOpenRouterRemoteKeyInfo(json.data);
}

async function patchOpenRouterRemoteKey(
  keyHash: string,
  body: {
    disabled: boolean;
    include_byok_in_limit: boolean;
    limit: number | null;
    limit_reset: 'daily' | 'weekly' | 'monthly' | null;
  },
): Promise<OpenRouterRemoteKeyInfo> {
  const response = await fetch(
    `${env.openrouterBaseUrl}/keys/${encodeURIComponent(keyHash)}`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${env.openrouterManagementApiKey}`,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  const json = (await response.json().catch(() => ({}))) as OpenRouterKeyInfoResponse;
  if (!response.ok || !json.data) {
    throw new OpenRouterKeyProvisioningError(
      parseOpenRouterMessage(json, response.status),
    );
  }

  return toOpenRouterRemoteKeyInfo(json.data);
}

function toOpenRouterUserKeyRecord(
  row: UserOpenRouterKeyRow,
): OpenRouterUserKeyRecord {
  return {
    createdAt: row.created_at,
    keyHash: row.key_hash,
    lastError: row.last_error,
    limitReset: row.limit_reset,
    limitUsd: row.limit_usd,
    name: row.name,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function toOpenRouterRemoteKeyInfo(
  data: Record<string, unknown>,
): OpenRouterRemoteKeyInfo {
  return {
    byokUsage: readNumberValue(data.byok_usage),
    byokUsageDaily: readNumberValue(data.byok_usage_daily),
    byokUsageMonthly: readNumberValue(data.byok_usage_monthly),
    byokUsageWeekly: readNumberValue(data.byok_usage_weekly),
    createdAt: readStringValue(data.created_at),
    disabled: readBooleanValue(data.disabled),
    hash: readStringValue(data.hash),
    includeByokInLimit: readBooleanValue(data.include_byok_in_limit),
    label: readStringValue(data.label),
    limit: readNullableNumberValue(data.limit),
    limitRemaining: readNullableNumberValue(data.limit_remaining),
    limitReset: readLimitResetValue(data.limit_reset),
    name: readStringValue(data.name),
    updatedAt: readStringValue(data.updated_at),
    usage: readNumberValue(data.usage),
    usageDaily: readNumberValue(data.usage_daily),
    usageMonthly: readNumberValue(data.usage_monthly),
    usageWeekly: readNumberValue(data.usage_weekly),
  };
}

function parseOpenRouterMessage(
  json: OpenRouterKeyInfoResponse,
  status: number,
): string {
  if (typeof json.message === 'string') {
    return json.message;
  }

  if (typeof json.error === 'string') {
    return json.error;
  }

  if (
    json.error &&
    typeof json.error === 'object' &&
    'message' in json.error &&
    typeof json.error.message === 'string'
  ) {
    return json.error.message;
  }

  return `OpenRouter request failed with HTTP ${status}.`;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readNullableNumberValue(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }

  return readNumberValue(value);
}

function readLimitResetValue(
  value: unknown,
): 'daily' | 'weekly' | 'monthly' | null | undefined {
  if (value === null) {
    return null;
  }

  return value === 'daily' || value === 'weekly' || value === 'monthly'
    ? value
    : undefined;
}

function markOpenRouterKeyPending(userId: string, name: string): void {
  getDb()
    .prepare(
      `
        INSERT INTO user_openrouter_keys (user_id, name, status, limit_usd, limit_reset)
        VALUES (?, ?, 'pending', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          status = 'pending',
          last_error = NULL,
          limit_usd = excluded.limit_usd,
          limit_reset = excluded.limit_reset,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(
      userId,
      name,
      env.openrouterUserKeyLimitUsd,
      null,
    );
}

function saveOpenRouterUserKey(input: {
  apiKey: string;
  keyHash: string;
  name: string;
  userId: string;
}): void {
  getDb()
    .prepare(
      `
        INSERT INTO user_openrouter_keys (
          user_id,
          key_hash,
          encrypted_api_key,
          name,
          limit_usd,
          limit_reset,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'active')
        ON CONFLICT(user_id) DO UPDATE SET
          key_hash = excluded.key_hash,
          encrypted_api_key = excluded.encrypted_api_key,
          name = excluded.name,
          limit_usd = excluded.limit_usd,
          limit_reset = excluded.limit_reset,
          status = 'active',
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(
      input.userId,
      input.keyHash,
      encryptApiKey(input.apiKey),
      input.name,
      env.openrouterUserKeyLimitUsd,
      null,
    );
}

function markOpenRouterKeyError(userId: string, message: string): void {
  getDb()
    .prepare(
      `
        INSERT INTO user_openrouter_keys (user_id, name, status, last_error)
        VALUES (?, ?, 'error', ?)
        ON CONFLICT(user_id) DO UPDATE SET
          status = 'error',
          last_error = excluded.last_error,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run(userId, buildOpenRouterKeyName(userId), message.slice(0, 1000));
}

function buildOpenRouterKeyName(userId: string): string {
  const user = findUserById(userId);
  const emailPart = user ? sanitizeKeyNamePart(user.email, 80) : 'unknown-email';
  return `misterf:${emailPart}:${userId}`;
}

function sanitizeKeyNamePart(value: string, maxLength: number): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}

function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptApiKey(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new OpenRouterKeyProvisioningError('Stored OpenRouter key is invalid.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function getEncryptionKey(): Buffer {
  return createHash('sha256')
    .update(env.openrouterKeyEncryptionSecret)
    .digest();
}
