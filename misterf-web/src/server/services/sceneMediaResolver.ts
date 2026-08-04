import { generateText } from 'ai';
import {
  defaultProfileModelTier,
  type ProfileModelTier,
} from '../profiles/modelTier.js';
import { z } from 'zod';
import { parseJsonFromModelText } from './llmTutor/modelJson.js';
import {
  getLanguageModel,
  getProviderOptions,
  shouldUseTemperature,
} from './llmTutor/providers.js';
import {
  listSceneMediaItems,
  normalizeSceneMediaLevel,
} from '../sceneMedia/library.js';
import type {
  SceneMediaLevel,
  SceneMediaLibraryItem,
} from '../sceneMedia/types.js';

export type SceneMediaLayerName = 'audio' | 'image' | 'script';

export type ResolveSceneMediaRequest = {
  criteria: string;
  desiredLayers?: SceneMediaLayerName[];
  includeUserGenerated?: boolean;
  learnerLevel?: SceneMediaLevel;
  modelTier?: ProfileModelTier;
  openRouterApiKey: string;
  ownerProfileId?: string;
  ownerUserId?: string;
  recentMediaIds?: string[];
};

export type ResolveSceneMediaRecommendation = {
  alternates?: string[];
  confidence?: 'high' | 'low' | 'medium';
  layers?: {
    audio?: boolean;
    image?: boolean;
    script?: boolean;
  };
  mediaId?: string;
  reason: string;
  strategy:
    | 'built_in_image_dynamic_script'
    | 'existing_media'
    | 'no_good_match';
};

type CompactSceneMediaCatalogItem = {
  audioAvailable: boolean;
  audioClipCount?: number;
  format: string;
  id: string;
  level?: string;
  scriptAvailable: boolean;
  scriptType?: string;
  setting?: string;
  source: string;
  title: string;
  visualAssetId?: string;
  visualSummary: string[];
};

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

export async function resolveSceneMedia(
  request: ResolveSceneMediaRequest,
): Promise<ResolveSceneMediaRecommendation> {
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
      modelTier: request.modelTier ?? defaultProfileModelTier,
      openRouterApiKey: request.openRouterApiKey,
    }),
    providerOptions: getProviderOptions(),
    system: buildResolverSystemPrompt(),
    temperature: shouldUseTemperature({
      modelTier: request.modelTier ?? defaultProfileModelTier,
    })
      ? 0.1
      : undefined,
  });

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonFromModelText(result.text);
  } catch {
    return fallbackRecommendation(request, catalog, 'The resolver returned invalid JSON.');
  }

  const parsed = resolverResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return fallbackRecommendation(
      request,
      catalog,
      'The resolver returned a malformed recommendation.',
    );
  }

  return validateResolverRecommendation(request, catalog, parsed.data);
}

export function buildCompactSceneMediaCatalog(
  request: Pick<
    ResolveSceneMediaRequest,
    'includeUserGenerated' | 'learnerLevel' | 'ownerProfileId' | 'ownerUserId'
  >,
): CompactSceneMediaCatalogItem[] {
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

function validateResolverRecommendation(
  request: ResolveSceneMediaRequest,
  catalog: CompactSceneMediaCatalogItem[],
  recommendation: z.infer<typeof resolverResponseSchema>,
): ResolveSceneMediaRecommendation {
  if (recommendation.strategy === 'no_good_match') {
    return {
      confidence: recommendation.confidence ?? 'low',
      reason: recommendation.reason,
      strategy: 'no_good_match',
    };
  }

  const item = findValidCatalogItem(
    catalog,
    recommendation.mediaId,
    request,
  ) ?? (
    recommendation.alternates
      ?.map((mediaId) => findValidCatalogItem(catalog, mediaId, request))
      .find(Boolean)
  );

  if (!item) {
    return fallbackRecommendation(
      request,
      catalog,
      'The resolver did not return an available media id.',
    );
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

function fallbackRecommendation(
  request: ResolveSceneMediaRequest,
  catalog: CompactSceneMediaCatalogItem[],
  reason: string,
): ResolveSceneMediaRecommendation {
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

function findValidCatalogItem(
  catalog: CompactSceneMediaCatalogItem[],
  mediaId: string | undefined,
  request: ResolveSceneMediaRequest,
): CompactSceneMediaCatalogItem | null {
  if (!mediaId) {
    return null;
  }

  const item = catalog.find((candidate) => candidate.id === mediaId);
  return item && isCatalogItemAllowed(item, request) ? item : null;
}

function isCatalogItemAllowed(
  item: CompactSceneMediaCatalogItem,
  request: ResolveSceneMediaRequest,
): boolean {
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

function layersForCatalogItem(
  item: CompactSceneMediaCatalogItem,
  desiredLayers: SceneMediaLayerName[] | undefined,
): ResolveSceneMediaRecommendation['layers'] {
  const requested = new Set(desiredLayers?.length ? desiredLayers : ['image']);
  return {
    audio: requested.has('audio') && item.audioAvailable,
    image: requested.has('image'),
    script: requested.has('script') && item.scriptAvailable,
  };
}

function toCompactCatalogItem(
  item: SceneMediaLibraryItem,
): CompactSceneMediaCatalogItem {
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
    source: item.source,
    title: item.title,
    visualAssetId: item.visualAssetId,
    visualSummary: item.visualSummary.slice(0, 5),
  };
}

function buildResolverSystemPrompt(): string {
  return [
    'You select an existing scene media item for Mister F, an English-learning app.',
    'Use only ids from the provided compact catalog. Never invent, translate, slugify, or modify ids.',
    'Prefer media that matches the criteria, learner level, desired layers, and recent-media exclusions.',
    'Return JSON only. Do not include markdown or prose.',
  ].join('\n');
}

function buildResolverUserPrompt(
  request: ResolveSceneMediaRequest,
  catalog: CompactSceneMediaCatalogItem[],
): string {
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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
