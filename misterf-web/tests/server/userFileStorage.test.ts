import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  DO_SPACES_ENDPOINT: process.env.DO_SPACES_ENDPOINT,
  ENV_FILE: process.env.ENV_FILE,
  USER_FILE_STORAGE_BUCKET: process.env.USER_FILE_STORAGE_BUCKET,
  USER_FILE_STORAGE_REGION: process.env.USER_FILE_STORAGE_REGION,
  USER_FILE_STORAGE_ROOT_PREFIX: process.env.USER_FILE_STORAGE_ROOT_PREFIX,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('user file storage', () => {
  it('builds scene media storage keys under the configured root prefix', async () => {
    process.env.ENV_FILE = '/dev/null';
    process.env.USER_FILE_STORAGE_ROOT_PREFIX = 'misterf';
    vi.resetModules();
    const { createSceneMediaStorageKey } = await import(
      '../../src/server/storage/userFileStorage.js'
    );

    expect(createSceneMediaStorageKey({
      extension: '.png',
      fileId: 'file_123',
      fileRole: 'image',
      mediaId: 'media_456',
      userId: 'user_789',
    })).toBe('misterf/users/user_789/scene-media/media_456/image/file_123.png');
  });

  it('rejects unsafe scene media storage key segments', async () => {
    process.env.ENV_FILE = '/dev/null';
    vi.resetModules();
    const { createSceneMediaStorageKey } = await import(
      '../../src/server/storage/userFileStorage.js'
    );

    expect(() => createSceneMediaStorageKey({
      extension: 'png',
      fileId: 'file_123',
      fileRole: 'image',
      mediaId: '../media',
      userId: 'user_789',
    })).toThrow('Invalid media id.');
  });

  it('creates presigned DigitalOcean Spaces read URLs without exposing the secret', async () => {
    const { SpacesUserFileStorageProvider } = await import(
      '../../src/server/storage/userFileStorage.js'
    );
    const provider = new SpacesUserFileStorageProvider({
      accessKey: 'test-access-key',
      bucket: 'misterf.us-files-dev',
      endpoint: 'https://atl1.digitaloceanspaces.com',
      region: 'atl1',
      rootPrefix: 'misterf',
      secretKey: 'test-secret-key',
    });

    const url = await provider.createReadUrl({
      expiresInSeconds: 60,
      storageKey: 'misterf/users/user_1/scene-media/media_1/image/file_1.png',
    });

    expect(url).toContain('https://atl1.digitaloceanspaces.com/misterf.us-files-dev/');
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Expires=60');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).not.toContain('test-secret-key');
  });

  it('signs PUT requests to DigitalOcean Spaces', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const { SpacesUserFileStorageProvider } = await import(
      '../../src/server/storage/userFileStorage.js'
    );
    const provider = new SpacesUserFileStorageProvider({
      accessKey: 'test-access-key',
      bucket: 'misterf.us-files-dev',
      endpoint: 'https://atl1.digitaloceanspaces.com',
      region: 'atl1',
      rootPrefix: 'misterf',
      secretKey: 'test-secret-key',
    });

    const result = await provider.putObject({
      body: Buffer.from('image-bytes'),
      cacheControl: 'private, max-age=60',
      contentType: 'image/png',
      key: 'misterf/users/user_1/scene-media/media_1/image/file_1.png',
      metadata: {
        mediaId: 'media_1',
      },
    });

    expect(result).toEqual({
      sizeBytes: 11,
      storageKey: 'misterf/users/user_1/scene-media/media_1/image/file_1.png',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://atl1.digitaloceanspaces.com/misterf.us-files-dev/misterf/users/user_1/scene-media/media_1/image/file_1.png',
    );
    expect(init?.method).toBe('PUT');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256');
    expect(headers['content-type']).toBe('image/png');
    expect(headers['cache-control']).toBe('private, max-age=60');
    expect(headers['x-amz-meta-mediaid']).toBe('media_1');
  });
});
