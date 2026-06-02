import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configDir, '../../..');
const envFileName =
  process.env.ENV_FILE ??
  (process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development');

loadDotenv({
  path: path.join(projectRoot, envFileName),
  override: true,
});

function readInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readNumber(name: string, fallback: number | null): number | null {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(rawValue.toLowerCase());
}

function resolveProjectPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export const env = {
  projectRoot,
  host:
    process.env.HOST ??
    (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
  port: readInteger('PORT', 3000),
  databasePath: resolveProjectPath(
    process.env.DATABASE_PATH ?? './data/misterf.sqlite',
  ),
  llmProvider: 'openrouter',
  llmRegularModel:
    process.env.LLM_MODEL_REGULAR ??
    process.env.LLM_MODEL ??
    'openai/gpt-5-mini',
  llmAdvancedModel:
    process.env.LLM_MODEL_ADVANCED ??
    process.env.LLM_MODEL_REGULAR ??
    process.env.LLM_MODEL ??
    'openai/gpt-5',
  llmMaxModel:
    process.env.LLM_MODEL_MAX ??
    process.env.LLM_MODEL_ADVANCED ??
    process.env.LLM_MODEL_REGULAR ??
    process.env.LLM_MODEL ??
    'openai/gpt-5',
  llmContextWindow: readInteger('LLM_CONTEXT_WINDOW', 128000),
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  openrouterKeyEncryptionSecret:
    process.env.OPENROUTER_KEY_ENCRYPTION_SECRET ??
    process.env.APP_SESSION_SECRET ??
    '',
  openrouterManagementApiKey:
    process.env.OPENROUTER_MANAGEMENT_API_KEY ?? '',
  openrouterReasoningEffort:
    process.env.OPENROUTER_REASONING_EFFORT ?? 'medium',
  openrouterUserKeyLimitUsd: readNumber('OPENROUTER_USER_KEY_LIMIT_USD', null),
  openrouterUserKeyLimitReset:
    process.env.OPENROUTER_USER_KEY_LIMIT_RESET || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${readInteger('PORT', 3000)}`,
  sessionSecret: process.env.APP_SESSION_SECRET ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: readInteger('SMTP_PORT', 587),
  smtpSecure: readBoolean('SMTP_SECURE', false),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword:
    process.env.SMTP_PASSWORD ??
    process.env.RESEND_SMTP_API_KEY ??
    '',
  mailFrom: process.env.MAIL_FROM ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  superadminEmail: (process.env.SUPERADMIN_EMAIL ?? '').trim().toLowerCase(),
};
