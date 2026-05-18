import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
const promptCache = new Map();
export function loadSystemPrompt(relativePath) {
    const cached = promptCache.get(relativePath);
    if (cached) {
        return cached;
    }
    const absolutePath = path.join(env.projectRoot, 'system-prompts', relativePath);
    const prompt = fs.readFileSync(absolutePath, 'utf8');
    promptCache.set(relativePath, prompt);
    return prompt;
}
export function renderSystemPrompt(relativePath, placeholders = {}) {
    let prompt = loadSystemPrompt(relativePath);
    for (const [key, value] of Object.entries(placeholders)) {
        prompt = prompt.replaceAll(`{{${key}}}`, value);
    }
    return prompt;
}
//# sourceMappingURL=systemPrompts.js.map