/**
 * Content sniffing for uploaded attachments.
 *
 * The declared content type and the file extension are both user-controlled and
 * are treated as claims to be checked, never as facts. The byte signature
 * decides what a file is; the claims only have to agree with it.
 */

import { maxUploadBytes } from './limits.js';
import {
  AttachmentRejectedError,
  type AttachmentSourceType,
  type RawAttachmentUpload,
} from './types.js';

export type SniffedContent = {
  contentType: string;
  sourceType: AttachmentSourceType;
};

type Signature = {
  contentType: string;
  /** Byte prefix that identifies the format. */
  magic: number[];
  /** Offset at which `magic` must appear. */
  offset: number;
  sourceType: AttachmentSourceType;
  /**
   * Extra check for container formats whose prefix is shared with other
   * formats, such as the ZIP header that every OOXML file starts with.
   */
  verify?: (bytes: Buffer) => boolean;
};

const asciiBytes = (text: string): number[] =>
  [...text].map((character) => character.charCodeAt(0));

const signatures: Signature[] = [
  {
    contentType: 'application/pdf',
    magic: asciiBytes('%PDF-'),
    offset: 0,
    sourceType: 'pdf',
  },
  {
    contentType: 'image/png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    sourceType: 'image',
  },
  {
    contentType: 'image/jpeg',
    magic: [0xff, 0xd8, 0xff],
    offset: 0,
    sourceType: 'image',
  },
  {
    contentType: 'image/webp',
    magic: asciiBytes('WEBP'),
    offset: 8,
    sourceType: 'image',
    // The RIFF container is generic; 'WEBP' at offset 8 is what makes it an
    // image rather than, say, a WAV file.
    verify: (bytes) => bytes.subarray(0, 4).toString('latin1') === 'RIFF',
  },
  {
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
    sourceType: 'docx',
    verify: isOfficeOpenXml,
  },
];

/**
 * Every OOXML file is a ZIP whose part list lives in `[Content_Types].xml`. The
 * entry name appears in a local file header near the start, so a short prefix
 * scan separates a real .docx from an arbitrary .zip without unzipping it.
 */
function isOfficeOpenXml(bytes: Buffer): boolean {
  const prefix = bytes.subarray(0, 4096).toString('latin1');
  return prefix.includes('[Content_Types].xml');
}

function matches(bytes: Buffer, signature: Signature): boolean {
  const end = signature.offset + signature.magic.length;
  if (bytes.length < end) {
    return false;
  }

  for (let index = 0; index < signature.magic.length; index += 1) {
    if (bytes[signature.offset + index] !== signature.magic[index]) {
      return false;
    }
  }

  return signature.verify ? signature.verify(bytes) : true;
}

/** Extensions accepted for each sniffed source type. */
const allowedExtensions: Record<AttachmentSourceType, string[]> = {
  docx: ['docx'],
  image: ['jpeg', 'jpg', 'png', 'webp'],
  pdf: ['pdf'],
  url: [],
};

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

/**
 * Determines what an upload actually is, and rejects it when the bytes, the
 * declared type, or the extension disagree.
 */
export function sniffAttachment(upload: RawAttachmentUpload): SniffedContent {
  if (upload.bytes.length === 0) {
    throw new AttachmentRejectedError('empty_file');
  }

  const signature = signatures.find((candidate) =>
    matches(upload.bytes, candidate),
  );
  if (!signature) {
    throw new AttachmentRejectedError('unsupported_type');
  }

  const limit = maxUploadBytes[signature.sourceType];
  if (upload.bytes.length > limit) {
    throw new AttachmentRejectedError('too_large', {
      limitMb: Math.floor(limit / (1024 * 1024)),
    });
  }

  const extension = extensionOf(upload.fileName);
  if (
    extension &&
    !allowedExtensions[signature.sourceType].includes(extension)
  ) {
    throw new AttachmentRejectedError('content_mismatch');
  }

  // A mismatched declared type is a strong signal of a crafted request; the
  // bytes already decided the answer, so the claim only has to not contradict
  // it. A missing or generic claim is fine.
  const declared = upload.declaredContentType.split(';')[0].trim().toLowerCase();
  const declaredIsGeneric =
    declared === '' ||
    declared === 'application/octet-stream' ||
    declared === 'application/binary';
  if (!declaredIsGeneric && declared !== signature.contentType) {
    const declaredIsEquivalentJpeg =
      signature.contentType === 'image/jpeg' && declared === 'image/jpg';
    if (!declaredIsEquivalentJpeg) {
      throw new AttachmentRejectedError('content_mismatch');
    }
  }

  return {
    contentType: signature.contentType,
    sourceType: signature.sourceType,
  };
}
