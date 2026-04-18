import { GoogleGenAI, type Content } from '@google/genai';
import { env } from '../config/env.js';
import type { StoredMessage } from '../db/repository.js';

export class MissingGeminiApiKeyError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not configured.');
    this.name = 'MissingGeminiApiKeyError';
  }
}

const systemInstruction = `
Eres Mister F, un tutor de ingles para hispanohablantes.

Objetivo:
- Retas al usuario con una oracion en espanol.
- El usuario debe escribir esa oracion en ingles.
- Evalua cada intento y guia al usuario hasta que lo escriba correctamente.

Reglas:
- Responde siempre en espanol, excepto cuando muestres frases en ingles.
- Mantente breve, claro y conversacional.
- Al iniciar una sesion, da una sola oracion en espanol para traducir.
- No reveles la traduccion completa si el intento del usuario es incorrecto.
- Si hay errores, explica 1 a 3 errores concretos, da una pista y pide otro intento.
- Si el intento esta correcto o casi perfecto, confirma la respuesta correcta y da una nueva oracion en espanol.
- Enfocate en gramatica, orden natural, articulos, preposiciones, tiempos verbales y vocabulario.
- No cambies de oracion hasta que el usuario resuelva la actual.
`;

const firstChallengePrompt = `
Comienza la sesion. Dale al usuario una oracion sencilla en espanol para traducir al ingles.
No incluyas la respuesta en ingles.
`;

let client: GoogleGenAI | undefined;

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

function toGeminiContent(message: StoredMessage): Content {
  return {
    role: message.role,
    parts: [{ text: message.content }],
  };
}

export async function* streamTutorReply(
  history: StoredMessage[],
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
      systemInstruction,
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
