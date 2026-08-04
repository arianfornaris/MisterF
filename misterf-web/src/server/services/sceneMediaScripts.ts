import { generateText, type ModelMessage } from 'ai';
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
import { logger } from './logger.js';
import { renderSystemPrompt } from './systemPrompts.js';
import type {
  SceneMediaFormat,
  SceneMediaLevel,
  SceneMediaScript,
  UserSceneMediaScriptTypePreference,
} from '../sceneMedia/types.js';
import { sceneMediaSpeakerGenders } from '../sceneMedia/types.js';
import {
  buildSceneMediaSourceContextPrompt,
  type SceneMediaGenerationSourceContext,
} from '../sceneMedia/generationContext.js';

const scriptGenerationTurns = 2;

export const sceneMediaScriptGenerationSchema = z.discriminatedUnion('scriptType', [
    z.object({
      identityStrategy: z.union([
        z.literal('named_in_dialogue'),
        z.literal('role_only'),
      ]),
      scriptType: z.literal('dialogue'),
      speakers: z.array(z.object({
        gender: z.enum(sceneMediaSpeakerGenders),
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
      gender: z.enum(sceneMediaSpeakerGenders),
      identityStrategy: z.union([
        z.literal('named_in_narration'),
        z.literal('role_only'),
      ]),
      scriptType: z.union([z.literal('monologue'), z.literal('narration')]),
      text: z.string().trim().min(1).max(1800),
    }).strict(),
  ]);

export const sceneMediaMetadataGenerationSchema = z.object({
  setting: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(80),
  visualSummary: z.array(z.string().trim().min(1).max(180)).min(1).max(5),
}).strict();

export const sceneMediaTitleGenerationSchema = z.object({
  title: z.string().trim().min(1).max(80),
}).strict();

export const sceneMediaGenerationResponseSchema = sceneMediaMetadataGenerationSchema.extend({
  script: sceneMediaScriptGenerationSchema.optional(),
}).strict();

export const sceneMediaScriptPackageGenerationSchema = sceneMediaMetadataGenerationSchema.extend({
  script: sceneMediaScriptGenerationSchema,
}).strict();

// Derive from the metadata schema (not the generation schema) so the exported
// `script` is the runtime `SceneMediaScript` type. The generation schema requires
// `gender` at parse time, but the runtime type keeps it optional for
// backward-compatible items, so intersecting the two script shapes would clash.
export type GeneratedSceneMediaScriptPackage = z.infer<typeof sceneMediaMetadataGenerationSchema> & {
  script: SceneMediaScript;
};

export type GeneratedSceneMediaMetadataPackage = z.infer<typeof sceneMediaMetadataGenerationSchema>;

export type GeneratedSceneMediaTitlePackage = z.infer<typeof sceneMediaTitleGenerationSchema>;

export type GenerateSceneMediaScriptInput = {
  format: SceneMediaFormat;
  imageAlt?: string;
  imageBytes?: Buffer;
  imageContentType?: string;
  level: SceneMediaLevel;
  modelTier?: ProfileModelTier;
  openRouterApiKey: string;
  prompt: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  sourceContext?: SceneMediaGenerationSourceContext;
};

export class SceneMediaScriptContentPolicyError extends Error {
  constructor(message = 'Scene media script prompt was rejected by content policy.') {
    super(message);
    this.name = 'SceneMediaScriptContentPolicyError';
  }
}

export class SceneMediaScriptProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneMediaScriptProviderError';
  }
}

function summarizeScriptValidationIssues(
  error: z.ZodError,
): Array<{ code: string; message: string; path: string }> {
  return error.issues.slice(0, 12).map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.map((segment) => String(segment)).join('.') || '(root)',
  }));
}

export async function generateSceneMediaScriptPackage(
  input: GenerateSceneMediaScriptInput,
): Promise<GeneratedSceneMediaScriptPackage> {
  const result = await generateSceneMediaPackage(
    input,
    sceneMediaScriptPackageGenerationSchema,
    buildSceneMediaScriptSystemPrompt(),
    buildSceneMediaScriptUserPrompt(input, true),
    (data) => findScriptContentIssues(data.script),
  );
  return {
    ...result,
    script: result.script as SceneMediaScript,
  };
}

export async function generateSceneMediaMetadataPackage(
  input: GenerateSceneMediaScriptInput,
): Promise<GeneratedSceneMediaMetadataPackage> {
  return generateSceneMediaPackage(
    input,
    sceneMediaMetadataGenerationSchema,
    buildSceneMediaScriptSystemPrompt(),
    buildSceneMediaScriptUserPrompt(input, false),
  );
}

export async function generateSceneMediaTitlePackage(
  input: GenerateSceneMediaScriptInput,
): Promise<GeneratedSceneMediaTitlePackage> {
  return generateSceneMediaPackage(
    input,
    sceneMediaTitleGenerationSchema,
    buildSceneMediaTitleSystemPrompt(),
    buildSceneMediaTitleUserPrompt(input),
  );
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

function findScriptContentIssues(
  script: z.infer<typeof sceneMediaScriptGenerationSchema>,
): Array<{ code: string; message: string; path: string }> {
  const spokenText = script.scriptType === 'dialogue'
    ? script.turns.map((turn) => turn.text).join('\n')
    : script.text;
  const lower = spokenText.toLowerCase();
  const issues: Array<{ code: string; message: string; path: string }> = [];
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
  if (script.scriptType === 'dialogue') {
    const speakerNames = new Set(script.speakers.map((speaker) => speaker.name));
    script.turns.forEach((turn, index) => {
      if (!speakerNames.has(turn.speaker)) {
        issues.push({
          code: 'unknown_speaker',
          message: `Turn speaker "${turn.speaker}" must exactly match a declared speaker name.`,
          path: `script.turns.${index}.speaker`,
        });
      }
    });
    const namedSpeakers = script.speakers.filter((speaker) => speaker.nameSpokenInAudio);
    if (script.identityStrategy === 'named_in_dialogue' && namedSpeakers.length === 0) {
      issues.push({
        code: 'missing_spoken_name',
        message: 'named_in_dialogue requires at least one speaker name to be spoken.',
        path: 'script.speakers',
      });
    }
    if (script.identityStrategy === 'role_only' && namedSpeakers.length > 0) {
      issues.push({
        code: 'unexpected_spoken_name',
        message: 'role_only requires every nameSpokenInAudio value to be false.',
        path: 'script.speakers',
      });
    }
    for (const speaker of namedSpeakers) {
      if (!lower.includes(speaker.name.toLowerCase())) {
        issues.push({
          code: 'spoken_name_missing_from_turns',
          message: `Speaker name "${speaker.name}" is marked as spoken but does not occur in any turn.`,
          path: 'script.speakers',
        });
      }
    }
  }
  return issues;
}

async function generateSceneMediaPackage<T>(
  input: GenerateSceneMediaScriptInput,
  schema: z.ZodType<T>,
  system: string,
  userPrompt: string,
  extraValidation?: (data: T) => Array<{ code: string; message: string; path: string }>,
): Promise<T> {
  const messages: ModelMessage[] = [
    {
      content: input.imageBytes
        ? [
          { type: 'text' as const, text: userPrompt },
          {
            image: input.imageBytes,
            mediaType: input.imageContentType ?? 'image/webp',
            type: 'image' as const,
          },
        ]
        : userPrompt,
      role: 'user' as const,
    },
  ];

  for (let turn = 0; turn < scriptGenerationTurns; turn += 1) {
    const result = await generateText({
      messages,
      model: getLanguageModel({
        modelTier: input.modelTier ?? defaultProfileModelTier,
        openRouterApiKey: input.openRouterApiKey,
      }),
      // Media authoring is a bounded structured-generation task. Minimal
      // reasoning keeps creation and revision previews responsive while the
      // schema and retry loop continue to enforce correctness.
      providerOptions: getProviderOptions({ reasoningEffort: 'minimal' }),
      system,
      temperature: shouldUseTemperature({
        modelTier: input.modelTier ?? defaultProfileModelTier,
      })
        ? 0.35
        : undefined,
    });

    if (isContentPolicyFinish(result.finishReason, result.providerMetadata)) {
      throw new SceneMediaScriptContentPolicyError();
    }

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonFromModelText(result.text);
    } catch (error) {
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
      throw new SceneMediaScriptProviderError('The scene media text generator returned invalid JSON.');
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
          content:
            'The JSON did not match the schema. Fix these validation issues, then return only JSON:\n'
            + JSON.stringify(issues, null, 2),
          role: 'user',
        });
        continue;
      }
      throw new SceneMediaScriptProviderError('The scene media text generator returned an invalid package.');
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
          content:
            'The generated content broke content rules. Fix these issues, then return only JSON:\n'
            + JSON.stringify(contentIssues, null, 2),
          role: 'user',
        });
        continue;
      }
      throw new SceneMediaScriptProviderError('The scene media text generator returned content that broke content rules.');
    }

    return parsed.data;
  }

  throw new SceneMediaScriptProviderError('The scene media text generator did not return a usable package.');
}

export function buildSceneMediaScriptSystemPrompt(): string {
  // Editable template (no placeholders); the per-request user prompt below
  // carries the dynamic level, format, and context.
  return renderSystemPrompt('scene-media/generation.md').trimEnd();
}

export function buildSceneMediaTitleSystemPrompt(): string {
  return renderSystemPrompt('scene-media/title.md').trimEnd();
}

export function buildSceneMediaTitleUserPrompt(
  input: GenerateSceneMediaScriptInput,
): string {
  const formatGuidance = {
    four_panel_wordless_story: 'The image is a four-panel wordless story.',
    single_panel_scene: 'The image is a single scene.',
    two_panel_contrast: 'The image is a two-panel contrast.',
  } satisfies Record<SceneMediaFormat, string>;

  return [
    `Task: ${input.prompt}`,
    `Visual format: ${input.format}. ${formatGuidance[input.format]}`,
    input.imageAlt ? `Generated image alt text: ${input.imageAlt}` : '',
    input.sourceContext ? buildSceneMediaSourceContextPrompt(input.sourceContext) : '',
    'Propose a new title that is meaningfully different from the current title.',
    'Return one JSON object matching the Response type.',
  ].filter(Boolean).join('\n');
}

export function buildSceneMediaScriptUserPrompt(
  input: GenerateSceneMediaScriptInput,
  includeScript = true,
): string {
  // Level is defined by linguistic complexity, not word count. Ranges are soft
  // targets calibrated for listening (higher load than reading), so passages run
  // shorter than a reading text at the same CEFR band. See script-levels.md.
  const levelGuidance = {
    'A1-A2':
      'Around 30-60 words. Mostly present simple/continuous, simple past, and common modals. Concrete nouns, visible actions, emotions, times, and places. Short turns. Avoid idioms, long clauses, and abstract explanation.',
    'B1-B2':
      'Around 55-90 words. Add reasons, reactions, plans, and mild negotiation. Use connectors such as because, although, after, before, so, and while. Natural but clean speech; keep the situation easy to infer from the image.',
    C1: 'Around 75-130 words. Add nuance, implied meaning, repair strategies, richer verbs, embedded clauses, and varied rhythm. Keep it grounded in the image; do not invent unrelated backstory. Avoid slang that reduces international reuse.',
  } satisfies Record<SceneMediaLevel, string>;
  const formatGuidance = {
    four_panel_wordless_story:
      'The media image is a four-panel wordless story. The script should follow the panel sequence clearly.',
    single_panel_scene:
      'The media image is a single scene. The script should describe or dramatize the central action.',
    two_panel_contrast:
      'The media image is a two-panel contrast. The script should make the contrast easy to understand.',
  } satisfies Record<SceneMediaFormat, string>;
  const preferredType =
    input.scriptTypePreference === 'unspecified'
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

function isContentPolicyFinish(
  finishReason: string,
  providerMetadata: unknown,
): boolean {
  const metadata = JSON.stringify(providerMetadata ?? {}).toLowerCase();
  return (
    finishReason === 'content-filter' ||
    metadata.includes('policy') ||
    metadata.includes('safety') ||
    metadata.includes('moderation')
  );
}
