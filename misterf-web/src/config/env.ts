import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configDir, '../..');

function readInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
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
  port: readInteger('PORT', 3000),
  databasePath: resolveProjectPath(
    process.env.DATABASE_PATH ?? './data/misterf.sqlite',
  ),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  geminiThinkingBudget: readInteger('GEMINI_THINKING_BUDGET', -1),
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${readInteger('PORT', 3000)}`,
  sessionSecret: process.env.APP_SESSION_SECRET ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: readInteger('SMTP_PORT', 587),
  smtpSecure: readBoolean('SMTP_SECURE', false),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  mailFrom: process.env.MAIL_FROM ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
};
