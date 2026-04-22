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
  llmProvider: (process.env.LLM_PROVIDER ?? 'google').toLowerCase(),
  llmModel:
    process.env.LLM_MODEL ??
    process.env.GEMINI_MODEL ??
    'gemini-2.5-flash',
  llmContextWindow: readInteger('LLM_CONTEXT_WINDOW', 128000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiReasoningEffort: process.env.OPENAI_REASONING_EFFORT ?? 'medium',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
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
