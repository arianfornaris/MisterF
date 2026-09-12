import QRCode from 'qrcode';
import {
  findActiveResourceCopyLinkForResource,
  findProfileById,
  findResourceCopyOrigin,
} from '../db/repository.js';
import { buildAbsoluteAppUrl } from '../pages/shell.js';

/** Locals for `partials/resource-copy-link-modal.ejs`, shared by every owner surface. */
export type CopyLinkModalLocals = {
  copyLinkAutoOpen: boolean;
  copyLinkQrDataUrl: string;
  copyLinkResourceId: string;
  copyLinkReturnTo: string;
  copyLinkUrl: string;
};

/**
 * Builds the owner's "Compartir una copia" modal. The copy link is read, never
 * created, here: minting one is an explicit author action (it hands over the
 * answer key), so a page view must not produce a token.
 */
export async function buildCopyLinkModalLocals(input: {
  resourceId: string;
  returnTo: string;
  shareMode: unknown;
}): Promise<CopyLinkModalLocals> {
  const copyLink = findActiveResourceCopyLinkForResource(input.resourceId);
  const copyLinkUrl = copyLink
    ? buildAbsoluteAppUrl(`/resources/copy/${encodeURIComponent(copyLink.id)}`)
    : '';

  return {
    copyLinkAutoOpen: input.shareMode === 'copy',
    copyLinkQrDataUrl: copyLinkUrl
      ? await QRCode.toDataURL(copyLinkUrl, { margin: 1, width: 180 })
      : '',
    copyLinkResourceId: input.resourceId,
    copyLinkReturnTo: input.returnTo,
    copyLinkUrl,
  };
}

/**
 * The name to credit on a copied resource's pages ("Basado en un recurso de
 * …"), or '' for an original or when the origin profile no longer exists.
 */
export function findCopiedFromName(resourceId: string): string {
  const origin = findResourceCopyOrigin(resourceId);
  if (!origin?.originProfileId) {
    return '';
  }

  return findProfileById(origin.originProfileId)?.name.trim() ?? '';
}
