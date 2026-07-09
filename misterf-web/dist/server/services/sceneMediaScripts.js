import { generateText } from 'ai';
import { z } from 'zod';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { logger } from './logger.js';
const scriptGenerationTurns = 2;
const scriptGenerationSchema = z.object({
    script: z.discriminatedUnion('scriptType', [
        z.object({
            scriptType: z.literal('dialogue'),
            turns: z.array(z.object({
                speaker: z.string().trim().min(1).max(40),
                text: z.string().trim().min(1).max(320),
            }).strict()).min(2).max(8),
        }).strict(),
        z.object({
            scriptType: z.union([z.literal('monologue'), z.literal('narration')]),
            text: z.string().trim().min(1).max(1800),
        }).strict(),
    ]),
    setting: z.string().trim().min(1).max(120),
    skills: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    tags: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
    title: z.string().trim().min(1).max(80),
    useCases: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    visualSummary: z.array(z.string().trim().min(1).max(180)).min(1).max(5),
}).strict();
export class SceneMediaScriptContentPolicyError extends Error {
    constructor(message = 'Scene media script prompt was rejected by content policy.') {
        super(message);
        this.name = 'SceneMediaScriptContentPolicyError';
    }
}
export class SceneMediaScriptProviderError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SceneMediaScriptProviderError';
    }
}
export async function generateSceneMediaScriptPackage(input) {
    const system = buildScriptSystemPrompt();
    const messages = [
        {
            content: buildScriptUserPrompt(input),
            role: 'user',
        },
    ];
    for (let turn = 0; turn < scriptGenerationTurns; turn += 1) {
        const result = await generateText({
            maxOutputTokens: 2200,
            messages,
            model: getLanguageModel({
                modelTier: 'regular',
                openRouterApiKey: input.openRouterApiKey,
            }),
            providerOptions: getProviderOptions(),
            system,
            temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.35 : undefined,
        });
        if (isContentPolicyFinish(result.finishReason, result.providerMetadata)) {
            throw new SceneMediaScriptContentPolicyError();
        }
        let parsedJson;
        try {
            parsedJson = parseJsonFromModelText(result.text);
        }
        catch (error) {
            logger.warn('scene_media_script_invalid_json', {
                error: error instanceof Error ? error.message : String(error),
                turn: turn + 1,
            });
            if (turn < scriptGenerationTurns - 1) {
                messages.push({
                    content: result.text.slice(0, 8000),
                    role: 'assistant',
                });
                messages.push({
                    content: 'Return only a valid JSON object matching the requested schema. Do not include markdown.',
                    role: 'user',
                });
                continue;
            }
            throw new SceneMediaScriptProviderError('The script generator returned invalid JSON.');
        }
        const parsed = scriptGenerationSchema.safeParse(parsedJson);
        if (!parsed.success) {
            logger.warn('scene_media_script_validation_failed', {
                issueCount: parsed.error.issues.length,
                turn: turn + 1,
            });
            if (turn < scriptGenerationTurns - 1) {
                messages.push({
                    content: result.text.slice(0, 8000),
                    role: 'assistant',
                });
                messages.push({
                    content: 'The JSON did not match the schema. Fix the shape and constraints, then return only JSON.',
                    role: 'user',
                });
                continue;
            }
            throw new SceneMediaScriptProviderError('The script generator returned an invalid script package.');
        }
        return {
            ...parsed.data,
            script: parsed.data.script,
        };
    }
    throw new SceneMediaScriptProviderError('The script generator did not return a usable script package.');
}
function buildScriptSystemPrompt() {
    return [
        'You generate compact pedagogical scene media metadata and listening scripts for Mister F, an English-learning app.',
        'Return one JSON object only. Do not use markdown, comments, or surrounding prose.',
        'The script must be in English and suitable for the requested learner level.',
        'If dialogue is requested, use at most three speakers. If the user asks for more, merge or simplify roles.',
        'Script and audio are an atomic layer: produce a script that can be directly synthesized into listening audio.',
        'Keep the content classroom-safe, culturally neutral, and useful for English practice.',
        'Do not include copyrighted characters, brand names, explicit content, hateful content, graphic violence, or unsafe instructions.',
    ].join('\n');
}
function buildScriptUserPrompt(input) {
    const levelGuidance = {
        'A1-A2': 'Use simple present/past, short turns, familiar vocabulary, and target about 20-45 seconds of audio.',
        'B1-B2': 'Use natural everyday speech, moderate sentence variety, and target about 35-75 seconds of audio.',
        C1: 'Use more nuanced language, idioms only when clear from context, and target about 60-120 seconds of audio.',
    };
    const formatGuidance = {
        four_panel_wordless_story: 'The media image is a four-panel wordless story. The script should follow the panel sequence clearly.',
        single_panel_scene: 'The media image is a single scene. The script should describe or dramatize the central action.',
        two_panel_contrast: 'The media image is a two-panel contrast. The script should make the contrast easy to understand.',
    };
    const preferredType = input.scriptTypePreference === 'unspecified'
        ? 'Choose the best script type: dialogue, narration, or monologue.'
        : `Use scriptType "${input.scriptTypePreference}".`;
    return [
        `User prompt: ${input.prompt}`,
        `Level: ${input.level}. ${levelGuidance[input.level]}`,
        `Visual format: ${input.format}. ${formatGuidance[input.format]}`,
        preferredType,
        input.imageAlt ? `Generated image alt text: ${input.imageAlt}` : '',
        input.sourceVisualSummary?.length
            ? `Source visual summary: ${input.sourceVisualSummary.join(' | ')}`
            : '',
        '',
        'Return JSON in this exact shape:',
        '{',
        '  "title": "short title",',
        '  "setting": "where this happens",',
        '  "visualSummary": ["1-5 short visual facts"],',
        '  "tags": ["search tag"],',
        '  "skills": ["English skill practiced"],',
        '  "useCases": ["listening", "speaking", "writing prompt"],',
        '  "script": { "scriptType": "dialogue", "turns": [{ "speaker": "Name", "text": "Line" }] }',
        '}',
        '',
        'For narration or monologue, script must be { "scriptType": "narration" | "monologue", "text": "..." }.',
    ].filter(Boolean).join('\n');
}
function isContentPolicyFinish(finishReason, providerMetadata) {
    const metadata = JSON.stringify(providerMetadata ?? {}).toLowerCase();
    return (finishReason === 'content-filter' ||
        metadata.includes('policy') ||
        metadata.includes('safety') ||
        metadata.includes('moderation'));
}
//# sourceMappingURL=sceneMediaScripts.js.map