import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

const promptCache = new Map<string, string>();

export function loadSystemPrompt(relativePath: string): string {
  const cached = promptCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const absolutePath = path.join(env.projectRoot, 'system-prompts', relativePath);
  const prompt = fs.readFileSync(absolutePath, 'utf8');
  promptCache.set(relativePath, prompt);
  return prompt;
}

export function renderSystemPrompt(
  relativePath: string,
  placeholders: Record<string, string> = {},
): string {
  let prompt = loadSystemPrompt(relativePath);

  for (const [key, value] of Object.entries(placeholders)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  return prompt;
}
