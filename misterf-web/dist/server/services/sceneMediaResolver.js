import { generateText } from 'ai';
import { z } from 'zod';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import { getLanguageModel, getProviderOptions, shouldUseTemperature, } from './llmTutor/providers.js';
import { listSceneMediaItems, normalizeSceneMediaLevel, } from '../sceneMedia/library.js';
const resolverResponseSchema = z.object({
    alternates: z.array(z.string().trim().min(1)).max(5).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    layers: z.object({
        audio: z.boolean().optional(),
        image: z.boolean().optional(),
        script: z.boolean().optional(),
    }).strict().optional(),
    mediaId: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).max(500),
    strategy: z.enum([
        'built_in_image_dynamic_script',
        'existing_media',
        'no_good_match',
    ]),
}).strict();
export async function resolveSceneMedia(request) {
    const catalog = buildCompactSceneMediaCatalog(request);
    if (catalog.length === 0) {
        return {
            reason: 'No media items are available for this request.',
            strategy: 'no_good_match',
        };
    }
    const result = await generateText({
        messages: [{
                content: buildResolverUserPrompt(request, catalog),
                role: 'user',
            }],
        model: getLanguageModel({
            modelTier: 'lite',
            openRouterApiKey: request.openRouterApiKey,
        }),
        providerOptions: getProviderOptions(),
        system: buildResolverSystemPrompt(),
        temperature: shouldUseTemperature({ modelTier: 'lite' }) ? 0.1 : undefined,
    });
    let parsedJson;
    try {
        parsedJson = parseJsonFromModelText(result.text);
    }
    catch {
        return fallbackRecommendation(request, catalog, 'The resolver returned invalid JSON.');
    }
    const parsed = resolverResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
        return fallbackRecommendation(request, catalog, 'The resolver returned a malformed recommendation.');
    }
    return validateResolverRecommendation(request, catalog, parsed.data);
}
export function buildCompactSceneMediaCatalog(request) {
    const owner = request.includeUserGenerated !== false &&
        request.ownerUserId &&
        request.ownerProfileId
        ? {
            profileId: request.ownerProfileId,
            userId: request.ownerUserId,
        }
        : undefined;
    const normalizedLevel = normalizeSceneMediaLevel(request.learnerLevel);
    return listSceneMediaItems({}, owner)
        .filter((item) => item.status === 'ready')
        .sort((left, right) => {
        if (normalizedLevel && left.level === normalizedLevel && right.level !== normalizedLevel) {
            return -1;
        }
        if (normalizedLevel && right.level === normalizedLevel && left.level !== normalizedLevel) {
            return 1;
        }
        return 0;
    })
        .slice(0, 80)
        .map(toCompactCatalogItem);
}
function validateResolverRecommendation(request, catalog, recommendation) {
    if (recommendation.strategy === 'no_good_match') {
        return {
            confidence: recommendation.confidence ?? 'low',
            reason: recommendation.reason,
            strategy: 'no_good_match',
        };
    }
    const item = findValidCatalogItem(catalog, recommendation.mediaId, request) ?? (recommendation.alternates
        ?.map((mediaId) => findValidCatalogItem(catalog, mediaId, request))
        .find(Boolean));
    if (!item) {
        return fallbackRecommendation(request, catalog, 'The resolver did not return an available media id.');
    }
    const strategy = recommendation.strategy === 'built_in_image_dynamic_script' &&
        item.source === 'built_in' &&
        item.audioAvailable === false
        ? 'built_in_image_dynamic_script'
        : 'existing_media';
    return {
        alternates: (recommendation.alternates ?? [])
            .filter((mediaId) => mediaId !== item.id)
            .filter((mediaId) => Boolean(findValidCatalogItem(catalog, mediaId, request)))
            .slice(0, 3),
        confidence: recommendation.confidence ?? 'medium',
        layers: layersForCatalogItem(item, request.desiredLayers),
        mediaId: item.id,
        reason: recommendation.reason,
        strategy,
    };
}
function fallbackRecommendation(request, catalog, reason) {
    const fallback = catalog.find((item) => isCatalogItemAllowed(item, request));
    if (!fallback) {
        return {
            confidence: 'low',
            reason,
            strategy: 'no_good_match',
        };
    }
    return {
        confidence: 'low',
        layers: layersForCatalogItem(fallback, request.desiredLayers),
        mediaId: fallback.id,
        reason,
        strategy: 'existing_media',
    };
}
function findValidCatalogItem(catalog, mediaId, request) {
    if (!mediaId) {
        return null;
    }
    const item = catalog.find((candidate) => candidate.id === mediaId);
    return item && isCatalogItemAllowed(item, request) ? item : null;
}
function isCatalogItemAllowed(item, request) {
    if (request.recentMediaIds?.includes(item.id)) {
        return false;
    }
    return (request.desiredLayers ?? []).every((layer) => {
        if (layer === 'audio') {
            return item.audioAvailable;
        }
        if (layer === 'script') {
            return item.scriptAvailable;
        }
        return true;
    });
}
function layersForCatalogItem(item, desiredLayers) {
    const requested = new Set(desiredLayers?.length ? desiredLayers : ['image']);
    return {
        audio: requested.has('audio') && item.audioAvailable,
        image: requested.has('image'),
        script: requested.has('script') && item.scriptAvailable,
    };
}
function toCompactCatalogItem(item) {
    const scriptWordCount = item.script
        ? item.script.scriptType === 'dialogue'
            ? item.script.turns.reduce((sum, turn) => sum + countWords(turn.text), 0)
            : countWords(item.script.text)
        : 0;
    return {
        audioAvailable: Boolean(item.audio),
        audioClipCount: item.audio?.clips.length,
        format: item.format,
        id: item.id,
        level: item.level,
        scriptAvailable: Boolean(item.script),
        scriptType: item.script
            ? `${item.script.scriptType}:${scriptWordCount}w`
            : undefined,
        setting: item.setting,
        skills: item.skills.slice(0, 6),
        source: item.source,
        tags: item.tags.slice(0, 8),
        title: item.title,
        useCases: item.useCases.slice(0, 6),
        visualAssetId: item.visualAssetId,
        visualSummary: item.visualSummary.slice(0, 5),
    };
}
function buildResolverSystemPrompt() {
    return [
        'You select an existing scene media item for Mister F, an English-learning app.',
        'Use only ids from the provided compact catalog. Never invent, translate, slugify, or modify ids.',
        'Prefer media that matches the criteria, learner level, desired layers, and recent-media exclusions.',
        'Return JSON only. Do not include markdown or prose.',
    ].join('\n');
}
function buildResolverUserPrompt(request, catalog) {
    return [
        `Criteria: ${request.criteria}`,
        `Learner level: ${request.learnerLevel ?? 'not specified'}`,
        `Desired layers: ${(request.desiredLayers ?? ['image']).join(', ')}`,
        `Recent media ids to avoid: ${(request.recentMediaIds ?? []).join(', ') || 'none'}`,
        'Return JSON with this shape:',
        '{"strategy":"existing_media|built_in_image_dynamic_script|no_good_match","mediaId":"catalog id when applicable","layers":{"image":true,"audio":false,"script":false},"confidence":"high|medium|low","reason":"short reason","alternates":["optional ids"]}',
        'Compact catalog:',
        JSON.stringify(catalog),
    ].join('\n');
}
function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
//# sourceMappingURL=sceneMediaResolver.js.map