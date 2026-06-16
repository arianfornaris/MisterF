import express from 'express';
import {
  handleCreateProfile,
  handleProfileOnboarding,
  handleSkipProfileOnboarding,
  handleSwitchProfile,
  handleUpdateProfile,
  renderEditProfilePage,
  renderNewProfilePage,
  renderProfileOnboardingPage,
  renderProfilesListPage,
} from './handlers.js';

export const profileOnboardingRouter = express.Router();
export const profilesRouter = express.Router();

profileOnboardingRouter.get('/profiles/onboarding', renderProfileOnboardingPage);
profileOnboardingRouter.post('/profiles/onboarding', handleProfileOnboarding);
profileOnboardingRouter.post('/profiles/onboarding/skip', handleSkipProfileOnboarding);

profilesRouter.get('/profiles', renderProfilesListPage);
profilesRouter.get('/profiles/new', renderNewProfilePage);
profilesRouter.get('/profiles/:profileId/edit', renderEditProfilePage);
profilesRouter.post('/profiles', handleCreateProfile);
profilesRouter.post('/profiles/switch', handleSwitchProfile);
profilesRouter.post('/profiles/:profileId', handleUpdateProfile);
