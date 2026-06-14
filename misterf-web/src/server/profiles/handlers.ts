import type { Request, Response } from 'express';
import {
  findProfileForUser,
  markProfileOnboardingCompleted,
  updateProfile,
} from '../db/repository.js';
import {
  appDocumentTitle,
  buildAppShellContext,
  getHomeAuthMessage,
} from '../pages/shell.js';
import {
  normalizeProfileReturnTo,
  normalizeProfileText,
  profileDescriptionMaxLength,
  profileLearningContextMaxLength,
  profileNameMaxLength,
} from './fields.js';

const profileFieldLimits = {
  description: profileDescriptionMaxLength,
  learningContext: profileLearningContextMaxLength,
  name: profileNameMaxLength,
};

function ensureVerifiedProfileUser(
  request: Request,
  response: Response,
): NonNullable<Request['authUser']> | null {
  const user = request.authUser;
  if (!user?.emailVerified) {
    response.redirect('/login');
    return null;
  }

  return user;
}

export function renderProfilesListPage(request: Request, response: Response): void {
  const user = ensureVerifiedProfileUser(request, response);
  if (!user) {
    return;
  }

  response.render('profiles-list', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'profiles',
      guestInitialGreeting: '',
      request,
      title: `Perfiles · ${appDocumentTitle}`,
      user,
    }),
    profilePageMode: 'list',
  });
}

export function renderNewProfilePage(request: Request, response: Response): void {
  const user = ensureVerifiedProfileUser(request, response);
  if (!user) {
    return;
  }

  response.render('profiles-form', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'profiles',
      guestInitialGreeting: '',
      request,
      title: `Nuevo perfil · ${appDocumentTitle}`,
      user,
    }),
    profileFieldLimits,
    profilePageMode: 'new',
    selectedProfile: null,
  });
}

export function renderEditProfilePage(request: Request, response: Response): void {
  const user = ensureVerifiedProfileUser(request, response);
  if (!user) {
    return;
  }

  const requestedProfileIdRaw = request.params.profileId;
  const requestedProfileId =
    typeof requestedProfileIdRaw === 'string'
      ? requestedProfileIdRaw.trim()
      : '';
  const selectedProfile = findProfileForUser(requestedProfileId, user.id);
  if (!selectedProfile) {
    response.redirect('/profiles');
    return;
  }

  response.render('profiles-form', {
    ...buildAppShellContext({
      activeProfile: request.activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'profiles',
      guestInitialGreeting: '',
      request,
      title: `Editar perfil · ${appDocumentTitle}`,
      user,
    }),
    profileFieldLimits,
    profilePageMode: 'edit',
    selectedProfile,
  });
}

export function renderProfileOnboardingPage(
  request: Request,
  response: Response,
): void {
  const user = ensureVerifiedProfileUser(request, response);
  if (!user) {
    return;
  }

  const activeProfile = request.activeProfile;
  if (!activeProfile) {
    response.redirect('/');
    return;
  }

  const returnTo = normalizeProfileReturnTo(request.query.returnTo);

  response.render('profile-onboarding', {
    ...buildAppShellContext({
      activeProfile,
      authMessage: getHomeAuthMessage(request, user),
      currentView: 'profiles',
      guestInitialGreeting: '',
      request,
      title: `Completa tu perfil · ${appDocumentTitle}`,
      user,
    }),
    error: '',
    profileFieldLimits,
    returnTo,
    selectedProfile: activeProfile,
    values: {
      description: activeProfile.description,
      learningContext: activeProfile.learningContext,
      name: activeProfile.name,
    },
  });
}

export function handleProfileOnboarding(
  request: Request,
  response: Response,
): void {
  const user = ensureVerifiedProfileUser(request, response);
  if (!user) {
    return;
  }

  const activeProfile = request.activeProfile;
  if (!activeProfile) {
    response.redirect('/');
    return;
  }

  const returnTo = normalizeProfileReturnTo(request.body.returnTo);
  const name = normalizeProfileText(request.body.name, profileNameMaxLength);
  const description = normalizeProfileText(
    request.body.description,
    profileDescriptionMaxLength,
  );
  const learningContext = normalizeProfileText(
    request.body.learningContext,
    profileLearningContextMaxLength,
  );

  if (!name) {
    response.status(422).render('profile-onboarding', {
      ...buildAppShellContext({
        activeProfile,
        authMessage: getHomeAuthMessage(request, user),
        currentView: 'profiles',
        guestInitialGreeting: '',
        request,
        title: `Completa tu perfil · ${appDocumentTitle}`,
        user,
      }),
      error: 'Escribe un nombre para este perfil.',
      profileFieldLimits,
      returnTo,
      selectedProfile: activeProfile,
      values: {
        description,
        learningContext,
        name,
      },
    });
    return;
  }

  updateProfile({
    description,
    learningContext,
    name,
    profileId: activeProfile.id,
    profileOnboardingCompleted: true,
    userId: user.id,
  });

  response.redirect(returnTo);
}

export function handleSkipProfileOnboarding(
  request: Request,
  response: Response,
): void {
  const user = ensureVerifiedProfileUser(request, response);
  const activeProfile = request.activeProfile;
  if (!user) {
    return;
  }

  if (!activeProfile) {
    response.redirect('/');
    return;
  }

  markProfileOnboardingCompleted({
    profileId: activeProfile.id,
    userId: user.id,
  });

  response.redirect(normalizeProfileReturnTo(request.body.returnTo));
}
