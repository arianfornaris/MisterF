import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for the rule in Roadmap V3 §1.8: **every operation that runs an
 * inference must show a wait or progress affordance.** A blank navigation or an
 * unresponsive button is a bug, because inferences routinely take several
 * seconds and the learner cannot tell the app apart from a freeze.
 *
 * The rule was audited by hand on 2026-07-20 and the two gaps it found were
 * fixed, but nothing stopped the next credit-gated route from shipping without
 * one. That is what this test is for. It was tracked as "non-trivial because
 * triggers live in EJS and client JS" — which is exactly why the inventory
 * below names *both* files per route: an attribute written into a template that
 * no client module reads is not an affordance, and neither is a client handler
 * looking for a marker no template emits.
 *
 * How it works:
 *
 * 1. Every function in `src/server` whose body resolves a credit-gated
 *    OpenRouter key is collected, then callers are folded in to a fixpoint —
 *    so a route handler counts even when the inference is three modules deep
 *    (the scene-media handlers reach it through `requireCreditKey`, the quiz
 *    evaluation through `evaluateSubmittedQuizAttemptForUser`).
 * 2. That set is intersected with the handlers actually registered on a router.
 * 3. The result must equal the inventory below, so a new credit-gated route
 *    fails this test until someone declares how it tells the user to wait.
 *
 * A failure here usually means the inventory needs an entry, not that the
 * assertion is wrong — confirm the route really is credit-gated, then add it
 * with the affordance it ships, or with an explicit `no-ui-trigger` reason.
 */

type WaitStateCoverage =
  | {
      kind: 'trigger';
      /** What the user sees while the inference runs. */
      mechanism: string;
      /** Attribute the template puts on the trigger or its pending surface. */
      marker: string;
      /** Template that emits the marker. */
      view: string;
      /** Client module that reads the marker and shows the wait state. */
      client: string;
    }
  | {
      kind: 'no-ui-trigger';
      /** Why nothing in the product reaches this route. */
      reason: string;
    };

const pendingModalForm = (view: string, client: string): WaitStateCoverage => ({
  kind: 'trigger',
  mechanism: 'form submit opens the blocking pending modal',
  marker:
    client === 'src/client/quizzes/index.js'
      ? 'data-quiz-generate-form'
      : client === 'src/client/roleplays/index.js'
        ? 'data-roleplay-pending-form'
        : 'data-resource-generate-form',
  view,
  client,
});

const modificationModal = (view: string): WaitStateCoverage => ({
  kind: 'trigger',
  mechanism: 'shared describe → generating → preview modal',
  marker: 'data-modify-phase',
  view,
  client: 'src/client/shared/modificationModal.js',
});

const createResourceFromContext: WaitStateCoverage = {
  kind: 'trigger',
  mechanism: 'submit button disabled and swapped for its loading label',
  marker: 'data-create-resource-from-context-form',
  view: 'views/partials/create-resource-from-context.ejs',
  client: 'src/client/shared/createResourceFromContext.js',
};

const createResourceFromConversation: WaitStateCoverage = {
  kind: 'trigger',
  mechanism: 'loading label plus the tutor-report pending modal',
  marker: 'data-create-resource-from-conversation-form',
  view: 'views/partials/app-shell-open.ejs',
  client: 'src/client/chat/index.js',
};

const sceneMediaChangeModal = (): WaitStateCoverage => ({
  kind: 'trigger',
  mechanism: 'scene-media change modal, generating phase with a progress bar',
  marker: 'data-scene-media-change-phase',
  view: 'views/partials/scene-media-change-modal.ejs',
  client: 'src/client/mediaLibrary/index.js',
});

const expectedWaitStateCoverage: Record<string, WaitStateCoverage> = {
  // Tutor chat.
  'POST /c/:conversationId/finalize': {
    kind: 'trigger',
    mechanism: 'loading label plus the tutor-report pending modal',
    marker: 'data-finalize-conversation-form',
    view: 'views/partials/app-shell-open.ejs',
    client: 'src/client/chat/index.js',
  },
  'POST /c/:conversationId/resource': createResourceFromConversation,
  'POST /c/:conversationId/report/resource': createResourceFromConversation,

  // Quizzes.
  'POST /quizzes/generate': pendingModalForm(
    'views/quizzes-new.ejs',
    'src/client/quizzes/index.js',
  ),
  'POST /quizzes/generate-draft': {
    kind: 'no-ui-trigger',
    reason:
      'Alias of POST /quizzes/generate on the same handler. Nothing in views/ ' +
      'or src/client/ posts to it, so there is no trigger to give a wait state.',
  },
  'POST /quizzes/:quizId/edit/modify': modificationModal('views/quizzes-authoring.ejs'),
  'POST /quizzes/:quizId/edit/blocks-modify': modificationModal(
    'views/quizzes-authoring.ejs',
  ),
  'POST /quizzes/:quizId/edit/add-block': modificationModal('views/quizzes-authoring.ejs'),
  'POST /quizzes/:quizId/edit/blocks/:blockId/modify': modificationModal(
    'views/quizzes-authoring.ejs',
  ),
  'POST /quizzes/:quizId/summary': pendingModalForm(
    'views/quizzes-participation.ejs',
    'src/client/quizzes/index.js',
  ),
  'POST /quiz-attempts/:attemptId/submit': {
    kind: 'trigger',
    mechanism: 'form submit opens the blocking pending modal',
    marker: 'data-quiz-submit-form',
    view: 'views/quizzes-attempt.ejs',
    client: 'src/client/quizzes/index.js',
  },
  'POST /quiz-attempts/:attemptId/evaluate': {
    kind: 'trigger',
    // The page that posts this exists only so the spinner paints before the
    // evaluation starts; a guest used to sit on a blank navigation instead.
    mechanism: 'evaluating page renders a spinner, then posts itself',
    marker: 'data-quiz-auto-submit-form',
    view: 'views/quizzes-evaluating.ejs',
    client: 'src/client/quizzes/index.js',
  },
  'POST /quiz-attempts/:attemptId/resource': createResourceFromContext,

  // Roleplays.
  'POST /roleplays/generate': pendingModalForm(
    'views/roleplays-new.ejs',
    'src/client/roleplays/index.js',
  ),
  'POST /roleplays/:roleplayId/edit/modify': modificationModal('views/roleplays-edit.ejs'),
  'POST /roleplays/:roleplayId/summary': pendingModalForm(
    'views/roleplays-participation.ejs',
    'src/client/roleplays/index.js',
  ),
  'POST /roleplays/:roleplayId/attempts': pendingModalForm(
    'views/roleplays-show.ejs',
    'src/client/roleplays/index.js',
  ),
  'GET /roleplays/shared/:shareId/start': {
    kind: 'trigger',
    // A plain link navigation, so the modal is opened by intercepting the
    // click; without it the visitor waited on a blank page for the opening turn.
    mechanism: 'shared-resource start link intercepted to open the pending modal',
    marker: 'data-shared-resource-pending-modal',
    view: 'views/resources-shared.ejs',
    client: 'src/client/resources/index.js',
  },
  'POST /roleplay-attempts/:attemptId/turns': {
    kind: 'trigger',
    // Deliberately not the pending modal: a turn stays in the transcript, so
    // the composer disables and a thinking bubble stands in for the reply.
    mechanism: 'thinking turn in the transcript, composer disabled',
    marker: 'data-roleplay-turn-form',
    view: 'views/roleplays-attempt.ejs',
    client: 'src/client/roleplays/index.js',
  },
  'POST /roleplay-attempts/:attemptId/finish': pendingModalForm(
    'views/roleplays-attempt.ejs',
    'src/client/roleplays/index.js',
  ),
  'POST /roleplay-attempts/:attemptId/resource': createResourceFromContext,

  // Practice guides.
  'POST /practice-guides/generate-draft': pendingModalForm(
    'views/practice-guides-new.ejs',
    'src/client/practiceGuides/index.js',
  ),
  'POST /practice-guides/:practiceGuideId/summary': pendingModalForm(
    'views/practice-guides-participation.ejs',
    'src/client/practiceGuides/index.js',
  ),
  'POST /practice-guides/:practiceGuideId/edit/modify': modificationModal(
    'views/practice-guides-authoring.ejs',
  ),

  // Scene media library.
  'POST /media-library': {
    kind: 'trigger',
    mechanism: 'scene-media pending modal with a streamed progress bar',
    marker: 'data-scene-media-generate-form',
    view: 'views/media-library-new.ejs',
    client: 'src/client/mediaLibrary/index.js',
  },
  'POST /media-library/:mediaId/variations': {
    kind: 'trigger',
    mechanism: 'scene-media pending modal with a streamed progress bar',
    marker: 'data-scene-media-generate-form',
    view: 'views/media-library-variation-new.ejs',
    client: 'src/client/mediaLibrary/index.js',
  },
  'POST /media-library/:mediaId/generate-title': {
    kind: 'trigger',
    mechanism: 'generate button disabled with an inline spinner label',
    marker: 'data-scene-media-generate-title',
    view: 'views/media-library-authoring.ejs',
    client: 'src/client/mediaLibrary/index.js',
  },
  'POST /media-library/:mediaId/preview/image': sceneMediaChangeModal(),
  'POST /media-library/:mediaId/preview/script': sceneMediaChangeModal(),
  'POST /media-library/:mediaId/preview/metadata': sceneMediaChangeModal(),
  // Approving a script generates its audio, so applying is an inference too.
  'POST /media-library/:mediaId/preview/script/apply': sceneMediaChangeModal(),
};

const creditGateFunction = 'getCreditCheckedOpenRouterApiKeyForUser';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function listFiles(directory: string, extensions: Set<string>): string[] {
  const absoluteDirectory = path.join(process.cwd(), directory);
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(relativePath, extensions));
      continue;
    }

    if (extensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Splits a module into top-level function bodies, keyed `file::name`.
 *
 * Only column-zero declarations open a new body, so nested callbacks stay with
 * the function that owns them. This is a heuristic, not a parser — good enough
 * to answer "does this handler reach the credit gate", which is all the
 * inventory needs.
 */
function collectFunctionBodies(files: string[]): Map<string, string> {
  const bodies = new Map<string, string>();

  for (const file of files) {
    const lines = readProjectFile(file).split('\n');
    let name: string | null = null;
    let buffer: string[] = [];

    const flush = () => {
      if (name) {
        bodies.set(`${file}::${name}`, buffer.join('\n'));
      }
    };

    for (const line of lines) {
      const match = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/.exec(
        line,
      );
      if (match) {
        flush();
        name = match[1] ?? match[2] ?? null;
        buffer = [];
      }
      buffer.push(line);
    }

    flush();
  }

  return bodies;
}

/** Names of every function that reaches the credit gate, directly or not. */
function collectCreditGatedFunctionNames(bodies: Map<string, string>): Set<string> {
  const gated = new Set<string>();

  for (const [key, body] of bodies) {
    if (body.includes(`${creditGateFunction}(`)) {
      gated.add(key.split('::')[1] as string);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, body] of bodies) {
      const name = key.split('::')[1] as string;
      if (gated.has(name)) {
        continue;
      }

      for (const gatedName of gated) {
        if (new RegExp(`\\b${gatedName}\\s*\\(`).test(body)) {
          gated.add(name);
          changed = true;
          break;
        }
      }
    }
  }

  return gated;
}

function collectCreditGatedRoutes(gatedNames: Set<string>): string[] {
  const routes: string[] = [];
  const registration = /(\w+)Router\.(get|post|put|delete)\(\s*'([^']+)',\s*(\w+)/g;

  for (const file of listFiles('src/server', new Set(['.ts']))) {
    if (!file.endsWith('routes.ts')) {
      continue;
    }

    const source = readProjectFile(file);
    let match: RegExpExecArray | null;
    while ((match = registration.exec(source))) {
      const [, , method, routePath, handler] = match as unknown as string[];
      if (gatedNames.has(handler as string)) {
        routes.push(`${(method as string).toUpperCase()} ${routePath}`);
      }
    }
  }

  return [...new Set(routes)].sort();
}

describe('inference wait-state architecture', () => {
  const bodies = collectFunctionBodies(listFiles('src/server', new Set(['.ts'])));
  const gatedNames = collectCreditGatedFunctionNames(bodies);
  const gatedRoutes = collectCreditGatedRoutes(gatedNames);

  it('inventories every route whose handler resolves a credit-gated key', () => {
    expect(gatedRoutes).toEqual(Object.keys(expectedWaitStateCoverage).sort());
  });

  it('backs every credit-gated route with a wait affordance in both layers', () => {
    for (const route of gatedRoutes) {
      const coverage = expectedWaitStateCoverage[route];
      if (!coverage || coverage.kind !== 'trigger') {
        continue;
      }

      expect(
        readProjectFile(coverage.view),
        `${route}: ${coverage.view} should carry ${coverage.marker} (${coverage.mechanism})`,
      ).toContain(coverage.marker);

      // A marker no client module reads paints nothing, which is the failure
      // this rule exists to prevent.
      expect(
        readProjectFile(coverage.client),
        `${route}: ${coverage.client} should read ${coverage.marker} and show the wait state`,
      ).toContain(coverage.marker);
    }
  });

  it('keeps a route declared as having no trigger genuinely unreachable', () => {
    const uiFiles = [
      ...listFiles('views', new Set(['.ejs'])),
      ...listFiles('src/client', new Set(['.js'])),
    ];

    for (const [route, coverage] of Object.entries(expectedWaitStateCoverage)) {
      if (coverage.kind !== 'no-ui-trigger') {
        continue;
      }

      const routePath = route.slice(route.indexOf(' ') + 1);
      for (const file of uiFiles) {
        expect(
          readProjectFile(file),
          `${route} is declared to have no UI trigger, but ${file} references it. ` +
            'Either give it a wait affordance and move it to a trigger entry, or ' +
            'remove the reference.',
        ).not.toContain(routePath);
      }
    }
  });
});
