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
      route: '/media-library',
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
    createPracticeGuide({
      description: 'Route labels guide.',
      profileId: ownerProfile.id,
      title: 'Route Labels Guide',
      tutorInstructions: 'Practice route labels.',
      userId: owner.id,
    });

    const attempt = createQuizAttempt({
      quizId: quiz.id,
      profileId: ownerProfile.id,
      snapshot: quizDraft,
      userId: owner.id,
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
    expect(quizHtml).toContain('Entregas');
    expect(quizHtml).toContain(`/quiz-attempts/${attempt.id}/result`);
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

  it('renders the built-in media library and media detail pages', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');
    const {
      createUserSceneMediaJob,
      failUserSceneMediaJob,
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

    const libraryResponse = await fetch(`${baseUrl}/media-library`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const libraryHtml = await libraryResponse.text();
    expect(libraryResponse.status).toBe(200);
    expect(libraryHtml).toContain('Biblioteca de medios');
    expect(libraryHtml).toContain('Nuevo');
    expect(libraryHtml).toContain('Crear media');
    expect(libraryHtml).toContain('id="createSceneMediaModal"');
    expect(libraryHtml).toContain('airport-security-line-01-a1-a2');
    expect(libraryHtml).toContain('/public/scene-media/images/airport-security-line-01.png');
    expect(libraryHtml).toContain('/media-library/airport-security-line-01-a1-a2');
    expect(libraryHtml).toContain('data-scene-media-play');
    expect(libraryHtml).toContain('data-scene-media-preview-modal');
    expect(libraryHtml).toContain('class="stretched-link"');
    expect(libraryHtml).toContain('aria-label="Detalles"');
    expect(libraryHtml).toContain('aria-label="Reproducir"');
    expect(libraryHtml).not.toContain('bi-info-circle');
    expect(libraryHtml).toContain('/public/scene-media/audio/a1-a2/airport-security-line-01-a1-a2.mp3');
    expect(libraryHtml).toContain('Put your bag in the box');

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
    expect(detailHtml).toContain('Through Security');
    expect(detailHtml).toContain('Crear variación');
    expect(detailHtml).toContain('id="createSceneMediaVariationModal"');
    expect(detailHtml).toContain('/public/scene-media/audio/a1-a2/airport-security-line-01-a1-a2.mp3');
    expect(detailHtml).toContain('Put your bag in the box');
    expect(detailHtml).toContain('href="/media-library?level=A1-A2"');

    const csrfToken = extractCsrfToken(libraryHtml);
    const variationResponse = await postForm(
      '/media-library/airport-security-line-01-a1-a2/variations',
      {
        _csrf: csrfToken,
        format: 'single_panel_scene',
        imageDecision: 'keep_existing',
        level: 'A1-A2',
        prompt: 'Make the same scene feel calmer.',
        scriptAndAudioDecision: 'keep_existing',
        scriptTypePreference: 'unspecified',
      },
      cookie,
    );
    expect(variationResponse.status).toBe(302);
    const variationLocation = variationResponse.headers.get('location') ?? '';
    const variationMediaId = variationLocation.split('/').pop() ?? '';
    expect(variationLocation).toMatch(/^\/media-library\/[-0-9a-f]+$/);
    expect(findUserSceneMediaForProfile({
      mediaId: variationMediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })?.title).toBe('Variation: Through Security');

    const createResponse = await postForm(
      '/media-library',
      {
        _csrf: csrfToken,
        format: 'single_panel_scene',
        generationMode: 'image_only',
        level: 'A1-A2',
        prompt: 'A learner orders coffee politely.',
        scriptTypePreference: 'unspecified',
      },
      cookie,
    );
    expect(createResponse.status).toBe(302);
    expect(createResponse.headers.get('location')).toMatch(/^\/media-library\/[-0-9a-f]+$/);

    const failedJob = createUserSceneMediaJob({
      format: 'single_panel_scene',
      generationMode: 'image_only',
      level: 'A1-A2',
      ownerProfileId: profile.id,
      ownerUserId: user.id,
      prompt: 'A failed generated media item.',
      scriptTypePreference: 'unspecified',
      type: 'new_media',
    });
    failUserSceneMediaJob({
      failureMessage: 'Unable to generate this media.',
      failureReason: 'unexpected_error',
      mediaId: failedJob.mediaId,
    });

    const failedLibraryResponse = await fetch(`${baseUrl}/media-library`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const failedLibraryHtml = await failedLibraryResponse.text();
    expect(failedLibraryResponse.status).toBe(200);
    expect(failedLibraryHtml).toContain('A failed generated media item');
    expect(failedLibraryHtml).toContain('bi-exclamation-triangle-fill');
    expect(failedLibraryHtml).not.toContain('No se pudo generar esta media');
    expect(failedLibraryHtml).not.toContain(`action="/media-library/${failedJob.mediaId}/retry"`);
    expect(failedLibraryHtml).not.toContain(`action="/media-library/${failedJob.mediaId}/archive"`);

    const failedDetailResponse = await fetch(
      `${baseUrl}/media-library/${failedJob.mediaId}`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const failedDetailHtml = await failedDetailResponse.text();
    expect(failedDetailResponse.status).toBe(200);
    expect(failedDetailHtml).toContain('class="resource-action-row mb-4"');
    expect(failedDetailHtml).toContain('class="btn btn-secondary dropdown-toggle"');
    expect(failedDetailHtml).toContain('Opciones');
    expect(failedDetailHtml).toContain(`action="/media-library/${failedJob.mediaId}/retry"`);
    expect(failedDetailHtml).toContain(`action="/media-library/${failedJob.mediaId}/archive"`);
    expect(failedDetailHtml.indexOf('Crear variación')).toBeLessThan(
      failedDetailHtml.indexOf('Opciones'),
    );

    const archiveResponse = await postForm(
      `/media-library/${failedJob.mediaId}/archive`,
      {
        _csrf: csrfToken,
      },
      cookie,
    );
    expect(archiveResponse.status).toBe(302);
    expect(archiveResponse.headers.get('location')).toBe('/media-library');
    expect(findUserSceneMediaForProfile({
      mediaId: failedJob.mediaId,
      ownerProfileId: profile.id,
      ownerUserId: user.id,
    })).toBeNull();
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
    expect(decodeURIComponent(submitLocation)).toContain(`/quiz-attempts/${attemptId}/result`);
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
      description: 'Shared start roleplay.',
      level: 'A2',
      pedagogicalFocus: 'Evaluate polite requests.',
      profileId: ownerProfile.id,
      scenario: 'A customer orders lunch at a cafe.',
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
