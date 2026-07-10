# User File Storage

Mister F stores user-owned binary files in DigitalOcean Spaces through an
object-storage-compatible boundary. The first shared bucket is:

- Production bucket: `misterf.us-files`
- Development bucket: `misterf.us-files-dev`
- Region: `atl1`
- App root prefix: `misterf/`

The buckets are dedicated to Mister F user files. All files created by Mister F
must still live under the `misterf/` prefix so app-owned objects remain grouped
and future tooling can share one root convention.

## Goals

- Keep large binary files out of SQLite.
- Give generated and uploaded files a stable storage key that can be referenced
  by app metadata.
- Support private user files by default, with an explicit public-delivery MVP
  exception for immutable scene-media image and audio assets.
- Keep the domain model independent from the provider so local disk, test fakes,
  or another object store can be swapped without changing feature code.
- Preserve enough metadata to audit ownership, lifecycle state, provenance, and
  derived-resource access.

## Provider Boundary

Feature code should depend on a small storage interface, not directly on
DigitalOcean Spaces or S3 SDK classes:

```ts
interface UserFileStorageProvider {
  putObject(input: {
    key: string;
    contentType: string;
    body: Uint8Array | Buffer;
    cacheControl?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    storageKey: string;
    sizeBytes: number;
  }>;

  deleteObject(storageKey: string): Promise<void>;

  createReadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
  }): Promise<string>;
}
```

The production adapter should use DigitalOcean Spaces' S3-compatible API. Tests
should use an in-memory or temp-directory fake and must not call DigitalOcean.

## Key Layout

Storage keys are internal implementation details and should not encode user
input directly. Use stable ids and generated file names.

Recommended layout:

```text
misterf/users/{userId}/{domain}/{ownerEntityId}/{fileRole}/{fileId}.{ext}
```

Examples:

```text
misterf/users/user_123/scene-media/media_user_456/audio/file_789.mp3
misterf/users/user_123/scene-media/media_user_456/image/file_790.png
misterf/users/user_123/roleplay-attempts/attempt_abc/audio/file_def.webm
```

Rules:

- The first path segment after the bucket must be `misterf`.
- Separate production and development by bucket, not only by path prefix.
- Include the owning user id for private user files.
- Include the feature domain and owner entity id so cleanup jobs can find
  related objects.
- Do not put raw titles, learner names, email addresses, prompts, or other PII
  in object keys.
- Keep file extensions consistent with the stored `contentType`.

## Access Model

The bucket should remain private. App surfaces should never persist broad public
URLs for private user files.

Preferred delivery pattern:

1. Persist the storage key plus metadata in SQLite.
2. Validate ownership or resource-grant access in the app.
3. Create a short-lived read URL or serve through an app endpoint.
4. Return the resolved render payload to the browser.

Built-in public assets can continue living under app public folders. Generated
or uploaded user files should use object storage, even when a derived resource
needs to render them for students or shared-link guests.

### Scene Media MVP Public-Delivery Exception

For the V3 scene-media MVP, generated image and audio objects may be exposed
through stable public CDN URLs. This is an intentional product tradeoff: fast
browser and edge caching is more important in this phase than preventing someone
who already has an asset URL from opening the binary directly.

The exception applies only to immutable scene-media binaries. The media library,
metadata, prompts, ownership records, scripts, and management actions remain
profile-authorized application data. Object keys must use opaque generated ids,
must never contain user-provided text or PII, and must never be overwritten. A
changed image or audio layer receives a new key and URL.

Scene-media responses should use a long-lived cache policy such as
`public, max-age=31536000, immutable` and a stable CDN URL without a changing
presigned query string. The database should continue storing `storageKey` as the
provider-independent source reference; public delivery URLs are derived render
data, not ownership evidence.

This exception is technical debt to revisit after the media-resource sharing
model exists. The future design may put edge authorization, signed CDN access,
or grant-aware delivery in front of the same immutable keys without changing the
scene-media domain contract.

## Metadata To Persist

Each user-file-backed domain object should persist enough metadata for access
checks and lifecycle management:

- `storageKey`
- `bucket`
- `region`
- `contentType`
- `sizeBytes`
- optional checksum/hash
- owner user id
- owner profile id when useful for UX or filtering
- domain owner id, such as `mediaId` or `attemptId`
- file role, such as `image`, `audio`, `transcript`, or `attachment`
- lifecycle status, such as `pending`, `ready`, `failed`, or `archived`
- creation timestamp and optional deletion/archive timestamp

Do not rely on object storage as the source of truth for application ownership.
The database owns access rules; Spaces stores bytes.

## Scene Media Use

User-generated scene media should store scripts and searchable metadata in the
database. Generated audio and images should store binary files in object
storage, referenced by `storageKey` from the scene media metadata.

If a user-generated media item reuses a built-in image, only the generated
layers need object storage. The media item can reference the built-in image by
`visualAssetId` while storing generated audio or image layers under
`misterf/users/...` in the configured environment bucket.

Derived resources should reference `sourceMediaId` and should receive grants
that let their students render the required media without exposing the owner's
whole media library.

## Configuration

Production should use environment variables for all provider credentials and
location values. Do not commit Spaces access keys.

Suggested variables:

```text
USER_FILE_STORAGE_PROVIDER=spaces
USER_FILE_STORAGE_BUCKET=misterf.us-files
USER_FILE_STORAGE_REGION=atl1
USER_FILE_STORAGE_ROOT_PREFIX=misterf
DO_SPACES_ENDPOINT=https://atl1.digitaloceanspaces.com
DO_SPACES_ACCESS_KEY=...
DO_SPACES_SECRET_KEY=...
```

Development should use:

```text
USER_FILE_STORAGE_PROVIDER=spaces
USER_FILE_STORAGE_BUCKET=misterf.us-files-dev
USER_FILE_STORAGE_REGION=atl1
USER_FILE_STORAGE_ROOT_PREFIX=misterf
DO_SPACES_ENDPOINT=https://atl1.digitaloceanspaces.com
DO_SPACES_ACCESS_KEY=...
DO_SPACES_SECRET_KEY=...
```

Local development may use either:

- a local-disk adapter rooted in an ignored directory; or
- the development Spaces bucket `misterf.us-files-dev`.

## Operational Notes

- A zero-byte marker object exists at `misterf/` in each bucket so the app
  prefix appears as a folder in Spaces UI.
- Provisioning keys used to create or update bucket structure should be
  temporary and revoked after use.
- Application runtime keys should be scoped as narrowly as DigitalOcean Spaces
  allows and stored only in environment variables or deployment secrets.
- Cleanup jobs should archive database records first, then delete objects after
  retention rules allow deletion.
