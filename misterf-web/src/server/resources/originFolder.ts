import { listResourceFolderPath, type StoredResource } from '../db/repository.js';

export interface OriginFolderContext {
  /** The folder a new resource is being created into, if valid; else null. */
  originFolderId: string | null;
  /** Folder ancestry (root → target) for the creation breadcrumb; empty when none. */
  originFolderPath: StoredResource[];
}

/**
 * Resolves the "origin folder" a resource is being created into, from a raw
 * value taken off the `-new` request (`?folder=` query on GET, hidden field on
 * POST). `listResourceFolderPath` returns the chain including the target folder
 * only when it is a real folder owned by the user, so an empty path means the
 * value was missing or invalid and we fall back to the area root.
 */
export function resolveOriginFolderContext(
  rawFolderId: unknown,
  userId: string,
): OriginFolderContext {
  const folderId = typeof rawFolderId === 'string' ? rawFolderId.trim().slice(0, 100) : '';
  if (!folderId) {
    return { originFolderId: null, originFolderPath: [] };
  }

  const originFolderPath = listResourceFolderPath(folderId, userId);
  if (originFolderPath.length === 0) {
    return { originFolderId: null, originFolderPath: [] };
  }

  return { originFolderId: folderId, originFolderPath };
}
