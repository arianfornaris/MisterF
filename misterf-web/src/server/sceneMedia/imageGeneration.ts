import { env } from '../config/env.js';
import type {
  SceneMediaFormat,
  SceneMediaLevel,
  UserSceneMediaScriptTypePreference,
} from './types.js';

export type GeneratedSceneMediaImage = {
  bytes: Buffer;
  contentType: string;
  extension: string;
  model: string;
  prompt: string;
  provider: 'openrouter';
  usage?: {
    completionTokens?: number;
    costUsd?: number;
    promptTokens?: number;
    totalTokens?: number;
  };
};

export type GenerateSceneMediaImageInput = {
  format: SceneMediaFormat;
  level: SceneMediaLevel;
  openRouterApiKey: string;
  prompt: string;
  scriptTypePreference: UserSceneMediaScriptTypePreference;
  sourceVisualSummary?: string[];
};

type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
  usage?: {
    completion_tokens?: number;
    cost?: number;
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

export class SceneMediaImageContentPolicyError extends Error {
  constructor(message = 'Scene media image prompt was rejected by content policy.') {
    super(message);
    this.name = 'SceneMediaImageContentPolicyError';
  }
}

export class SceneMediaImageProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneMediaImageProviderError';
  }
}

export async function generateSceneMediaImage(
  input: GenerateSceneMediaImageInput,
): Promise<GeneratedSceneMediaImage> {
  const imagePrompt = buildSceneMediaImagePrompt(input);
  const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, '')}/images`, {
    body: JSON.stringify({
      aspect_ratio: getAspectRatio(input.format),
      model: env.sceneMediaImageModel,
      n: 1,
      output_format: 'png',
      prompt: imagePrompt,
      quality: 'medium',
    }),
    headers: {
      Authorization: `Bearer ${input.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.appBaseUrl,
      'X-Title': 'Mister F',
    },
    method: 'POST',
  });
  const payload = (await response.json().catch(() => ({}))) as OpenRouterImageResponse;

  if (!response.ok) {
    const message = payload.error?.message ?? `OpenRouter image request failed with HTTP ${response.status}.`;
    if (isContentPolicyFailure(response.status, message, payload.error?.code)) {
      throw new SceneMediaImageContentPolicyError();
    }
    throw new SceneMediaImageProviderError(message);
  }

  const firstImage = payload.data?.[0];
  if (!firstImage?.b64_json) {
    throw new SceneMediaImageProviderError('OpenRouter image response did not include image bytes.');
  }

  const contentType = normalizeImageContentType(firstImage.media_type);
  return {
    bytes: Buffer.from(firstImage.b64_json, 'base64'),
    contentType,
    extension: imageExtensionFromContentType(contentType),
    model: env.sceneMediaImageModel,
    prompt: imagePrompt,
    provider: 'openrouter',
    usage: payload.usage ? {
      completionTokens: payload.usage.completion_tokens,
      costUsd: payload.usage.cost,
      promptTokens: payload.usage.prompt_tokens,
      totalTokens: payload.usage.total_tokens,
    } : undefined,
  };
}

function buildSceneMediaImagePrompt(input: GenerateSceneMediaImageInput): string {
  const formatInstruction = {
    four_panel_wordless_story:
      'Create one cohesive four-panel wordless story image with clear panel separation.',
    single_panel_scene:
      'Create one single-panel scene image with a clear focal action.',
    two_panel_contrast:
      'Create one two-panel contrast image with clear before/after or compare/contrast structure.',
  } satisfies Record<SceneMediaFormat, string>;
  const sourceContext = input.sourceVisualSummary?.length
    ? ` Preserve useful context from this source media: ${input.sourceVisualSummary.join('; ')}.`
    : '';
  const scriptHint = input.scriptTypePreference === 'dialogue'
    ? 'Include two or three visible characters with distinct speaking roles, but do not render speech bubbles or readable text.'
    : input.scriptTypePreference === 'monologue' || input.scriptTypePreference === 'narration'
      ? 'Favor a scene that supports one speaker or narrator, and do not render readable text.'
      : 'Do not render readable text, captions, subtitles, logos, or watermarks.';

  return [
    'Illustration for an English-learning scene media asset.',
    formatInstruction[input.format],
    `Target learner level: ${input.level}.`,
    `User request: ${input.prompt}`,
    sourceContext,
    scriptHint,
    'Use a friendly, classroom-safe style with natural people, recognizable actions, and visual details that invite language practice.',
    'Avoid political, sexual, graphic, hateful, copyrighted-character, branded, or unsafe content.',
  ].filter(Boolean).join(' ');
}

function getAspectRatio(format: SceneMediaFormat): string {
  if (format === 'single_panel_scene') {
    return '4:3';
  }
  return '16:9';
}

function normalizeImageContentType(contentType: string | undefined): string {
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/png' ||
    contentType === 'image/webp'
  ) {
    return contentType;
  }
  return 'image/png';
}

function imageExtensionFromContentType(contentType: string): string {
  if (contentType === 'image/jpeg') {
    return 'jpg';
  }
  if (contentType === 'image/webp') {
    return 'webp';
  }
  return 'png';
}

function isContentPolicyFailure(
  status: number,
  message: string,
  code: string | undefined,
): boolean {
  const text = `${code ?? ''} ${message}`.toLowerCase();
  return (
    status === 400 ||
    status === 403 ||
    status === 422
  ) && (
    text.includes('policy') ||
    text.includes('safety') ||
    text.includes('moderation') ||
    text.includes('content') ||
    text.includes('unsafe')
  );
}
