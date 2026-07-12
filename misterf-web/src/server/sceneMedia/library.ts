import { z } from 'zod';
import { normalizeSearchText } from '../pages/shell.js';
import { builtInSceneMediaItems } from './builtInSceneMedia.generated.js';
import type {
  SceneMediaFormat,
  SceneMediaLevel,
  SceneMediaLibraryFilters,
  SceneMediaLibraryItem,
} from './types.js';
import {
  findUserSceneMediaForProfile,
  listUserSceneMediaForProfile,
} from './userMediaRepository.js';

export const sceneMediaLevels = ['A1-A2', 'B1-B2', 'C1'] as const;
export const sceneMediaFormats = [
  'four_panel_wordless_story',
  'single_panel_scene',
  'two_panel_contrast',
] as const;

const sceneMediaImageLayerSchema = z
  .object({
    alt: z.string().trim().min(1),
    height: z.number().int().positive().optional(),
    mediaId: z.string().trim().min(1).optional(),
    source: z.enum(['built_in', 'user_generated']).optional(),
    src: z.string().trim().min(1),
    width: z.number().int().positive().optional(),
  })
  .strict();

const sceneMediaAudioLayerSchema = z
  .object({
    clips: z.array(z.object({
      speaker: z.string().trim().min(1),
      src: z.string().trim().min(1),
      storageKey: z.string().trim().min(1).optional(),
      turn: z.number().int().positive(),
    }).strict()).min(1),
    format: z.literal('wav'),
    model: z.string().trim().min(1).optional(),
    provider: z.literal('openrouter').optional(),
    voiceStrategy: z.literal('per_turn_clips'),
  })
  .strict();

const sceneMediaScriptSchema = z.union([
  z
    .object({
      identityStrategy: z.enum(['named_in_dialogue', 'role_only']),
      scriptType: z.literal('dialogue'),
      speakers: z.array(z.object({
        name: z.string().trim().min(1),
        nameSpokenInAudio: z.boolean(),
        role: z.string().trim().min(1),
      }).strict()).min(1).max(3),
      turns: z
        .array(
          z
            .object({
              speaker: z.string().trim().min(1),
              text: z.string().trim().min(1),
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
  z
    .object({
      identityStrategy: z.enum(['named_in_narration', 'role_only']),
      scriptType: z.enum(['monologue', 'narration']),
      text: z.string().trim().min(1),
    })
    .strict(),
]);

const sceneMediaLibraryItemSchema = z
  .object({
    audio: sceneMediaAudioLayerSchema.optional(),
    createdFrom: z
      .object({
        baseBuiltInMediaId: z.string().trim().min(1).optional(),
        baseVisualAssetId: z.string().trim().min(1).optional(),
        conversationId: z.string().trim().min(1).optional(),
        prompt: z.string().trim().min(1).optional(),
        resourceId: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    format: z.enum(sceneMediaFormats),
    id: z.string().trim().min(1),
    image: sceneMediaImageLayerSchema.optional(),
    level: z.enum(sceneMediaLevels).optional(),
    ownerUserId: z.string().trim().min(1).optional(),
    script: sceneMediaScriptSchema.optional(),
    setting: z.string().trim().min(1).optional(),
    skills: z.array(z.string().trim().min(1)),
    source: z.enum(['built_in', 'user_generated']),
    status: z.literal('ready'),
    tags: z.array(z.string().trim().min(1)),
    title: z.string().trim().min(1),
    useCases: z.array(z.string().trim().min(1)),
    visualAssetId: z.string().trim().min(1).optional(),
    visualSummary: z.array(z.string().trim().min(1)),
  })
  .strict();

const validatedBuiltInItems = z
  .array(sceneMediaLibraryItemSchema)
  .parse(builtInSceneMediaItems) satisfies SceneMediaLibraryItem[];

const itemsById = new Map(validatedBuiltInItems.map((item) => [item.id, item]));

export function listSceneMediaItems(
  filters: SceneMediaLibraryFilters = {},
  owner?: {
    profileId: string;
    userId: string;
  },
): SceneMediaLibraryItem[] {
  const normalizedQuery = normalizeSearchText(filters.query ?? '');
  const userItems = owner
    ? listUserSceneMediaForProfile({
      ownerProfileId: owner.profileId,
      ownerUserId: owner.userId,
    })
    : [];
  const items = [
    ...userItems,
    ...validatedBuiltInItems,
  ];

  return items.filter((item) => {
    if (filters.level && item.level !== filters.level) {
      return false;
    }

    if (filters.format && item.format !== filters.format) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeSearchText([
      item.title,
      item.setting,
      item.level,
      item.format,
      ...item.tags,
      ...item.skills,
      ...item.useCases,
      ...item.visualSummary,
    ].filter(Boolean).join(' ')).includes(normalizedQuery);
  });
}

export function findSceneMediaItemById(
  mediaId: string,
  owner?: {
    profileId: string;
    userId: string;
  },
): SceneMediaLibraryItem | null {
  if (owner) {
    const userItem = findUserSceneMediaForProfile({
      mediaId,
      ownerProfileId: owner.profileId,
      ownerUserId: owner.userId,
    });
    if (userItem) {
      return userItem;
    }
  }

  const item = itemsById.get(mediaId);
  return item ?? null;
}

export function normalizeSceneMediaLevel(
  value: unknown,
): SceneMediaLevel | undefined {
  return typeof value === 'string' &&
    sceneMediaLevels.includes(value as SceneMediaLevel)
    ? (value as SceneMediaLevel)
    : undefined;
}

export function normalizeSceneMediaFormat(
  value: unknown,
): SceneMediaFormat | undefined {
  return typeof value === 'string' &&
    sceneMediaFormats.includes(value as SceneMediaFormat)
    ? (value as SceneMediaFormat)
    : undefined;
}
