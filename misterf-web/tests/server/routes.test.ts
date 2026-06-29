import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-route-smoke-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'routes.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  vi.resetModules();

  const serverModule = await import('../../src/server/server.js');
  server = serverModule.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnvValue('APP_BASE_URL', originalAppBaseUrl);
  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
  restoreEnvValue('NODE_ENV', originalNodeEnv);
  restoreEnvValue('APP_SESSION_SECRET', originalSessionSecret);
});

describe('main route smoke tests', () => {
  it.each([
    '/',
    '/login',
    '/signup',
  ])('renders %s for anonymous visitors', async (route) => {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('Mr. F');
  });

  it.each([
    {
      location: '/resources',
      route: '/assignments',
    },
    {
      location: '/resources',
      route: '/practice-modules',
    },
    {
      location: '/resources',
      route: '/chatrooms',
    },
    {
      location: '/resources',
      route: '/chatroom-conversations/test-conversation',
    },
    {
      location: '/login',
      route: '/progress',
    },
    {
      location: '/login',
      route: '/resources',
    },
    {
      location: '/login',
      route: '/resources/folders/test-folder',
    },
    {
      location: '/login',
      route: '/credits',
    },
    {
      location: '/login',
      route: '/settings',
    },
  ])('redirects anonymous visitors from $route to $location', async ({ location, route }) => {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(location);
  });

  it('renders and accepts generic live resource share links', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createAssignment,
      createPracticeModule,
      createProfile,
      createResourceFolder,
      createRoleplay,
      findResourceAccessForProfile,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-share-owner@example.com',
      emailVerified: true,
      fullName: 'Route Share Owner',
      provider: 'google',
      providerSubject: 'route-share-owner',
    });
    const ownerProfile = createProfile({
      name: 'Route share owner profile',
      userId: owner.id,
    });
    const receiver = createExternalUser({
      email: 'route-share-receiver@example.com',
      emailVerified: true,
      fullName: 'Route Share Receiver',
      provider: 'google',
      providerSubject: 'route-share-receiver',
    });
    const receiverProfile = createProfile({
      name: 'Route share receiver profile',
      userId: receiver.id,
    });
    const assignment = createAssignment({
      description: 'Route shared assignment.',
      instructions: '',
      profileId: ownerProfile.id,
      quiz: { blocks: [], title: 'Route Shared Assignment' },
      title: 'Route Shared Assignment',
      userId: owner.id,
    });
    const practiceGuide = createPracticeModule({
      description: 'Route shared practice guide.',
      profileId: ownerProfile.id,
      title: 'Route Shared Guide',
      tutorInstructions: 'Practice route sharing.',
      userId: owner.id,
    });
    const folder = createResourceFolder({
      description: 'Route shared folder.',
      profileId: ownerProfile.id,
      title: 'Route Shared Folder',
      userId: owner.id,
    });
    const roleplay = createRoleplay({
      characters: [
        {
          description: 'A learner ordering lunch politely.',
          id: 'learner',
          name: 'Learner',
        },
        {
          description: 'A helpful cafe server who helps the customer choose food.',
          id: 'ai',
          name: 'Server',
        },
      ],
      description: 'Route shared roleplay.',
      level: 'A2',
      pedagogicalFocus: 'Evaluate polite requests and restaurant vocabulary.',
      profileId: ownerProfile.id,
      scenario: 'A customer orders lunch at a cafe. The learner wants to order lunch politely.',
      title: 'Route Shared Roleplay',
      userId: owner.id,
    });
    const sharedResources = [
      {
        detailPath: `/assignments/${assignment.id}`,
        id: assignment.id,
        title: 'Route Shared Assignment',
      },
      {
        detailPath: `/practice-modules/${practiceGuide.id}`,
        id: practiceGuide.id,
        title: 'Route Shared Guide',
      },
      {
        detailPath: `/resources/folders/${folder.id}`,
        id: folder.id,
        title: 'Route Shared Folder',
      },
      {
        detailPath: `/roleplays/${roleplay.id}`,
        id: roleplay.id,
        title: 'Route Shared Roleplay',
      },
    ];
    const receiverCookie = await createAuthenticatedCookie(receiver.id, receiverProfile.id);

    for (const resource of sharedResources) {
      const shareLink = getOrCreateResourceShareLink(resource.id);

      const anonymousResponse = await fetch(`${baseUrl}/resources/shared/${shareLink.id}`, {
        redirect: 'manual',
      });
      const anonymousHtml = await anonymousResponse.text();
      expect(anonymousResponse.status).toBe(200);
      expect(anonymousHtml).toContain(resource.title);
      expect(anonymousHtml).toContain(`/login?returnTo=%2Fresources%2Fshared%2F${shareLink.id}`);

      const authenticatedResponse = await fetch(`${baseUrl}/resources/shared/${shareLink.id}`, {
        headers: { cookie: receiverCookie },
        redirect: 'manual',
      });
      const authenticatedHtml = await authenticatedResponse.text();
      expect(authenticatedResponse.status).toBe(200);
      expect(authenticatedHtml).toContain('Agregar a mis recursos');

      const acceptResponse = await postForm(
        `/resources/shared/${shareLink.id}/accept`,
        {
          _csrf: extractCsrfToken(authenticatedHtml),
        },
        receiverCookie,
      );

      expect(acceptResponse.status).toBe(302);
      expect(acceptResponse.headers.get('location')).toBe(resource.detailPath);
      expect(findResourceAccessForProfile({
        profileId: receiverProfile.id,
        resourceId: resource.id,
        userId: receiver.id,
      })).toEqual(expect.objectContaining({
        accessKind: 'shared',
        id: resource.id,
        shareLinkId: shareLink.id,
      }));
    }
  });

  it('shares resource folders with another profile as live access grants', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createResourceFolder,
      findResourceAccessForProfile,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-profile-share-owner@example.com',
      emailVerified: true,
      fullName: 'Route Profile Share Owner',
      provider: 'google',
      providerSubject: 'route-profile-share-owner',
    });
    const sourceProfile = createProfile({
      name: 'Source profile',
      userId: owner.id,
    });
    const targetProfile = createProfile({
      name: 'Target profile',
      userId: owner.id,
    });
    const folder = createResourceFolder({
      description: 'Folder shared with a profile.',
      profileId: sourceProfile.id,
      title: 'Profile Shared Folder',
      userId: owner.id,
    });
    const ownerCookie = await createAuthenticatedCookie(owner.id, sourceProfile.id);

    const folderResponse = await fetch(`${baseUrl}/resources/folders/${folder.id}?share=profile`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const folderHtml = await folderResponse.text();
    expect(folderResponse.status).toBe(200);
    expect(folderHtml).toContain('Compartir con perfil');
    expect(folderHtml).toContain('Target profile');

    const shareResponse = await postForm(
      `/resources/${folder.id}/share/profile`,
      {
        _csrf: extractCsrfToken(folderHtml),
        returnTo: `/resources/folders/${folder.id}`,
        targetProfileId: targetProfile.id,
      },
      ownerCookie,
    );

    expect(shareResponse.status).toBe(302);
    expect(shareResponse.headers.get('location')).toBe(`/resources/folders/${folder.id}`);
    expect(findResourceAccessForProfile({
      profileId: targetProfile.id,
      resourceId: folder.id,
      userId: owner.id,
    })).toEqual(expect.objectContaining({
      accessKind: 'shared',
      grantedVia: 'profile',
      id: folder.id,
    }));
  });

  it('renders roleplay detail pages', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createRoleplay,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-roleplay-owner@example.com',
      emailVerified: true,
      fullName: 'Route Roleplay Owner',
      provider: 'google',
      providerSubject: 'route-roleplay-owner',
    });
    const profile = createProfile({
      name: 'Route roleplay profile',
      userId: owner.id,
    });
    const roleplay = createRoleplay({
      characters: [
        {
          description: 'A visitor asking for directions politely.',
          id: 'learner',
          name: 'Learner',
        },
        {
          description: 'A local resident who gives clear directions in a friendly way.',
          id: 'ai',
          name: 'Local',
        },
      ],
      description: 'A roleplay for asking for directions.',
      level: 'A2',
      maxLearnerTurns: 3,
      pedagogicalFocus: 'Evaluate question forms and direction vocabulary.',
      profileId: profile.id,
      scenario: 'A visitor asks a local resident how to find a museum. The learner is trying to find the museum.',
      title: 'Directions Roleplay',
      userId: owner.id,
    });
    const cookie = await createAuthenticatedCookie(owner.id, profile.id);

    const detailResponse = await fetch(`${baseUrl}/roleplays/${roleplay.id}`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain('Directions Roleplay');
    expect(detailHtml).toContain('Comenzar');
    expect(detailHtml).toContain('Compartir');
  });

  it('redirects legacy assignment and practice guide links into generic share links', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createAssignment,
      createPracticeModule,
      createProfile,
      getOrCreateAssignmentShareLink,
      getOrCreatePracticeModuleShareLink,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-legacy-share-owner@example.com',
      emailVerified: true,
      fullName: 'Route Legacy Share Owner',
      provider: 'google',
      providerSubject: 'route-legacy-share-owner',
    });
    const profile = createProfile({
      name: 'Legacy share profile',
      userId: owner.id,
    });
    const assignment = createAssignment({
      description: 'Legacy assignment share.',
      instructions: '',
      profileId: profile.id,
      quiz: { blocks: [], title: 'Legacy Assignment Share' },
      title: 'Legacy Assignment Share',
      userId: owner.id,
    });
    const practiceGuide = createPracticeModule({
      description: 'Legacy guide share.',
      profileId: profile.id,
      title: 'Legacy Guide Share',
      tutorInstructions: 'Practice.',
      userId: owner.id,
    });
    const assignmentShareLink = getOrCreateAssignmentShareLink(assignment.id);
    const practiceGuideShareLink = getOrCreatePracticeModuleShareLink(practiceGuide.id);

    const assignmentResponse = await fetch(
      `${baseUrl}/assignments/shared/${assignmentShareLink.id}`,
      { redirect: 'manual' },
    );
    const assignmentResourceShareLink = getOrCreateResourceShareLink(assignment.id);
    expect(assignmentResponse.status).toBe(302);
    expect(assignmentResponse.headers.get('location')).toBe(
      `/resources/shared/${assignmentResourceShareLink.id}`,
    );

    const practiceGuideResponse = await fetch(
      `${baseUrl}/practice-modules/shared/${practiceGuideShareLink.id}`,
      { redirect: 'manual' },
    );
    const practiceGuideResourceShareLink = getOrCreateResourceShareLink(practiceGuide.id);
    expect(practiceGuideResponse.status).toBe(302);
    expect(practiceGuideResponse.headers.get('location')).toBe(
      `/resources/shared/${practiceGuideResourceShareLink.id}`,
    );
  });
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function createAuthenticatedCookie(
  userId: string,
  profileId: string,
): Promise<string> {
  const { createSession } = await import('../../src/server/auth/repository.js');
  const { activeProfileCookieName } = await import('../../src/server/auth/profiles.js');
  const {
    createSessionCookie,
    sessionCookieName,
  } = await import('../../src/server/auth/session.js');

  const session = createSessionCookie();
  createSession({
    expiresAt: session.expiresAt,
    tokenHash: session.tokenHash,
    userId,
  });

  return [
    `${sessionCookieName}=${encodeURIComponent(session.token)}`,
    `${activeProfileCookieName}=${encodeURIComponent(profileId)}`,
  ].join('; ');
}

function extractCsrfToken(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

function postForm(
  route: string,
  body: Record<string, string>,
  cookie: string,
): Promise<Response> {
  return fetch(`${baseUrl}${route}`, {
    body: new URLSearchParams(body),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie,
    },
    method: 'POST',
    redirect: 'manual',
  });
}
