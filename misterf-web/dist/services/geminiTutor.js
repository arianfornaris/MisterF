import { FinishReason, FunctionCallingConfigMode, GoogleGenAI, createPartFromFunctionResponse, } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
export class MissingGeminiApiKeyError extends Error {
    constructor() {
        super('GEMINI_API_KEY is not configured.');
        this.name = 'MissingGeminiApiKeyError';
    }
}
export class GeminiFinishReasonError extends Error {
    finishReason;
    constructor(finishReason, message) {
        super(message);
        this.finishReason = finishReason;
        this.name = 'GeminiFinishReasonError';
    }
}
const firstChallengePrompt = `
Comienza la sesion.
`;
let client;
let systemInstruction;
function getClient() {
    if (!env.geminiApiKey ||
        env.geminiApiKey === 'replace_with_your_gemini_api_key') {
        throw new MissingGeminiApiKeyError();
    }
    client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
    return client;
}
function toGeminiContent(message) {
    return {
        role: message.role,
        parts: [{ text: message.content }],
    };
}
function getSystemInstruction() {
    systemInstruction ??= fs.readFileSync(path.join(env.projectRoot, 'gameplays/gameplay-1.md'), 'utf8');
    return systemInstruction;
}
export async function runTutorAgentLoop(history, options) {
    const ai = getClient();
    const contents = history.map(toGeminiContent);
    const toolCalls = [];
    if (options.startConversation || contents.length === 0) {
        contents.push({
            role: 'user',
            parts: [{ text: firstChallengePrompt }],
        });
    }
    for (let turn = 0; turn < 6; turn += 1) {
        const response = await ai.models.generateContent({
            model: env.geminiModel,
            contents,
            config: {
                systemInstruction: buildAgentSystemInstruction(options),
                temperature: 0.45,
                maxOutputTokens: 900,
                thinkingConfig: {
                    includeThoughts: false,
                    thinkingBudget: env.geminiThinkingBudget,
                },
                tools: [
                    {
                        functionDeclarations: options.toolDeclarations,
                    },
                ],
                toolConfig: {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.AUTO,
                    },
                },
            },
        });
        const finishReason = response.candidates?.[0]?.finishReason;
        const userFacingFinishMessage = getUserFacingFinishReasonMessage(finishReason);
        if (userFacingFinishMessage && finishReason) {
            throw new GeminiFinishReasonError(finishReason, userFacingFinishMessage);
        }
        const functionCalls = response.functionCalls ?? [];
        if (functionCalls.length === 0) {
            const content = response.text?.trim() ?? '';
            return { content, toolCalls };
        }
        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
            contents.push(modelContent);
        }
        const functionResponseParts = [];
        for (const [index, functionCall] of functionCalls.entries()) {
            const toolCall = toTutorToolCall(functionCall, index);
            toolCalls.push({ args: toolCall.args, name: toolCall.name });
            const toolResponse = await options.executeTool(toolCall);
            functionResponseParts.push(createPartFromFunctionResponse(toolCall.id, toolCall.name, toolResponse));
        }
        contents.push({
            role: 'user',
            parts: functionResponseParts,
        });
    }
    return {
        content: '',
        toolCalls,
    };
}
function getUserFacingFinishReasonMessage(finishReason) {
    switch (finishReason) {
        case FinishReason.MAX_TOKENS:
            return 'La respuesta de Gemini se cortó porque alcanzó el límite máximo de tokens. Intenta enviar un mensaje más corto o vuelve a pedirlo en partes.';
        case FinishReason.SAFETY:
            return 'Gemini detuvo la respuesta por sus filtros de seguridad. Prueba reformulando tu mensaje con un contexto más claro y neutral.';
        case FinishReason.RECITATION:
            return 'Gemini detuvo la respuesta porque detectó una posible recitación de contenido protegido. Intenta pedir una explicación o una versión original en vez de una reproducción exacta.';
        default:
            return null;
    }
}
function buildAgentSystemInstruction(options) {
    return [
        getSystemInstruction(),
        '',
        '## Estado interno actual',
        '',
        `Título actual: ${options.currentTitle || 'Nueva conversación'}`,
        options.titleUpdatedByUser
            ? 'El usuario ya cambió este título manualmente. No llames update_conversation_title.'
            : 'Puedes llamar update_conversation_title si el tema o propósito ya está claro y el título actual es genérico.',
        '',
        'Progreso actual:',
        options.currentProgressMarkdown || '(todavía no hay progreso guardado)',
        '',
        '## Uso de tools',
        '',
        '- Evalúa la ortografía inglesa con rigor. Si el usuario escribe una palabra mal, como "cal" en vez de "call", el intento no debe considerarse correcto.',
        '- Puedes llamar update_learning_progress cuando haya información útil nueva sobre tema, nivel, resumen, errores frecuentes o vocabulario.',
        '- Debes llamar update_sentence_evaluation cada vez que estés corrigiendo o evaluando un intento de traducción del usuario.',
        '- Puedes llamar update_conversation_title cuando el título actual sea genérico y ya exista suficiente contexto.',
        '- Después de llamar tools, continúa con tu respuesta normal al usuario.',
        '- No menciones al usuario que llamaste tools.',
    ].join('\n');
}
function toTutorToolCall(functionCall, index) {
    const name = functionCall.name ?? 'unknown_tool';
    return {
        args: functionCall.args ?? {},
        id: functionCall.id ?? `${name}-${index}`,
        name,
    };
}
//# sourceMappingURL=geminiTutor.js.map