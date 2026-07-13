import { generateText } from 'ai';
import { z } from 'zod';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';
import { buildSceneMediaSourceContextPrompt, } from '../sceneMedia/generationContext.js';
const scriptGenerationTurns = 2;
const sceneMediaScriptSchema = z.discriminatedUnion('scriptType', [
    z.object({
        identityStrategy: z.union([
            z.literal('named_in_dialogue'),
            z.literal('role_only'),
        ]),
        scriptType: z.literal('dialogue'),
        speakers: z.array(z.object({
            gender: z.enum(['female', 'male', 'neutral']),
            name: z.string().trim().min(1).max(40),
            nameSpokenInAudio: z.boolean(),
            role: z.string().trim().min(1).max(60),
        }).strict()).min(2).max(3),
        turns: z.array(z.object({
            speaker: z.string().trim().min(1).max(40),
            text: z.string().trim().min(1).max(320),
        }).strict()).min(2).max(8),
    }).strict(),
    z.object({
        // Required on fresh model output (a monologue's speaker gender; 'neutral'
        // for narration). The runtime SceneMediaScript type keeps it optional for
        // items authored before the field existed.
        gender: z.enum(['female', 'male', 'neutral']),
        identityStrategy: z.union([
            z.literal('named_in_narration'),
            z.literal('role_only'),
        ]),
        scriptType: z.union([z.literal('monologue'), z.literal('narration')]),
        text: z.string().trim().min(1).max(1800),
    }).strict(),
]);
const sceneMediaMetadataSchema = z.object({
    setting: z.string().trim().min(1).max(120),
    skills: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    tags: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
    title: z.string().trim().min(1).max(80),
    useCases: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    visualSummary: z.array(z.string().trim().min(1).max(180)).min(1).max(5),
}).strict();
const scriptGenerationSchema = sceneMediaMetadataSchema.extend({
    script: sceneMediaScriptSchema,
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
function summarizeScriptValidationIssues(error) {
    return error.issues.slice(0, 12).map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.map((segment) => String(segment)).join('.') || '(root)',
    }));
}
export async function generateSceneMediaScriptPackage(input) {
    const result = await generateSceneMediaPackage(input, true, scriptGenerationSchema, (data) => findScriptContentIssues(data.script));
    return {
        ...result,
        script: result.script,
    };
}
export async function generateSceneMediaMetadataPackage(input) {
    return generateSceneMediaPackage(input, false, sceneMediaMetadataSchema);
}
// Spoken text must not describe the medium or the exercise (mirrors the built-in
// `validate_no_description_phrases` guard). Case-insensitive substring / panel
// checks against the text a learner actually hears.
const descriptionPhrases = [
    'this image',
    'this picture',
    'the image shows',
    'the image presents',
    'the picture shows',
    'this scene shows',
    'the scene shows',
    'the two panels',
    'this wordless story',
    'the story shows',
    'this is a short story about',
    'the contrast in',
    'the listener can',
    'the learner can',
];
const panelReferencePattern = /\bpanel\s+(\d+|one|two|three|four)\b/i;
function findScriptContentIssues(script) {
    const spokenText = script.scriptType === 'dialogue'
        ? script.turns.map((turn) => turn.text).join('\n')
        : script.text;
    const lower = spokenText.toLowerCase();
    const issues = [];
    const hit = descriptionPhrases.find((phrase) => lower.includes(phrase));
    if (hit) {
        issues.push({
            code: 'description_phrase',
            message: `Spoken text must not describe the image or exercise. Remove phrasing like "${hit}".`,
            path: 'script',
        });
    }
    if (panelReferencePattern.test(spokenText)) {
        issues.push({
            code: 'panel_reference',
            message: 'Spoken text must not reference panel numbers.',
            path: 'script',
        });
    }
    return issues;
}
async function generateSceneMediaPackage(input, includeScript, schema, extraValidation) {
    const system = buildSceneMediaScriptSystemPrompt();
    const messages = [
        {
            content: input.imageBytes
                ? [
                    { type: 'text', text: buildSceneMediaScriptUserPrompt(input, includeScript) },
                    {
                        image: input.imageBytes,
                        mediaType: input.imageContentType ?? 'image/webp',
                        type: 'image',
                    },
                ]
                : buildSceneMediaScriptUserPrompt(input, includeScript),
            role: 'user',
        },
    ];
    for (let turn = 0; turn < scriptGenerationTurns; turn += 1) {
        const result = await generateText({
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
        const parsed = schema.safeParse(parsedJson);
        if (!parsed.success) {
            const issues = summarizeScriptValidationIssues(parsed.error);
            logger.warn('scene_media_script_validation_failed', {
                issueCount: parsed.error.issues.length,
                issues,
                turn: turn + 1,
            });
            if (turn < scriptGenerationTurns - 1) {
                messages.push({
                    content: result.text.slice(0, 8000),
                    role: 'assistant',
                });
                messages.push({
                    content: 'The JSON did not match the schema. Fix these validation issues, then return only JSON:\n'
                        + JSON.stringify(issues, null, 2),
                    role: 'user',
                });
                continue;
            }
            throw new SceneMediaScriptProviderError('The script generator returned an invalid script package.');
        }
        const contentIssues = extraValidation ? extraValidation(parsed.data) : [];
        if (contentIssues.length > 0) {
            logger.warn('scene_media_script_content_rejected', {
                issueCount: contentIssues.length,
                issues: contentIssues,
                turn: turn + 1,
            });
            if (turn < scriptGenerationTurns - 1) {
                messages.push({
                    content: result.text.slice(0, 8000),
                    role: 'assistant',
                });
                messages.push({
                    content: 'The script broke content rules. Fix these issues, then return only JSON:\n'
                        + JSON.stringify(contentIssues, null, 2),
                    role: 'user',
                });
                continue;
            }
            throw new SceneMediaScriptProviderError('The script generator returned a script that broke content rules.');
        }
        return parsed.data;
    }
    throw new SceneMediaScriptProviderError('The script generator did not return a usable script package.');
}
export function buildSceneMediaScriptSystemPrompt() {
    // Editable template (no placeholders); the per-request user prompt below
    // carries the dynamic level/format/context. Mirrors the scene-media revision
    // loop, which also loads its system prompt from system-prompts/.
    return renderSystemPrompt('scene-media/generation.md').trimEnd();
}
export function buildSceneMediaScriptUserPrompt(input, includeScript = true) {
    // Level is defined by linguistic complexity, not word count. Ranges are soft
    // targets calibrated for listening (higher load than reading), so passages run
    // shorter than a reading text at the same CEFR band. See script-levels.md.
    const levelGuidance = {
        'A1-A2': 'Around 30-60 words. Mostly present simple/continuous, simple past, and common modals. Concrete nouns, visible actions, emotions, times, and places. Short turns. Avoid idioms, long clauses, and abstract explanation.',
        'B1-B2': 'Around 55-90 words. Add reasons, reactions, plans, and mild negotiation. Use connectors such as because, although, after, before, so, and while. Natural but clean speech; keep the situation easy to infer from the image.',
        C1: 'Around 75-130 words. Add nuance, implied meaning, repair strategies, richer verbs, embedded clauses, and varied rhythm. Keep it grounded in the image; do not invent unrelated backstory. Avoid slang that reduces international reuse.',
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
        includeScript ? preferredType : 'Do not include a script field.',
        input.imageAlt ? `Generated image alt text: ${input.imageAlt}` : '',
        input.sourceContext ? buildSceneMediaSourceContextPrompt(input.sourceContext) : '',
        '',
        // The `Response`/`Script` type is defined and documented in the system
        // prompt (system-prompts/scene-media/generation.md), so it is not repeated
        // here.
        includeScript
            ? 'Return one JSON object matching the Response type, including the script field.'
            : 'Return one JSON object matching the Response type, with metadata only (omit the script field).',
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