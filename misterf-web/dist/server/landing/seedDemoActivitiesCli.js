import { randomUUID } from 'node:crypto';
import { closeDb, getDb } from '../db/database.js';
import { migrate } from '../db/migrator.js';
import { env } from '../config/env.js';
import { landingDemoActivities } from './demoActivities.js';
import { createProfile, createQuiz, findQuizById, getOrCreateResourceShareLink, listProfilesForUser, setResourceShareLinkCollectResults, updateQuiz, } from '../db/repository.js';
import { quizDraftSchema } from '../services/quizzes.js';
/**
 * Writes the landing page's public example activities into a dedicated demo
 * account, and shares each one by link.
 *
 * Idempotent: resource ids are derived from the fixture slug, so re-running
 * updates the same activities in place and every share URL already handed out
 * keeps working. Run it once per environment, and again whenever
 * `demoActivities.ts` changes.
 *
 * Local:
 *
 *     npm run seed:landing-demos
 *
 * Production: `npm ci --omit=dev` means `tsx` is not installed there, so this
 * lives under `src/` (like `db/migrateCli.ts`) to be compiled into `dist/` and
 * run with plain node. `NODE_ENV=production` is what points `config/env.ts` at
 * the server's `.env.production`, and therefore at the production database —
 * without it the seed would silently target the wrong file. See the
 * `production-server-ops` skill.
 *
 *     NODE_ENV=production node dist/server/landing/seedDemoActivitiesCli.js
 */
async function main() {
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
        }
        else {
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
        process.stdout.write(`${existing ? 'updated' : 'created'}  ${draft.level.padEnd(3)} ${draft.title}\n` +
            `          ${env.appBaseUrl}/resources/shared/${shareLink.id}\n`);
    }
    process.stdout.write(`\n${landingDemoActivities.length} demo activities ready for ${email}.\n`);
}
function ensureDemoUser(email) {
    const db = getDb();
    const existing = db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(email);
    if (existing) {
        return existing;
    }
    const id = randomUUID();
    // No password hash and no identity row on purpose: the account owns the demo
    // content and cannot be signed into.
    db.prepare(`
      INSERT INTO users (id, email, full_name, password_hash, email_verified)
      VALUES (?, ?, ?, NULL, 1)
    `).run(id, email, 'Mister F examples');
    return { id };
}
function ensureDemoProfile(userId) {
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
    .catch((error) => {
    process.exitCode = 1;
    console.error(error);
})
    .finally(() => {
    closeDb();
});
//# sourceMappingURL=seedDemoActivitiesCli.js.map