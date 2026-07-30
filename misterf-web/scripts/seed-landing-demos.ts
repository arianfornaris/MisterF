import { randomUUID } from 'node:crypto';
import { closeDb, getDb } from '../src/server/db/database.js';
import { migrate } from '../src/server/db/migrator.js';
import { env } from '../src/server/config/env.js';
import { landingDemoActivities } from '../src/server/landing/demoActivities.js';
import {
  createProfile,
  createQuiz,
  findQuizById,
  getOrCreateResourceShareLink,
  listProfilesForUser,
  setResourceShareLinkCollectResults,
  updateQuiz,
} from '../src/server/db/repository.js';
import { quizDraftSchema } from '../src/server/services/quizzes.js';

/**
 * Writes the landing page's public example activities into a dedicated demo
 * account, and shares each one by link.
 *
 * Idempotent: resource ids are derived from the fixture slug, so re-running
 * updates the same activities in place and every share URL already handed out
 * keeps working. Run it once per environment, and again whenever
 * `src/server/landing/demoActivities.ts` changes:
 *
 *     npm run seed:landing-demos
 */
async function main(): Promise<void> {
  migrate();

  const email = env.landingDemoEmail;
  const user = ensureDemoUser(email);
  const profile = ensureDemoProfile(user.id);

  for (const activity of landingDemoActivities) {
    // Validate before writing: a fixture that cannot be parsed would render as
    // a broken activity for a stranger, which is the worst place to find out.
    const draft = quizDraftSchema.parse(activity.draft);
    const id = `landing-demo-${activity.slug}`;
    const existing = findQuizById(id);

    if (existing) {
      updateQuiz({
        description: draft.description,
        instructions: draft.instructions,
        level: draft.level,
        quiz: draft,
        quizId: id,
        targetTopic: draft.targetTopic,
        title: draft.title,
        userId: user.id,
      });
    } else {
      createQuiz({
        description: draft.description,
        id,
        instructions: draft.instructions,
        level: draft.level,
        profileId: profile.id,
        quiz: draft,
        sharedVia: 'link',
        targetTopic: draft.targetTopic,
        title: draft.title,
        userId: user.id,
      });
    }

    const shareLink = getOrCreateResourceShareLink(id);
    // A public demo must not collect results: nobody consented to being seen,
    // and the demo account is not a teacher waiting for a report.
    setResourceShareLinkCollectResults({ collectResults: false, resourceId: id });

    process.stdout.write(
      `${existing ? 'updated' : 'created'}  ${draft.level.padEnd(3)} ${draft.title}\n` +
        `          ${env.appBaseUrl}/resources/shared/${shareLink.id}\n`,
    );
  }

  process.stdout.write(
    `\n${landingDemoActivities.length} demo activities ready for ${email}.\n`,
  );
}

function ensureDemoUser(email: string): { id: string } {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: string } | undefined;

  if (existing) {
    return existing;
  }

  const id = randomUUID();
  // No password hash and no identity row on purpose: the account owns the demo
  // content and cannot be signed into.
  db.prepare(
    `
      INSERT INTO users (id, email, full_name, password_hash, email_verified)
      VALUES (?, ?, ?, NULL, 1)
    `,
  ).run(id, email, 'Mister F examples');

  return { id };
}

function ensureDemoProfile(userId: string): { id: string } {
  const existing = listProfilesForUser(userId);
  if (existing.length > 0) {
    return existing[0];
  }

  return createProfile({
    instructionLanguage: 'en',
    name: 'Examples',
    profileOnboardingCompleted: true,
    userId,
  });
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    console.error(error);
  })
  .finally(() => {
    closeDb();
  });
