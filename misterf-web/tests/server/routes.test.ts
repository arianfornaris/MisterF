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
      route: '/media-library/route-ready-media',
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

  it('keeps instruction language on profile forms for multi-profile accounts', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createConversation,
      createProfile,
      findConversationForUser,
      findProfileForUser,
    } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'route-profile-language@example.com',
      emailVerified: true,
      fullName: 'Route Profile Language',
      provider: 'google',
      providerSubject: 'route-profile-language',
    });
    const englishProfile = createProfile({
      instructionLanguage: 'en',
      name: 'English profile',
      userId: user.id,
    });
    const creoleProfile = createProfile({
      instructionLanguage: 'ht',
      name: 'Creole profile',
      userId: user.id,
    });
    const existingConversation = createConversation(user.id, creoleProfile.id);
    const cookie = await createAuthenticatedCookie(user.id, englishProfile.id);

    const settingsResponse = await fetch(`${baseUrl}/settings`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const settingsHtml = await settingsResponse.text();
    expect(settingsResponse.status).toBe(200);
    expect(settingsHtml).toContain('Manage your account security.');
    expect(settingsHtml).not.toContain('name="instructionLanguage"');
    expect(settingsHtml).not.toContain('/settings/language');

    const editResponse = await fetch(
      `${baseUrl}/profiles/${creoleProfile.id}/edit`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const editHtml = await editResponse.text();
    expect(editResponse.status).toBe(200);
    expect(editHtml).toContain('name="instructionLanguage"');
    expect(editHtml).toMatch(
      /name="instructionLanguage"\s+value="ht"\s+checked/,
    );

    const retiredSettingsUpdate = await postForm(
      '/settings/language',
      {
        _csrf: extractCsrfToken(editHtml),
        instructionLanguage: 'es',
      },
      cookie,
    );
    expect(retiredSettingsUpdate.status).toBe(404);

    const updateResponse = await postForm(
      `/profiles/${creoleProfile.id}`,
      {
        _csrf: extractCsrfToken(editHtml),
        description: creoleProfile.description,
        instructionLanguage: 'es',
        learningContext: creoleProfile.learningContext,
        modelTier: creoleProfile.modelTier,
        name: creoleProfile.name,
      },
      cookie,
    );
    expect(updateResponse.status).toBe(302);
    expect(updateResponse.headers.get('location')).toBe('/profiles');
    expect(
      findProfileForUser(englishProfile.id, user.id)?.instructionLanguage,
    ).toBe('en');
    expect(
      findProfileForUser(creoleProfile.id, user.id)?.instructionLanguage,
    ).toBe('es');
    expect(
      findConversationForUser(existingConversation.id, user.id)
        ?.instructionLanguage,
    ).toBe('ht');
    expect(createConversation(user.id, creoleProfile.id).instructionLanguage).toBe(
      'es',
    );
  });

  it('switches and edits the active profile from the main menu', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile, findProfileForUser } = await import(
      '../../src/server/db/repository.js'
    );

    const user = createExternalUser({
      email: 'route-profile-menu@example.com',
      emailVerified: true,
      fullName: 'Route Profile Menu',
      provider: 'google',
      providerSubject: 'route-profile-menu',
    });
    const activeProfile = createProfile({
      name: 'Menu active profile',
      userId: user.id,
    });
    const otherProfile = createProfile({
      name: 'Menu other profile',
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, activeProfile.id);

    const progressResponse = await fetch(`${baseUrl}/progress`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const progressHtml = await progressResponse.text();
    expect(progressResponse.status).toBe(200);

    // The menu switches profiles in place and links straight to the active
    // profile's edit page instead of routing through /profiles.
    expect(progressHtml).toContain('id="switchProfileModal"');
    expect(progressHtml).toContain('data-bs-target="#switchProfileModal"');
    expect(progressHtml).toMatch(
      new RegExp(`name="profileId"\\s+value="${otherProfile.id}"`),
    );
    expect(progressHtml).toContain(
      `/profiles/${activeProfile.id}/edit?returnTo=${encodeURIComponent('/progress')}`,
    );
    expect(progressHtml).not.toContain('href="/profiles"');

    const switchResponse = await postForm(
      '/profiles/switch',
      {
        _csrf: extractCsrfToken(progressHtml),
        profileId: otherProfile.id,
        returnTo: '/',
      },
      cookie,
    );
    expect(switchResponse.status).toBe(302);
    expect(switchResponse.headers.get('location')).toBe('/');

    const editResponse = await fetch(
      `${baseUrl}/profiles/${activeProfile.id}/edit?returnTo=%2Fprogress`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const editHtml = await editResponse.text();
    expect(editResponse.status).toBe(200);
    expect(editHtml).toContain('name="returnTo" value="/progress"');

    // Saving from the menu returns to the page the edit was started from.
    const updateResponse = await postForm(
      `/profiles/${activeProfile.id}`,
      {
        _csrf: extractCsrfToken(editHtml),
        description: '',
        instructionLanguage: 'es',
        learningContext: '',
        modelTier: 'lite',
        name: 'Menu renamed profile',
        returnTo: '/progress',
      },
      cookie,
    );
    expect(updateResponse.status).toBe(302);
    expect(updateResponse.headers.get('location')).toBe('/progress');
    expect(findProfileForUser(activeProfile.id, user.id)?.name).toBe(
      'Menu renamed profile',
    );

    // An off-site returnTo never leaves the app.
    const hijackedUpdate = await postForm(
      `/profiles/${activeProfile.id}`,
      {
        _csrf: extractCsrfToken(editHtml),
        instructionLanguage: 'es',
        modelTier: 'lite',
        name: 'Menu renamed profile',
        returnTo: '//evil.example.com',
      },
      cookie,
    );
    expect(hijackedUpdate.status).toBe(302);
    expect(hijackedUpdate.headers.get('location')).toBe('/');
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
      grantResourceAccess,
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
      // A valid draft: the recipient's detail page parses it (the share page does not).
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Route Shared Quiz',
      },
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
      expect(anonymousHtml).toContain('Compartido contigo por Route share owner profile');
      expect(anonymousHtml).toContain('Cómo funciona');
      // Declining without a session goes to the landing, not to a login wall.
      expect(anonymousHtml).toContain('href="/" data-shared-decline');
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
      expect(authenticatedHtml).toContain('href="/resources" data-shared-decline');
      if (resource.id === roleplay.id) {
        // The roleplay page introduces both characters before starting.
        expect(authenticatedHtml).toContain('Tu papel:');
        expect(authenticatedHtml).toContain('Server');
      }

      if (resource.isQuiz || resource.isStart) {
        // Once the recipient holds access, the detail page is where they come
        // back to it. Their run is real participation, never the author's
        // private "Probar".
        grantResourceAccess({
          collectResults: false,
          grantedByUserId: owner.id,
          grantedVia: 'link',
          profileId: receiverProfile.id,
          resourceId: resource.id,
          shareLinkId: shareLink.id,
          userId: receiver.id,
        });
        const recipientDetailHtml = await (
          await fetch(`${baseUrl}${resource.detailPath}`, {
            headers: { cookie: receiverCookie },
            redirect: 'manual',
          })
        ).text();
        expect(recipientDetailHtml).toContain(resource.isQuiz ? 'Hacer el quiz' : 'Comenzar');
        expect(recipientDetailHtml).not.toContain('Probar');
      }

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

  it('hands a colleague their own copy through a copy link', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createProfile,
      createQuiz,
      findActiveResourceCopyLinkForResource,
      findResourceById,
      findResourceCopyOrigin,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');

    const author = createExternalUser({
      email: 'route-copy-author@example.com',
      emailVerified: true,
      fullName: 'Route Copy Author',
      provider: 'google',
      providerSubject: 'route-copy-author',
    });
    const authorProfile = createProfile({ name: 'Profe Autor', userId: author.id });
    const colleague = createExternalUser({
      email: 'route-copy-colleague@example.com',
      emailVerified: true,
      fullName: 'Route Copy Colleague',
      provider: 'google',
      providerSubject: 'route-copy-colleague',
    });
    const colleagueProfile = createProfile({ name: 'Profe Colega', userId: colleague.id });
    const quiz = createQuiz({
      description: 'Route copied quiz.',
      instructions: '',
      profileId: authorProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Route Copied Quiz',
      },
      title: 'Route Copied Quiz',
      userId: author.id,
    });
    const authorCookie = await createAuthenticatedCookie(author.id, authorProfile.id);
    const colleagueCookie = await createAuthenticatedCookie(colleague.id, colleagueProfile.id);

    // The author sees two distinct share actions, and no copy link exists
    // until they ask for one: opening it hands over the answer key.
    const ownerHtml = await (
      await fetch(`${baseUrl}/quizzes/${quiz.id}`, { headers: { cookie: authorCookie } })
    ).text();
    expect(ownerHtml).toContain('Compartir para practicar');
    expect(ownerHtml).toContain('Compartir una copia');
    expect(ownerHtml).toContain('Crear enlace de copia');
    expect(findActiveResourceCopyLinkForResource(quiz.id)).toBeNull();
    const csrf = extractCsrfToken(ownerHtml);

    const createResponse = await postForm(
      `/resources/${quiz.id}/copy-link`,
      { _csrf: csrf, returnTo: `/quizzes/${quiz.id}?share=copy` },
      authorCookie,
    );
    expect(createResponse.status).toBe(302);
    expect(createResponse.headers.get('location')).toBe(`/quizzes/${quiz.id}?share=copy`);
    const copyLink = findActiveResourceCopyLinkForResource(quiz.id);
    expect(copyLink).not.toBeNull();
    const copyPath = `/resources/copy/${copyLink!.id}`;

    const ownerModalHtml = await (
      await fetch(`${baseUrl}/quizzes/${quiz.id}?share=copy`, { headers: { cookie: authorCookie } })
    ).text();
    expect(ownerModalHtml).toContain(copyPath);
    expect(ownerModalHtml).toContain('data-auto-open-copy-link-modal');
    expect(ownerModalHtml).toContain('Desactivar enlace');

    // A colleague without an account is asked to sign up; the page never
    // offers to run the author's quiz.
    const anonymousResponse = await fetch(`${baseUrl}${copyPath}`, { redirect: 'manual' });
    const anonymousHtml = await anonymousResponse.text();
    expect(anonymousResponse.status).toBe(200);
    expect(anonymousHtml).toContain('Route Copied Quiz');
    expect(anonymousHtml).toContain('Profe Autor te comparte una copia para que la uses con tus estudiantes');
    expect(anonymousHtml).toContain(`/signup?returnTo=${encodeURIComponent(copyPath)}`);
    expect(anonymousHtml).not.toContain('Hacer el quiz');
    expect(anonymousHtml).not.toContain('/take');

    // Signed in, one click makes the copy and lands on it.
    const colleagueHtml = await (
      await fetch(`${baseUrl}${copyPath}`, { headers: { cookie: colleagueCookie }, redirect: 'manual' })
    ).text();
    expect(colleagueHtml).toContain('Hacer mi copia');
    const acceptResponse = await postForm(
      `${copyPath}/accept`,
      { _csrf: extractCsrfToken(colleagueHtml) },
      colleagueCookie,
    );
    expect(acceptResponse.status).toBe(302);
    const copyLocation = acceptResponse.headers.get('location') ?? '';
    expect(copyLocation).toMatch(/^\/quizzes\//);
    const copyId = copyLocation.split('/').pop()!;
    expect(copyId).not.toBe(quiz.id);
    expect(findResourceById(copyId)?.userId).toBe(colleague.id);
    expect(findResourceCopyOrigin(copyId)?.originUserId).toBe(author.id);

    // The copy is the colleague's: they author it, and it credits the author.
    const copyDetailHtml = await (
      await fetch(`${baseUrl}${copyLocation}`, { headers: { cookie: colleagueCookie } })
    ).text();
    expect(copyDetailHtml).toContain('Basado en un recurso de Profe Autor');
    expect(copyDetailHtml).toContain('Probar');
    expect(copyDetailHtml).toContain('Compartir una copia');

    // Coming back opens the same copy instead of making another one.
    const returningHtml = await (
      await fetch(`${baseUrl}${copyPath}`, { headers: { cookie: colleagueCookie } })
    ).text();
    expect(returningHtml).toContain('Abrir mi copia');
    expect(returningHtml).toContain(`href="${copyLocation}"`);
    const secondAccept = await postForm(`${copyPath}/accept`, { _csrf: csrf }, colleagueCookie);
    expect(secondAccept.headers.get('location')).toBe(copyLocation);

    // The author's own link sends them back to the resource.
    const authorOnLink = await fetch(`${baseUrl}${copyPath}`, {
      headers: { cookie: authorCookie },
      redirect: 'manual',
    });
    expect(authorOnLink.status).toBe(302);
    expect(authorOnLink.headers.get('location')).toBe(`/quizzes/${quiz.id}?share=copy`);

    // The run link is not a copy link.
    const shareLink = getOrCreateResourceShareLink(quiz.id);
    const runLinkAsCopy = await fetch(`${baseUrl}/resources/copy/${shareLink.id}`, {
      headers: { cookie: colleagueCookie },
      redirect: 'manual',
    });
    expect(runLinkAsCopy.headers.get('location')).toBe('/resources');

    // Only the owner can turn a copy link on.
    await postForm(`/resources/${quiz.id}/copy-link/revoke`, { _csrf: csrf }, colleagueCookie);
    expect(findActiveResourceCopyLinkForResource(quiz.id)?.id).toBe(copyLink!.id);

    // Revoking kills the link for everyone but never takes a copy back.
    const revokeResponse = await postForm(
      `/resources/${quiz.id}/copy-link/revoke`,
      { _csrf: csrf, returnTo: `/quizzes/${quiz.id}?share=copy` },
      authorCookie,
    );
    expect(revokeResponse.status).toBe(302);
    expect(findActiveResourceCopyLinkForResource(quiz.id)).toBeNull();
    const deadLink = await fetch(`${baseUrl}${copyPath}`, { redirect: 'manual' });
    expect(deadLink.status).toBe(302);
    expect(deadLink.headers.get('location')).toBe('/');
    expect(findResourceById(copyId)?.archivedAt).toBeNull();

    await postForm(`/resources/${quiz.id}/copy-link`, { _csrf: csrf }, colleagueCookie);
    expect(findActiveResourceCopyLinkForResource(quiz.id)).toBeNull();
  });

  it('copies a whole folder, subfolders included, through a copy link', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      addResourceToFolder,
      createProfile,
      createQuiz,
      createResourceCopyLink,
      createResourceFolder,
      createRoleplay,
      findResourceById,
      findResourceCopyOrigin,
      listResourceFolderItems,
    } = await import('../../src/server/db/repository.js');

    const author = createExternalUser({
      email: 'route-folder-copy-author@example.com',
      emailVerified: true,
      fullName: 'Route Folder Copy Author',
      provider: 'google',
      providerSubject: 'route-folder-copy-author',
    });
    const authorProfile = createProfile({ name: 'Profe Carpeta', userId: author.id });
    const colleague = createExternalUser({
      email: 'route-folder-copy-colleague@example.com',
      emailVerified: true,
      fullName: 'Route Folder Copy Colleague',
      provider: 'google',
      providerSubject: 'route-folder-copy-colleague',
    });
    const colleagueProfile = createProfile({ name: 'Colega Carpeta', userId: colleague.id });
    const folder = createResourceFolder({
      description: 'Unidad 3 completa.',
      profileId: authorProfile.id,
      title: 'Unidad 3',
      userId: author.id,
    });
    const subfolder = createResourceFolder({
      profileId: authorProfile.id,
      title: 'Repaso',
      userId: author.id,
    });
    const quiz = createQuiz({
      description: 'Folder quiz.',
      instructions: '',
      profileId: authorProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Quiz de la unidad',
      },
      title: 'Quiz de la unidad',
      userId: author.id,
    });
    const roleplay = createRoleplay({
      characters: [
        { description: 'A learner ordering lunch politely.', id: 'learner', name: 'Learner' },
        { description: 'A helpful cafe server.', id: 'ai', name: 'Server' },
      ],
      description: 'Ordering lunch at a cafe.',
      level: 'A2',
      profileId: authorProfile.id,
      title: 'Roleplay de repaso',
      userId: author.id,
    });
    addResourceToFolder({ folderId: folder.id, resourceId: quiz.id, userId: author.id });
    addResourceToFolder({ folderId: folder.id, resourceId: subfolder.id, userId: author.id });
    addResourceToFolder({ folderId: subfolder.id, resourceId: roleplay.id, userId: author.id });
    const copyPath = `/resources/copy/${createResourceCopyLink(folder.id).id}`;
    const colleagueCookie = await createAuthenticatedCookie(colleague.id, colleagueProfile.id);

    // The page lists what the colleague is about to copy.
    const pageHtml = await (
      await fetch(`${baseUrl}${copyPath}`, { headers: { cookie: colleagueCookie } })
    ).text();
    expect(pageHtml).toContain('Qué incluye');
    expect(pageHtml).toContain('2 actividades');
    expect(pageHtml).toContain('Quiz de la unidad');
    expect(pageHtml).toContain('Repaso');
    expect(pageHtml).toContain('Hacer mi copia');

    const acceptResponse = await postForm(
      `${copyPath}/accept`,
      { _csrf: extractCsrfToken(pageHtml) },
      colleagueCookie,
    );
    expect(acceptResponse.status).toBe(302);
    const folderLocation = acceptResponse.headers.get('location') ?? '';
    expect(folderLocation).toMatch(/^\/resources\/folders\//);
    const folderCopyId = folderLocation.split('/').pop()!;
    expect(folderCopyId).not.toBe(folder.id);

    // The tree arrives whole, owned by the colleague, each piece credited.
    const topItems = listResourceFolderItems(folderCopyId, colleague.id);
    expect(topItems.map((item) => findResourceById(item.resourceId)?.title).sort())
      .toEqual(['Quiz de la unidad', 'Repaso']);
    const subfolderCopy = topItems.find((item) => item.resourceType === 'resource_folder')!;
    const nestedItems = listResourceFolderItems(subfolderCopy.resourceId, colleague.id);
    expect(nestedItems.map((item) => findResourceById(item.resourceId)?.title))
      .toEqual(['Roleplay de repaso']);
    for (const id of [folderCopyId, ...topItems.map((item) => item.resourceId), nestedItems[0]!.resourceId]) {
      expect(findResourceById(id)?.userId).toBe(colleague.id);
      expect(findResourceCopyOrigin(id)?.originProfileId).toBe(authorProfile.id);
    }

    const folderPageHtml = await (
      await fetch(`${baseUrl}${folderLocation}`, { headers: { cookie: colleagueCookie } })
    ).text();
    expect(folderPageHtml).toContain('Unidad 3');
    expect(folderPageHtml).toContain('Basado en un recurso de Profe Carpeta');
    expect(folderPageHtml).toContain('Compartir una copia');

    // A snapshot: what the author files later does not reach the copy.
    const later = createResourceFolder({ profileId: authorProfile.id, title: 'Añadida después', userId: author.id });
    addResourceToFolder({ folderId: folder.id, resourceId: later.id, userId: author.id });
    expect(listResourceFolderItems(folderCopyId, colleague.id)).toHaveLength(2);
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
    // The author's own run is a private test, so the author reads "Probar".
    expect(detailHtml).toContain('Probar');
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
    expect(editHtml).toContain(`data-modify-endpoint="/roleplays/${roleplay.id}/edit/modify"`);
    expect(editHtml).toContain(`data-modify-apply-endpoint="/roleplays/${roleplay.id}/edit/modify/apply"`);
    expect(editHtml).toContain(`data-modify-discard-endpoint="/roleplays/${roleplay.id}/edit/modify/discard"`);
    expect(editHtml.match(/data-modify-open/g)).toHaveLength(1);
    expect(editHtml).toContain('data-modify-modal');
    expect(editHtml).toContain('modal-dialog-scrollable');
    expect(editHtml).not.toContain('data-modify-form');
    expect(editHtml).toContain('data-modify-comparison');
    expect(editHtml).toContain('data-modify-phase="preview"');
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
    expect(editHtml).toContain('data-modify-modal');
    expect(editHtml).toContain(
      `data-modify-endpoint="/practice-guides/${practiceGuide.id}/edit/modify"`,
    );
    expect(editHtml).toContain('data-modify-comparison');
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

    // The badges are icon-only; the label moves to the tooltip, and the
    // "shared by me" one carries how many profiles hold access. This quiz is
    // only behind a link so far, so nobody has acquired it yet.
    expect(allHtml).toContain('Compartido por mí · 0 perfiles con acceso');

    // Granting access to a profile increments the count on the badge.
    grantResourceAccess({
      grantedByUserId: owner.id,
      grantedVia: 'profile',
      profileId: otherProfile.id,
      resourceId: sharedByMeQuiz.id,
      userId: otherOwner.id,
    });
    expect(await getResources()).toContain('Compartido por mí · 1 perfil con acceso');

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
    const createdFolderHtml = await createdFolderResponse.text();
    expect(createdFolderHtml).toContain('QA Folder');
    // The "Nuevo" chooser is a modal whose options create inside this folder.
    expect(createdFolderHtml).toContain('data-bs-target="#newResourceModal"');
    const folderQuery = `?folder=${encodeURIComponent(folderId)}`;
    for (const newPath of ['/quizzes/new', '/practice-guides/new', '/roleplays/new']) {
      expect(createdFolderHtml).toContain(`href="${newPath}${folderQuery}"`);
    }

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

  it('renders the media library and media detail pages', async () => {
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
          src: 'https://cdn.example.test/route-ready-media/turn-01.wav',
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
        src: 'https://cdn.example.test/route-ready-media/image.png',
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
    expect(libraryHtml).toContain('Route Ready Media');
    expect(libraryHtml).toContain('https://cdn.example.test/route-ready-media/image.png');
    expect(libraryHtml).toContain('/media-library/route-ready-media');
    expect(libraryHtml).not.toContain('airport-security-line-01-a1-a2');
    expect(libraryHtml).not.toContain('Creada por el usuario');
    expect(libraryHtml).toContain('data-scene-media-play');
    expect(libraryHtml).toContain('data-scene-media-preview-modal');
    expect(libraryHtml).toContain('class="stretched-link"');
    expect(libraryHtml).toContain('aria-label="Detalles"');
    expect(libraryHtml).toContain('aria-label="Reproducir"');
    expect(libraryHtml).not.toContain('bi-info-circle');
    expect(libraryHtml).toContain('https://cdn.example.test/route-ready-media/turn-01.wav');
    expect(libraryHtml).toContain('Please place your bag on the belt.');

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

    const builtInMediaResponse = await fetch(
      `${baseUrl}/media-library/airport-security-line-01-a1-a2`,
      { headers: { cookie }, redirect: 'manual' },
    );
    expect(builtInMediaResponse.status).toBe(302);
    expect(builtInMediaResponse.headers.get('location')).toBe('/media-library');

    const builtInTitleGenerationResponse = await postForm(
      '/media-library/airport-security-line-01-a1-a2/generate-title',
      { _csrf: authoringCsrfToken },
      cookie,
    );
    expect(builtInTitleGenerationResponse.status).toBe(302);
    expect(builtInTitleGenerationResponse.headers.get('location')).toBe('/media-library');

    const filteredResponse = await fetch(`${baseUrl}/media-library?level=C1`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const filteredHtml = await filteredResponse.text();
    expect(filteredResponse.status).toBe(200);
    expect(filteredHtml).not.toContain('Updated Route Media');
    expect(filteredHtml).toContain('No hay medias');

    const detailResponse = await fetch(
      `${baseUrl}/media-library/route-ready-media?returnTo=${encodeURIComponent('/media-library?level=A1-A2')}`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain('Updated Route Media');
    expect(detailHtml).toContain('Crear variación');
    expect(detailHtml).toContain('href="/media-library/route-ready-media/variations/new"');
    expect(detailHtml).toContain('href="/media-library/route-ready-media/edit"');
    expect(detailHtml).not.toContain('data-bs-target="#createSceneMediaVariationModal"');
    expect(detailHtml).not.toContain('id="createSceneMediaVariationModal"');
    expect(detailHtml).not.toContain('Creada por el usuario');
    expect(detailHtml).toContain('https://cdn.example.test/route-ready-media/turn-01.wav');
    expect(detailHtml).toContain('Please place your bag on the belt.');
    expect(detailHtml).toContain('href="/media-library?level=A1-A2"');

    const variationPageResponse = await fetch(
      `${baseUrl}/media-library/route-ready-media/variations/new`,
      { headers: { cookie }, redirect: 'manual' },
    );
    const variationPageHtml = await variationPageResponse.text();
    expect(variationPageResponse.status).toBe(200);
    expect(variationPageHtml).toContain('Variación de Updated Route Media');
    expect(variationPageHtml).toContain('data-scene-media-variation-form');
    expect(variationPageHtml).toContain('data-scene-media-pending-modal');

    const csrfToken = extractCsrfToken(newMediaHtml);
    const variationResponse = await postForm(
      '/media-library/route-ready-media/variations',
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
    const { createReadyUserSceneMedia } = await import(
      '../../src/server/sceneMedia/userMediaRepository.js'
    );

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
    createReadyUserSceneMedia({
      audio: {
        clips: [{
          speaker: 'Agent',
          src: 'https://cdn.example.test/route-ht-media/turn-01.wav',
          turn: 1,
        }],
        format: 'wav',
        voiceStrategy: 'per_turn_clips',
      },
      format: 'single_panel_scene',
      generationMode: 'complete_scene',
      id: 'route-ht-media',
      image: {
        alt: 'A traveler at airport security.',
        src: 'https://cdn.example.test/route-ht-media/image.png',
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
      title: 'Route HT Media',
      visualSummary: ['A traveler speaks with a security officer.'],
    });

    const libraryResponse = await fetch(`${baseUrl}/media-library`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const libraryHtml = await libraryResponse.text();
    expect(libraryResponse.status).toBe(200);
    // The tag now carries the profile's home mode too, so assert the
    // language attribute rather than the whole opening tag.
    expect(libraryHtml).toContain('<html lang="ht"');
    expect(libraryHtml).toContain('Bibliyotèk medya');
    expect(libraryHtml).toContain('Detay');
    expect(libraryHtml).toContain('Jwe');
    expect(libraryHtml).toContain('Jwe medya');
    expect(libraryHtml).not.toContain('Details');
    expect(libraryHtml).not.toContain('Play media');

    const detailResponse = await fetch(
      `${baseUrl}/media-library/route-ht-media`,
      {
        headers: { cookie },
        redirect: 'manual',
      },
    );
    const detailHtml = await detailResponse.text();
    expect(detailResponse.status).toBe(200);
    expect(detailHtml).toContain('<html lang="ht"');
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

  it('keeps a guest on the shared path out of the quiz and into signup', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile, createQuiz, getOrCreateResourceShareLink } = await import(
      '../../src/server/db/repository.js'
    );
    const { getDb } = await import('../../src/server/db/database.js');

    const owner = createExternalUser({
      email: 'route-guest-exit-owner@example.com',
      emailVerified: true,
      fullName: 'Route Guest Exit Owner',
      provider: 'google',
      providerSubject: 'route-guest-exit-owner',
    });
    const ownerProfile = createProfile({ name: 'Route guest exit profile', userId: owner.id });
    const quiz = createQuiz({
      profileId: ownerProfile.id,
      quiz: {
        blocks: [
          { id: 'open_text', item: { kind: 'quiz_open_text', prompt: 'Write one sentence.' } },
        ],
        title: 'Guest Exit Quiz',
      },
      title: 'Guest Exit Quiz',
      userId: owner.id,
    });
    const shareLink = getOrCreateResourceShareLink(quiz.id);
    const sharePath = `/resources/shared/${shareLink.id}`;
    const sharedHtml = await (await fetch(`${baseUrl}${sharePath}`)).text();
    const csrf = extractCsrfToken(sharedHtml);

    const startLocation =
      (await postForm(`/quizzes/shared/${shareLink.id}/take`, { _csrf: csrf }, '')).headers.get(
        'location',
      ) ?? '';
    const attemptId = decodeURIComponent(startLocation.replace('/quiz-attempts/', '').split('?')[0]);
    const guestToken = new URLSearchParams(startLocation.split('?')[1]).get('guestToken') ?? '';

    // The close X leads back to the shared page, never to the owner's quiz
    // page, which would send a visitor without a session to /login.
    const attemptHtml = await (await fetch(`${baseUrl}${startLocation}`)).text();
    expect(attemptHtml).toContain(`class="app-page-close-button"\n        href="${sharePath}"`);
    expect(attemptHtml).not.toContain(`href="/quizzes/${quiz.id}"`);

    const submitLocation =
      (
        await postForm(`/quiz-attempts/${attemptId}/submit`, { _csrf: csrf, guestToken }, '')
      ).headers.get('location') ?? '';
    const returnTo = new URLSearchParams(submitLocation.split('?')[1]).get('returnTo') ?? '';

    // Signup says the answers are saved and what the account unlocks, and
    // leads back to the activity; login carries the same context.
    const signupHtml = await (await fetch(`${baseUrl}${submitLocation}`)).text();
    expect(signupHtml).toContain('Tus respuestas están guardadas');
    expect(signupHtml).toContain('evaluación de «Guest Exit Quiz»');
    expect(signupHtml).toContain(`href="${sharePath}"`);
    const loginHtml = await (
      await fetch(`${baseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`)
    ).text();
    expect(loginHtml).toContain('Tus respuestas de «Guest Exit Quiz» están guardadas');

    // A token that does not match the attempt keeps the generic page.
    const forgedReturnTo = returnTo.replace(guestToken, 'not-the-token');
    const forgedHtml = await (
      await fetch(`${baseUrl}/signup?returnTo=${encodeURIComponent(forgedReturnTo)}`)
    ).text();
    expect(forgedHtml).toContain('Empezar a practicar');
    expect(forgedHtml).not.toContain('Guest Exit Quiz');

    // Once the link is revoked there is no shared page to return to: the X
    // falls back to the landing and signup drops the way back.
    getDb()
      .prepare('UPDATE resource_share_links SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(shareLink.id);
    const revokedAttemptHtml = await (await fetch(`${baseUrl}${startLocation}`)).text();
    expect(revokedAttemptHtml).toContain(`class="app-page-close-button"\n        href="/"`);
    const revokedSignupHtml = await (await fetch(`${baseUrl}${submitLocation}`)).text();
    expect(revokedSignupHtml).toContain('Tus respuestas están guardadas');
    expect(revokedSignupHtml).not.toContain(`href="${sharePath}"`);
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

  it('names the resource a derived conversation came from', async () => {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const {
      createConversation,
      createConversationFromPracticeGuide,
      createPracticeGuide,
      createProfile,
    } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: 'derived-conversation@example.com',
      emailVerified: true,
      fullName: 'Conversation Origin',
      provider: 'google',
      providerSubject: 'derived-conversation',
    });
    const profile = createProfile({
      instructionLanguage: 'en',
      name: 'Origin profile',
      userId: user.id,
    });
    const cookie = await createAuthenticatedCookie(user.id, profile.id);

    const practiceGuide = createPracticeGuide({
      description: 'Practice ordering at a clinic.',
      profileId: profile.id,
      title: 'At The Clinic',
      tutorInstructions: 'Guide the learner through a clinic visit.',
      userId: user.id,
    });
    const guideConversation = createConversationFromPracticeGuide(
      user.id,
      practiceGuide,
      profile.id,
    );

    const derivedResponse = await fetch(`${baseUrl}/c/${guideConversation.id}`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const derivedHtml = await derivedResponse.text();
    expect(derivedResponse.status).toBe(200);
    expect(derivedHtml).toContain('class="conversation-origin"');
    expect(derivedHtml).toContain('Comes from');
    expect(derivedHtml).toContain(`href="/practice-guides/${practiceGuide.id}"`);
    expect(derivedHtml).toContain('At The Clinic');

    // A chat that was not derived from anything says nothing.
    const plainConversation = createConversation(user.id, profile.id);
    const plainResponse = await fetch(`${baseUrl}/c/${plainConversation.id}`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const plainHtml = await plainResponse.text();
    expect(plainResponse.status).toBe(200);
    expect(plainHtml).not.toContain('class="conversation-origin"');
  });
});

describe('signed-in home modes', () => {
  async function createHomeAccount(seed: string, homeMode: 'learn' | 'teach') {
    const { createExternalUser } = await import('../../src/server/auth/repository.js');
    const { createProfile } = await import('../../src/server/db/repository.js');

    const user = createExternalUser({
      email: `${seed}@example.com`,
      emailVerified: true,
      fullName: `Home ${seed}`,
      provider: 'google',
      providerSubject: seed,
    });
    const profile = createProfile({
      homeMode,
      instructionLanguage: 'en',
      name: `${seed} profile`,
      userId: user.id,
    });

    return { cookie: await createAuthenticatedCookie(user.id, profile.id), profile, user };
  }

  it('opens the learning home as its own page for a learning profile', async () => {
    const { cookie } = await createHomeAccount('home-learner', 'learn');

    const response = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    // Roadmap V3 §1.16: the learning home is no longer the chat. Mr. F is one
    // text box that opens `/chat`.
    expect(html).not.toContain('id="chatForm"');
    expect(html).toContain('data-home-ask-form');
    expect(html).toContain('action="/chat"');
    // Every prompt field offers attachment (`prompt-attachments`).
    expect(html).toContain('data-attachment-picker="homeAskAttachmentWizard"');
    expect(html).toContain('id="homeAskAttachmentWizard"');
    expect(html).toContain('What would you like to practice today?');
    expect(html).toContain('For you');
    expect(html).toContain('href="/progress"');
    // Nothing shared with this profile yet: the illustrated empty state.
    expect(html).toContain('When someone shares an activity with you');
    expect(html).toContain('/public/illustrations/empty-biblioteca.png');
    // The learning composition's hero (`ui-illustrations`).
    expect(html).toContain("url('/public/illustrations/hero-aprendo.png')");
    expect(html).toContain('aria-label="A learner practicing English at her kitchen table"');
    // The home is the active entry in the side panel.
    expect(html).toMatch(/class="panel-nav-link is-active" href="\/"/);
  });

  it('separates the way home from a new conversation', async () => {
    const { cookie } = await createHomeAccount('home-nav', 'teach');

    const response = await fetch(`${baseUrl}/resources`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    // Roadmap V3 §1.15: "Inicio" goes to `/`, "Nueva conversación" to `/chat`,
    // and a section root closes to the home.
    expect(html).toMatch(/href="\/">\s*<i class="bi bi-house"/);
    expect(html).toContain('href="/chat" data-new-conversation');
    expect(html).toMatch(/class="app-page-close-button"\s+href="\/"/);
    // The phone toolbar reaches the home without opening the side panel.
    expect(html).toMatch(/class="btn btn-link chat-home-button d-lg-none"\s+href="\/"/);
    // The legal footer is the last thing on the page, after the shell, and
    // not inside the side panel.
    expect(html).toMatch(/<\/main>\s*(?:<%#[\s\S]*?%>)?\s*<footer[^>]*>[\s\S]*?href="\/privacy"/);
    expect(html).not.toMatch(/class="panel-bottom"[\s\S]*?href="\/privacy"[\s\S]*?<\/aside>/);
  });

  it('writes the profile home mode onto the document so the theme can read it', async () => {
    const learner = await createHomeAccount('home-mode-attr-learn', 'learn');
    const teacher = await createHomeAccount('home-mode-attr-teach', 'teach');

    const learnerHome = await fetch(`${baseUrl}/`, {
      headers: { cookie: learner.cookie },
      redirect: 'manual',
    });
    expect(await learnerHome.text()).toContain('<html lang="en" data-mode="learn">');

    const teacherHome = await fetch(`${baseUrl}/`, {
      headers: { cookie: teacher.cookie },
      redirect: 'manual',
    });
    expect(await teacherHome.text()).toContain('<html lang="en" data-mode="teach">');

    // The attribute is app-wide, not home-only: the rail in the side panel is
    // the one mode signal that survives navigating away from the home.
    const catalog = await fetch(`${baseUrl}/resources`, {
      headers: { cookie: teacher.cookie },
      redirect: 'manual',
    });
    expect(await catalog.text()).toContain('<html lang="en" data-mode="teach">');
  });

  it('opens the teaching composition for a teaching profile', async () => {
    const { cookie } = await createHomeAccount('home-teacher', 'teach');

    const response = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Your shared activities');
    expect(html).toContain('Create an activity');
    expect(html).toContain('href="/quizzes/new"');
    expect(html).toContain('You have not shared an activity yet');
    expect(html).toContain('/public/illustrations/empty-clase.png');
    // The teaching composition's own hero and the family spots on creation.
    expect(html).toContain("url('/public/illustrations/hero-enseno.png')");
    expect(html).toContain('aria-label="A teacher getting worksheets ready by his desk"');
    expect(html).toContain('/public/illustrations/spot-quiz.png');
    expect(html).toContain('/public/illustrations/spot-roleplay.png');
    // Nothing answered yet, so the lede is the plain description.
    expect(html).toContain('Create activities, share them, and review what people answered.');
    // The teaching home is not the chat page; the tutor is one quiet link away.
    expect(html).not.toContain('id="chatForm"');
    expect(html).toContain('href="/chat"');
  });

  it('shows shared activities and their participation on the teaching home', async () => {
    const {
      createQuiz,
      createQuizAttempt,
      createProfile,
      getOrCreateResourceShareLink,
    } = await import('../../src/server/db/repository.js');
    const { createExternalUser } = await import('../../src/server/auth/repository.js');

    const { cookie, profile, user } = await createHomeAccount('home-shares', 'teach');
    const quiz = createQuiz({
      profileId: profile.id,
      quiz: { blocks: [], title: 'Present Perfect Drill', type: 'quiz' },
      title: 'Present Perfect Drill',
      userId: user.id,
    });
    getOrCreateResourceShareLink(quiz.id);

    const student = createExternalUser({
      email: 'home-shares-student@example.com',
      emailVerified: true,
      fullName: 'Home Student',
      provider: 'google',
      providerSubject: 'home-shares-student',
    });
    const studentProfile = createProfile({ name: 'Student profile', userId: student.id });
    createQuizAttempt({
      collectResults: true,
      profileId: studentProfile.id,
      quizId: quiz.id,
      snapshot: { blocks: [], title: 'Present Perfect Drill', type: 'quiz' },
      userId: student.id,
    });

    const response = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Present Perfect Drill');
    expect(html).toContain(`href="/quizzes/${quiz.id}/participation"`);
    expect(html).toContain('1 new answer');
    expect(html).toContain('1 participant');
  });

  it('lists activities shared with a learning profile as pending', async () => {
    const { createQuiz, createProfile, grantResourceAccess } = await import(
      '../../src/server/db/repository.js'
    );
    const { createExternalUser } = await import('../../src/server/auth/repository.js');

    const { cookie, profile, user } = await createHomeAccount('home-receiver', 'learn');
    const teacher = createExternalUser({
      email: 'home-receiver-teacher@example.com',
      emailVerified: true,
      fullName: 'Home Teacher',
      provider: 'google',
      providerSubject: 'home-receiver-teacher',
    });
    const teacherProfile = createProfile({ name: 'Teacher profile', userId: teacher.id });
    const quiz = createQuiz({
      profileId: teacherProfile.id,
      quiz: { blocks: [], title: 'Homework One', type: 'quiz' },
      title: 'Homework One',
      userId: teacher.id,
    });
    grantResourceAccess({
      grantedByUserId: teacher.id,
      grantedVia: 'link',
      profileId: profile.id,
      resourceId: quiz.id,
      userId: user.id,
    });

    const response = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Homework One');
    expect(html).toContain(`href="/quizzes/${quiz.id}"`);
    expect(html).toContain('Pending');
    // The pending activity leads the page as the next step.
    expect(html).toContain('You have 1 pending activity.');
    expect(html).toMatch(/href="\/quizzes\/[^"]+">\s*<i class="bi bi-play-fill/);
  });

  it('switches the composition and persists it on the profile', async () => {
    const { findProfileForUser } = await import('../../src/server/db/repository.js');
    const { cookie, profile, user } = await createHomeAccount('home-switch', 'learn');

    const homeResponse = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    const csrfToken = extractCsrfToken(await homeResponse.text());

    const switchResponse = await postForm(
      '/home/mode',
      { _csrf: csrfToken, homeMode: 'teach', returnTo: '/' },
      cookie,
    );
    expect(switchResponse.status).toBe(302);
    expect(switchResponse.headers.get('location')).toBe('/');
    expect(findProfileForUser(profile.id, user.id)?.homeMode).toBe('teach');

    const teachingResponse = await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' });
    expect(await teachingResponse.text()).toContain('Your shared activities');

    // And back, from the teaching home's own switch.
    await postForm('/home/mode', { _csrf: csrfToken, homeMode: 'learn', returnTo: '/' }, cookie);
    expect(findProfileForUser(profile.id, user.id)?.homeMode).toBe('learn');
  });

  it('keeps /chat on the chat page in either mode', async () => {
    const { cookie } = await createHomeAccount('home-chat-entry', 'teach');

    const response = await fetch(`${baseUrl}/chat`, { headers: { cookie }, redirect: 'manual' });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('id="chatForm"');
    expect(html).not.toContain('Your shared activities');
  });

  it('opens a finished conversation on its summary and keeps it off the learning home', async () => {
    const { closeConversationForUser, createConversation } = await import(
      '../../src/server/db/repository.js'
    );
    const { cookie, profile, user } = await createHomeAccount('home-closed-conversation', 'learn');
    const open = createConversation(user.id, profile.id, 'Still going');
    const closed = createConversation(user.id, profile.id, 'All done');
    closeConversationForUser(closed.id, user.id);

    const home = await (
      await fetch(`${baseUrl}/`, { headers: { cookie }, redirect: 'manual' })
    ).text();
    // The home lists only open conversations, so it never links to a finished
    // one. The side panel does, with `?tab=summary`, which this does not match.
    expect(home).toContain(`href="/c/${open.id}"`);
    expect(home).not.toContain(`href="/c/${closed.id}"`);
    expect(home).toContain(`href="/c/${closed.id}?tab=summary"`);

    // A plain link to a finished conversation still honours the closed
    // protocol: the server opens it closed, on its summary, exactly as the side
    // panel's `?tab=summary` does.
    const page = await (
      await fetch(`${baseUrl}/c/${closed.id}`, { headers: { cookie }, redirect: 'manual' })
    ).text();
    expect(page).toContain('is-closed-conversation');
    expect(page).toMatch(/class="nav-link active"\s+href="\/c\/[^"]+\?tab=summary"/);
    expect(page).toContain('Summary unavailable');
    // A closed conversation keeps only a hidden composer, never a usable one.
    expect(page).toContain('<form id="chatForm" class="composer d-none"');
    expect(page).not.toContain('<form id="chatForm" class="composer" ');
  });

  it('rejects a mode switch from a signed-out visitor', async () => {
    const homeResponse = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
    const csrfToken = extractCsrfToken(await homeResponse.text());

    const response = await fetch(`${baseUrl}/home/mode`, {
      body: new URLSearchParams({ _csrf: csrfToken, homeMode: 'teach', returnTo: '/' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login');
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

describe('unverified accounts', () => {
  /**
   * Pressing Back from the verification screen landed on `/`, which handed the
   * signed-in app shell to someone whose address was never verified: the
   * sidebar showed their account while the chat rendered its guest greeting,
   * and no tutor turn could work behind it.
   */
  it.each(['/', '/chat'])(
    'sends an unverified signed-in visitor from %s to the verification screen',
    async (route) => {
      const { createLocalUser } = await import('../../src/server/auth/repository.js');
      const user = createLocalUser({
        email: `unverified-${route.replace(/\W/g, '') || 'root'}@example.com`,
        fullName: 'Unverified Person',
        passwordHash: 'irrelevant-for-this-test',
      });
      expect(user.emailVerified).toBeFalsy();

      const cookie = await createSessionOnlyCookie(user.id);
      const response = await fetch(`${baseUrl}${route}`, {
        headers: { cookie },
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/verify-needed');
    },
  );

  it('offers a way off the verification screen instead of a link back to it', async () => {
    const { createLocalUser } = await import('../../src/server/auth/repository.js');
    const user = createLocalUser({
      email: 'unverified-exit@example.com',
      fullName: 'Unverified Person',
      passwordHash: 'irrelevant-for-this-test',
    });
    const cookie = await createSessionOnlyCookie(user.id);

    const response = await fetch(`${baseUrl}/verify-needed`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('action="/logout"');
    // The generic back link would point at `/`, which bounces straight back.
    expect(html).not.toMatch(/<a class="btn btn-secondary" href="\/"/);
  });
});

async function createSessionOnlyCookie(userId: string): Promise<string> {
  const { createSession } = await import('../../src/server/auth/repository.js');
  const { createSessionCookie, sessionCookieName } = await import(
    '../../src/server/auth/session.js'
  );

  const session = createSessionCookie();
  createSession({
    expiresAt: session.expiresAt,
    tokenHash: session.tokenHash,
    userId,
  });

  return `${sessionCookieName}=${encodeURIComponent(session.token)}`;
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
