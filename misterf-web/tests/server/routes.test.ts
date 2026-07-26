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
      route: '/quizzes',
    },
    {
      location: '/resources',
      route: '/practice-guides',
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
      route: '/resources/trash',
    },
    {
      location: '/login',
      route: '/media-library',
    },
    {
      location: '/login',
      route: '/media-library/trash',
    },
    {
      location: '/login',
      route: '/media-library/airport-security-line-01-a1-a2',
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
      createQuiz,
      createPracticeGuide,
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
    const quiz = createQuiz({
      description: 'Route shared quiz.',
      instructions: '',
      profileId: ownerProfile.id,
      quiz: { blocks: [], title: 'Route Shared Quiz' },
      title: 'Route Shared Quiz',
      userId: owner.id,
    });
    const practiceGuide = createPracticeGuide({
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
      description: 'A customer orders lunch at a cafe. The learner wants to order lunch politely.',
      level: 'A2',
      profileId: ownerProfile.id,
      title: 'Route Shared Roleplay',
      userId: owner.id,
    });
    const sharedResources = [
      {
        detailPath: `/quizzes/${quiz.id}`,
        id: quiz.id,
        isQuiz: true,
        title: 'Route Shared Quiz',
      },
      {
        detailPath: `/practice-guides/${practiceGuide.id}`,
        id: practiceGuide.id,
        isStart: true,
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
        isStart: true,
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
      if (resource.isQuiz) {
        // Any shared quiz can be filled anonymously; no login wall on the page.
        expect(anonymousHtml).toContain('Hacer el quiz');
      } else if (resource.isStart) {
        // Roleplay/guide show a "Comenzar" call to action, no login wall.
        expect(anonymousHtml).toContain('Comenzar');
      } else {
        expect(anonymousHtml).toContain(`/login?returnTo=%2Fresources%2Fshared%2F${shareLink.id}`);
      }

      const authenticatedResponse = await fetch(`${baseUrl}/resources/shared/${shareLink.id}`, {
        headers: { cookie: receiverCookie },
        redirect: 'manual',
      });
      const authenticatedHtml = await authenticatedResponse.text();
      expect(authenticatedResponse.status).toBe(200);
      expect(authenticatedHtml).toContain(
        resource.isQuiz ? 'Hacer el quiz' : resource.isStart ? 'Comenzar' : 'Agregar a mis recursos',
      );

      // Only folders use the generic accept flow; quiz/roleplay/guide have their
      // own take/start flows tested separately.
      if (resource.isQuiz || resource.isStart) {
        continue;
      }

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
      findRoleplayForUser,
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
      description: 'A visitor asks a local resident how to find a museum. The learner is trying to find the museum.',
      level: 'A2',
      profileId: profile.id,
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
    expect(detailHtml).toContain('A visitor asks a local resident how to find a museum.');
    expect(detailHtml).not.toContain('Enfoque pedagógico');
    expect(detailHtml).not.toContain('Límite de turnos');
    expect(detailHtml).toContain('Comenzar');
    expect(detailHtml).toContain('Compartir');

    const editResponse = await fetch(`${baseUrl}/roleplays/${roleplay.id}/edit`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const editHtml = await editResponse.text();
    expect(editResponse.status).toBe(200);
    expect(editHtml).toContain('app-page-header app-page-header-has-close mb-4 pe-0');
    expect(editHtml).toContain('app-page-header-actions position-static flex-shrink-0');
    expect(editHtml).toContain('name="description"');
    expect(editHtml).toContain(`data-roleplay-modify-endpoint="/roleplays/${roleplay.id}/edit/modify"`);
    expect(editHtml).toContain(`data-roleplay-modify-apply-endpoint="/roleplays/${roleplay.id}/edit/modify/apply"`);
    expect(editHtml).toContain(`data-roleplay-modify-discard-endpoint="/roleplays/${roleplay.id}/edit/modify/discard"`);
    expect(editHtml.match(/data-roleplay-modify-open/g)).toHaveLength(1);
    expect(editHtml).toContain('data-roleplay-modify-modal');
    expect(editHtml).toContain('modal-dialog-scrollable');
    expect(editHtml).not.toContain('data-roleplay-modify-form');
    expect(editHtml).toContain('data-roleplay-modify-comparison');
    expect(editHtml).toContain('data-roleplay-modify-phase="preview"');
    expect(editHtml).toContain('Aprobar y guardar');
    expect(editHtml).toContain('name="requestedChange"');
    expect(editHtml).toContain('Modificar con IA');
    expect(editHtml).not.toContain('Chat IA');
    expect(editHtml).not.toContain('data-authoring-chat-form');
    expect(editHtml).not.toContain('authoring-tabs');
    expect(editHtml).toContain('<select class="form-select" id="roleplayLevel" name="level" required>');
    expect(editHtml).toContain('<option value="A1-A2"');
    expect(editHtml).toContain('<option value="B1-B2"');
    expect(editHtml).toContain('<option value="C1"');
    expect(editHtml).toContain('<option value="" disabled selected>');
    expect(editHtml).not.toContain('<input class="form-control" id="roleplayLevel"');
    expect(editHtml).toContain('name="learnerCharacterDescription"');
    expect(editHtml).toContain('name="aiCharacterDescription"');
    expect(editHtml).not.toContain('name="scenario"');
    expect(editHtml).not.toContain('name="pedagogicalFocus"');
    expect(editHtml).not.toContain('name="maxLearnerTurns"');

    const csrfToken = extractCsrfToken(editHtml);
    const editBody = {
      _csrf: csrfToken,
      aiCharacterDescription: 'A local resident who gives clear directions in a friendly way.',
      aiCharacterName: 'Local',
      description: 'A visitor asks a local resident how to find a museum.',
      learnerCharacterDescription: 'A visitor asking for directions politely.',
      learnerCharacterName: 'Learner',
      title: 'Directions Roleplay',
    };
    const invalidModificationResponse = await postForm(
      `/roleplays/${roleplay.id}/edit/modify`,
      {
        _csrf: csrfToken,
        currentDraft: '{}',
        requestedChange: 'Make it more specific.',
      },
      cookie,
    );
    expect(invalidModificationResponse.status).toBe(422);
    await expect(invalidModificationResponse.json()).resolves.toEqual({
      error: 'No se pudo generar esta modificación. Inténtalo de nuevo.',
    });
    const retiredEditChatResponse = await postForm(
      `/roleplays/${roleplay.id}/edit/revise`,
      { _csrf: csrfToken, message: 'Change the title.' },
      cookie,
    );
    expect(retiredEditChatResponse.status).toBe(404);
    const retiredLegacyChatResponse = await postForm(
      `/roleplays/${roleplay.id}/revise`,
      { _csrf: csrfToken, message: 'Change the title.' },
      cookie,
    );
    expect(retiredLegacyChatResponse.status).toBe(404);
    expect(findRoleplayForUser(roleplay.id, owner.id)).toEqual(expect.objectContaining({
      authoringMessages: [],
      level: 'A2',
      title: 'Directions Roleplay',
    }));

    const creditGate = await import('../../src/server/services/creditGate.js');
    const resourceDrafts = await import('../../src/server/services/resourceDrafts.js');
    const { storedRoleplayToDraft } = await import('../../src/server/services/roleplays.js');
    const storedDraft = storedRoleplayToDraft(roleplay);
    const creditKeySpy = vi
      .spyOn(creditGate, 'getCreditCheckedOpenRouterApiKeyForUser')
      .mockResolvedValue('test-openrouter-key');
    const revisionSpy = vi.spyOn(resourceDrafts, 'generateRoleplayRevision');
    try {
      const currentDraft = {
        characters: storedDraft.characters,
        description: 'An unsaved description supplied as current form context.',
        level: 'A1-A2',
        title: 'Unsaved Current Title',
      };
      const proposedDraft = {
        characters: [
          {
            ...currentDraft.characters.find((character) => character.id === 'learner')!,
            description: 'A traveler who needs precise directions.',
          },
          {
            ...currentDraft.characters.find((character) => character.id === 'ai')!,
            name: 'Museum Employee',
          },
        ],
        description: 'A modified description ready for review.',
        level: 'C1',
        title: 'Modified Roleplay Title',
      };
      revisionSpy.mockResolvedValueOnce({
        assistantMessage: 'I updated the requested Roleplay fields.',
        draft: proposedDraft,
      });
      const modificationRequest = 'Make the situation more advanced and update any relevant fields.';
      const successfulModificationResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify`,
        {
          _csrf: csrfToken,
          currentDraft: JSON.stringify(currentDraft),
          requestedChange: modificationRequest,
        },
        cookie,
      );
      expect(successfulModificationResponse.status).toBe(200);
      const modificationPreview = await successfulModificationResponse.json() as {
        changes: Array<{ after: string; before: string; field: string }>;
        previewId: string;
      };
      expect(modificationPreview.previewId).toEqual(expect.any(String));
      expect(modificationPreview.changes).toEqual([
        { after: 'Modified Roleplay Title', before: 'Unsaved Current Title', field: 'title' },
        {
          after: 'A modified description ready for review.',
          before: 'An unsaved description supplied as current form context.',
          field: 'description',
        },
        { after: 'C1', before: 'A1-A2', field: 'level' },
        {
          after: 'A traveler who needs precise directions.',
          before: 'A visitor asking for directions politely.',
          field: 'learner.description',
        },
        { after: 'Museum Employee', before: 'Local', field: 'ai.name' },
      ]);
      expect(revisionSpy).toHaveBeenCalledWith(expect.objectContaining({
        currentDraft,
        openRouterApiKey: 'test-openrouter-key',
        prompt: modificationRequest,
      }));
      expect(findRoleplayForUser(roleplay.id, owner.id)).toEqual(expect.objectContaining({
        characters: roleplay.characters,
        description: roleplay.description,
        level: 'A2',
        title: 'Directions Roleplay',
      }));

      const staleApplyResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: 'wrong-preview-id' },
        cookie,
      );
      expect(staleApplyResponse.status).toBe(409);

      const applyResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: modificationPreview.previewId },
        cookie,
      );
      expect(applyResponse.status).toBe(200);
      await expect(applyResponse.json()).resolves.toEqual({
        ok: true,
        redirect: `/roleplays/${roleplay.id}/edit`,
      });
      expect(findRoleplayForUser(roleplay.id, owner.id)).toEqual(expect.objectContaining({
        authoringMessages: [],
        characters: proposedDraft.characters,
        description: proposedDraft.description,
        level: proposedDraft.level,
        title: proposedDraft.title,
      }));

      revisionSpy.mockResolvedValueOnce({
        assistantMessage: 'I changed the title.',
        draft: {
          ...proposedDraft,
          title: 'Discarded Proposed Title',
        },
      });
      const discardPreviewResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify`,
        {
          _csrf: csrfToken,
          currentDraft: JSON.stringify(proposedDraft),
          requestedChange: 'Change the title again.',
        },
        cookie,
      );
      const discardPreview = await discardPreviewResponse.json() as { previewId: string };
      expect(discardPreviewResponse.status).toBe(200);
      const discardResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify/discard`,
        { _csrf: csrfToken, previewId: discardPreview.previewId },
        cookie,
      );
      expect(discardResponse.status).toBe(200);
      const discardedApplyResponse = await postForm(
        `/roleplays/${roleplay.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: discardPreview.previewId },
        cookie,
      );
      expect(discardedApplyResponse.status).toBe(409);
      expect(findRoleplayForUser(roleplay.id, owner.id)?.title).toBe('Modified Roleplay Title');
    } finally {
      revisionSpy.mockRestore();
      creditKeySpy.mockRestore();
    }

    const invalidLevelResponse = await postForm(
      `/roleplays/${roleplay.id}/edit`,
      { ...editBody, level: 'A2' },
      cookie,
    );
    expect(invalidLevelResponse.status).toBe(422);
    expect(findRoleplayForUser(roleplay.id, owner.id)?.level).toBe('C1');

    const validLevelResponse = await postForm(
      `/roleplays/${roleplay.id}/edit`,
      { ...editBody, level: 'B1-B2' },
      cookie,
    );
    expect(validLevelResponse.status).toBe(302);
    expect(findRoleplayForUser(roleplay.id, owner.id)?.level).toBe('B1-B2');
  });

  it('previews and explicitly applies practice guide AI modifications without an authoring chat', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createPracticeGuide,
      createProfile,
      findPracticeGuideForUser,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-practice-guide-owner@example.com',
      emailVerified: true,
      fullName: 'Route Practice Guide Owner',
      provider: 'google',
      providerSubject: 'route-practice-guide-owner',
    });
    const profile = createProfile({
      name: 'Route practice guide profile',
      userId: owner.id,
    });
    const practiceGuide = createPracticeGuide({
      description: 'Practice short conversations about daily routines.',
      profileId: profile.id,
      title: 'Daily Routine Practice',
      tutorInstructions: 'Guide one short exercise at a time.',
      userId: owner.id,
    });
    const cookie = await createAuthenticatedCookie(owner.id, profile.id);

    const editResponse = await fetch(`${baseUrl}/practice-guides/${practiceGuide.id}/edit`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const editHtml = await editResponse.text();
    expect(editResponse.status).toBe(200);
    expect(editHtml).toContain('app-page-header app-page-header-has-close mb-4 pe-0');
    expect(editHtml).toContain('app-page-header-actions position-static flex-shrink-0');
    expect(editHtml).toContain('Modificar con IA');
    expect(editHtml).toContain('data-practice-guide-modify-modal');
    expect(editHtml).toContain(
      `data-practice-guide-modify-endpoint="/practice-guides/${practiceGuide.id}/edit/modify"`,
    );
    expect(editHtml).toContain('data-practice-guide-modify-comparison');
    expect(editHtml).not.toContain('Chat IA');
    expect(editHtml).not.toContain('authoring-tabs');
    expect(editHtml).not.toContain('data-authoring-chat-form');

    const csrfToken = extractCsrfToken(editHtml);
    const retiredChatResponse = await postForm(
      `/practice-guides/${practiceGuide.id}/edit/revise`,
      { _csrf: csrfToken, message: 'Change the title.' },
      cookie,
    );
    expect(retiredChatResponse.status).toBe(404);

    const invalidPreviewResponse = await postForm(
      `/practice-guides/${practiceGuide.id}/edit/modify`,
      {
        _csrf: csrfToken,
        currentDraft: '{}',
        requestedChange: 'Make it more specific.',
      },
      cookie,
    );
    expect(invalidPreviewResponse.status).toBe(422);

    const creditGate = await import('../../src/server/services/creditGate.js');
    const resourceDrafts = await import('../../src/server/services/resourceDrafts.js');
    const creditKeySpy = vi
      .spyOn(creditGate, 'getCreditCheckedOpenRouterApiKeyForUser')
      .mockResolvedValue('test-openrouter-key');
    const revisionSpy = vi.spyOn(resourceDrafts, 'generatePracticeGuideRevision');
    try {
      const currentDraft = {
        description: 'Unsaved description from the current edit form.',
        title: 'Unsaved Guide Title',
        tutorInstructions: 'Keep this unsaved instruction exactly.',
      };
      const proposedDraft = {
        ...currentDraft,
        description: 'Revised description proposed for review.',
        tutorInstructions: 'Use three stages and keep the practice sequential.',
      };
      revisionSpy.mockResolvedValueOnce({
        assistantMessage: 'I revised the requested guide fields.',
        guide: proposedDraft,
      });

      const previewResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify`,
        {
          _csrf: csrfToken,
          currentDraft: JSON.stringify(currentDraft),
          requestedChange: 'Revise the description and organize the instructions into three stages.',
        },
        cookie,
      );
      expect(previewResponse.status).toBe(200);
      const preview = await previewResponse.json() as {
        changes: Array<{ after: string; before: string; field: string }>;
        previewId: string;
      };
      expect(preview.previewId).toEqual(expect.any(String));
      expect(preview.changes).toEqual([
        {
          after: proposedDraft.description,
          before: currentDraft.description,
          field: 'description',
        },
        {
          after: proposedDraft.tutorInstructions,
          before: currentDraft.tutorInstructions,
          field: 'tutorInstructions',
        },
      ]);
      expect(revisionSpy).toHaveBeenCalledWith(expect.objectContaining({
        currentPracticeGuide: currentDraft,
        openRouterApiKey: 'test-openrouter-key',
      }));
      expect(findPracticeGuideForUser(practiceGuide.id, owner.id)).toEqual(
        expect.objectContaining({
          authoringMessages: [],
          description: practiceGuide.description,
          title: practiceGuide.title,
          tutorInstructions: practiceGuide.tutorInstructions,
        }),
      );

      const wrongApplyResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: 'wrong-preview-id' },
        cookie,
      );
      expect(wrongApplyResponse.status).toBe(409);

      const applyResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: preview.previewId },
        cookie,
      );
      expect(applyResponse.status).toBe(200);
      await expect(applyResponse.json()).resolves.toEqual({
        ok: true,
        redirect: `/practice-guides/${practiceGuide.id}/edit`,
      });
      expect(findPracticeGuideForUser(practiceGuide.id, owner.id)).toEqual(
        expect.objectContaining({
          authoringMessages: [],
          ...proposedDraft,
        }),
      );

      revisionSpy.mockResolvedValueOnce({
        assistantMessage: 'I changed the title.',
        guide: { ...proposedDraft, title: 'Discarded Guide Title' },
      });
      const discardPreviewResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify`,
        {
          _csrf: csrfToken,
          currentDraft: JSON.stringify(proposedDraft),
          requestedChange: 'Change the title.',
        },
        cookie,
      );
      const discardPreview = await discardPreviewResponse.json() as { previewId: string };
      const discardResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify/discard`,
        { _csrf: csrfToken, previewId: discardPreview.previewId },
        cookie,
      );
      expect(discardResponse.status).toBe(200);
      const discardedApplyResponse = await postForm(
        `/practice-guides/${practiceGuide.id}/edit/modify/apply`,
        { _csrf: csrfToken, previewId: discardPreview.previewId },
        cookie,
      );
      expect(discardedApplyResponse.status).toBe(409);
      expect(findPracticeGuideForUser(practiceGuide.id, owner.id)?.title)
        .toBe('Unsaved Guide Title');
    } finally {
      revisionSpy.mockRestore();
      creditKeySpy.mockRestore();
    }
  });

  it('renders the practice guide label and quiz attempts on resource pages', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createQuiz,
      createQuizAttempt,
      createPracticeGuide,
      createProfile,
      saveQuizAttemptResult,
      submitQuizAttempt,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-labels-owner@example.com',
      emailVerified: true,
      fullName: 'Route Labels Owner',
      provider: 'google',
      providerSubject: 'route-labels-owner',
    });
    const ownerProfile = createProfile({
      name: 'Route labels profile',
      userId: owner.id,
    });
    const quizDraft = {
      blocks: [
        {
          id: 'open_text',
          item: {
            kind: 'quiz_open_text',
            prompt: 'Write one sentence with present perfect.',
          },
        },
      ],
      description: 'Present perfect practice.',
      instructions: 'Evaluate present perfect meaning and form.',
      level: 'B1',
      targetTopic: 'Present perfect',
      title: 'Route Labels Quiz',
    };
    const quiz = createQuiz({
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: ownerProfile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: owner.id,
    });
    const practiceGuide = createPracticeGuide({
      description: 'Route labels guide.',
      profileId: ownerProfile.id,
      title: 'Route Labels Guide',
      tutorInstructions: 'Practice route labels.',
      userId: owner.id,
    });

    // A collected participant submission is what surfaces to the owner as
    // participation. It must be a different profile than the owner's (here a
    // guest, so no profile) and flagged collect_results; the owner's own
    // attempts are Probar test runs and are intentionally excluded.
    const attempt = createQuizAttempt({
      quizId: quiz.id,
      collectResults: true,
      profileId: null,
      snapshot: quizDraft,
      userId: null,
    });
    submitQuizAttempt({
      attemptId: attempt.id,
      responses: [{ text: 'She has lived here for years.' }],
    });
    saveQuizAttemptResult({
      attemptId: attempt.id,
      result: {
        items: [
          {
            evaluation: { feedback: 'Bien.', status: 'correct' },
            kind: 'quiz_open_text',
            prompt: 'Write one sentence with present perfect.',
            userResponse: { text: 'She has lived here for years.' },
          },
        ],
        title: quizDraft.title,
        type: 'quiz_result',
      },
    });

    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);

    const resourcesResponse = await fetch(`${baseUrl}/resources`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const resourcesHtml = await resourcesResponse.text();
    expect(resourcesResponse.status).toBe(200);
    expect(resourcesHtml).toContain('Guía de Práctica');
    expect(resourcesHtml).toContain('Route Labels Guide');

    const quizResponse = await fetch(`${baseUrl}/quizzes/${quiz.id}`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const quizHtml = await quizResponse.text();
    expect(quizResponse.status).toBe(200);
    expect(quizHtml).toContain('Route Labels Quiz');
    // The owner sees the Participantes teaser with counts from the collected
    // participant submission, plus a link to the dedicated participation page.
    // The direct submission list ("Entregas") is only shown to non-owner
    // recipients, so it is asserted from the participation surface here.
    expect(quizHtml).toContain('Participantes');
    expect(quizHtml).toContain('1 entregas');
    expect(quizHtml).toContain(`/quizzes/${quiz.id}/participation`);

    // The practice-guide detail page renders through the practice-guides-view
    // partial, whose breadcrumb include must resolve relative to views/partials/.
    const guideResponse = await fetch(`${baseUrl}/practice-guides/${practiceGuide.id}`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const guideHtml = await guideResponse.text();
    expect(guideResponse.status).toBe(200);
    expect(guideHtml).toContain('Route Labels Guide');
    expect(guideHtml).toContain('data-breadcrumb');
  });

  it('badges and filters shared-by-me and shared-with-me resources on /resources', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile, createQuiz, getOrCreateResourceShareLink, grantResourceAccess } =
      await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'shared-badges-owner@example.com',
      emailVerified: true,
      fullName: 'Shared Badges Owner',
      provider: 'google',
      providerSubject: 'shared-badges-owner',
    });
    const ownerProfile = createProfile({ name: 'Shared badges profile', userId: owner.id });
    const otherOwner = createExternalUser({
      email: 'shared-badges-other@example.com',
      emailVerified: true,
      fullName: 'Shared Badges Other',
      provider: 'google',
      providerSubject: 'shared-badges-other',
    });
    const otherProfile = createProfile({ name: 'Other owner profile', userId: otherOwner.id });

    const makeQuiz = (title: string, profileId: string, userId: string) =>
      createQuiz({
        description: '',
        instructions: '',
        profileId,
        quiz: { blocks: [], title },
        title,
        userId,
      });

    const sharedByMeQuiz = makeQuiz('Shared By Me Badge Quiz', ownerProfile.id, owner.id);
    const privateQuiz = makeQuiz('Private Badge Quiz', ownerProfile.id, owner.id);
    const sharedWithMeQuiz = makeQuiz('Shared With Me Badge Quiz', otherProfile.id, otherOwner.id);

    // Owner puts their quiz up for sharing (link) -> "shared by me".
    getOrCreateResourceShareLink(sharedByMeQuiz.id);
    // Another owner shares their quiz with the owner's profile -> "shared with me".
    grantResourceAccess({
      grantedByUserId: otherOwner.id,
      grantedVia: 'profile',
      profileId: ownerProfile.id,
      resourceId: sharedWithMeQuiz.id,
      userId: owner.id,
    });

    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const getResources = async (query = '') => {
      const response = await fetch(`${baseUrl}/resources${query}`, {
        headers: { cookie: ownerCookie },
        redirect: 'manual',
      });
      expect(response.status).toBe(200);
      return response.text();
    };

    // Unfiltered: both shared resources appear with their badges.
    const allHtml = await getResources();
    expect(allHtml).toContain('Shared By Me Badge Quiz');
    expect(allHtml).toContain('Shared With Me Badge Quiz');
    expect(allHtml).toContain('Private Badge Quiz');
    expect(allHtml).toContain('Compartido por mí');
    expect(allHtml).toContain('Compartido conmigo');

    // The sharing categories live inside the type filter: type=by_me keeps only
    // the resource the owner shared out.
    const byMeHtml = await getResources('?type=by_me');
    expect(byMeHtml).toContain('Shared By Me Badge Quiz');
    expect(byMeHtml).not.toContain('Shared With Me Badge Quiz');
    expect(byMeHtml).not.toContain('Private Badge Quiz');

    // type=with_me keeps only what others shared with the owner.
    const withMeHtml = await getResources('?type=with_me');
    expect(withMeHtml).toContain('Shared With Me Badge Quiz');
    expect(withMeHtml).not.toContain('Shared By Me Badge Quiz');
    expect(withMeHtml).not.toContain('Private Badge Quiz');
  });

  it('scope=all finds filed resources across folders and shows their folder', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      addResourceToFolder,
      createProfile,
      createQuiz,
      createResourceFolder,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'scope-owner@example.com',
      emailVerified: true,
      fullName: 'Scope Owner',
      provider: 'google',
      providerSubject: 'scope-owner',
    });
    const ownerProfile = createProfile({ name: 'Scope profile', userId: owner.id });

    const folder = createResourceFolder({
      description: '',
      profileId: ownerProfile.id,
      title: 'Scope Folder',
      userId: owner.id,
    });
    const filedQuiz = createQuiz({
      description: '',
      instructions: '',
      profileId: ownerProfile.id,
      quiz: { blocks: [], title: 'Filed Shared Scope Quiz' },
      title: 'Filed Shared Scope Quiz',
      userId: owner.id,
    });
    getOrCreateResourceShareLink(filedQuiz.id);
    addResourceToFolder({ folderId: folder.id, resourceId: filedQuiz.id, userId: owner.id });

    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const getResources = async (query: string) => {
      const response = await fetch(`${baseUrl}/resources${query}`, {
        headers: { cookie: ownerCookie },
        redirect: 'manual',
      });
      expect(response.status).toBe(200);
      return response.text();
    };

    // Current-folder scope at the root hides resources filed inside folders.
    const folderScopeHtml = await getResources('?type=by_me');
    expect(folderScopeHtml).not.toContain('Filed Shared Scope Quiz');

    // Global scope surfaces it across folders and labels its folder.
    const globalScopeHtml = await getResources('?type=by_me&scope=all');
    expect(globalScopeHtml).toContain('Filed Shared Scope Quiz');
    expect(globalScopeHtml).toContain('Scope Folder');
  });

  it('renders quiz sections in the authoring blocks tab', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createQuiz, createProfile } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'quiz-sections-owner@example.com',
      emailVerified: true,
      fullName: 'Quiz Sections Owner',
      provider: 'google',
      providerSubject: 'quiz-sections-owner',
    });
    const ownerProfile = createProfile({
      name: 'Quiz sections profile',
      userId: owner.id,
    });
    const quizDraft = {
      blocks: [
        {
          id: 'block_1',
          item: {
            kind: 'quiz_open_text',
            prompt: 'Write one sentence with an adverb of frequency.',
          },
          sectionId: 'section_a',
        },
        {
          id: 'block_2',
          item: {
            kind: 'quiz_open_text',
            prompt: 'How often do you exercise?',
          },
          sectionId: 'section_b',
        },
      ],
      description: 'Adverb practice.',
      instructions: 'Complete both sections.',
      level: 'A2',
      sections: [
        {
          id: 'section_a',
          instructions: 'Completa las oraciones con la frase correcta.',
          title: 'Parte A',
        },
        {
          id: 'section_b',
          instructions: 'Responde con oraciones completas.',
          title: 'Parte B',
        },
      ],
      targetTopic: 'Adverbs of frequency',
      title: 'Sections Quiz',
    };
    const quiz = createQuiz({
      description: quizDraft.description,
      instructions: quizDraft.instructions,
      level: quizDraft.level,
      profileId: ownerProfile.id,
      quiz: quizDraft,
      targetTopic: quizDraft.targetTopic,
      title: quizDraft.title,
      userId: owner.id,
    });
    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);

    const editResponse = await fetch(`${baseUrl}/quizzes/${quiz.id}/edit?tab=blocks`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const editHtml = await editResponse.text();
    expect(editResponse.status).toBe(200);
    expect(editHtml).toContain('Parte A');
    expect(editHtml).toContain('Completa las oraciones con la frase correcta.');
    expect(editHtml).toContain('Parte B');

    const showResponse = await fetch(`${baseUrl}/quizzes/${quiz.id}`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const showHtml = await showResponse.text();
    expect(showResponse.status).toBe(200);
    expect(showHtml).toContain('Parte A');
    expect(showHtml).toContain('Completa las oraciones con la frase correcta.');
    expect(showHtml).toContain('Parte B');
    expect(showHtml).toContain('Responde con oraciones completas.');
  });

  it('creates, edits, archives, and restores resource folders through routes', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile, findResourceForUser } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-folder-actions-owner@example.com',
      emailVerified: true,
      fullName: 'Route Folder Actions Owner',
      provider: 'google',
      providerSubject: 'route-folder-actions-owner',
    });
    const ownerProfile = createProfile({
      name: 'Route folder actions profile',
      userId: owner.id,
    });
    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);

    const resourcesResponse = await fetch(`${baseUrl}/resources`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const csrfToken = extractCsrfToken(await resourcesResponse.text());

    const createResponse = await postForm(
      '/resources/folders',
      {
        _csrf: csrfToken,
        description: 'Folder created in a route test.',
        returnTo: '/resources',
        title: 'QA Folder',
      },
      ownerCookie,
    );
    expect(createResponse.status).toBe(302);
    const folderLocation = createResponse.headers.get('location') ?? '';
    expect(folderLocation).toMatch(/^\/resources\/folders\//);
    const folderId = decodeURIComponent(folderLocation.replace('/resources/folders/', ''));

    const createdFolderResponse = await fetch(`${baseUrl}${folderLocation}`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    expect(createdFolderResponse.status).toBe(200);
    expect(await createdFolderResponse.text()).toContain('QA Folder');

    const editResponse = await postForm(
      `/resources/folders/${folderId}`,
      {
        _csrf: csrfToken,
        description: 'Renamed in a route test.',
        returnTo: folderLocation,
        title: 'QA Folder Renamed',
      },
      ownerCookie,
    );
    expect(editResponse.status).toBe(302);
    expect(findResourceForUser(folderId, owner.id)?.title).toBe('QA Folder Renamed');

    const archiveResponse = await postForm(
      `/resources/${folderId}/archive`,
      {
        _csrf: csrfToken,
        returnTo: '/resources',
      },
      ownerCookie,
    );
    expect(archiveResponse.status).toBe(302);
    expect(findResourceForUser(folderId, owner.id)?.archivedAt).toBeTruthy();

    const restoreResponse = await postForm(
      `/resources/${folderId}/restore`,
      {
        _csrf: csrfToken,
        returnTo: '/resources',
      },
      ownerCookie,
    );
    expect(restoreResponse.status).toBe(302);
    expect(findResourceForUser(folderId, owner.id)?.archivedAt).toBeFalsy();
  });

  it('recovers archived resources from trash without losing folders or sharing', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      addResourceToFolder,
      createProfile,
      createQuiz,
      createResourceFolder,
      findResourceAccessForProfile,
      findResourceFolderForResource,
      findResourceForUser,
      getOrCreateResourceShareLink,
      grantResourceAccess,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'resource-trash-owner@example.com',
      emailVerified: true,
      fullName: 'Resource Trash Owner',
      provider: 'google',
      providerSubject: 'resource-trash-owner',
    });
    const ownerProfile = createProfile({
      name: 'Resource trash profile',
      userId: owner.id,
    });
    const student = createExternalUser({
      email: 'resource-trash-student@example.com',
      emailVerified: true,
      fullName: 'Resource Trash Student',
      provider: 'google',
      providerSubject: 'resource-trash-student',
    });
    const studentProfile = createProfile({
      name: 'Resource trash student profile',
      userId: student.id,
    });
    const folder = createResourceFolder({
      description: '',
      profileId: ownerProfile.id,
      title: 'Original Trash Folder',
      userId: owner.id,
    });
    const quiz = createQuiz({
      description: 'A quiz used to verify trash recovery.',
      instructions: '',
      profileId: ownerProfile.id,
      quiz: { blocks: [], title: 'Recoverable Trash Quiz' },
      title: 'Recoverable Trash Quiz',
      userId: owner.id,
    });
    const activeQuiz = createQuiz({
      description: '',
      instructions: '',
      profileId: ownerProfile.id,
      quiz: { blocks: [], title: 'Active Quiz Outside Trash' },
      title: 'Active Quiz Outside Trash',
      userId: owner.id,
    });
    expect(activeQuiz.archivedAt).toBeNull();
    expect(addResourceToFolder({
      folderId: folder.id,
      resourceId: quiz.id,
      userId: owner.id,
    })).toBe(true);

    const shareLink = getOrCreateResourceShareLink(quiz.id);
    grantResourceAccess({
      grantedByUserId: owner.id,
      grantedVia: 'profile',
      profileId: studentProfile.id,
      resourceId: quiz.id,
      userId: student.id,
    });

    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const resourcesResponse = await fetch(`${baseUrl}/resources`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const csrfToken = extractCsrfToken(await resourcesResponse.text());
    const archiveResponse = await postForm(
      `/resources/${quiz.id}/archive`,
      {
        _csrf: csrfToken,
        returnTo: '/resources',
      },
      ownerCookie,
    );
    expect(archiveResponse.status).toBe(302);
    expect(findResourceForUser(quiz.id, owner.id)?.archivedAt).toBeTruthy();
    expect(findResourceAccessForProfile({
      profileId: studentProfile.id,
      resourceId: quiz.id,
      userId: student.id,
    })).toBeNull();

    const archivedShareResponse = await fetch(
      `${baseUrl}/resources/shared/${shareLink.id}`,
      { redirect: 'manual' },
    );
    expect(archivedShareResponse.status).toBe(302);
    expect(archivedShareResponse.headers.get('location')).toBe('/resources');

    const trashResponse = await fetch(`${baseUrl}/resources/trash`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual',
    });
    const trashHtml = await trashResponse.text();
    expect(trashResponse.status).toBe(200);
    expect(trashHtml).toContain('Papelera');
    expect(trashHtml).toContain('Recoverable Trash Quiz');
    expect(trashHtml).toContain('Estaba en Original Trash Folder');
    expect(trashHtml).toContain(`/resources/${quiz.id}/restore`);
    expect(trashHtml).toContain('class="btn btn-link app-page-close-button"');
    expect(trashHtml).toContain('href="/resources"');
    expect(trashHtml).toContain('bi bi-x-lg');
    expect(trashHtml).not.toContain('Active Quiz Outside Trash');

    const restoreResponse = await postForm(
      `/resources/${quiz.id}/restore`,
      {
        _csrf: extractCsrfToken(trashHtml),
        returnTo: '/resources/trash',
      },
      ownerCookie,
    );
    expect(restoreResponse.status).toBe(302);
    expect(restoreResponse.headers.get('location')).toBe('/resources/trash');
    expect(findResourceForUser(quiz.id, owner.id)?.archivedAt).toBeNull();
    expect(findResourceFolderForResource(quiz.id, owner.id)?.id).toBe(folder.id);
    expect(findResourceAccessForProfile({
      profileId: studentProfile.id,
      resourceId: quiz.id,
      userId: student.id,
    })).toEqual(expect.objectContaining({
      accessKind: 'shared',
      id: quiz.id,
    }));

    const restoredShareResponse = await fetch(
      `${baseUrl}/resources/shared/${shareLink.id}`,
      { redirect: 'manual' },
    );
    expect(restoredShareResponse.status).toBe(200);
    const emptyTrashHtml = await (
      await fetch(`${baseUrl}/resources/trash`, {
        headers: { cookie: ownerCookie },
        redirect: 'manual',
      })
    ).text();
    expect(emptyTrashHtml).toContain('La papelera está vacía');
    expect(emptyTrashHtml).not.toContain('Recoverable Trash Quiz');
  });

  it('renders the built-in media library and media detail pages', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createReadyUserSceneMedia,
      findUserSceneMediaForProfile,
    } = await import('../../src/server/sceneMedia/userMediaRepository.js');

    const user = createExternalUser({
      email: 'route-media-library@example.com',
      emailVerified: true,
      fullName: 'Route Media Library',
      provider: 'google',
      providerSubject: 'route-media-library',
    });
    const profile = createProfile({
      name: 'Route media library profile',
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);
    createReadyUserSceneMedia({
      audio: {
        clips: [{
          speaker: 'Agent',
          src: '/public/scene-media/audio/a1-a2/airport-security-line-01-a1-a2/turn-01.wav',
          turn: 1,
        }],
        format: 'wav',
        voiceStrategy: 'per_turn_clips',
      },
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      id: 'route-ready-media',
      image: {
        alt: 'A traveler at airport security.',
        src: '/public/scene-media/images/airport-security-line-01.png',
      },
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'Create an airport scene.',
      script: {
        identityStrategy: 'named_in_dialogue',
        scriptType: 'dialogue',
        speakers: [
          { name: 'Agent', nameSpokenInAudio: true, role: 'security_agent' },
          { name: 'Traveler', nameSpokenInAudio: true, role: 'traveler' },
        ],
        turns: [
          { speaker: 'Agent', text: 'Please place your bag on the belt.' },
          { speaker: 'Traveler', text: 'Of course.' },
        ],
      },
      scriptTypePreference: 'dialogue',
      setting: 'Airport security',
      title: 'Route Ready Media',
      visualSummary: ['A traveler speaks with a security officer.'],
    });

    const libraryResponse = await fetch(`${baseUrl}/media-library`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const libraryHtml = await libraryResponse.text();
    expect(libraryResponse.status).toBe(200);
    expect(libraryHtml).toContain('Biblioteca de medios');
    expect(libraryHtml).toContain('Nuevo');
    expect(libraryHtml).toContain('href="/media-library/new"');
    expect(libraryHtml).not.toContain('id="createSceneMediaModal"');
    expect(libraryHtml).toContain('airport-security-line-01-a1-a2');
    expect(libraryHtml).toContain('/public/scene-media/images/airport-security-line-01.png');
    expect(libraryHtml).toContain('/media-library/airport-security-line-01-a1-a2');
    expect(libraryHtml).toContain('data-scene-media-play');
    expect(libraryHtml).toContain('data-scene-media-preview-modal');
    expect(libraryHtml).toContain('class="stretched-link"');
    expect(libraryHtml).toContain('aria-label="Detalles"');
    expect(libraryHtml).toContain('aria-label="Reproducir"');
    expect(libraryHtml).not.toContain('bi-info-circle');
    expect(libraryHtml).toContain('/public/scene-media/audio/a1-a2/airport-security-line-01-a1-a2/turn-01.wav');
    expect(libraryHtml).toContain('Jon stood in the airport security line');

    const newMediaResponse = await fetch(`${baseUrl}/media-library/new`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const newMediaHtml = await newMediaResponse.text();
    expect(newMediaResponse.status).toBe(200);
    expect(newMediaHtml).toContain('Crear media');
    expect(newMediaHtml).toContain('data-scene-media-generate-form');
    expect(newMediaHtml).toContain('data-scene-media-pending-modal');

    const mediaAuthoringResponse = await fetch(
      `${baseUrl}/media-library/route-ready-media/edit`,
      { headers: { cookie }, redirect: 'manual' },
    );
    const mediaAuthoringHtml = await mediaAuthoringResponse.text();
    expect(mediaAuthoringResponse.status).toBe(200);
    expect(mediaAuthoringHtml).toContain('Editando media');
    expect(mediaAuthoringHtml).not.toContain('Chat IA');
    expect(mediaAuthoringHtml).toContain('app-page-header app-page-header-has-close mb-4');
    expect(mediaAuthoringHtml).not.toContain('nav nav-pills authoring-tabs');
    expect(mediaAuthoringHtml).not.toContain('data-authoring-chat-form');
    expect(mediaAuthoringHtml).toContain('value="Route Ready Media"');
    expect(mediaAuthoringHtml).toContain('data-scene-media-title-form');
    expect(mediaAuthoringHtml).toContain('data-scene-media-generate-title');
    expect(mediaAuthoringHtml).toContain('data-scene-media-generate-title-label>Generar</span>');
    expect(mediaAuthoringHtml).not.toContain('Generar título');
    expect(mediaAuthoringHtml).toContain('class="d-flex flex-wrap gap-2"');
    expect(mediaAuthoringHtml.indexOf('data-scene-media-generate-title')).toBeLessThan(
      mediaAuthoringHtml.indexOf('data-scene-media-title-save'),
    );
    expect(mediaAuthoringHtml).toContain('disabled data-scene-media-title-save');
    expect(mediaAuthoringHtml).toContain('bi-save me-1');
    expect(mediaAuthoringHtml).toContain('Guardar');
    expect(mediaAuthoringHtml).not.toContain('Guardar detalles');
    expect(mediaAuthoringHtml).toContain('Escena completa');
    expect(mediaAuthoringHtml).toContain('Escena de un panel');
    expect(mediaAuthoringHtml).toContain('Airport security');
    expect(mediaAuthoringHtml).toContain('A traveler speaks with a security officer.');
    expect(mediaAuthoringHtml).toContain('Please place your bag on the belt.');
    expect(mediaAuthoringHtml).toContain('<audio');
    expect(mediaAuthoringHtml).not.toContain('id="mediaLevel"');
    expect(mediaAuthoringHtml).not.toContain('id="mediaScriptType"');
    expect(mediaAuthoringHtml).toContain('data-current-level="A1-A2"');
    expect(mediaAuthoringHtml).toContain('data-current-script-type-preference="dialogue"');
    expect(mediaAuthoringHtml).toContain('id="sceneMediaChangeLevel"');
    expect(mediaAuthoringHtml).toContain('id="sceneMediaChangeScriptType"');
    const authoringCsrfToken = extractCsrfToken(mediaAuthoringHtml);
    const saveTitleResponse = await postForm(
      '/media-library/route-ready-media/edit/save',
      {
        _csrf: authoringCsrfToken,
        level: 'C1',
        scriptTypePreference: 'monologue',
        title: 'Updated Route Media',
      },
      cookie,
    );
    expect(saveTitleResponse.status).toBe(302);
    expect(saveTitleResponse.headers.get('location')).toBe(
      '/media-library/route-ready-media/edit',
    );
    expect(findUserSceneMediaForProfile({
      mediaId: 'route-ready-media',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      level: 'A1-A2',
      scriptTypePreference: 'dialogue',
      title: 'Updated Route Media',
    }));

    const legacyMediaChatResponse = await fetch(
      `${baseUrl}/media-library/route-ready-media/edit?tab=chat`,
      { headers: { cookie }, redirect: 'manual' },
    );
    const legacyMediaChatHtml = await legacyMediaChatResponse.text();
    expect(legacyMediaChatResponse.status).toBe(200);
    expect(legacyMediaChatHtml).not.toContain('Chat IA');
    expect(legacyMediaChatHtml).not.toContain('data-authoring-chat-form');

    const removedReviseResponse = await postForm(
      '/media-library/route-ready-media/edit/revise',
      { _csrf: authoringCsrfToken, message: 'Change the scene.' },
      cookie,
    );
    expect(removedReviseResponse.status).toBe(404);

    const builtInTitleGenerationResponse = await postForm(
      '/media-library/airport-security-line-01-a1-a2/generate-title',
      { _csrf: authoringCsrfToken },
      cookie,
    );
    expect(builtInTitleGenerationResponse.status).toBe(302);
    expect(builtInTitleGenerationResponse.headers.get('location')).toBe(
      '/media-library/airport-security-line-01-a1-a2',
    );

    const filteredResponse = await fetch(`${baseUrl}/media-library?level=C1`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const filteredHtml = await filteredResponse.text();
    expect(filteredResponse.status).toBe(200);
    expect(filteredHtml).toContain('airport-security-line-01-c1');
    expect(filteredHtml).not.toContain('airport-security-line-01-a1-a2');

    const detailResponse = await fetch(
      `${baseUrl}/media-library/airport-security-line-01-a1-a2?returnTo=${encodeURIComponent('/media-library?level=A1-A2')}`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain('Airport Security Line - Simple Story');
    expect(detailHtml).toContain('Crear variación');
    expect(detailHtml).toContain('href="/media-library/airport-security-line-01-a1-a2/variations/new"');
    expect(detailHtml).not.toContain('data-bs-target="#createSceneMediaVariationModal"');
    expect(detailHtml).not.toContain('id="createSceneMediaVariationModal"');
    expect(detailHtml).toContain('/public/scene-media/audio/a1-a2/airport-security-line-01-a1-a2/turn-01.wav');
    expect(detailHtml).toContain('Jon stood in the airport security line');
    expect(detailHtml).toContain('href="/media-library?level=A1-A2"');

    const variationPageResponse = await fetch(
      `${baseUrl}/media-library/airport-security-line-01-a1-a2/variations/new`,
      { headers: { cookie }, redirect: 'manual' },
    );
    const variationPageHtml = await variationPageResponse.text();
    expect(variationPageResponse.status).toBe(200);
    expect(variationPageHtml).toContain('Variación de Airport Security Line - Simple Story');
    expect(variationPageHtml).toContain('data-scene-media-variation-form');
    expect(variationPageHtml).toContain('data-scene-media-pending-modal');

    const csrfToken = extractCsrfToken(newMediaHtml);
    const variationResponse = await postForm(
      '/media-library/airport-security-line-01-a1-a2/variations',
      {
        _csrf: csrfToken,
        format: 'single_panel_scene',
        imageDecision: 'keep_existing',
        level: 'A1-A2',
        prompt: '',
        scriptAndAudioDecision: 'keep_existing',
        scriptTypePreference: 'unspecified',
      },
      cookie,
    );
    expect(variationResponse.status).toBe(422);
    expect(await variationResponse.text()).toContain('Revisa el formulario');

    const createResponse = await postForm(
      '/media-library',
      {
        _csrf: csrfToken,
        format: 'single_panel_scene',
        generationMode: 'image_only',
        level: 'A1-A2',
        prompt: '',
        scriptTypePreference: 'unspecified',
      },
      cookie,
    );
    expect(createResponse.status).toBe(422);
    expect(await createResponse.text()).toContain('Revisa el formulario');

    const archiveResponse = await postForm(
      '/media-library/route-ready-media/archive',
      {
        _csrf: csrfToken,
      },
      cookie,
    );
    expect(archiveResponse.status).toBe(302);
    expect(archiveResponse.headers.get('location')).toBe('/media-library');
    expect(findUserSceneMediaForProfile({
      mediaId: 'route-ready-media',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toBeNull();

    const mediaTrashResponse = await fetch(`${baseUrl}/media-library/trash`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const mediaTrashHtml = await mediaTrashResponse.text();
    expect(mediaTrashResponse.status).toBe(200);
    expect(mediaTrashHtml).toContain('Papelera');
    expect(mediaTrashHtml).toContain('Updated Route Media');
    expect(mediaTrashHtml).toContain('/media-library/route-ready-media/restore');
    expect(mediaTrashHtml).toContain('class="btn btn-link app-page-close-button"');
    expect(mediaTrashHtml).toContain('href="/media-library"');
    expect(mediaTrashHtml).toContain('bi bi-x-lg');

    const restoreMediaResponse = await postForm(
      '/media-library/route-ready-media/restore',
      { _csrf: extractCsrfToken(mediaTrashHtml) },
      cookie,
    );
    expect(restoreMediaResponse.status).toBe(302);
    expect(restoreMediaResponse.headers.get('location')).toBe('/media-library/trash');
    expect(findUserSceneMediaForProfile({
      mediaId: 'route-ready-media',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toEqual(expect.objectContaining({
      archivedAt: null,
      status: 'ready',
      title: 'Updated Route Media',
    }));
    const emptyMediaTrashHtml = await (
      await fetch(`${baseUrl}/media-library/trash`, {
        headers: { cookie },
        redirect: 'manual',
      })
    ).text();
    expect(emptyMediaTrashHtml).toContain('La papelera de medias está vacía');
    expect(emptyMediaTrashHtml).not.toContain('Updated Route Media');

    const retryResponse = await postForm(
      '/media-library/route-ready-media/retry',
      { _csrf: csrfToken },
      cookie,
    );
    expect(retryResponse.status).toBe(404);
  });

  it('localizes the media library pages for the active profile language', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'route-media-library-ht@example.com',
      emailVerified: true,
      fullName: 'Route Media Library HT',
      provider: 'google',
      providerSubject: 'route-media-library-ht',
    });
    const profile = createProfile({
      instructionLanguage: 'ht',
      name: 'Route media library HT profile',
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);

    const libraryResponse = await fetch(`${baseUrl}/media-library`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const libraryHtml = await libraryResponse.text();
    expect(libraryResponse.status).toBe(200);
    expect(libraryHtml).toContain('<html lang="ht">');
    expect(libraryHtml).toContain('Bibliyotèk medya');
    expect(libraryHtml).toContain('Detay');
    expect(libraryHtml).toContain('Jwe');
    expect(libraryHtml).toContain('Jwe medya');
    expect(libraryHtml).not.toContain('Details');
    expect(libraryHtml).not.toContain('Play media');

    const detailResponse = await fetch(
      `${baseUrl}/media-library/airport-security-line-01-a1-a2`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain('<html lang="ht">');
    expect(detailHtml).toContain('Retounen nan bibliyotèk medya a');
    expect(detailHtml).toContain('Odyo');
    expect(detailHtml).toContain('Skrip');
  });

  it('guards the create-resource-from-conversation route before calling the model', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createConversation, createProfile } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-conversation-resource-owner@example.com',
      emailVerified: true,
      fullName: 'Route Conversation Resource Owner',
      provider: 'google',
      providerSubject: 'route-conversation-resource-owner',
    });
    const ownerProfile = createProfile({
      name: 'Route conversation resource profile',
      userId: owner.id,
    });
    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const csrfToken = extractCsrfToken(
      await (
        await fetch(`${baseUrl}/resources`, { headers: { cookie: ownerCookie }, redirect: 'manual' })
      ).text(),
    );

    const missingResponse = await postForm(
      '/c/does-not-exist/resource',
      { _csrf: csrfToken, type: 'practice_guide' },
      ownerCookie,
    );
    expect(missingResponse.status).toBe(302);
    expect(missingResponse.headers.get('location')).toBe('/');

    const conversation = createConversation(owner.id, ownerProfile.id);

    const invalidTypeResponse = await postForm(
      `/c/${conversation.id}/resource`,
      { _csrf: csrfToken, type: 'not_a_type' },
      ownerCookie,
    );
    expect(invalidTypeResponse.status).toBe(302);
    expect(invalidTypeResponse.headers.get('location')).toBe(`/c/${conversation.id}`);

    const emptyConversationResponse = await postForm(
      `/c/${conversation.id}/resource`,
      { _csrf: csrfToken, type: 'practice_guide' },
      ownerCookie,
    );
    expect(emptyConversationResponse.status).toBe(302);
    expect(emptyConversationResponse.headers.get('location')).toBe(`/c/${conversation.id}`);

    const reportInvalidTypeResponse = await postForm(
      `/c/${conversation.id}/report/resource`,
      { _csrf: csrfToken, type: 'not_a_type' },
      ownerCookie,
    );
    expect(reportInvalidTypeResponse.status).toBe(302);
    expect(reportInvalidTypeResponse.headers.get('location')).toBe(`/c/${conversation.id}?tab=summary`);

    const reportNoReportResponse = await postForm(
      `/c/${conversation.id}/report/resource`,
      { _csrf: csrfToken, type: 'practice_guide' },
      ownerCookie,
    );
    expect(reportNoReportResponse.status).toBe(302);
    expect(reportNoReportResponse.headers.get('location')).toBe(`/c/${conversation.id}?tab=summary`);
  });

  it('lets anyone take a shared quiz anonymously, then gates evaluation behind signup', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      findQuizAttemptById,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-shared-quiz-owner@example.com',
      emailVerified: true,
      fullName: 'Route Shared Quiz Owner',
      provider: 'google',
      providerSubject: 'route-shared-quiz-owner',
    });
    const ownerProfile = createProfile({ name: 'Route shared quiz profile', userId: owner.id });
    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Route Shared Quiz',
      },
      title: 'Route Shared Quiz',
      userId: owner.id,
    });

    const shareLink = getOrCreateResourceShareLink(quiz.id);
    const sharePath = `/resources/shared/${shareLink.id}`;

    // Any shared quiz shows the anonymous "take it" action, no opt-in needed.
    const sharedResponse = await fetch(`${baseUrl}${sharePath}`, { redirect: 'manual' });
    const sharedHtml = await sharedResponse.text();
    expect(sharedResponse.status).toBe(200);
    expect(sharedHtml).toContain('Hacer el quiz');
    expect(sharedHtml).toContain(`/quizzes/shared/${shareLink.id}/take`);

    // Anonymous visitor starts a guest attempt.
    const startResponse = await postForm(
      `/quizzes/shared/${shareLink.id}/take`,
      { _csrf: extractCsrfToken(sharedHtml) },
      '',
    );
    expect(startResponse.status).toBe(302);
    const startLocation = startResponse.headers.get('location') ?? '';
    expect(startLocation).toMatch(/^\/quiz-attempts\/[^/]+\?guestToken=/);
    const attemptId = decodeURIComponent(startLocation.replace('/quiz-attempts/', '').split('?')[0]);
    const guestToken = new URLSearchParams(startLocation.split('?')[1]).get('guestToken') ?? '';
    const attempt = findQuizAttemptById(attemptId);
    expect(attempt?.userId).toBeNull();
    expect(attempt?.guestToken).toBeTruthy();

    // Submitting as a guest saves answers and redirects to signup instead of
    // evaluating (no LLM call happens here).
    const submitResponse = await postForm(
      `/quiz-attempts/${attemptId}/submit`,
      { _csrf: extractCsrfToken(sharedHtml), guestToken },
      '',
    );
    expect(submitResponse.status).toBe(302);
    const submitLocation = submitResponse.headers.get('location') ?? '';
    expect(submitLocation).toMatch(/^\/signup\?returnTo=/);
    // Signup returns to the evaluating page, which shows progress while the
    // evaluation inference runs, instead of blocking the result render.
    expect(decodeURIComponent(submitLocation)).toContain(
      `/quiz-attempts/${attemptId}/evaluating`,
    );
  });

  it('guards the quiz responses summary before any inference', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile, createQuiz } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'summary-route-owner@example.com',
      emailVerified: true,
      fullName: 'Summary Route Owner',
      provider: 'google',
      providerSubject: 'summary-route-owner',
    });
    const ownerProfile = createProfile({ name: 'Summary route profile', userId: owner.id });
    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Summary Route Quiz',
      },
      title: 'Summary Route Quiz',
      userId: owner.id,
    });

    // The owner with no evaluated responses is redirected with an empty-state
    // error and no inference runs (nothing to summarize).
    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const quizHtml = await (await fetch(`${baseUrl}/quizzes/${quiz.id}`, {
      headers: { cookie: ownerCookie },
    })).text();
    const summaryResponse = await postForm(
      `/quizzes/${quiz.id}/summary`,
      { _csrf: extractCsrfToken(quizHtml) },
      ownerCookie,
    );
    expect(summaryResponse.status).toBe(302);
    expect(summaryResponse.headers.get('location')).toBe(
      `/quizzes/${quiz.id}/participation?summaryError=empty`,
    );
  });

  it('routes a submitted attempt through the evaluating page instead of blocking the result', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      createQuizAttempt,
      submitQuizAttempt,
    } = await import('../../src/server/db/repository.js');

    const student = createExternalUser({
      email: 'evaluating-student@example.com',
      emailVerified: true,
      fullName: 'Evaluating Student',
      provider: 'google',
      providerSubject: 'evaluating-student',
    });
    const studentProfile = createProfile({
      name: 'Student profile',
      userId: student.id,
    });
    const evaluatingDraft = {
      blocks: [
        { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
      ],
      title: 'Evaluating Flow Quiz',
    };
    const quiz = createQuiz({
      profileId: studentProfile.id,
      quiz: evaluatingDraft,
      title: 'Evaluating Flow Quiz',
      userId: student.id,
    });
    const attempt = createQuizAttempt({
      quizId: quiz.id,
      profileId: studentProfile.id,
      snapshot: evaluatingDraft,
      userId: student.id,
    });
    submitQuizAttempt({ attemptId: attempt.id, responses: [] });

    const cookie = await createAuthenticatedCookie(student.id, studentProfile.id);

    // The result page no longer runs the evaluation inline; it hands off to the
    // evaluating page.
    const resultResponse = await fetch(`${baseUrl}/quiz-attempts/${attempt.id}/result`, {
      headers: { cookie },
      redirect: 'manual',
    });
    expect(resultResponse.status).toBe(302);
    expect(resultResponse.headers.get('location')).toBe(
      `/quiz-attempts/${attempt.id}/evaluating`,
    );

    // The evaluating page renders instantly with the progress affordance and
    // the self-posting form that triggers the evaluation.
    const evaluatingResponse = await fetch(`${baseUrl}/quiz-attempts/${attempt.id}/evaluating`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const evaluatingHtml = await evaluatingResponse.text();
    expect(evaluatingResponse.status).toBe(200);
    expect(evaluatingHtml).toContain('data-quiz-auto-submit-form');
    expect(evaluatingHtml).toContain(`/quiz-attempts/${attempt.id}/evaluate`);
    expect(evaluatingHtml).toContain('Evaluando el quiz');

    // Signed-out visitors without the guest token are sent to signup, never to
    // an evaluation they cannot pay for.
    const anonymousResponse = await fetch(`${baseUrl}/quiz-attempts/${attempt.id}/evaluating`, {
      redirect: 'manual',
    });
    expect(anonymousResponse.status).toBe(302);
    expect(anonymousResponse.headers.get('location')).toBe('/login');
  });

  it('collects shared-quiz results for the owner behind the share results-feedback flag', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      findQuizAttemptById,
      findResourceShareLinkForResource,
      getOrCreateResourceShareLink,
      saveQuizAttemptResult,
      setResourceShareLinkCollectResults,
      submitQuizAttempt,
    } = await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-collect-owner@example.com',
      emailVerified: true,
      fullName: 'Route Collect Owner',
      provider: 'google',
      providerSubject: 'route-collect-owner',
    });
    const ownerProfile = createProfile({ name: 'Route collect profile', userId: owner.id });
    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Route Collect Quiz',
      },
      title: 'Route Collect Quiz',
      userId: owner.id,
    });
    const shareLink = getOrCreateResourceShareLink(quiz.id);
    const sharePath = `/resources/shared/${shareLink.id}`;

    // Flag on (default): the shared page shows the disclosure notice and the
    // guest attempt snapshots the flag at start.
    const sharedHtml = await (await fetch(`${baseUrl}${sharePath}`, { redirect: 'manual' })).text();
    expect(sharedHtml).toContain('verá tus respuestas y tu evaluación');
    const csrfToken = extractCsrfToken(sharedHtml);
    const collectedStart = await postForm(
      `/quizzes/shared/${shareLink.id}/take`,
      { _csrf: csrfToken },
      '',
    );
    const collectedAttemptId = decodeURIComponent(
      (collectedStart.headers.get('location') ?? '')
        .replace('/quiz-attempts/', '')
        .split('?')[0],
    );
    expect(findQuizAttemptById(collectedAttemptId)?.collectResults).toBe(true);

    // Flag off: no notice, and new attempts are not collected.
    setResourceShareLinkCollectResults({ collectResults: false, resourceId: quiz.id });
    const noNoticeHtml = await (await fetch(`${baseUrl}${sharePath}`, { redirect: 'manual' })).text();
    expect(noNoticeHtml).not.toContain('verá tus respuestas y tu evaluación');
    const uncollectedStart = await postForm(
      `/quizzes/shared/${shareLink.id}/take`,
      { _csrf: csrfToken },
      '',
    );
    const uncollectedAttemptId = decodeURIComponent(
      (uncollectedStart.headers.get('location') ?? '')
        .replace('/quiz-attempts/', '')
        .split('?')[0],
    );
    expect(findQuizAttemptById(uncollectedAttemptId)?.collectResults).toBe(false);

    // Evaluate the collected guest attempt through repository factories.
    submitQuizAttempt({ attemptId: collectedAttemptId, responses: [] });
    saveQuizAttemptResult({
      attemptId: collectedAttemptId,
      result: {
        items: [
          {
            evaluation: { feedback: 'Bien.', status: 'correct' },
            kind: 'quiz_open_text',
            prompt: 'Write one sentence.',
            userResponse: { text: 'I wrote one sentence.' },
          },
        ],
        title: 'Route Collect Quiz',
        type: 'quiz_result',
      },
    });

    // The owner's quiz page lists only the collected attempt.
    const ownerCookie = await createAuthenticatedCookie(owner.id, ownerProfile.id);
    const quizPageHtml = await (
      await fetch(`${baseUrl}/quizzes/${quiz.id}`, {
        headers: { cookie: ownerCookie },
        redirect: 'manual',
      })
    ).text();
    // The quiz page keeps only the compact teaser plus a link; the per-
    // participant list lives on the participation page.
    expect(quizPageHtml).toContain('Participantes');
    expect(quizPageHtml).toContain(`/quizzes/${quiz.id}/participation`);
    expect(quizPageHtml).not.toContain(`/quiz-attempts/${collectedAttemptId}/result`);

    const participationHtml = await (
      await fetch(`${baseUrl}/quizzes/${quiz.id}/participation`, {
        headers: { cookie: ownerCookie },
        redirect: 'manual',
      })
    ).text();
    expect(participationHtml).toContain(`/quiz-attempts/${collectedAttemptId}/result`);
    expect(participationHtml).not.toContain(uncollectedAttemptId);

    // Owner read-only result view: renders without the learner actions and
    // without the guest token; the uncollected attempt stays inaccessible.
    const ownerResultResponse = await fetch(
      `${baseUrl}/quiz-attempts/${collectedAttemptId}/result`,
      { headers: { cookie: ownerCookie }, redirect: 'manual' },
    );
    expect(ownerResultResponse.status).toBe(200);
    const ownerResultHtml = await ownerResultResponse.text();
    expect(ownerResultHtml).toContain('modo solo lectura');
    expect(ownerResultHtml).not.toContain('guestToken=');
    expect(ownerResultHtml).not.toContain(`/quiz-attempts/${collectedAttemptId}/practice`);
    const deniedResponse = await fetch(
      `${baseUrl}/quiz-attempts/${uncollectedAttemptId}/result`,
      { headers: { cookie: ownerCookie }, redirect: 'manual' },
    );
    expect(deniedResponse.status).toBe(302);
    expect(deniedResponse.headers.get('location')).toBe('/login');

    // The toggle route is owner-only.
    const stranger = createExternalUser({
      email: 'route-collect-stranger@example.com',
      emailVerified: true,
      fullName: 'Route Collect Stranger',
      provider: 'google',
      providerSubject: 'route-collect-stranger',
    });
    const strangerProfile = createProfile({ name: 'Stranger profile', userId: stranger.id });
    const strangerCookie = await createAuthenticatedCookie(stranger.id, strangerProfile.id);
    await postForm(
      `/resources/${quiz.id}/share/collect-results`,
      { _csrf: csrfToken, collectResults: 'on' },
      strangerCookie,
    );
    expect(findResourceShareLinkForResource(quiz.id)?.collectResults).toBe(false);
    await postForm(
      `/resources/${quiz.id}/share/collect-results`,
      { _csrf: csrfToken, collectResults: 'on' },
      ownerCookie,
    );
    expect(findResourceShareLinkForResource(quiz.id)?.collectResults).toBe(true);
  });

  it('sends anonymous visitors from a shared roleplay/guide start to sign up', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createPracticeGuide, createProfile, createRoleplay, getOrCreateResourceShareLink } =
      await import('../../src/server/db/repository.js');

    const owner = createExternalUser({
      email: 'route-shared-start-owner@example.com',
      emailVerified: true,
      fullName: 'Route Shared Start Owner',
      provider: 'google',
      providerSubject: 'route-shared-start-owner',
    });
    const ownerProfile = createProfile({ name: 'Route shared start profile', userId: owner.id });
    const roleplay = createRoleplay({
      characters: [
        { description: 'A learner ordering lunch politely.', id: 'learner', name: 'Learner' },
        { description: 'A helpful cafe server.', id: 'ai', name: 'Server' },
      ],
      description: 'A customer orders lunch at a cafe.',
      level: 'A2',
      profileId: ownerProfile.id,
      title: 'Shared Start Roleplay',
      userId: owner.id,
    });
    const practiceGuide = createPracticeGuide({
      description: 'Shared start guide.',
      profileId: ownerProfile.id,
      title: 'Shared Start Guide',
      tutorInstructions: 'Practice shared start.',
      userId: owner.id,
    });

    const roleplayStart = `/roleplays/shared/${getOrCreateResourceShareLink(roleplay.id).id}/start`;
    const roleplayResponse = await fetch(`${baseUrl}${roleplayStart}`, { redirect: 'manual' });
    expect(roleplayResponse.status).toBe(302);
    expect(roleplayResponse.headers.get('location')).toBe(
      `/signup?returnTo=${encodeURIComponent(roleplayStart)}`,
    );

    const guideStart = `/practice-guides/shared/${getOrCreateResourceShareLink(practiceGuide.id).id}/start`;
    const guideResponse = await fetch(`${baseUrl}${guideStart}`, { redirect: 'manual' });
    expect(guideResponse.status).toBe(302);
    expect(guideResponse.headers.get('location')).toBe(
      `/signup?returnTo=${encodeURIComponent(guideStart)}`,
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
