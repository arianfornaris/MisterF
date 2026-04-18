import { GoogleGenAI, type Content } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export type TutorMessage = {
  role: 'user' | 'model';
  content: string;
};

export class MissingGeminiApiKeyError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not configured.');
    this.name = 'MissingGeminiApiKeyError';
  }
}

const firstChallengePrompt = `
Comienza la sesion.
`;

let client: GoogleGenAI | undefined;
let systemInstruction: string | undefined;

function getClient(): GoogleGenAI {
  if (
    !env.geminiApiKey ||
    env.geminiApiKey === 'replace_with_your_gemini_api_key'
  ) {
    throw new MissingGeminiApiKeyError();
  }

  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

function toGeminiContent(message: TutorMessage): Content {
  return {
    role: message.role,
    parts: [{ text: message.content }],
  };
}

function getSystemInstruction(): string {
  systemInstruction ??= fs.readFileSync(
    path.join(env.projectRoot, 'gameplays/gameplay-1.md'),
    'utf8',
  );

  return systemInstruction;
}

export async function* streamTutorReply(
  history: TutorMessage[],
  options: { startConversation?: boolean } = {},
): AsyncGenerator<string> {
  const ai = getClient();
  const contents = history.map(toGeminiContent);

  if (options.startConversation || contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: firstChallengePrompt }],
    });
  }

  const stream = await ai.models.generateContentStream({
    model: env.geminiModel,
    contents,
    config: {
      systemInstruction: getSystemInstruction(),
      temperature: 0.45,
      maxOutputTokens: 700,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}
