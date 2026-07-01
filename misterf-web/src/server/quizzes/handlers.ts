import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  archiveQuizForUser,
  attachQuizAttemptToUser,
  createQuiz,
  createQuizAttempt,
  createConversationFromQuizAttempt,
  findQuizAttemptById,
  findQuizById,
  findQuizForUser,
  findQuizShareLinkById,
  findProfileById,
  findProfileForUser,
  findResourceAccessForProfile,
  findResourceFolderForResource,
  findResourceShareLinkById,
  getOrCreateResourceShareLink,
  listResourceFolderPathForResource,
  listResourceFoldersForProfile,
  grantResourceAccess,
  listQuizAttemptsForUser,
  markQuizAttemptEvaluating,
  markQuizAttemptFailed,
  restoreQuizForUser,
  saveQuizAttemptResult,
  submitQuizAttempt,
  updateQuiz,
  updateQuizAuthoringMessages,
  type QuizAuthoringMessage,
  type StoredQuiz,
  type StoredQuizAttempt,
} from '../db/repository.js';
import { setActiveProfileCookie } from '../auth/profiles.js';
import {
  appDocumentTitle,
  buildAbsoluteAppUrl,
  buildAppShellContext,
  formatRelativeTime,
  getHomeAuthMessage,
} from '../pages/shell.js';
import {
  appendQuizBlock,
  quizDraftToStudentQuizBlock,
  buildQuizEvaluationSummary,
  buildQuizResultTitle,
  createQuizDraftFromManualInput,
  duplicateQuizBlock,
  evaluateQuizAttempt,
  moveQuizBlock,
  normalizeQuizResponses,
  removeQuizBlock,
  safeParseQuizDraft,
  storedQuizToDraft,
  type QuizDraft,
} from '../services/quizzes.js';
import {
  generateQuizBlock,
  generateQuizDraft,
  generateQuizRevision,
} from '../services/resourceDrafts.js';
import {
  buildResourceFromContextPrompt,
  createResourceFromContextDraft,
  normalizeContextResourceType,
} from '../services/resourceFromContext.js';
import {
  getCreditCheckedOpenRouterApiKeyForUser,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../services/creditGate.js';
import { recordQuizAttemptProgress } from '../services/learnerProgress.js';
import { logger } from '../services/logger.js';
import { quizResultBlockSchema } from '../services/llmTutor/schemas.js';
import type { TutorQuizResultBlock } from '../services/llmTutor/types.js';

type QuizAuthoringTab = 'blocks' | 'chat' | 'general';

type QuizBlockOutlineItem = {
  blockNumber: number;
  kindLabel: string;
  metaItems: string[];
  prompt: string;
  sentence: string;
};

const quizBlockKinds = [
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

const defaultQuizAuthoringTab: QuizAuthoringTab = 'general';
const maxQuizAuthoringMessages = 40;
const maxQuizAuthoringMessageLength = 6000;

function normalizeOutlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatFallbackBlockKindLabel(kind: string): string {
  return kind.replace(/^quiz_/, '').replaceAll('_', ' ');
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeQuizAuthoringMessageContent(content: string): string {
  return content.trim().slice(0, maxQuizAuthoringMessageLength);
}

function createQuizAuthoringMessage(
  role: QuizAuthoringMessage['role'],
  content: string,
  draftSnapshot?: QuizDraft,
): QuizAuthoringMessage {
  const message: QuizAuthoringMessage = {
    content: normalizeQuizAuthoringMessageContent(content),
    createdAt: new Date().toISOString(),
    role,
  };

  if (draftSnapshot) {
    message.draftSnapshot = draftSnapshot;
  }

  return message;
}

function appendQuizAuthoringMessages(
  existingMessages: QuizAuthoringMessage[],
  ...messages: QuizAuthoringMessage[]
): QuizAuthoringMessage[] {
  return [...existingMessages, ...messages]
    .flatMap((message): QuizAuthoringMessage[] => {
      const content = normalizeQuizAuthoringMessageContent(message.content);
      if (!content || (message.role !== 'assistant' && message.role !== 'user')) {
        return [];
      }

      return [{
        content,
        createdAt: message.createdAt || new Date().toISOString(),
        draftSnapshot: message.draftSnapshot,
        role: message.role,
      }];
    })
    .slice(-maxQuizAuthoringMessages);
}

function summarizeQuizDraftCreation(draft: QuizDraft): string {
  return `Listo. Creé una primera versión de "${draft.title}" con ${formatCountLabel(draft.blocks.length, 'bloque', 'bloques')}.`;
}

function saveQuizAuthoringTurn(input: {
  quiz: StoredQuiz;
  assistantMessage: string;
  draftSnapshot?: QuizDraft;
  userId: string;
  userMessage: string;
}): StoredQuiz | null {
  return updateQuizAuthoringMessages({
    quizId: input.quiz.id,
    messages: appendQuizAuthoringMessages(
      input.quiz.authoringMessages,
      createQuizAuthoringMessage('user', input.userMessage),
      createQuizAuthoringMessage('assistant', input.assistantMessage, input.draftSnapshot),
    ),
    userId: input.userId,
  });
}

function buildQuizBlockOutlineItems(draft: QuizDraft): QuizBlockOutlineItem[] {
  return draft.blocks.map((block, index) => {
    const item = block.item;
    const kind = quizBlockKinds.find((candidate) => candidate.value === item.kind);
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

function ensureVerifiedQuizUser(
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

function buildQuizzesShellContext(request: Request, options: {
  activeProfile: Request['activeProfile'];
  title: string;
  user: Request['authUser'];
}) {
  return buildAppShellContext({
    activeProfile: options.activeProfile ?? null,
    authMessage: getHomeAuthMessage(request, options.user ?? null),
    currentView: 'resources',
    guestInitialGreeting: '',
    request,
    title: options.title,
    user: options.user ?? null,
  });
}

function renderQuizzesView(
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

function readReturnTo(value: unknown, fallback: string): string {
  const returnTo = readField(value, 1200);
  return returnTo.startsWith('/') ? returnTo : fallback;
}

function readQuizShareMode(value: unknown): 'link' | 'profile' | '' {
  const mode = readField(value, 20);
  return mode === 'link' || mode === 'profile' ? mode : '';
}

function readQuizAuthoringTab(value: unknown): QuizAuthoringTab {
  const tab = readField(value, 20);
  if (tab === 'blocks' || tab === 'chat' || tab === 'general') {
    return tab;
  }

  if (tab === 'design' || tab === 'preview') {
    return 'general';
  }

  return defaultQuizAuthoringTab;
}

function buildQuizBlockAnchorId(blockId: string): string {
  return `quiz-block-${blockId}`;
}

function buildQuizAuthoringPath(
  quizId: string,
  tab: QuizAuthoringTab,
  anchorId?: string,
): string {
  const path = `/quizzes/${encodeURIComponent(quizId)}/edit?tab=${tab}`;
  return anchorId ? `${path}#${encodeURIComponent(anchorId)}` : path;
}

function appendGuestToken(pathname: string, attempt: StoredQuizAttempt): string {
  if (!attempt.guestToken) {
    return pathname;
  }

  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}guestToken=${encodeURIComponent(attempt.guestToken)}`;
}

function buildQuizResultPath(
  attempt: StoredQuizAttempt,
  params: Record<string, string> = {},
): string {
  const searchParams = new URLSearchParams(params);
  if (attempt.guestToken) {
    searchParams.set('guestToken', attempt.guestToken);
  }

  const query = searchParams.toString();
  const path = `/quiz-attempts/${encodeURIComponent(attempt.id)}/result`;
  return query ? `${path}?${query}` : path;
}

function readQuizResultActionError(value: unknown): {
  resultActionError: string;
  resultActionErrorIsCredit: boolean;
} {
  const code = readField(value, 40);
  if (code === 'credit') {
    return {
      resultActionError: getCreditExhaustedMessage(),
      resultActionErrorIsCredit: true,
    };
  }

  if (code === 'practice-guide') {
    return {
      resultActionError: 'No pude crear la guía de práctica ahora mismo. Inténtalo otra vez.',
      resultActionErrorIsCredit: false,
    };
  }

  return {
    resultActionError: '',
    resultActionErrorIsCredit: false,
  };
}

function buildQuizResultContext(input: {
  attempt: StoredQuizAttempt;
  draft: QuizDraft;
  result: TutorQuizResultBlock;
}): string {
  const summary = buildQuizEvaluationSummary(input.result);
  const payload = {
    quiz: {
      blocks: input.draft.blocks,
      description: input.draft.description,
      instructions: input.draft.instructions,
      level: input.draft.level,
      targetTopic: input.draft.targetTopic,
      title: input.draft.title,
    },
    evaluation: input.result,
    learnerResponses: input.attempt.responses,
    summary,
  };

  return JSON.stringify(payload, null, 2);
}

function quizToDraftOrRedirect(
  quiz: StoredQuiz,
  response: Response,
): QuizDraft | null {
  const draft = safeParseQuizDraft(quiz.quiz);
  if (!draft) {
    response.redirect('/resources');
    return null;
  }

  return draft;
}

function updateQuizWithDraft(
  quiz: StoredQuiz,
  userId: string,
  draft: QuizDraft,
  authoringMessages?: QuizAuthoringMessage[],
): StoredQuiz | null {
  return updateQuiz({
    quizId: quiz.id,
    authoringMessages,
    description: draft.description,
    instructions: draft.instructions,
    level: draft.level,
    quiz: draft,
    targetTopic: draft.targetTopic,
    title: draft.title,
    userId,
  });
}

function buildQuizAttemptListItems(attempts: StoredQuizAttempt[]) {
  return attempts.map((attempt) => ({
    ...attempt,
    ...getQuizAttemptStatusView(attempt.status),
    relativeUpdatedAt: formatRelativeTime(attempt.updatedAt),
  }));
}

function getQuizAttemptStatusView(status: StoredQuizAttempt['status']) {
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

function renderQuizAuthoring(
  request: Request,
  response: Response,
  input: {
    activeTab?: QuizAuthoringTab;
    quiz: StoredQuiz;
    error?: string;
    user: NonNullable<Request['authUser']>;
    activeProfile: NonNullable<Request['activeProfile']>;
  },
): void {
  const draft = safeParseQuizDraft(input.quiz.quiz);
  if (!draft) {
    response.redirect('/resources');
    return;
  }

  renderQuizzesView(response, 'quizzes-authoring', {
    ...buildQuizzesShellContext(request, {
      activeProfile: input.activeProfile,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: input.user,
    }),
    activeTab: input.activeTab ?? defaultQuizAuthoringTab,
    quizBlockKinds,
    quizAuthoringMessages: input.quiz.authoringMessages,
    authoringError: input.error || '',
    draft,
    selectedQuiz: input.quiz,
  });
}

function resolveOwnQuiz(
  request: Request,
  response: Response,
): {
  activeProfile: NonNullable<Request['activeProfile']>;
  quiz: StoredQuiz;
  user: NonNullable<Request['authUser']>;
} | null {
  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return null;
  }

  const quizId = readField(request.params.quizId, 120);
  const quiz = findQuizForUser(quizId, auth.user.id);
  if (!quiz) {
    response.redirect('/resources');
    return null;
  }

  let activeProfile = auth.activeProfile;
  if (quiz.profileId !== activeProfile.id) {
    const profile = findProfileForUser(quiz.profileId, auth.user.id);
    if (!profile) {
      response.redirect('/resources');
      return null;
    }

    activeProfile = profile;
    setActiveProfileCookie(response, profile.id);
  }

  return { activeProfile, quiz, user: auth.user };
}

function resolveAccessibleQuiz(
  request: Request,
  response: Response,
): {
  activeProfile: NonNullable<Request['activeProfile']>;
  quiz: StoredQuiz;
  canManageQuiz: boolean;
  user: NonNullable<Request['authUser']>;
} | null {
  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return null;
  }

  const quizId = readField(request.params.quizId, 120);
  const resourceAccess = findResourceAccessForProfile({
    includeArchived: true,
    profileId: auth.activeProfile.id,
    resourceId: quizId,
    userId: auth.user.id,
  });

  if (resourceAccess?.type === 'quiz') {
    if (resourceAccess.accessKind === 'shared' && resourceAccess.archivedAt) {
      response.redirect('/resources');
      return null;
    }

    const quiz = findQuizById(resourceAccess.id);
    if (!quiz) {
      response.redirect('/resources');
      return null;
    }

    return {
      activeProfile: auth.activeProfile,
      quiz,
      canManageQuiz: resourceAccess.accessKind === 'owner',
      user: auth.user,
    };
  }

  const ownedQuiz = findQuizForUser(quizId, auth.user.id);
  if (!ownedQuiz) {
    response.redirect('/resources');
    return null;
  }

  let activeProfile = auth.activeProfile;
  if (ownedQuiz.profileId !== activeProfile.id) {
    const profile = findProfileForUser(ownedQuiz.profileId, auth.user.id);
    if (!profile) {
      response.redirect('/resources');
      return null;
    }

    activeProfile = profile;
    setActiveProfileCookie(response, profile.id);
  }

  return {
    activeProfile,
    quiz: ownedQuiz,
    canManageQuiz: true,
    user: auth.user,
  };
}

function resolveAccessibleAttempt(
  request: Request,
  response: Response,
): StoredQuizAttempt | null {
  const attemptId = readField(request.params.attemptId, 120);
  const attempt = findQuizAttemptById(attemptId);
  if (!attempt) {
    response.redirect('/resources');
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

function renderQuizAttempt(
  request: Request,
  response: Response,
  input: {
    attempt: StoredQuizAttempt;
    error?: string;
    errorIsCredit?: boolean;
  },
): void {
  const draft = safeParseQuizDraft(input.attempt.snapshot);
  if (!draft) {
    response.redirect('/resources');
    return;
  }

  renderQuizzesView(response, 'quizzes-attempt', {
    ...buildQuizzesShellContext(request, {
      activeProfile: request.activeProfile ?? null,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: request.authUser ?? null,
    }),
    attempt: input.attempt,
    attemptError: input.error || '',
    attemptErrorIsCredit: Boolean(input.errorIsCredit),
    quizQuizJson: serializeViewJson(quizDraftToStudentQuizBlock(draft)),
    draft,
    guestToken: input.attempt.guestToken || '',
  });
}

function renderQuizResult(
  request: Request,
  response: Response,
  attempt: StoredQuizAttempt,
): void {
  const draft = safeParseQuizDraft(attempt.snapshot);
  const result = attempt.result ? quizResultBlockSchema.safeParse(attempt.result) : null;
  if (!draft || !result?.success) {
    response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}`, attempt));
    return;
  }

  const summary = buildQuizEvaluationSummary(result.data);
  const actionError = readQuizResultActionError(request.query.guideError);
  renderQuizzesView(response, 'quizzes-result', {
    ...buildQuizzesShellContext(request, {
      activeProfile: request.activeProfile ?? null,
      title: `${draft.title} - ${appDocumentTitle}`,
      user: request.authUser ?? null,
    }),
    attempt,
    draft,
    guestToken: attempt.guestToken || '',
    resultBlockJson: serializeViewJson(result.data),
    resultBlock: result.data,
    resultTitle: buildQuizResultTitle(result.data),
    ...actionError,
    summary,
  });
}

export function renderQuizNewPage(request: Request, response: Response): void {
  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return;
  }

  renderQuizzesView(response, 'quizzes-new', {
    ...buildQuizzesShellContext(request, {
      activeProfile: auth.activeProfile,
      title: `Nuevo quiz - ${appDocumentTitle}`,
      user: auth.user,
    }),
    generationError: '',
    generationPrompt: '',
  });
}

export async function handleGenerateQuiz(
  request: Request,
  response: Response,
): Promise<void> {
  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return;
  }

  const prompt = readMultilineField(request.body.prompt, 6000);
  if (prompt.length < 10) {
    renderQuizzesView(response.status(422), 'quizzes-new', {
      ...buildQuizzesShellContext(request, {
        activeProfile: auth.activeProfile,
        title: `Nuevo quiz - ${appDocumentTitle}`,
        user: auth.user,
      }),
      generationError: 'Describe un poco mejor el quiz.',
      generationPrompt: prompt,
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const draft = await generateQuizDraft({
      openRouterApiKey,
      prompt,
    });
    const quiz = createQuiz({
      authoringMessages: appendQuizAuthoringMessages(
        [],
        createQuizAuthoringMessage('user', prompt),
        createQuizAuthoringMessage('assistant', summarizeQuizDraftCreation(draft), draft),
      ),
      description: draft.description,
      instructions: draft.instructions,
      level: draft.level,
      profileId: auth.activeProfile.id,
      quiz: draft,
      targetTopic: draft.targetTopic,
      title: draft.title,
      userId: auth.user.id,
    });

    logger.info('quiz_created_from_prompt', {
      quizId: quiz.id,
      blockCount: draft.blocks.length,
      profileId: auth.activeProfile.id,
      resourceId: quiz.id,
      resourceType: 'quiz',
      userId: auth.user.id,
    });

    response.redirect(buildQuizAuthoringPath(quiz.id, defaultQuizAuthoringTab));
  } catch (error) {
    logger.error('quiz_generation_failed', {
      error,
      userId: auth.user.id,
    });
    const generationError = isCreditExhaustedError(error)
      ? getCreditExhaustedMessage()
      : 'No pude generar el quiz ahora mismo. Inténtalo otra vez.';

    renderQuizzesView(response.status(422), 'quizzes-new', {
      ...buildQuizzesShellContext(request, {
        activeProfile: auth.activeProfile,
        title: `Nuevo quiz - ${appDocumentTitle}`,
        user: auth.user,
      }),
      generationError,
      generationPrompt: prompt,
    });
  }
}

export function handleUpdateQuizMetadata(request: Request, response: Response): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseQuizDraft(resolved.quiz.quiz);
  if (!draft) {
    response.redirect('/resources');
    return;
  }

  const updatedDraft = createQuizDraftFromManualInput({
    description: readMultilineField(request.body.description, 1500),
    evaluationInstructions: readMultilineField(request.body.evaluationInstructions, 3000),
    instructions: readMultilineField(request.body.instructions, 3000),
    level: readField(request.body.level, 120),
    previousDraft: draft,
    targetTopic: readField(request.body.targetTopic, 220),
    title: readField(request.body.title, 220) || draft.title,
  });

  const updatedQuiz = updateQuizWithDraft(
    resolved.quiz,
    resolved.user.id,
    updatedDraft,
  );
  if (!updatedQuiz) {
    renderQuizAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'general',
      error: 'No pude guardar los detalles del quiz.',
    });
    return;
  }

  response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'general'));
}

export async function handleReviseQuiz(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseQuizDraft(resolved.quiz.quiz);
  const userMessage = readMultilineField(request.body.message, 4000);
  if (!draft || userMessage.length < 3) {
    renderQuizAuthoring(request, response, {
      ...resolved,
      activeTab: 'chat',
      error: 'Escribe el cambio que quieres hacer.',
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
    const revision = await generateQuizRevision({
      conversationHistory: resolved.quiz.authoringMessages.map((message) => ({
        content: message.content,
        createdAt: message.createdAt,
        draftSnapshot: message.draftSnapshot,
        role: message.role,
      })),
      currentDraft: draft,
      openRouterApiKey,
      prompt: userMessage,
    });
    const revisedDraft = revision.draft;
    const nextAuthoringMessages = appendQuizAuthoringMessages(
      resolved.quiz.authoringMessages,
      createQuizAuthoringMessage('user', userMessage),
      createQuizAuthoringMessage('assistant', revision.assistantMessage, revisedDraft),
    );
    const updatedQuiz = updateQuizWithDraft(
      resolved.quiz,
      resolved.user.id,
      revisedDraft,
      nextAuthoringMessages,
    );
    if (!updatedQuiz) {
      const quizWithFailureMessage = saveQuizAuthoringTurn({
        quiz: resolved.quiz,
        assistantMessage: 'No pude aplicar ese cambio ahora mismo.',
        userId: resolved.user.id,
        userMessage,
      });
      renderQuizAuthoring(request, response.status(422), {
        ...resolved,
        activeTab: 'chat',
        quiz: quizWithFailureMessage ?? resolved.quiz,
        error: 'No pude aplicar ese cambio ahora mismo.',
      });
      return;
    }
    logger.info('quiz_revised', {
      quizId: resolved.quiz.id,
      blockCount: revisedDraft.blocks.length,
      resourceId: resolved.quiz.id,
      resourceType: 'quiz',
      userId: resolved.user.id,
    });

    response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'chat'));
  } catch (error) {
    const failureMessage = isCreditExhaustedError(error)
      ? getCreditExhaustedMessage()
      : 'No pude aplicar ese cambio ahora mismo.';
    const quizWithFailureMessage = saveQuizAuthoringTurn({
      quiz: resolved.quiz,
      assistantMessage: failureMessage,
      userId: resolved.user.id,
      userMessage,
    });
    logger.error('quiz_revision_failed', {
      quizId: resolved.quiz.id,
      error,
      resourceId: resolved.quiz.id,
      resourceType: 'quiz',
      userId: resolved.user.id,
    });
    renderQuizAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'chat',
      quiz: quizWithFailureMessage ?? resolved.quiz,
      error: failureMessage,
    });
  }
}

export async function handleAddQuizBlock(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseQuizDraft(resolved.quiz.quiz);
  const blockKind = readField(request.body.blockKind, 120);
  const prompt = readMultilineField(request.body.prompt, 3000);
  if (!draft || prompt.length < 3) {
    renderQuizAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'blocks',
      error: 'Describe el bloque que quieres agregar.',
    });
    return;
  }

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(resolved.user.id);
    const block = await generateQuizBlock({
      blockKind,
      currentDraft: draft,
      openRouterApiKey,
      prompt,
    });
    const updatedDraft = appendQuizBlock(draft, block);
    const updatedQuiz = updateQuizWithDraft(
      resolved.quiz,
      resolved.user.id,
      updatedDraft,
    );
    if (!updatedQuiz) {
      renderQuizAuthoring(request, response.status(422), {
        ...resolved,
        activeTab: 'blocks',
        error: 'No pude guardar ese bloque ahora mismo.',
      });
      return;
    }
    logger.info('quiz_block_added', {
      quizId: resolved.quiz.id,
      blockCount: updatedDraft.blocks.length,
      blockKind: block.item.kind,
      resourceId: resolved.quiz.id,
      resourceType: 'quiz',
      userId: resolved.user.id,
    });

    response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'blocks'));
  } catch (error) {
    logger.error('quiz_block_generation_failed', {
      quizId: resolved.quiz.id,
      error,
      resourceId: resolved.quiz.id,
      resourceType: 'quiz',
      userId: resolved.user.id,
    });
    renderQuizAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'blocks',
      error: isCreditExhaustedError(error)
        ? getCreditExhaustedMessage()
        : 'No pude crear ese bloque ahora mismo.',
    });
  }
}

export function handleDeleteQuizBlock(request: Request, response: Response): void {
  updateDraftBlocks(request, response, (draft, blockId) => removeQuizBlock(draft, blockId));
}

export function handleDuplicateQuizBlock(request: Request, response: Response): void {
  updateDraftBlocks(request, response, (draft, blockId) => duplicateQuizBlock(draft, blockId));
}

export function handleMoveQuizBlock(request: Request, response: Response): void {
  const direction = request.path.endsWith('/move-down') ? 'down' : 'up';
  updateDraftBlocks(
    request,
    response,
    (draft, blockId) => moveQuizBlock(draft, blockId, direction),
    { focusMovedBlock: true },
  );
}

function updateDraftBlocks(
  request: Request,
  response: Response,
  updater: (draft: QuizDraft, blockId: string) => QuizDraft,
  options: { focusMovedBlock?: boolean } = {},
): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = safeParseQuizDraft(resolved.quiz.quiz);
  const blockId = readField(request.params.blockId, 120);
  if (!draft || !blockId) {
    response.redirect(buildQuizAuthoringPath(resolved.quiz.id, 'blocks'));
    return;
  }

  const updatedDraft = updater(draft, blockId);
  const updatedQuiz = updateQuizWithDraft(
    resolved.quiz,
    resolved.user.id,
    updatedDraft,
  );
  if (!updatedQuiz) {
    renderQuizAuthoring(request, response.status(422), {
      ...resolved,
      activeTab: 'blocks',
      error: 'No pude actualizar los bloques ahora mismo.',
    });
    return;
  }
  logger.info('quiz_blocks_updated', {
    quizId: resolved.quiz.id,
    blockCount: updatedDraft.blocks.length,
    blockId,
    resourceId: resolved.quiz.id,
    resourceType: 'quiz',
    userId: resolved.user.id,
  });

  response.redirect(
    buildQuizAuthoringPath(
      resolved.quiz.id,
      'blocks',
      options.focusMovedBlock ? buildQuizBlockAnchorId(blockId) : undefined,
    ),
  );
}

export function renderQuizEditPage(request: Request, response: Response): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = quizToDraftOrRedirect(resolved.quiz, response);
  if (!draft) {
    return;
  }

  const activeTab = readQuizAuthoringTab(request.query.tab);

  renderQuizAuthoring(request, response, {
    activeProfile: resolved.activeProfile,
    activeTab,
    quiz: resolved.quiz,
    user: resolved.user,
  });
}

export async function renderQuizShowPage(
  request: Request,
  response: Response,
): Promise<void> {
  const resolved = resolveAccessibleQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = quizToDraftOrRedirect(resolved.quiz, response);
  if (!draft) {
    return;
  }

  const shareLink = resolved.canManageQuiz
    ? getOrCreateResourceShareLink(resolved.quiz.id)
    : null;
  const shareUrl = shareLink
    ? buildAbsoluteAppUrl(`/resources/shared/${encodeURIComponent(shareLink.id)}`)
    : '';
  const quizShareQrDataUrl = shareLink
    ? await QRCode.toDataURL(shareUrl, {
        margin: 1,
        width: 180,
      })
    : '';
  const quizShareMode = readQuizShareMode(request.query.share);
  const selectedQuizSharedFromProfileName = !resolved.canManageQuiz
    ? findProfileById(resolved.quiz.profileId)?.name || ''
    : resolved.quiz.sourceProfileId
    ? findProfileById(resolved.quiz.sourceProfileId)?.name || ''
    : '';
  const shareTargetQuizProfiles = (request.availableProfiles ?? []).filter(
    (profile) => profile.id !== resolved.quiz.profileId,
  );
  const resourceCurrentFolder = resolved.canManageQuiz
    ? findResourceFolderForResource(resolved.quiz.id, resolved.user.id)
    : null;
  const resourceFolderPath = resolved.canManageQuiz
    ? listResourceFolderPathForResource(resolved.quiz.id, resolved.user.id)
    : [];
  const resourceFolderOptions = resolved.canManageQuiz
    ? listResourceFoldersForProfile({
        includeArchived: false,
        profileId: resolved.quiz.profileId,
        userId: resolved.user.id,
      })
    : [];
  const attempts = listQuizAttemptsForUser({
    quizId: resolved.quiz.id,
    profileId: resolved.canManageQuiz
      ? resolved.quiz.profileId
      : resolved.activeProfile.id,
    userId: resolved.user.id,
  });

  renderQuizzesView(response, 'quizzes-show', {
    ...buildQuizzesShellContext(request, {
      activeProfile: resolved.activeProfile,
      title: `${resolved.quiz.title} - ${appDocumentTitle}`,
      user: resolved.user,
    }),
    quizAttempts: buildQuizAttemptListItems(attempts),
    quizBlockOutlineItems: buildQuizBlockOutlineItems(draft),
    canManageQuiz: resolved.canManageQuiz,
    quizShareMode,
    quizShareQrDataUrl,
    draft,
    resourceCurrentFolder,
    resourceFolderPath,
    resourceFolderOptions,
    selectedQuiz: resolved.quiz,
    selectedQuizSharedFromProfileName,
    shareLink,
    shareTargetQuizProfiles,
    shareUrl,
  });
}

export function handleShareQuizToProfile(request: Request, response: Response): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const targetProfileId = readField(request.body.targetProfileId, 120);
  const targetProfile = findProfileForUser(targetProfileId, resolved.user.id);
  if (!targetProfile || targetProfile.id === resolved.quiz.profileId) {
    response.redirect(`/quizzes/${encodeURIComponent(resolved.quiz.id)}`);
    return;
  }

  grantResourceAccess({
    grantedByUserId: resolved.user.id,
    grantedVia: 'profile',
    profileId: targetProfile.id,
    resourceId: resolved.quiz.id,
    userId: resolved.user.id,
  });
  response.redirect(`/quizzes/${encodeURIComponent(resolved.quiz.id)}`);
}

export function handleArchiveQuiz(request: Request, response: Response): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const returnTo = readReturnTo(request.body.returnTo, '/resources');
  archiveQuizForUser(resolved.quiz.id, resolved.user.id);
  response.redirect(returnTo);
}

export function handleRestoreQuiz(request: Request, response: Response): void {
  const resolved = resolveOwnQuiz(request, response);
  if (!resolved) {
    return;
  }

  const returnTo = readReturnTo(
    request.body.returnTo,
    `/quizzes/${encodeURIComponent(resolved.quiz.id)}`,
  );
  restoreQuizForUser(resolved.quiz.id, resolved.user.id);
  response.redirect(returnTo);
}

export function renderSharedQuizPage(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const legacyShareLink = findQuizShareLinkById(shareId);
  if (!legacyShareLink || legacyShareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const resourceShareLink = getOrCreateResourceShareLink(legacyShareLink.quizId);
  response.redirect(`/resources/shared/${encodeURIComponent(resourceShareLink.id)}`);
}

export function handleStartQuizAttempt(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const shareLink = findQuizShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const quiz = findQuizById(shareLink.quizId);
  if (!quiz || quiz.archivedAt) {
    response.redirect('/resources');
    return;
  }

  const resourceShareLink = getOrCreateResourceShareLink(quiz.id);
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    response.redirect(
      `/login?returnTo=${encodeURIComponent(
        `/resources/shared/${resourceShareLink.id}`,
      )}`,
    );
    return;
  }

  grantResourceAccess({
    grantedByUserId: quiz.userId,
    grantedVia: 'link',
    profileId: activeProfile.id,
    resourceId: quiz.id,
    shareLinkId: resourceShareLink.id,
    userId: user.id,
  });

  response.redirect(`/quizzes/${encodeURIComponent(quiz.id)}`);
}

/**
 * Starts an attempt for a shared quiz that allows public attempts. Anonymous
 * visitors get a free guest attempt (evaluated with the platform free-resource
 * key). Authenticated visitors get a normal owned attempt with resource access.
 */
export function handleStartSharedQuizAttempt(request: Request, response: Response): void {
  const shareId = readField(request.params.shareId, 120);
  const sharePath = `/resources/shared/${encodeURIComponent(shareId)}`;
  const shareLink = findResourceShareLinkById(shareId);
  if (!shareLink || shareLink.revokedAt) {
    response.redirect('/resources');
    return;
  }

  const quiz = findQuizById(shareLink.resourceId);
  if (!quiz || quiz.archivedAt) {
    response.redirect(sharePath);
    return;
  }

  const draft = safeParseQuizDraft(quiz.quiz);
  if (!draft) {
    response.redirect(sharePath);
    return;
  }

  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (user?.emailVerified && activeProfile) {
    grantResourceAccess({
      grantedByUserId: quiz.userId,
      grantedVia: 'link',
      profileId: activeProfile.id,
      resourceId: quiz.id,
      shareLinkId: shareLink.id,
      userId: user.id,
    });
    const attempt = createQuizAttempt({
      quizId: quiz.id,
      profileId: activeProfile.id,
      snapshot: draft,
      userId: user.id,
    });
    logger.info('quiz_attempt_started', {
      quizId: quiz.id,
      attemptId: attempt.id,
      isGuest: false,
      profileId: attempt.profileId,
      resourceId: quiz.id,
      resourceType: 'quiz',
      userId: attempt.userId,
    });
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
    return;
  }

  const attempt = createQuizAttempt({ quizId: quiz.id, snapshot: draft });
  logger.info('quiz_public_attempt_started', {
    quizId: quiz.id,
    attemptId: attempt.id,
    isGuest: true,
    resourceId: quiz.id,
    resourceType: 'quiz',
    userId: null,
  });
  response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}`, attempt));
}

export function handleStartQuizTestAttempt(
  request: Request,
  response: Response,
): void {
  const resolved = resolveAccessibleQuiz(request, response);
  if (!resolved) {
    return;
  }

  const draft = quizToDraftOrRedirect(resolved.quiz, response);
  if (!draft) {
    return;
  }

  const attempt = createQuizAttempt({
    quizId: resolved.quiz.id,
    profileId: resolved.activeProfile.id,
    snapshot: draft,
    userId: resolved.user.id,
  });
  logger.info('quiz_attempt_started', {
    quizId: resolved.quiz.id,
    attemptId: attempt.id,
    isGuest: false,
    profileId: attempt.profileId,
    resourceId: resolved.quiz.id,
    resourceType: 'quiz',
    userId: attempt.userId,
  });

  response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
}

export function renderQuizAttemptPage(request: Request, response: Response): void {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  if (attempt.status === 'evaluated') {
    response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
    return;
  }

  renderQuizAttempt(request, response, { attempt });
}

export async function handleSubmitQuizAttempt(
  request: Request,
  response: Response,
): Promise<void> {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const draft = safeParseQuizDraft(attempt.snapshot);
  if (!draft) {
    response.redirect('/resources');
    return;
  }

  const responses = normalizeQuizResponses({
    body: request.body,
    draft,
  });
  const submittedAttempt = submitQuizAttempt({
    attemptId: attempt.id,
    responses,
  });
  logger.info('quiz_attempt_submitted', {
    quizId: attempt.quizId,
    attemptId: attempt.id,
    isGuest: !attempt.userId,
    responseCount: responses.length,
    resourceId: attempt.quizId,
    resourceType: 'quiz',
    userId: attempt.userId,
  });

  if (!submittedAttempt) {
    renderQuizAttempt(request, response.status(422), {
      attempt,
      error: 'No pude enviar el quiz. Inténtalo otra vez.',
    });
    return;
  }

  // Anonymous student: the answers are saved, but evaluation needs an account.
  // Send them to sign up / log in; on return the result page claims the attempt
  // and evaluates it with the new account's own credit-gated key.
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (!user?.emailVerified || !activeProfile) {
    const resultPath = appendGuestToken(
      `/quiz-attempts/${encodeURIComponent(submittedAttempt.id)}/result`,
      submittedAttempt,
    );
    response.redirect(`/signup?returnTo=${encodeURIComponent(resultPath)}`);
    return;
  }

  try {
    const evaluated = await evaluateSubmittedQuizAttemptForUser({
      attempt: submittedAttempt,
      profileId: activeProfile.id,
      userId: user.id,
    });
    response.redirect(`/quiz-attempts/${encodeURIComponent(evaluated.id)}/result`);
  } catch (error) {
    renderQuizEvaluationError(request, response, submittedAttempt, error);
  }
}

async function evaluateSubmittedQuizAttemptForUser(input: {
  attempt: StoredQuizAttempt;
  profileId: string;
  userId: string;
}): Promise<StoredQuizAttempt> {
  let attempt = input.attempt;
  // Claim a guest attempt so the evaluation and progress belong to the user.
  if (!attempt.userId && attempt.claimToken) {
    const claimed = attachQuizAttemptToUser({
      attemptId: attempt.id,
      claimToken: attempt.claimToken,
      profileId: input.profileId,
      userId: input.userId,
    });
    if (claimed) {
      attempt = claimed;
    }
  }

  const evaluatingAttempt = markQuizAttemptEvaluating(attempt.id);
  if (!evaluatingAttempt) {
    throw new Error('Could not mark quiz attempt as evaluating.');
  }

  const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(input.userId);
  const result = await evaluateQuizAttempt({
    attempt: evaluatingAttempt,
    llm: { openRouterApiKey },
  });
  const evaluated = saveQuizAttemptResult({ attemptId: evaluatingAttempt.id, result });
  if (!evaluated) {
    throw new Error('Could not save quiz attempt result.');
  }
  recordQuizAttemptProgress(evaluated);
  logger.info('quiz_attempt_evaluated', {
    quizId: evaluated.quizId,
    attemptId: evaluated.id,
    resourceId: evaluated.quizId,
    resourceType: 'quiz',
    summary: buildQuizEvaluationSummary(result),
    userId: evaluated.userId,
  });
  return evaluated;
}

function renderQuizEvaluationError(
  request: Request,
  response: Response,
  attempt: StoredQuizAttempt,
  error: unknown,
): void {
  const isCredit = isCreditExhaustedError(error);
  logger.error('quiz_attempt_evaluation_failed', {
    quizId: attempt.quizId,
    attemptId: attempt.id,
    error,
    isCredit,
    resourceId: attempt.quizId,
    resourceType: 'quiz',
    userId: attempt.userId,
  });
  const failedAttempt = markQuizAttemptFailed(attempt.id) ?? attempt;
  renderQuizAttempt(request, response.status(422), {
    attempt: failedAttempt,
    error: isCredit
      ? getCreditExhaustedMessage()
      : 'No pude evaluar el quiz ahora mismo. Puedes volver a enviarlo en unos minutos.',
    errorIsCredit: isCredit,
  });
}

export async function renderQuizResultPage(request: Request, response: Response): Promise<void> {
  let attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  // A student who filled a quiz as a guest and just signed in / signed up lands
  // here with the attempt only submitted. Claim it and evaluate it now with
  // their own credit-gated key, then show the result.
  const user = request.authUser;
  const activeProfile = request.activeProfile;
  if (user?.emailVerified && activeProfile && attempt.status === 'submitted') {
    try {
      attempt = await evaluateSubmittedQuizAttemptForUser({
        attempt,
        profileId: activeProfile.id,
        userId: user.id,
      });
    } catch (error) {
      renderQuizEvaluationError(request, response, attempt, error);
      return;
    }
  }

  renderQuizResult(request, response, attempt);
}

export function handleClaimQuizAttempt(request: Request, response: Response): void {
  const attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return;
  }

  if (attempt.userId === auth.user.id) {
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
    return;
  }

  if (!attempt.claimToken) {
    response.redirect(appendGuestToken(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`, attempt));
    return;
  }

  const claimedAttempt = attachQuizAttemptToUser({
    attemptId: attempt.id,
    claimToken: attempt.claimToken,
    profileId: auth.activeProfile.id,
    userId: auth.user.id,
  });

  if (claimedAttempt) {
    recordQuizAttemptProgress(claimedAttempt);
  }

  response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
}

export function handleCreateQuizFollowUpConversation(
  request: Request,
  response: Response,
): void {
  let attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return;
  }

  if (!attempt.userId && attempt.claimToken) {
    attempt = attachQuizAttemptToUser({
      attemptId: attempt.id,
      claimToken: attempt.claimToken,
      profileId: auth.activeProfile.id,
      userId: auth.user.id,
    });
    if (attempt) {
      recordQuizAttemptProgress(attempt);
    }
  }

  if (!attempt || attempt.userId !== auth.user.id || !attempt.profileId) {
    response.redirect('/login');
    return;
  }

  if (!attempt.result) {
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
    return;
  }

  const conversation = createConversationFromQuizAttempt({
    attempt,
    profileId: attempt.profileId,
    userId: auth.user.id,
  });
  logger.info('quiz_follow_up_conversation_created', {
    quizId: attempt.quizId,
    attemptId: attempt.id,
    conversationId: conversation.id,
    profileId: attempt.profileId,
    resourceId: attempt.quizId,
    resourceType: 'quiz',
    userId: auth.user.id,
  });

  response.redirect(`/c/${encodeURIComponent(conversation.id)}`);
}

export async function handleCreateQuizResource(
  request: Request,
  response: Response,
): Promise<void> {
  let attempt = resolveAccessibleAttempt(request, response);
  if (!attempt) {
    return;
  }

  const auth = ensureVerifiedQuizUser(request, response);
  if (!auth) {
    return;
  }

  if (!attempt.userId && attempt.claimToken) {
    attempt = attachQuizAttemptToUser({
      attemptId: attempt.id,
      claimToken: attempt.claimToken,
      profileId: auth.activeProfile.id,
      userId: auth.user.id,
    });
    if (attempt) {
      recordQuizAttemptProgress(attempt);
    }
  }

  if (!attempt || attempt.userId !== auth.user.id || !attempt.profileId) {
    response.redirect('/login');
    return;
  }

  const draft = safeParseQuizDraft(attempt.snapshot);
  const result = attempt.result ? quizResultBlockSchema.safeParse(attempt.result) : null;
  if (!draft || !result?.success || attempt.status !== 'evaluated') {
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}`);
    return;
  }

  const type = normalizeContextResourceType(request.body.type);
  if (!type) {
    response.redirect(`/quiz-attempts/${encodeURIComponent(attempt.id)}/result`);
    return;
  }

  const instruction = readMultilineField(request.body.prompt, 2000);
  const prompt = buildResourceFromContextPrompt({
    context: buildQuizResultContext({ attempt, draft, result: result.data }),
    contextLabel: 'Resultado del quiz completado',
    instruction,
    type,
  });

  try {
    const openRouterApiKey = await getCreditCheckedOpenRouterApiKeyForUser(auth.user.id);
    const created = await createResourceFromContextDraft({
      openRouterApiKey,
      profileId: attempt.profileId,
      prompt,
      type,
      userId: auth.user.id,
    });

    logger.info('quiz_resource_created', {
      quizId: attempt.quizId,
      attemptId: attempt.id,
      profileId: attempt.profileId,
      resourceType: type,
      sourceResourceId: attempt.quizId,
      userId: auth.user.id,
    });

    response.redirect(created.detailPath);
  } catch (error) {
    logger.error('quiz_resource_creation_failed', {
      quizId: attempt.quizId,
      attemptId: attempt.id,
      error,
      resourceType: type,
      sourceResourceId: attempt.quizId,
      userId: auth.user.id,
    });

    response.redirect(
      buildQuizResultPath(attempt, {
        guideError: isCreditExhaustedError(error) ? 'credit' : 'practice-guide',
      }),
    );
  }
}
