import {
  addResourceToFolder,
  createPracticeGuide,
  createQuiz,
  createResourceFolder,
  createRoleplay,
  findPracticeGuideForUser,
  findQuizForUser,
  findResourceCopyOrigin,
  findResourceForUser,
  findRoleplayForUser,
  listResourceFolderItems,
  recordResourceCopy,
  type StoredResource,
} from '../db/repository.js';
import { getDb } from '../db/database.js';
import { translate, type Locale } from '../i18n/index.js';

/**
 * How deep folder duplication will recurse. Folders nest, and the schema does
 * not prevent a pathological chain, so the walk is bounded rather than trusting
 * the data.
 */
const maxFolderDuplicationDepth = 10;

/** Titles are capped per type; the shortest limit wins so no copy is rejected. */
const maxDuplicatedTitleLength = 200;

export type DuplicateResourceResult = {
  duplicatedCount: number;
  resource: StoredResource;
};

/** Who a resource is read from or written to: an account and one of its profiles. */
type ResourceOwner = {
  profileId: string;
  userId: string;
};

/** Called for every resource copied, the folder itself included. */
type OnResourceCopied = (copy: StoredResource, original: StoredResource) => void;

export function buildDuplicateTitle(title: string, locale: Locale): string {
  const copyTitle = translate(locale, 'resources.duplicateTitle', { title });
  return copyTitle.length > maxDuplicatedTitleLength
    ? `${copyTitle.slice(0, maxDuplicatedTitleLength - 1)}…`
    : copyTitle;
}

/**
 * Duplicates a resource the active profile owns, returning an independent copy.
 *
 * A duplicate is a fresh original, not an import: it carries no `source*` or
 * `sharedVia` marks, so it starts unshared and none of the original's
 * participation travels with it — no attempts, reports, share links, grants, or
 * participation summary. That separation is the point of the feature, since it
 * is what lets the same activity run with a second group and keep its results
 * apart.
 *
 * Folders recurse into the resources filed inside them. Resources merely shared
 * *with* the owner are skipped, because duplication produces owned copies and
 * the owner does not own those.
 */
export function duplicateResourceForProfile(input: {
  locale: Locale;
  profileId: string;
  resourceId: string;
  userId: string;
}): DuplicateResourceResult | null {
  const resource = findResourceForUser(input.resourceId, input.userId);
  if (!resource || resource.profileId !== input.profileId) {
    return null;
  }
  // Archived resources live in Trash; duplicating one would quietly resurrect
  // its content into the active catalog.
  if (resource.archivedAt) {
    return null;
  }

  const owner = { profileId: input.profileId, userId: input.userId };
  return copyResourceTree({
    depth: 0,
    from: owner,
    resource,
    title: buildDuplicateTitle(resource.title, input.locale),
    to: owner,
  });
}

/**
 * Gives another account its own copy of a resource through a copy link
 * (Roadmap V3 §1.19): the teacher-to-teacher path, as opposed to the live share
 * link a student uses to run the resource.
 *
 * The copy follows the duplication rules — authored content only, no
 * participation, shares, or grants — but it keeps the original title, since for
 * the recipient it is their resource rather than a "Copia de". Every copied
 * resource, folder contents included, records its origin so the recipient's
 * pages can say whose work it is based on. Along a chain of copies the origin
 * stays the root author, not the colleague who passed it on.
 */
export function copyResourceFromLink(input: {
  copyLinkId: string;
  resource: StoredResource;
  target: ResourceOwner;
}): DuplicateResourceResult | null {
  const { resource } = input;
  if (resource.archivedAt) {
    return null;
  }

  const copy = () =>
    copyResourceTree({
      depth: 0,
      from: { profileId: resource.profileId, userId: resource.userId },
      onCopied: (copied, original) => {
        const inherited = findResourceCopyOrigin(original.id);
        const originUserId = inherited?.originUserId ?? original.userId;
        const originProfileId = inherited?.originProfileId ?? original.profileId;
        recordResourceCopy({
          copyLinkId: input.copyLinkId,
          originProfileId,
          originUserId,
          resourceId: copied.id,
          sourceResourceId: original.id,
        });
      },
      resource,
      title: resource.title,
      to: input.target,
    });

  // One transaction, so a folder never lands half-copied or without origins.
  return getDb().transaction(copy)();
}

function copyResourceTree(input: {
  depth: number;
  from: ResourceOwner;
  onCopied?: OnResourceCopied;
  resource: StoredResource;
  title: string;
  to: ResourceOwner;
}): DuplicateResourceResult | null {
  const copied = copySingleResource(input);
  if (!copied) {
    return null;
  }

  input.onCopied?.(copied.resource, input.resource);
  return copied;
}

function copySingleResource(input: {
  depth: number;
  from: ResourceOwner;
  onCopied?: OnResourceCopied;
  resource: StoredResource;
  title: string;
  to: ResourceOwner;
}): DuplicateResourceResult | null {
  const { from, resource, title, to } = input;

  if (resource.type === 'quiz') {
    const quiz = findQuizForUser(resource.id, from.userId);
    if (!quiz) {
      return null;
    }
    const created = createQuiz({
      description: quiz.description,
      instructions: quiz.instructions,
      level: quiz.level,
      profileId: to.profileId,
      quiz: quiz.quiz,
      targetTopic: quiz.targetTopic,
      title,
      userId: to.userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, to.userId) };
  }

  if (resource.type === 'roleplay') {
    const roleplay = findRoleplayForUser(resource.id, from.userId);
    if (!roleplay) {
      return null;
    }
    const created = createRoleplay({
      characters: roleplay.characters,
      description: roleplay.description,
      level: roleplay.level,
      profileId: to.profileId,
      title,
      userId: to.userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, to.userId) };
  }

  if (resource.type === 'practice_guide') {
    const guide = findPracticeGuideForUser(resource.id, from.userId);
    if (!guide) {
      return null;
    }
    const created = createPracticeGuide({
      description: guide.description,
      profileId: to.profileId,
      title,
      tutorInstructions: guide.tutorInstructions,
      userId: to.userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, to.userId) };
  }

  return copyFolder(input);
}

function copyFolder(input: {
  depth: number;
  from: ResourceOwner;
  onCopied?: OnResourceCopied;
  resource: StoredResource;
  title: string;
  to: ResourceOwner;
}): DuplicateResourceResult | null {
  const { depth, from, onCopied, resource, title, to } = input;
  const folder = createResourceFolder({
    description: resource.description,
    profileId: to.profileId,
    title,
    userId: to.userId,
  });
  let duplicatedCount = 1;

  if (depth >= maxFolderDuplicationDepth) {
    return { duplicatedCount, resource: toResource(folder.id, to.userId) };
  }

  for (const item of listResourceFolderItems(resource.id, from.userId)) {
    const child = findResourceForUser(item.resourceId, from.userId);
    // Skip what the owner cannot copy: resources shared with them rather than
    // owned, and archived ones, matching the top-level rules.
    if (!child || child.profileId !== from.profileId || child.archivedAt) {
      continue;
    }

    const copied = copyResourceTree({
      depth: depth + 1,
      from,
      onCopied,
      resource: child,
      // Only the folder itself is renamed; its contents keep their titles, so
      // the copy reads like the original rather than "Copia de" everywhere.
      title: child.title,
      to,
    });
    if (!copied) {
      continue;
    }

    duplicatedCount += copied.duplicatedCount;
    addResourceToFolder({
      folderId: folder.id,
      resourceId: copied.resource.id,
      userId: to.userId,
    });
  }

  return { duplicatedCount, resource: toResource(folder.id, to.userId) };
}

function toResource(resourceId: string, userId: string): StoredResource {
  const resource = findResourceForUser(resourceId, userId);
  if (!resource) {
    throw new Error(`Could not load the duplicated resource ${resourceId}.`);
  }
  return resource;
}
