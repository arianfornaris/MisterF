import type { Request, Response } from 'express';
import {
  archiveAssignmentForUser,
  attachAssignmentAttemptToUser,
  createAssignment,
  createAssignmentAttempt,
  createAssignmentAuthoringRevision,
  createAssignmentAuthoringSession,
  createConversationFromAssignmentAttempt,
  findAssignmentAttemptById,
  findAssignmentById,
  findAssignmentForUser,
  findAssignmentShareLinkById,
  findAssignmentAuthoringSessionForUser,
  findProfileForUser,
  getOrCreateAssignmentShareLink,
  listAssignmentAttemptsForUser,
  listAssignmentAuthoringRevisions,
  listAssignmentsForProfile,
  markAssignmentAttemptEvaluating,
  markAssignmentAttemptFailed,
  restoreAssignmentForUser,
  saveAssignmentAttemptResult,
  setAssignmentFavoriteForUser,
  submitAssignmentAttempt,
  updateAssignment,
  updateAssignmentAuthoringSession,
  type StoredAssignment,
  type StoredAssignmentAttempt,
  type StoredAssignmentAuthoringSession,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  appDocumentTitle,
  buildAbsoluteAppUrl,
  buildAppShellContext,
  formatRelativeTime,
  getHomeAuthMessage,
  normalizeSearchText,
} from '../pages/shell.js';
import {
  assignmentsLayoutCookieName,
  resolveResourceLayout,
} from '../pages/resourceLayout.js';
import {
  appendAssignmentBlock,
  assignmentDraftToStudentQuizBlock,
  buildAssignmentEvaluationSummary,
  buildAssignmentResultTitle,
  createAssignmentDraftFromManualInput,
  duplicateAssignmentBlock,
  evaluateAssignmentAttempt,
  moveAssignmentBlock,
  normalizeAssignmentResponses,
  removeAssignmentBlock,
  safeParseAssignmentDraft,
  storedAssignmentToDraft,
  type AssignmentDraft,
} from '../services/assignments.js';
import {
  generateAssignmentBlock,
  generateAssignmentDraft,
  generateAssignmentRevision,
} from '../services/resourceDrafts.js';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import { recordAssignmentAttemptProgress } from '../services/learnerProgress.js';
import { logger } from '../services/logger.js';
import { quizResultBlockSchema } from '../services/llmTutor/schemas.js';

type AssignmentAuthoringMessage = {
  content: string;
  role: 'assistant' | 'user';
  timestamp: string;
};

type AssignmentBlockOutlineItem = {
  blockNumber: number;
  kindLabel: string;
  metaItems: string[];
  prompt: string;
  sentence: string;
};

const assignmentBlockKinds = [
  {
    description: 'Respuesta libre evaluada por IA.',
    label: 'Respuesta abierta',
    value: 'quiz_open_text',
  },
  {
    description: 'Traducción con respuestas aceptables o rúbrica.',
    label: 'Traducir al inglés',
    value: 'quiz_translate_to_english',
  },
  {
    description: 'Comprensión de una frase en inglés.',
    label: 'Entender en español',
    value: 'quiz_understand_in_spanish',
  },
  {
    description: 'Espacios escritos, útil cuando hay variantes.',
    label: 'Completar escribiendo',
    value: 'quiz_fill_in_the_blank_input',
  },
  {
    description: 'Espacios con opciones visibles.',
    label: 'Completar con opciones',
    value: 'quiz_fill_in_the_blank_choice',
  },
  {
    description: 'Selección simple o múltiple.',
    label: 'Selección múltiple',
    value: 'quiz_multiple_choice',
  },
  {
    description: 'Relacionar pares.',
    label: 'Emparejar',
    value: 'quiz_matching_pairs',
  },
  {
    description: 'Ordenar una oración.',
    label: 'Ordenar oración',
    value: 'quiz_unscramble_sentence',
  },
] as const;

function normalizeOutlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatFallbackBlockKindLabel(kind: string): string {
  return kind.replace(/^quiz_/, '').replaceAll('_', ' ');
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildAssignmentBlockOutlineItems(draft: AssignmentDraft): AssignmentBlockOutlineItem[] {
  return draft.blocks.map((block, index) => {
    const item = block.item;
    const kind = assignmentBlockKinds.find((candidate) => candidate.value === item.kind);
    const metaItems: string[] = [];
    let sentence = '';

    if (
      item.kind === 'quiz_translate_to_english' ||
      item.kind === 'quiz_understand_in_spanish' ||
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      sentence = normalizeOutlineText(item.sentence);
    }

    if (
      item.kind === 'quiz_fill_in_the_blank_input' ||
      item.kind === 'quiz_fill_in_the_blank_choice'
    ) {
      metaItems.push(formatCountLabel(item.blanks.length, 'espacio', 'espacios'));
    }

    if (item.kind === 'quiz_multiple_choice') {
      metaItems.push(formatCountLabel(item.options.length, 'opción', 'opciones'));
    }

    if (item.kind === 'quiz_matching_pairs') {
      metaItems.push(formatCountLabel(item.leftItems.length, 'par', 'pares'));
    }

    if (item.kind === 'quiz_unscramble_sentence') {
      metaItems.push(formatCountLabel(item.tokens.length, 'palabra', 'palabras'));
    }

    return {
      blockNumber: index + 1,
      kindLabel: kind?.label ?? formatFallbackBlockKindLabel(item.kind),
      metaItems,
      prompt: item.prompt,
      sentence,
    };
  });
}

function ensureVerifiedAssignmentUser(
  request: Request,
  response: Response,
): { activeProfile: NonNullable<Request['activeProfile']>; user: NonNullable<Request['authUser']> } | null {
  const user = request.authUser;
  const activeProfile = request.activeProfile;

  if (!user?.emailVerified || !activeProfile) {
    response.redirect('/login');
    return null;
  }

  return { activeProfile, user };
}

function buildAssignmentsShellContext(request: Request, options: {
  activeProfile: Request['activeProfile'];
  title: string;
  user: Request['authUser'];
}) {
  return buildAppShellContext({
    activeProfile: options.activeProfile ?? null,
    authMessage: getHomeAuthMessage(request, options.user ?? null),
    currentView: 'assignments',
    guestInitialGreeting: '',
    request,
    title: options.title,
    user: options.user ?? null,
  });
}

function renderAssignmentsView(
  response: Response,
  view: string,
  model: Record<string, unknown>,
): void {
  response.render(view, model);
}

function serializeViewJson(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '&':
        return '\\u0026';
      case '\u2028':
        return '\\u2028';
      case '\u2029':
        return '\\u2029';
      default:
        return character;
    }
  });
}

function readField(value: unknown, maxLength = 8000): string {
  if (Array.isArray(value)) {
    return readField(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function readMultilineField(value: unknown, maxLength = 8000): string {
  if (Array.isArray(value)) {
    return readMultilineField(value[0], maxLength);
  }

  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : '';
}

function readEstimatedMinutes(value: unknown): number | null {
  const raw = Number(readField(value, 20));
  if (!Number.isInteger(raw) || raw < 1 || raw > 180) {
    return null;
  }

  return raw;
}

function readReturnTo(value: unknown, fallback: string): string {
  const returnTo = readField(value, 1200);
  return returnTo.startsWith('/') ? returnTo : fallback;
}

function appendGuestToken(pathname: string, attempt: StoredAssignmentAttempt): string {
  if (!attempt.guestToken) {
    return pathname;
  }

  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}guestToken=${encodeURIComponent(attempt.guestToken)}`;
}

function normalizeAuthoringMessages(messages: unknown[]): AssignmentAuthoringMessage[] {
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const record = message as Record<string, unknown>;
      const role = record.role === 'assistant' || record.role === 'user'
        ? record.role
        : null;
      const content = typeof record.content === 'string'
        ? record.content.trim()
        : '';
      const timestamp = typeof record.timestamp === 'string'
        ? record.timestamp
        : new Date().toISOString();

      return role && content ? { content, role, timestamp } : null;
    })
    .filter((message): message is AssignmentAuthoringMessage => Boolean(message));
}

function appendAuthoringMessage(
  session: StoredAssignmentAuthoringSession,
  message: Omit<AssignmentAuthoringMessage, 'timestamp'>,
): AssignmentAuthoringMessage[] {
  return [
    ...normalizeAuthoringMessages(session.messages),
    {
      ...message,
      timestamp: new Date().toISOString(),
    },
  ];
}

function assignmentToDraftOrRedirect(
  assignment: StoredAssignment,
  response: Response,
): AssignmentDraft | null {
  const draft = safeParseAssignmentDraft(assignment.quiz);
  if (!draft) {
    response.redirect('/assignments');
    return null;
  }

  return draft;
}

function buildAssignmentListItems(assignments: StoredAssignment[]) {
  return assignments.map((assignment) => ({
    ...assignment,
    blockCount: safeParseAssignmentDraft(assignment.quiz)?.blocks.length ?? 0,
    relativeUpdatedAt: formatRelativeTime(assignment.updatedAt),
  }));
}

function buildAssignmentAttemptListItems(attempts: StoredAssignmentAttempt[]) {
  return attempts.map((attempt) => ({
    ...attempt,
    ...getAssignmentAttemptStatusView(attempt.status),
    relativeUpdatedAt: formatRelativeTime(attempt.updatedAt),
  }));
}

function getAssignmentAttemptStatusView(status: StoredAssignmentAttempt['status']) {
  switch (status) {
    case 'draft':
      return {
        statusBadgeClass: 'text-bg-light border',
        statusLabel: 'Sin enviar',
      };
    case 'submitted':
      return {
        statusBadgeClass: 'text-bg-info',
        statusLabel: 'Enviada',
      };
    case 'evaluating':
      return {
        statusBadgeClass: 'text-bg-primary',
        statusLabel: 'Evaluando',
      };
    case 'evaluated':
      return {
        statusBadgeClass: 'text-bg-success',
        statusLabel: 'Evaluada',
      };
    case 'failed':
      return {
        statusBadgeClass: 'text-bg-danger',
        statusLabel: 'Error al evaluar',
      };
  }
}

function renderAssignmentAuthoring(
  request: Request,
  response: Response,
  input: {
    activeTab?: 'chat' | 'design' | 'preview';
    error?: string;
    session: StoredAssignmentAuthoringSession;
    user: NonNullable<Request['authUser']>;
    activeProfile: NonNullable<Request['activeProfile']>;
  },
): void {
  const draft = safeParseAssignmentDraft(input.session.currentDraft);
  if (!draft) {
    response.redirect('/assignments/new');
    return;
  }

  renderAssignmentsView(response, 'assignments-authoring', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: input.activeProfile,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: input.user,
    }),
    activeTab: input.activeTab ?? 'design',
    assignmentBlockKinds,
    assignmentQuizJson: serializeViewJson(assignmentDraftToStudentQuizBlock(draft)),
    authoringError: input.error || '',
    authoringMessages: normalizeAuthoringMessages(input.session.messages),
    draft,
    revisions: listAssignmentAuthoringRevisions(input.session.id),
    selectedSession: input.session,
  });
}

function resolveAuthoringSession(
  request: Request,
  response: Response,
): {
  activeProfile: NonNullable<Request['activeProfile']>;
  session: StoredAssignmentAuthoringSession;
  user: NonNullable<Request['authUser']>;
} | null {
  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return null;
  }

  const sessionId = readField(request.params.sessionId, 120);
  const session = findAssignmentAuthoringSessionForUser(sessionId, auth.user.id);
  if (!session) {
    response.redirect('/assignments');
    return null;
  }

  let activeProfile = auth.activeProfile;
  if (session.profileId !== activeProfile.id) {
    const profile = findProfileForUser(session.profileId, auth.user.id);
    if (!profile) {
      response.redirect('/assignments');
      return null;
    }

    activeProfile = profile;
    setActiveProfileCookie(response, profile.id);
  }

  return {
    activeProfile,
    session,
    user: auth.user,
  };
}

function resolveOwnAssignment(
  request: Request,
  response: Response,
): {
  activeProfile: NonNullable<Request['activeProfile']>;
  assignment: StoredAssignment;
  user: NonNullable<Request['authUser']>;
} | null {
  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return null;
  }

  const assignmentId = readField(request.params.assignmentId, 120);
  const assignment = findAssignmentForUser(assignmentId, auth.user.id);
  if (!assignment) {
    response.redirect('/assignments');
    return null;
  }

  let activeProfile = auth.activeProfile;
  if (assignment.profileId !== activeProfile.id) {
    const profile = findProfileForUser(assignment.profileId, auth.user.id);
    if (!profile) {
      response.redirect('/assignments');
      return null;
    }

    activeProfile = profile;
    setActiveProfileCookie(response, profile.id);
  }

  return { activeProfile, assignment, user: auth.user };
}

function resolveAccessibleAttempt(
  request: Request,
  response: Response,
): StoredAssignmentAttempt | null {
  const attemptId = readField(request.params.attemptId, 120);
  const attempt = findAssignmentAttemptById(attemptId);
  if (!attempt) {
    response.redirect('/assignments');
    return null;
  }

  const user = request.authUser;
  if (attempt.userId && user?.id === attempt.userId) {
    return attempt;
  }

  const guestToken =
    readField(request.query.guestToken, 200) || readField(request.body.guestToken, 200);
  if (!attempt.userId && attempt.guestToken && guestToken === attempt.guestToken) {
    return attempt;
  }

  response.redirect('/login');
  return null;
}

function renderAssignmentAttempt(
  request: Request,
  response: Response,
  input: {
    attempt: StoredAssignmentAttempt;
    error?: string;
  },
): void {
  const draft = safeParseAssignmentDraft(input.attempt.snapshot);
  if (!draft) {
    response.redirect('/assignments');
    return;
  }

  renderAssignmentsView(response, 'assignments-attempt', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: request.activeProfile ?? null,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: request.authUser ?? null,
    }),
    attempt: input.attempt,
    attemptError: input.error || '',
    assignmentQuizJson: serializeViewJson(assignmentDraftToStudentQuizBlock(draft)),
    draft,
    guestToken: input.attempt.guestToken || '',
  });
}

function renderAssignmentResult(
  request: Request,
  response: Response,
  attempt: StoredAssignmentAttempt,
): void {
  const draft = safeParseAssignmentDraft(attempt.snapshot);
  const result = attempt.result ? quizResultBlockSchema.safeParse(attempt.result) : null;
  if (!draft || !result?.success) {
    response.redirect(appendGuestToken(`/assignment-attempts/${encodeURIComponent(attempt.id)}`, attempt));
    return;
  }

  const summary = buildAssignmentEvaluationSummary(result.data);
  renderAssignmentsView(response, 'assignments-result', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: request.activeProfile ?? null,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: request.authUser ?? null,
    }),
    attempt,
    draft,
    guestToken: attempt.guestToken || '',
    resultBlockJson: serializeViewJson(result.data),
    resultBlock: result.data,
    resultTitle: buildAssignmentResultTitle(result.data),
    summary,
  });
}

export function renderAssignmentsListPage(request: Request, response: Response): void {
  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return;
  }

  const showArchived = readField(request.query.archived, 10) === '1';
  const query = readField(request.query.q, 240);
  const normalizedQuery = normalizeSearchText(query);
  const assignmentLayout = resolveResourceLayout(
    request,
    response,
    assignmentsLayoutCookieName,
  );
  const allAssignments = listAssignmentsForProfile({
    includeArchived: true,
    profileId: auth.activeProfile.id,
    userId: auth.user.id,
  });
  const hasArchivedAssignments = allAssignments.some((assignment) =>
    Boolean(assignment.archivedAt),
  );
  const assignments = allAssignments.filter((assignment) => {
    if (assignment.archivedAt && !showArchived) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeSearchText([
      assignment.title,
      assignment.description,
      assignment.targetTopic,
      assignment.level,
    ].join('\n')).includes(normalizedQuery);
  });
  renderAssignmentsView(response, 'assignments-list', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: auth.activeProfile,
      title: `Tareas - ${appDocumentTitle}`,
      user: auth.user,
    }),
    assignmentLayout,
    assignmentItems: buildAssignmentListItems(assignments),
    assignmentQuery: query,
    hasArchivedAssignments,
    showArchivedAssignments: showArchived,
  });
}

export function renderAssignmentNewPage(request: Request, response: Response): void {
  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return;
  }

  renderAssignmentsView(response, 'assignments-new', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: auth.activeProfile,
      title: `Nueva tarea - ${appDocumentTitle}`,
      user: auth.user,
    }),
    generationError: '',
    generationPrompt: '',
  });
}

export async function handleCreateAssignmentDraft(
  request: Request,
  response: Response,
): Promise<void> {
  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return;
  }

  const prompt = readMultilineField(request.body.prompt, 6000);
  if (prompt.length < 10) {
    renderAssignmentsView(response.status(422), 'assignments-new', {
      ...buildAssignmentsShellContext(request, {
        activeProfile: auth.activeProfile,
        title: `Nueva tarea - ${appDocumentTitle}`,
        user: auth.user,
      }),
      generationError: 'Describe un poco mejor la tarea.',
      generationPrompt: prompt,
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const draft = await generateAssignmentDraft({
      openRouterApiKey,
      prompt,
    });
    const session = createAssignmentAuthoringSession({
      currentDraft: draft,
      initialPrompt: prompt,
      messages: [
        {
          content: prompt,
          role: 'user',
          timestamp: new Date().toISOString(),
        },
        {
          content: `Creé un primer borrador con ${draft.blocks.length} bloques. Revísalo y dime qué quieres ajustar.`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
        },
      ],
      profileId: auth.activeProfile.id,
      userId: auth.user.id,
    });

    createAssignmentAuthoringRevision({
      assistantMessage: 'Initial AI draft created.',
      draft,
      sessionId: session.id,
      source: 'assistant',
      userMessage: prompt,
    });
    logger.info('assignment_draft_created', {
      blockCount: draft.blocks.length,
      profileId: auth.activeProfile.id,
      sessionId: session.id,
      userId: auth.user.id,
    });

    response.redirect(`/assignments/authoring/${encodeURIComponent(session.id)}`);
  } catch (error) {
    logger.error('assignment_draft_generation_failed', {
      error,
      userId: auth.user.id,
    });
    const generationError = isCreditExhaustedError(error)
      ? getCreditExhaustedMessage()
      : 'No pude generar la tarea ahora mismo. Inténtalo otra vez.';

    renderAssignmentsView(response.status(422), 'assignments-new', {
      ...buildAssignmentsShellContext(request, {
        activeProfile: auth.activeProfile,
        title: `Nueva tarea - ${appDocumentTitle}`,
        user: auth.user,
      }),
      generationError,
      generationPrompt: prompt,
    });
  }
}

export function renderAssignmentAuthoringPage(request: Request, response: Response): void {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const requestedTab = readField(request.query.tab, 20);
  const activeTab =
    requestedTab === 'chat' || requestedTab === 'preview' ? requestedTab : 'design';

  renderAssignmentAuthoring(request, response, {
    ...resolved,
    activeTab,
  });
}

export function handleUpdateAssignmentDraftMetadata(request: Request, response: Response): void {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  if (!draft) {
    response.redirect('/assignments/new');
    return;
  }

  const updatedDraft = createAssignmentDraftFromManualInput({
    description: readMultilineField(request.body.description, 1500),
    estimatedMinutes: readEstimatedMinutes(request.body.estimatedMinutes),
    instructions: readMultilineField(request.body.instructions, 3000),
    level: readField(request.body.level, 120),
    previousDraft: draft,
    rubric: readMultilineField(request.body.rubric, 3000),
    targetTopic: readField(request.body.targetTopic, 220),
    title: readField(request.body.title, 220) || draft.title,
  });

  updateAssignmentAuthoringSession({
    currentDraft: updatedDraft,
    sessionId: resolved.session.id,
    userId: resolved.user.id,
  });
  createAssignmentAuthoringRevision({
    draft: updatedDraft,
    sessionId: resolved.session.id,
    source: 'manual',
    userMessage: 'Metadata saved from the design tab.',
  });

  response.redirect(`/assignments/authoring/${encodeURIComponent(resolved.session.id)}?tab=design`);
}

export async function handleReviseAssignmentDraft(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  const userMessage = readMultilineField(request.body.message, 4000);
  if (!draft || userMessage.length < 3) {
    renderAssignmentAuthoring(request, response, {
      ...resolved,
      activeTab: 'chat',
      error: 'Escribe el cambio que quieres hacer.',
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
    const revisedDraft = await generateAssignmentRevision({
      currentDraft: draft,
      openRouterApiKey,
      prompt: userMessage,
    });
    const messages = appendAuthoringMessage(resolved.session, {
      content: userMessage,
      role: 'user',
    });
    messages.push({
      content: `Actualicé la tarea. Ahora tiene ${revisedDraft.blocks.length} bloques.`,
      role: 'assistant',
      timestamp: new Date().toISOString(),
    });

    updateAssignmentAuthoringSession({
      currentDraft: revisedDraft,
      messages,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });
    createAssignmentAuthoringRevision({
      assistantMessage: 'AI revised the assignment draft.',
      draft: revisedDraft,
      sessionId: resolved.session.id,
      source: 'assistant',
      userMessage,
    });
    logger.info('assignment_draft_revised', {
      blockCount: revisedDraft.blocks.length,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });

    response.redirect(`/assignments/authoring/${encodeURIComponent(resolved.session.id)}?tab=design`);
  } catch (error) {
    logger.error('assignment_revision_failed', {
      error,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'chat',
      error: isCreditExhaustedError(error)
        ? getCreditExhaustedMessage()
        : 'No pude aplicar ese cambio ahora mismo.',
    });
  }
}

export async function handleAddAssignmentBlock(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  const blockKind = readField(request.body.blockKind, 120);
  const prompt = readMultilineField(request.body.prompt, 3000);
  if (!draft || prompt.length < 3) {
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'design',
      error: 'Describe el bloque que quieres agregar.',
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
    const block = await generateAssignmentBlock({
      blockKind,
      currentDraft: draft,
      openRouterApiKey,
      prompt,
    });
    const updatedDraft = appendAssignmentBlock(draft, block);
    updateAssignmentAuthoringSession({
      currentDraft: updatedDraft,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });
    createAssignmentAuthoringRevision({
      assistantMessage: 'AI added a block.',
      draft: updatedDraft,
      sessionId: resolved.session.id,
      source: 'block_add',
      userMessage: prompt,
    });
    logger.info('assignment_block_added', {
      blockCount: updatedDraft.blocks.length,
      blockKind: block.item.kind,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });

    response.redirect(`/assignments/authoring/${encodeURIComponent(resolved.session.id)}?tab=design`);
  } catch (error) {
    logger.error('assignment_block_generation_failed', {
      error,
      sessionId: resolved.session.id,
      userId: resolved.user.id,
    });
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'design',
      error: isCreditExhaustedError(error)
        ? getCreditExhaustedMessage()
        : 'No pude crear ese bloque ahora mismo.',
    });
  }
}

export function handleDeleteAssignmentBlock(request: Request, response: Response): void {
  updateDraftBlocks(request, response, (draft, blockId) => removeAssignmentBlock(draft, blockId));
}

export function handleDuplicateAssignmentBlock(request: Request, response: Response): void {
  updateDraftBlocks(request, response, (draft, blockId) => duplicateAssignmentBlock(draft, blockId));
}

export function handleMoveAssignmentBlock(request: Request, response: Response): void {
  const direction = request.path.endsWith('/move-down') ? 'down' : 'up';
  updateDraftBlocks(request, response, (draft, blockId) =>
    moveAssignmentBlock(draft, blockId, direction),
  );
}

function updateDraftBlocks(
  request: Request,
  response: Response,
  updater: (draft: AssignmentDraft, blockId: string) => AssignmentDraft,
): void {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  const blockId = readField(request.params.blockId, 120);
  if (!draft || !blockId) {
    response.redirect(`/assignments/authoring/${encodeURIComponent(resolved.session.id)}?tab=design`);
    return;
  }

  const updatedDraft = updater(draft, blockId);
  updateAssignmentAuthoringSession({
    currentDraft: updatedDraft,
    sessionId: resolved.session.id,
    userId: resolved.user.id,
  });
  createAssignmentAuthoringRevision({
    draft: updatedDraft,
    sessionId: resolved.session.id,
    source: 'manual',
    userMessage: `Updated block order or block list for ${blockId}.`,
  });
  logger.info('assignment_blocks_updated', {
    blockCount: updatedDraft.blocks.length,
    blockId,
    sessionId: resolved.session.id,
    userId: resolved.user.id,
  });

  response.redirect(`/assignments/authoring/${encodeURIComponent(resolved.session.id)}?tab=design`);
}

export function handleSaveAuthoredAssignment(request: Request, response: Response): void {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  if (!draft) {
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'design',
      error: 'La tarea tiene datos inválidos.',
    });
    return;
  }

  const existingAssignment = resolved.session.assignmentId
    ? findAssignmentForUser(resolved.session.assignmentId, resolved.user.id)
    : null;
  const assignment = existingAssignment
    ? updateAssignment({
        assignmentId: existingAssignment.id,
        description: draft.description,
        estimatedMinutes: draft.estimatedMinutes,
        instructions: draft.instructions,
        level: draft.level,
        quiz: draft,
        rubric: draft.rubric,
        targetTopic: draft.targetTopic,
        title: draft.title,
        userId: resolved.user.id,
      })
    : createAssignment({
        description: draft.description,
        estimatedMinutes: draft.estimatedMinutes,
        instructions: draft.instructions,
        level: draft.level,
        profileId: resolved.activeProfile.id,
        quiz: draft,
        rubric: draft.rubric,
        targetTopic: draft.targetTopic,
        title: draft.title,
        userId: resolved.user.id,
      });

  if (!assignment) {
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'design',
      error: 'No pude guardar la tarea.',
    });
    return;
  }

  updateAssignmentAuthoringSession({
    assignmentId: assignment.id,
    currentDraft: draft,
    sessionId: resolved.session.id,
    status: 'saved',
    userId: resolved.user.id,
  });
  logger.info('assignment_saved', {
    assignmentId: assignment.id,
    blockCount: draft.blocks.length,
    profileId: assignment.profileId,
    sessionId: resolved.session.id,
    userId: resolved.user.id,
  });

  response.redirect(`/assignments/${encodeURIComponent(assignment.id)}`);
}

export function handleStartAssignmentSessionPreviewAttempt(
  request: Request,
  response: Response,
): void {
  const resolved = resolveAuthoringSession(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseAssignmentDraft(resolved.session.currentDraft);
  if (!draft) {
    renderAssignmentAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'preview',
      error: 'La tarea tiene datos inválidos.',
    });
    return;
  }

  const attempt = createAssignmentAttempt({
    authoringSessionId: resolved.session.id,
    isPreview: true,
    profileId: resolved.activeProfile.id,
    snapshot: draft,
    userId: resolved.user.id,
  });
  createAssignmentAuthoringRevision({
    draft,
    sessionId: resolved.session.id,
    source: 'preview_test',
    userMessage: 'Teacher started a preview attempt.',
  });
  logger.info('assignment_preview_attempt_started', {
    attemptId: attempt.id,
    profileId: resolved.activeProfile.id,
    sessionId: resolved.session.id,
    userId: resolved.user.id,
  });

  response.redirect(`/assignment-attempts/${encodeURIComponent(attempt.id)}`);
}

export function renderAssignmentEditPage(request: Request, response: Response): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const draft = assignmentToDraftOrRedirect(resolved.assignment, response);
  if (!draft) {
    return;
  }

  const session = createAssignmentAuthoringSession({
    currentDraft: draft,
    initialPrompt: `Edit assignment: ${resolved.assignment.title}`,
    messages: [
      {
        content: 'Abrí esta tarea para edición.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      },
    ],
    profileId: resolved.assignment.profileId,
    userId: resolved.user.id,
  });
  const updatedSession = updateAssignmentAuthoringSession({
    assignmentId: resolved.assignment.id,
    currentDraft: draft,
    sessionId: session.id,
    userId: resolved.user.id,
  }) ?? session;

  renderAssignmentAuthoring(request, response, {
    activeProfile: resolved.activeProfile,
    activeTab: 'design',
    session: updatedSession,
    user: resolved.user,
  });
}

export function renderAssignmentShowPage(request: Request, response: Response): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const draft = assignmentToDraftOrRedirect(resolved.assignment, response);
  if (!draft) {
    return;
  }

  const shareLink = getOrCreateAssignmentShareLink(resolved.assignment.id);
  const shareUrl = buildAbsoluteAppUrl(
    `/assignments/shared/${encodeURIComponent(shareLink.id)}`,
  );
  const attempts = listAssignmentAttemptsForUser({
    assignmentId: resolved.assignment.id,
    profileId: resolved.assignment.profileId,
    userId: resolved.user.id,
  });

  renderAssignmentsView(response, 'assignments-show', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: resolved.activeProfile,
      title: `${resolved.assignment.title} - ${appDocumentTitle}`,
      user: resolved.user,
    }),
    assignmentAttempts: buildAssignmentAttemptListItems(attempts),
    assignmentBlockOutlineItems: buildAssignmentBlockOutlineItems(draft),
    draft,
    selectedAssignment: resolved.assignment,
    shareAutoOpen: readField(request.query.share, 20) === 'link',
    shareLink,
    shareUrl,
  });
}

export function handleSetAssignmentFavorite(request: Request, response: Response): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const returnTo = readReturnTo(
    request.body.returnTo,
    `/assignments/${encodeURIComponent(resolved.assignment.id)}`,
  );
  setAssignmentFavoriteForUser(
    resolved.assignment.id,
    resolved.user.id,
    !resolved.assignment.isFavorite,
  );
  response.redirect(returnTo);
}

export function handleArchiveAssignment(request: Request, response: Response): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const returnTo = readReturnTo(request.body.returnTo, '/assignments');
  archiveAssignmentForUser(resolved.assignment.id, resolved.user.id);
  response.redirect(returnTo);
}

export function handleRestoreAssignment(request: Request, response: Response): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const returnTo = readReturnTo(
    request.body.returnTo,
    `/assignments/${encodeURIComponent(resolved.assignment.id)}`,
  );
  restoreAssignmentForUser(resolved.assignment.id, resolved.user.id);
  response.redirect(returnTo);
}

export function renderSharedAssignmentPage(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const shareLink = findAssignmentShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/assignments');
    return;
  }

  const assignment = findAssignmentById(shareLink.assignmentId);
  if (!assignment || assignment.archivedAt) {
    response.redirect('/assignments');
    return;
  }

  const draft = assignmentToDraftOrRedirect(assignment, response);
  if (!draft) {
    return;
  }

  renderAssignmentsView(response, 'assignments-shared', {
    ...buildAssignmentsShellContext(request, {
      activeProfile: request.activeProfile ?? null,
      title: `${assignment.title} - ${appDocumentTitle}`,
      user: request.authUser ?? null,
    }),
    assignmentQuizJson: serializeViewJson(assignmentDraftToStudentQuizBlock(draft)),
    draft,
    selectedAssignment: assignment,
    shareLink,
  });
}

export function handleStartAssignmentAttempt(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const shareLink = findAssignmentShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/assignments');
    return;
  }

  const assignment = findAssignmentById(shareLink.assignmentId);
  if (!assignment || assignment.archivedAt) {
    response.redirect('/assignments');
    return;
  }

  const draft = assignmentToDraftOrRedirect(assignment, response);
  if (!draft) {
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  const attempt = createAssignmentAttempt({
    assignmentId: assignment.id,
    profileId: user && activeProfile ? activeProfile.id : null,
    snapshot: draft,
    userId: user?.emailVerified ? user.id : null,
  });
  logger.info('assignment_attempt_started', {
    assignmentId: assignment.id,
    attemptId: attempt.id,
    isGuest: !attempt.userId,
    isPreview: attempt.isPreview,
    profileId: attempt.profileId,
    userId: attempt.userId,
  });

  response.redirect(appendGuestToken(`/assignment-attempts/${encodeURIComponent(attempt.id)}`, attempt));
}

export function handleStartAssignmentPreviewAttempt(
  request: Request,
  response: Response,
): void {
  const resolved = resolveOwnAssignment(request, response);
  if (!resolved) {
    return;
  }

  const draft = assignmentToDraftOrRedirect(resolved.assignment, response);
  if (!draft) {
    return;
  }

  const attempt = createAssignmentAttempt({
    assignmentId: resolved.assignment.id,
    isPreview: true,
    profileId: resolved.assignment.profileId,
    snapshot: draft,
    userId: resolved.user.id,
  });
  logger.info('assignment_attempt_started', {
    assignmentId: resolved.assignment.id,
    attemptId: attempt.id,
    isGuest: false,
    isPreview: true,
    profileId: attempt.profileId,
    userId: attempt.userId,
  });

  response.redirect(`/assignment-attempts/${encodeURIComponent(attempt.id)}`);
}

export function renderAssignmentAttemptPage(request: Request, response: Response): void {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  if (attempt.status === 'evaluated') {
    response.redirect(appendGuestToken(`/assignment-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
    return;
  }

  renderAssignmentAttempt(request, response, { attempt });
}

export async function handleSubmitAssignmentAttempt(
  request: Request,
  response: Response,
): Promise<void> {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const draft = safeParseAssignmentDraft(attempt.snapshot);
  if (!draft) {
    response.redirect('/assignments');
    return;
  }

  const responses = normalizeAssignmentResponses({
    body: request.body,
    draft,
  });
  const submittedAttempt = submitAssignmentAttempt({
    attemptId: attempt.id,
    responses,
  });
  logger.info('assignment_attempt_submitted', {
    assignmentId: attempt.assignmentId,
    attemptId: attempt.id,
    isGuest: !attempt.userId,
    isPreview: attempt.isPreview,
    responseCount: responses.length,
    userId: attempt.userId,
  });
  const evaluatingAttempt = submittedAttempt
    ? markAssignmentAttemptEvaluating(submittedAttempt.id)
    : null;

  if (!evaluatingAttempt) {
    renderAssignmentAttempt(request, response.status(422), {
      attempt,
      error: 'No pude enviar la tarea. Inténtalo otra vez.',
    });
    return;
  }

  try {
    const previewEvaluatorLlm =
      evaluatingAttempt.isPreview && evaluatingAttempt.userId
        ? {
            modelTier: request.activeProfile?.modelTier ?? 'regular',
            openRouterApiKey: await getCreditCheckedOpenRouterApiKeyForUser(
              evaluatingAttempt.userId,
            ),
            userId: evaluatingAttempt.userId,
          }
        : undefined;
    const result = await evaluateAssignmentAttempt({
      attempt: evaluatingAttempt,
      llm: previewEvaluatorLlm,
    });
    const evaluatedAttempt = saveAssignmentAttemptResult({
      attemptId: evaluatingAttempt.id,
      result,
    });

    if (evaluatedAttempt) {
      recordAssignmentAttemptProgress(evaluatedAttempt);
    }
    logger.info('assignment_attempt_evaluated', {
      assignmentId: attempt.assignmentId,
      attemptId: attempt.id,
      isGuest: !attempt.userId,
      isPreview: attempt.isPreview,
      summary: buildAssignmentEvaluationSummary(result),
      userId: attempt.userId,
    });

    response.redirect(appendGuestToken(`/assignment-attempts/${encodeURIComponent(evaluatingAttempt.id)}/result`, evaluatingAttempt));
  } catch (error) {
    logger.error('assignment_attempt_evaluation_failed', {
      assignmentId: attempt.assignmentId,
      attemptId: attempt.id,
      error,
      userId: attempt.userId,
    });
    const failedAttempt = markAssignmentAttemptFailed(attempt.id) ?? attempt;
    renderAssignmentAttempt(request, response.status(422), {
      attempt: failedAttempt,
      error: 'No pude evaluar la tarea ahora mismo. Puedes volver a enviarla en unos minutos.',
    });
  }
}

export function renderAssignmentResultPage(request: Request, response: Response): void {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  renderAssignmentResult(request, response, attempt);
}

export function handleClaimAssignmentAttempt(request: Request, response: Response): void {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return;
  }

  if (attempt.userId === auth.user.id) {
    response.redirect(`/assignment-attempts/${encodeURIComponent(attempt.id)}/result`);
    return;
  }

  if (!attempt.claimToken) {
    response.redirect(appendGuestToken(`/assignment-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
    return;
  }

  const claimedAttempt = attachAssignmentAttemptToUser({
    attemptId: attempt.id,
    claimToken: attempt.claimToken,
    profileId: auth.activeProfile.id,
    userId: auth.user.id,
  });

  if (claimedAttempt) {
    recordAssignmentAttemptProgress(claimedAttempt);
  }

  response.redirect(`/assignment-attempts/${encodeURIComponent(attempt.id)}/result`);
}

export function handleCreateAssignmentFollowUpConversation(
  request: Request,
  response: Response,
): void {
  let attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const auth = ensureVerifiedAssignmentUser(request, response);
  if (!auth) {
    return;
  }

  if (!attempt.userId && attempt.claimToken) {
    attempt = attachAssignmentAttemptToUser({
      attemptId: attempt.id,
      claimToken: attempt.claimToken,
      profileId: auth.activeProfile.id,
      userId: auth.user.id,
    });
    if (attempt) {
      recordAssignmentAttemptProgress(attempt);
    }
  }

  if (!attempt || attempt.userId !== auth.user.id || !attempt.profileId) {
    response.redirect('/login');
    return;
  }

  if (!attempt.result) {
    response.redirect(`/assignment-attempts/${encodeURIComponent(attempt.id)}`);
    return;
  }

  const conversation = createConversationFromAssignmentAttempt({
    attempt,
    profileId: attempt.profileId,
    userId: auth.user.id,
  });
  logger.info('assignment_follow_up_conversation_created', {
    assignmentId: attempt.assignmentId,
    attemptId: attempt.id,
    conversationId: conversation.id,
    profileId: attempt.profileId,
    userId: auth.user.id,
  });

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}
