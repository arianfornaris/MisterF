/**
 * HTTP surface for source attachments.
 *
 * These endpoints drive the attach wizard: **process**, then **approve** or
 * **discard**. They answer JSON rather than rendering, because the wizard runs
 * on a page that has not been submitted yet.
 *
 * Processing runs an inference, so unlike the rest of this feature it does
 * spend the user's credit and goes through the same gate as every other model
 * call. Approving and discarding do not.
 */

import type { Request, Response } from 'express';

import {
  getCreditCheckedOpenRouterApiKeyForUser,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import { createFixedWindowRateLimiter } from '../services/fixedWindowRateLimiter.js';
import {
  AttachmentExtractionFailedError,
  extractAttachmentText,
} from '../services/attachmentExtraction.js';
import { logger } from '../services/logger.js';
import {
  prepareUploadedAttachment,
  prepareUrlAttachment,
} from './ingestion.js';
import { translateRejection, translateWarnings } from './messages.js';
import {
  approveStagedAttachment,
  discardStagedAttachment,
  stageAttachment,
  type StagedAttachment,
} from './stagingStore.js';
import {
  AttachmentRejectedError,
  isAttachmentRejectedError,
  type PreparedAttachment,
} from './types.js';

/**
 * Processing decodes an image or parses a PDF and then runs a model over it, so
 * it is the most expensive endpoint in the feature. The limit is generous
 * enough that a teacher preparing a class never meets it.
 */
const processRateLimiter = createFixedWindowRateLimiter({
  maxActions: 30,
  windowMs: 5 * 60 * 1000,
});

/**
 * The limiter reports the first rejection in each window so the caller can log
 * it once rather than on every blocked attempt.
 */
function allowProcessing(userId: string): boolean {
  const decision = processRateLimiter.allow(userId);
  if (decision.shouldLogLimit) {
    logger.warn('attachment_process_rate_limited', { userId });
  }
  return decision.allowed;
}

type AuthenticatedActor = {
  profileId: string;
  userId: string;
};

function requireActor(
  request: Request,
  response: Response,
): AuthenticatedActor | null {
  const user = request.authUser;
  const activeProfile = request.activeProfile;

  if (!user?.emailVerified || !activeProfile) {
    response.status(401).json({ error: { code: 'unauthenticated' } });
    return null;
  }

  return { profileId: activeProfile.id, userId: user.id };
}

/**
 * What the review step renders. It deliberately includes the full extracted
 * text: the whole point of the step is that the user reads exactly what the
 * model will read before agreeing to send it.
 */
function toReviewView(
  staged: StagedAttachment,
  locale: Request['locale'],
): Record<string, unknown> {
  return {
    approved: staged.approved,
    contentType: staged.digest.contentType,
    displayName: staged.digest.displayName,
    id: staged.digest.id,
    pageCount: staged.digest.pageCount,
    sourceType: staged.digest.sourceType,
    sourceUrl: staged.digest.sourceUrl,
    edited: Boolean(staged.digest.edited),
    text: staged.digest.text,
    textIsDescription: staged.digest.textIsDescription,
    truncated: staged.digest.truncated,
    warnings: translateWarnings(staged.warnings, locale),
  };
}

function respondToFailure(
  error: unknown,
  request: Request,
  response: Response,
): void {
  if (isCreditExhaustedError(error)) {
    response.status(402).json({ error: { code: 'credit_exhausted' } });
    return;
  }

  if (error instanceof AttachmentExtractionFailedError) {
    response.status(422).json({
      error: {
        code: 'extraction_failed',
        message: translateRejection({
          code: 'extraction_failed',
          locale: request.locale,
        }),
      },
    });
    return;
  }

  if (isAttachmentRejectedError(error)) {
    response.status(422).json({
      error: {
        code: error.code,
        message: translateRejection({
          code: error.code,
          locale: request.locale,
          values: error.values,
        }),
      },
    });
    return;
  }

  logger.error('attachment_ingestion_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  response.status(500).json({ error: { code: 'ingestion_failed' } });
}

/**
 * Runs a prepared attachment through extraction and stages the result for
 * review. The bytes are dropped here and never travel further.
 */
async function processAndStage(input: {
  prepared: PreparedAttachment;
  request: Request;
  userId: string;
  userPrompt?: string;
}): Promise<StagedAttachment> {
  const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(
    input.userId,
  );

  const extraction = await extractAttachmentText({
    attachment: input.prepared,
    llm: { openRouterApiKey, userId: input.userId },
    userPrompt: input.userPrompt,
  });

  const warnings = [...input.prepared.warnings];
  if (extraction.truncated) {
    warnings.push({ code: 'text_truncated' });
  }

  const staged = stageAttachment({
    digest: {
      contentType: input.prepared.contentType,
      displayName: input.prepared.displayName,
      pageCount: input.prepared.pageCount,
      sourceType: input.prepared.sourceType,
      sourceUrl: input.prepared.sourceUrl,
      text: extraction.text,
      textIsDescription: extraction.textIsDescription,
      truncated: extraction.truncated,
    },
    userId: input.userId,
    warnings,
  });

  logger.info('attachment_processed', {
    displayName: staged.digest.displayName,
    pageCount: staged.digest.pageCount,
    sizeBytes: input.prepared.sizeBytes,
    sourceType: staged.digest.sourceType,
    textIsDescription: staged.digest.textIsDescription,
    textLength: staged.digest.text.length,
    truncated: staged.digest.truncated,
    userId: input.userId,
    warnings: warnings.map((warning) => warning.code),
  });

  return staged;
}

function readUserPrompt(request: Request): string | undefined {
  const raw = request.get('x-attachment-prompt') ?? '';
  if (!raw) {
    return undefined;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The filename travels in a header because the body is the file itself. It is
 * percent-encoded by the client so non-ASCII names survive a latin-1 header.
 */
function readFileNameHeader(request: Request): string {
  const raw = request.get('x-attachment-filename') ?? '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function handleProcessUploadedAttachment(
  request: Request,
  response: Response,
): Promise<void> {
  const actor = requireActor(request, response);
  if (!actor) {
    return;
  }

  if (!allowProcessing(actor.userId)) {
    response.status(429).json({ error: { code: 'rate_limited' } });
    return;
  }

  // `express.raw` leaves the body as a Buffer. An empty one means the client
  // sent a content type the parser did not claim, which is itself a rejection.
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);

  try {
    const prepared = {
      ...(await prepareUploadedAttachment({
        bytes,
        declaredContentType: request.get('content-type') ?? '',
        fileName: readFileNameHeader(request),
      })),
      id: 'pending',
    };

    const staged = await processAndStage({
      prepared,
      request,
      userId: actor.userId,
      userPrompt: readUserPrompt(request),
    });

    response.status(201).json({
      attachment: toReviewView(staged, request.locale),
    });
  } catch (error) {
    respondToFailure(error, request, response);
  }
}

export async function handleProcessUrlAttachment(
  request: Request,
  response: Response,
): Promise<void> {
  const actor = requireActor(request, response);
  if (!actor) {
    return;
  }

  if (!allowProcessing(actor.userId)) {
    response.status(429).json({ error: { code: 'rate_limited' } });
    return;
  }

  const url = typeof request.body?.url === 'string' ? request.body.url : '';
  const userPrompt =
    typeof request.body?.prompt === 'string' ? request.body.prompt : undefined;

  try {
    const prepared = {
      ...(await prepareUrlAttachment(url)),
      id: 'pending',
    };

    const staged = await processAndStage({
      prepared,
      request,
      userId: actor.userId,
      userPrompt,
    });

    response.status(201).json({
      attachment: toReviewView(staged, request.locale),
    });
  } catch (error) {
    respondToFailure(error, request, response);
  }
}

function readAttachmentId(request: Request): string {
  const value = request.params.attachmentId;
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/**
 * The user has read the extracted text and accepted it, possibly after
 * correcting it. The corrected text arrives urlencoded, so it goes through the
 * ordinary body CSRF check like any other form post.
 */
export function handleApproveAttachment(
  request: Request,
  response: Response,
): void {
  const actor = requireActor(request, response);
  if (!actor) {
    return;
  }

  const correctedText =
    typeof request.body?.text === 'string' ? request.body.text : undefined;

  let staged;
  try {
    staged = approveStagedAttachment({
      correctedText,
      id: readAttachmentId(request),
      userId: actor.userId,
    });
  } catch (error) {
    respondToFailure(error, request, response);
    return;
  }

  if (!staged) {
    response.status(404).json({ error: { code: 'not_found' } });
    return;
  }

  if (staged.digest.edited) {
    logger.info('attachment_text_edited', {
      displayName: staged.digest.displayName,
      sourceType: staged.digest.sourceType,
      textLength: staged.digest.text.length,
      userId: actor.userId,
    });
  }

  response.status(200).json({
    attachment: toReviewView(staged, request.locale),
  });
}

export function handleDiscardAttachment(
  request: Request,
  response: Response,
): void {
  const actor = requireActor(request, response);
  if (!actor) {
    return;
  }

  const removed = discardStagedAttachment({
    id: readAttachmentId(request),
    userId: actor.userId,
  });

  response.status(removed ? 204 : 404).end();
}

export { AttachmentRejectedError };
