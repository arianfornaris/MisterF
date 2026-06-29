import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function expectBefore(source: string, earlier: string, later: string): void {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);

  expect(earlierIndex, `${earlier} should be present`).toBeGreaterThanOrEqual(0);
  expect(laterIndex, `${later} should be present`).toBeGreaterThanOrEqual(0);
  expect(earlierIndex, `${earlier} should appear before ${later}`).toBeLessThan(laterIndex);
}

describe('server route architecture', () => {
  it('keeps auth form handlers scoped to authentication concerns', () => {
    const authForms = readProjectFile('src/server/auth/forms.ts');

    expect(authForms).not.toMatch(/\b(ChatRoom|PracticeModule)\b/);
    expect(authForms).not.toContain('chatrooms');
    expect(authForms).not.toContain('practice-modules');
  });

  it('mounts domain routers from the server composition root', () => {
    const server = readProjectFile('src/server/server.ts');

    expect(server).toContain("import { assignmentsRouter } from './assignments/routes.js';");
    expect(server).toContain("import { authRouter } from './auth/routes.js';");
    expect(server).toContain("import { chatRouter } from './chat/routes.js';");
    expect(server).toContain("import { legalRouter } from './legal/routes.js';");
    expect(server).toContain("import { paymentsRouter, stripeWebhookRouter } from './payments/routes.js';");
    expect(server).toContain("import { practiceModulesRouter } from './practiceModules/routes.js';");
    expect(server).toContain("import { profileOnboardingRouter, profilesRouter } from './profiles/routes.js';");
    expect(server).toContain("import { progressRouter } from './progress/routes.js';");
    expect(server).toContain("import { resourcesRouter } from './resources/routes.js';");
    expect(server).toContain("import { roleplaysRouter } from './roleplays/routes.js';");
    expect(server).toContain("import { settingsRouter } from './settings/routes.js';");
    expect(server).toContain("import { superadminRouter } from './superadmin/routes.js';");
    expect(server).toContain("import { clientTelemetryRouter } from './telemetry/clientErrors.js';");
    expect(server).not.toContain("import { chatroomsRouter }");
    expect(server).not.toContain('app.use(chatroomsRouter)');
    expect(server).not.toContain('/handlers.js');
  });

  it('preserves critical middleware ordering', () => {
    const server = readProjectFile('src/server/server.ts');

    expectBefore(server, 'app.use(stripeWebhookRouter);', 'app.use(express.urlencoded');
    expectBefore(server, 'app.use(clientTelemetryRouter);', 'app.use(express.urlencoded');
    expectBefore(server, 'app.use(express.urlencoded', 'app.use(csrfProtection);');
    expectBefore(server, 'app.use(csrfProtection);', 'app.use(loadAuthSession);');
    expectBefore(server, 'app.use(loadAuthSession);', 'app.use(authRouter);');
    expectBefore(server, 'app.use(profileOnboardingRouter);', 'app.use(redirectIncompleteProfileOnboarding);');
    expectBefore(server, 'app.use(redirectIncompleteProfileOnboarding);', 'app.use(resourcesRouter);');
    expectBefore(server, 'app.use(resourcesRouter);', 'app.use(practiceModulesRouter);');
    expectBefore(server, 'app.use(practiceModulesRouter);', 'app.use(assignmentsRouter);');
    expectBefore(server, 'app.use(assignmentsRouter);', 'app.use(roleplaysRouter);');
  });

  it('keeps practice module pages visible under the resources navigation entry', () => {
    const view = readProjectFile('views/partials/practice-modules-view.ejs');

    expect(view).not.toContain("currentView === 'practiceModules'");
    expect(view).not.toContain("practice-modules-page <%= currentView");
  });
});
