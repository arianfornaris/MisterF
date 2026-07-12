import { generateText } from 'ai';
import { z } from 'zod';
import { instructionLanguageEnglishName } from './llmTutor/languagePack.js';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { renderSystemPrompt } from './systemPrompts.js';
const sceneMediaRevisionSchema = z.object({
    assistantMessage: z.string().trim().min(1).max(2000),
    effectivePrompt: z.string().trim().min(3).max(4000),
    format: z.enum([
        'four_panel_wordless_story',
        'single_panel_scene',
        'two_panel_contrast',
    ]),
    imageDecision: z.enum(['keep_existing', 'generate_new']),
    level: z.enum(['A1-A2', 'B1-B2', 'C1']),
    scriptAndAudioDecision: z.enum([
        'keep_existing',
        'generate_new',
        'do_not_include',
    ]),
    scriptTypePreference: z.enum([
        'unspecified',
        'dialogue',
        'narration',
        'monologue',
    ]),
}).strict();
export async function generateSceneMediaRevisionPlan(input) {
    const system = renderSystemPrompt('scene-media/revision.md', {
        INSTRUCTION_LANGUAGE_NAME: instructionLanguageEnglishName(input.instructionLanguage ?? 'es'),
    });
    const messages = [{
            content: [
                {
                    text: JSON.stringify({
                        conversationHistory: input.conversationHistory.slice(-24).map((message) => ({
                            content: message.content,
                            createdAt: message.createdAt,
                            role: message.role,
                        })),
                        currentMedia: serializeCurrentMedia(input.currentMedia),
                        requestedChange: input.prompt,
                    }, null, 2),
                    type: 'text',
                },
                {
                    image: input.imageBytes,
                    mediaType: input.imageContentType,
                    type: 'image',
                },
            ],
            role: 'user',
        }];
    for (let turn = 0; turn < 2; turn += 1) {
        const result = await generateText({
            messages,
            model: getLanguageModel({
                modelTier: 'regular',
                openRouterApiKey: input.openRouterApiKey,
            }),
            providerOptions: getProviderOptions(),
            system,
            temperature: shouldUseTemperature({ modelTier: 'regular' }) ? 0.25 : undefined,
        });
        try {
            const parsed = sceneMediaRevisionSchema.safeParse(parseJsonFromModelText(result.text));
            if (parsed.success) {
                return normalizePlan(parsed.data, input.currentMedia);
            }
            if (turn === 1) {
                throw new Error('The media revision did not match the required schema.');
            }
            messages.push({ content: result.text, role: 'assistant' });
            messages.push({
                content: renderSystemPrompt('scene-media/revision-correction.md', {
                    CORRECTION_REASON: 'The JSON did not match the required schema.',
                }),
                role: 'user',
            });
        }
        catch (error) {
            if (turn === 1) {
                throw error;
            }
            messages.push({ content: result.text, role: 'assistant' });
            messages.push({
                content: renderSystemPrompt('scene-media/revision-correction.md', {
                    CORRECTION_REASON: 'The response was not valid JSON.',
                }),
                role: 'user',
            });
        }
    }
    throw new Error('Unable to generate a media revision plan.');
}
function normalizePlan(plan, media) {
    const hasScriptAndAudio = Boolean(media.script && media.audio);
    return {
        ...plan,
        format: plan.imageDecision === 'keep_existing' ? media.format : plan.format,
        scriptAndAudioDecision: plan.scriptAndAudioDecision === 'keep_existing' && !hasScriptAndAudio
            ? 'do_not_include'
            : plan.scriptAndAudioDecision,
    };
}
function serializeCurrentMedia(media) {
    return {
        format: media.format,
        imageAlt: media.image?.alt,
        level: media.level,
        script: media.script,
        setting: media.setting,
        skills: media.skills,
        tags: media.tags,
        title: media.title,
        useCases: media.useCases,
        visualSummary: media.visualSummary,
    };
}
//# sourceMappingURL=sceneMediaRevisions.js.map