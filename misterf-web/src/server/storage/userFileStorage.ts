import { createHash, createHmac, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export type UserFileStoragePutInput = {
  body: Buffer | Uint8Array;
  cacheControl?: string;
  contentType: string;
  key: string;
  metadata?: Record<string, string>;
};

export type UserFileStoragePutResult = {
  sizeBytes: number;
  storageKey: string;
};

export type UserFileStorageReadUrlInput = {
  expiresInSeconds: number;
  storageKey: string;
};

export type UserFileStorageProvider = {
  createReadUrl(input: UserFileStorageReadUrlInput): Promise<string>;
  deleteObject(storageKey: string): Promise<void>;
  putObject(input: UserFileStoragePutInput): Promise<UserFileStoragePutResult>;
};

export type SpacesUserFileStorageConfig = {
  accessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
  rootPrefix: string;
  secretKey: string;
};

type SignedRequest = {
  headers: Record<string, string>;
  url: string;
};

const service = 's3';
const unsignedPayload = 'UNSIGNED-PAYLOAD';

export class UserFileStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFileStorageConfigurationError';
  }
}

export class UserFileStorageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFileStorageOperationError';
  }
}

export class SpacesUserFileStorageProvider implements UserFileStorageProvider {
  private readonly config: SpacesUserFileStorageConfig;

  constructor(config: SpacesUserFileStorageConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint.replace(/\/+$/, ''),
      rootPrefix: normalizePathSegment(config.rootPrefix, 'root prefix'),
    };
  }

  async putObject(input: UserFileStoragePutInput): Promise<UserFileStoragePutResult> {
    const storageKey = normalizeStorageKey(input.key);
    const body = Buffer.from(input.body);
    const payloadHash = sha256Hex(body);
    const metadataHeaders = normalizeMetadataHeaders(input.metadata ?? {});
    const headers: Record<string, string> = {
      'content-length': String(body.byteLength),
      'content-type': input.contentType,
      'x-amz-content-sha256': payloadHash,
      ...metadataHeaders,
    };
    if (input.cacheControl) {
      headers['cache-control'] = input.cacheControl;
    }

    const signedRequest = this.signHeaderRequest({
      headers,
      method: 'PUT',
      payloadHash,
      storageKey,
    });
    const response = await fetch(signedRequest.url, {
      body,
      headers: signedRequest.headers,
      method: 'PUT',
    });

    if (!response.ok) {
      throw new UserFileStorageOperationError(
        `Spaces PUT failed with HTTP ${response.status}.`,
      );
    }

    return {
      sizeBytes: body.byteLength,
      storageKey,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const signedRequest = this.signHeaderRequest({
      headers: {
        'x-amz-content-sha256': sha256Hex(Buffer.alloc(0)),
      },
      method: 'DELETE',
      payloadHash: sha256Hex(Buffer.alloc(0)),
      storageKey: normalizeStorageKey(storageKey),
    });
    const response = await fetch(signedRequest.url, {
      headers: signedRequest.headers,
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      throw new UserFileStorageOperationError(
        `Spaces DELETE failed with HTTP ${response.status}.`,
      );
    }
  }

  async createReadUrl(input: UserFileStorageReadUrlInput): Promise<string> {
    const expiresInSeconds = Math.max(
      1,
      Math.min(Math.floor(input.expiresInSeconds), 604800),
    );
    return this.signPresignedGetUrl({
      expiresInSeconds,
      storageKey: normalizeStorageKey(input.storageKey),
    });
  }

  private signHeaderRequest(input: {
    headers: Record<string, string>;
    method: 'DELETE' | 'PUT';
    payloadHash: string;
    storageKey: string;
  }): SignedRequest {
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const datestamp = amzDate.slice(0, 8);
    const { canonicalUri, url } = this.objectUrl(input.storageKey);
    const headers = normalizeHeaders({
      ...input.headers,
      host: new URL(url).host,
      'x-amz-date': amzDate,
    });
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((headerName) => `${headerName}:${headers[headerName]}\n`)
      .join('');
    const canonicalRequest = [
      input.method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      input.payloadHash,
    ].join('\n');
    const credentialScope = buildCredentialScope(datestamp, this.config.region);
    const stringToSign = buildStringToSign({
      amzDate,
      canonicalRequest,
      credentialScope,
    });
    const signature = hmacHex(
      getSigningKey(this.config.secretKey, datestamp, this.config.region),
      stringToSign,
    );

    return {
      headers: {
        ...headers,
        authorization: [
          'AWS4-HMAC-SHA256',
          `Credential=${this.config.accessKey}/${credentialScope}`,
          `SignedHeaders=${signedHeaders}`,
          `Signature=${signature}`,
        ].join(', '),
      },
      url,
    };
  }

  private signPresignedGetUrl(input: {
    expiresInSeconds: number;
    storageKey: string;
  }): string {
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const datestamp = amzDate.slice(0, 8);
    const credentialScope = buildCredentialScope(datestamp, this.config.region);
    const { canonicalUri, url } = this.objectUrl(input.storageKey);
    const urlObject = new URL(url);
    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.accessKey}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(input.expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    });
    const canonicalQuery = canonicalizeSearchParams(query);
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuery,
      `host:${urlObject.host}\n`,
      'host',
      unsignedPayload,
    ].join('\n');
    const stringToSign = buildStringToSign({
      amzDate,
      canonicalRequest,
      credentialScope,
    });
    const signature = hmacHex(
      getSigningKey(this.config.secretKey, datestamp, this.config.region),
      stringToSign,
    );
    query.set('X-Amz-Signature', signature);
    urlObject.search = query.toString();
    return urlObject.toString();
  }

  private objectUrl(storageKey: string): {
    canonicalUri: string;
    url: string;
  } {
    const encodedKey = storageKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const bucket = normalizePathSegment(this.config.bucket, 'bucket');
    const canonicalUri = `/${bucket}/${encodedKey}`;
    return {
      canonicalUri,
      url: `${this.config.endpoint}${canonicalUri}`,
    };
  }
}

export function getUserFileStorageProvider(): UserFileStorageProvider {
  if (env.userFileStorageProvider !== 'spaces') {
    throw new UserFileStorageConfigurationError(
      `Unsupported user file storage provider: ${env.userFileStorageProvider}.`,
    );
  }

  if (!env.doSpacesAccessKey || !env.doSpacesSecretKey) {
    throw new UserFileStorageConfigurationError(
      'Missing DO_SPACES_ACCESS_KEY or DO_SPACES_SECRET_KEY for user file storage.',
    );
  }

  return new SpacesUserFileStorageProvider({
    accessKey: env.doSpacesAccessKey,
    bucket: env.userFileStorageBucket,
    endpoint: env.doSpacesEndpoint,
    region: env.userFileStorageRegion,
    rootPrefix: env.userFileStorageRootPrefix,
    secretKey: env.doSpacesSecretKey,
  });
}

export function createSceneMediaStorageKey(input: {
  extension: string;
  fileId?: string;
  fileRole: 'audio' | 'image';
  mediaId: string;
  userId: string;
}, rootPrefix = env.userFileStorageRootPrefix): string {
  const extension = normalizeExtension(input.extension);
  const fileId = input.fileId
    ? normalizePathSegment(input.fileId, 'file id')
    : `file_${randomUUID()}`;

  return [
    normalizePathSegment(rootPrefix, 'root prefix'),
    'users',
    normalizePathSegment(input.userId, 'user id'),
    'scene-media',
    normalizePathSegment(input.mediaId, 'media id'),
    input.fileRole,
    `${fileId}.${extension}`,
  ].join('/');
}

function normalizeStorageKey(storageKey: string): string {
  const trimmed = storageKey.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('..')) {
    throw new UserFileStorageConfigurationError('Invalid storage key.');
  }
  return trimmed
    .split('/')
    .map((segment) => normalizePathSegment(segment, 'storage key segment'))
    .join('/');
}

function normalizePathSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new UserFileStorageConfigurationError(`Invalid ${label}.`);
  }
  return trimmed;
}

function normalizeExtension(value: string): string {
  const extension = value.trim().replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]+$/.test(extension)) {
    throw new UserFileStorageConfigurationError('Invalid file extension.');
  }
  return extension;
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = value.trim().replace(/\s+/g, ' ');
  }
  return normalized;
}

function normalizeMetadataHeaders(
  metadata: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(metadata)) {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!safeName) {
      continue;
    }
    headers[`x-amz-meta-${safeName}`] = value.trim();
  }
  return headers;
}

function canonicalizeSearchParams(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`)
    .join('&');
}

function buildCredentialScope(datestamp: string, region: string): string {
  return `${datestamp}/${region}/${service}/aws4_request`;
}

function buildStringToSign(input: {
  amzDate: string;
  canonicalRequest: string;
  credentialScope: string;
}): string {
  return [
    'AWS4-HMAC-SHA256',
    input.amzDate,
    input.credentialScope,
    sha256Hex(Buffer.from(input.canonicalRequest, 'utf8')),
  ].join('\n');
}

function getSigningKey(secretKey: string, datestamp: string, region: string): Buffer {
  const dateKey = hmacBuffer(Buffer.from(`AWS4${secretKey}`, 'utf8'), datestamp);
  const dateRegionKey = hmacBuffer(dateKey, region);
  const dateRegionServiceKey = hmacBuffer(dateRegionKey, service);
  return hmacBuffer(dateRegionServiceKey, 'aws4_request');
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacBuffer(key: Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
