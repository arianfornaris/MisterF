import {
  addResourceToFolder,
  createPracticeGuide,
  createQuiz,
  createResourceFolder,
  createRoleplay,
  findPracticeGuideForUser,
  findQuizForUser,
  findResourceForUser,
  findRoleplayForUser,
  listResourceFolderItems,
  type StoredResource,
} from '../db/repository.js';
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

  return duplicateOwnedResource({
    depth: 0,
    locale: input.locale,
    profileId: input.profileId,
    resource,
    title: buildDuplicateTitle(resource.title, input.locale),
    userId: input.userId,
  });
}

function duplicateOwnedResource(input: {
  depth: number;
  locale: Locale;
  profileId: string;
  resource: StoredResource;
  title: string;
  userId: string;
}): DuplicateResourceResult | null {
  const { profileId, resource, title, userId } = input;

  if (resource.type === 'quiz') {
    const quiz = findQuizForUser(resource.id, userId);
    if (!quiz) {
      return null;
    }
    const created = createQuiz({
      description: quiz.description,
      instructions: quiz.instructions,
      level: quiz.level,
      profileId,
      quiz: quiz.quiz,
      targetTopic: quiz.targetTopic,
      title,
      userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, userId) };
  }

  if (resource.type === 'roleplay') {
    const roleplay = findRoleplayForUser(resource.id, userId);
    if (!roleplay) {
      return null;
    }
    const created = createRoleplay({
      characters: roleplay.characters,
      description: roleplay.description,
      level: roleplay.level,
      profileId,
      title,
      userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, userId) };
  }

  if (resource.type === 'practice_guide') {
    const guide = findPracticeGuideForUser(resource.id, userId);
    if (!guide) {
      return null;
    }
    const created = createPracticeGuide({
      description: guide.description,
      profileId,
      title,
      tutorInstructions: guide.tutorInstructions,
      userId,
    });
    return { duplicatedCount: 1, resource: toResource(created.id, userId) };
  }

  return duplicateFolder(input);
}

function duplicateFolder(input: {
  depth: number;
  locale: Locale;
  profileId: string;
  resource: StoredResource;
  title: string;
  userId: string;
}): DuplicateResourceResult | null {
  const { depth, locale, profileId, resource, title, userId } = input;
  const folder = createResourceFolder({
    description: resource.description,
    profileId,
    title,
    userId,
  });
  let duplicatedCount = 1;

  if (depth >= maxFolderDuplicationDepth) {
    return { duplicatedCount, resource: toResource(folder.id, userId) };
  }

  for (const item of listResourceFolderItems(resource.id, userId)) {
    const child = findResourceForUser(item.resourceId, userId);
    // Skip what the owner cannot copy: resources shared with them rather than
    // owned, and archived ones, matching the top-level rules.
    if (!child || child.profileId !== profileId || child.archivedAt) {
      continue;
    }

    const copied = duplicateOwnedResource({
      depth: depth + 1,
      locale,
      profileId,
      resource: child,
      // Only the folder itself is renamed; its contents keep their titles, so
      // the copy reads like the original rather than "Copia de" everywhere.
      title: child.title,
      userId,
    });
    if (!copied) {
      continue;
    }

    duplicatedCount += copied.duplicatedCount;
    addResourceToFolder({
      folderId: folder.id,
      resourceId: copied.resource.id,
      userId,
    });
  }

  return { duplicatedCount, resource: toResource(folder.id, userId) };
}

function toResource(resourceId: string, userId: string): StoredResource {
  const resource = findResourceForUser(resourceId, userId);
  if (!resource) {
    throw new Error(`Could not load the duplicated resource ${resourceId}.`);
  }
  return resource;
}
