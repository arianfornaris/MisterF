import { describe, expect, it } from 'vitest';
import {
  renderTutorBlockProtocol,
  tutorBlockNamesForInstructionLanguage,
} from '../../src/server/services/llmTutor/blockProtocol.js';
import { buildAgentSystemInstruction } from '../../src/server/services/llmTutor/prompt.js';
import { loadSystemPrompt } from '../../src/server/services/systemPrompts.js';

describe('tutor instruction language parametrization', () => {
  it('keeps the Spanish system prompt byte-for-byte identical across entry points', () => {
    const defaultSystem = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
    });
    const spanishSystem = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
      instructionLanguage: 'es',
    });

    expect(spanishSystem).toEqual(defaultSystem);
    expect(spanishSystem).toContain('You are an English tutor for Spanish-speaking learners.');
    expect(spanishSystem).toContain('Speak to the learner in Spanish by default.');
    expect(spanishSystem).toContain('The title must be short, Spanish, human-friendly');
    expect(spanishSystem).toContain('  - practicar vocabulario');
    expect(spanishSystem).toContain('`message` plus `understand_in_spanish_prompt`');
    expect(spanishSystem).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('renders an English monolingual system prompt without translation scaffolding', () => {
    const englishSystem = buildAgentSystemInstruction({
      currentTitle: 'New conversation',
      instructionLanguage: 'en',
    });

    expect(englishSystem).toContain('Speak to the learner in English by default.');
    expect(englishSystem).toContain('Teach English through English.');
    expect(englishSystem).toContain('The title must be short, English, human-friendly');
    expect(englishSystem).toContain('  - practice vocabulary');
    expect(englishSystem).not.toContain('for Spanish-speaking learners');
    expect(englishSystem).not.toContain('Speak to the learner in Spanish');
    expect(englishSystem).not.toContain('`message` plus `translate_to_english_prompt`');
    expect(englishSystem).not.toContain('`message` plus `understand_in_spanish_prompt`');
    expect(englishSystem).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('excludes translation-based blocks from the English block set only', () => {
    const spanishNames = tutorBlockNamesForInstructionLanguage('es');
    const englishNames = tutorBlockNamesForInstructionLanguage('en');

    expect(spanishNames).toContain('translate-to-english-prompt');
    expect(spanishNames).toContain('understand-in-spanish-prompt');
    expect(englishNames).not.toContain('translate-to-english-prompt');
    expect(englishNames).not.toContain('understand-in-spanish-prompt');

    const spanishProtocol = renderTutorBlockProtocol(undefined, 'es');
    const englishProtocol = renderTutorBlockProtocol(undefined, 'en');
    expect(englishProtocol).not.toContain('interface UnderstandInSpanishPromptBlock');
    expect(englishProtocol).not.toContain('interface TranslateToEnglishPromptBlock');
    expect(englishProtocol).not.toContain('| TranslateToEnglishPromptBlock');
    expect(englishProtocol).not.toContain('| UnderstandInSpanishPromptBlock');

    // The two Spanish-specific quiz item kinds are excluded outside Spanish.
    expect(spanishProtocol).toContain('interface QuizTranslateToEnglishItem');
    expect(spanishProtocol).toContain('interface QuizUnderstandInSpanishItem');
    expect(spanishProtocol).toContain('| QuizTranslateToEnglishItem');
    expect(englishProtocol).not.toContain('interface QuizTranslateToEnglishItem');
    expect(englishProtocol).not.toContain('interface QuizUnderstandInSpanishItem');
    expect(englishProtocol).not.toContain('quiz_translate_to_english');
    expect(englishProtocol).not.toContain('quiz_understand_in_spanish');
    expect(englishProtocol).not.toContain('| QuizTranslateToEnglishItem');
    expect(englishProtocol).not.toContain('| QuizUnderstandInSpanishItem');
  });

  it('authors block learner-facing fields in the instruction language', () => {
    const spanishProtocol = renderTutorBlockProtocol(undefined, 'es');
    const englishProtocol = renderTutorBlockProtocol(undefined, 'en');

    expect(spanishProtocol).toContain('must be Spanish');
    expect(spanishProtocol).toContain('Optional short Spanish quiz title');
    expect(spanishProtocol).not.toMatch(/\{\{[A-Z_]+\}\}/);

    expect(englishProtocol).toContain('must be English');
    expect(englishProtocol).toContain('Optional short English quiz title');
    expect(englishProtocol).not.toContain('must be Spanish');
    expect(englishProtocol).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe('tutor prompt contracts', () => {
  it('does not include removed block types in the tutor protocol', () => {
    const protocol = renderTutorBlockProtocol();

    expect(protocol).not.toContain('DirectionChoiceBlock');
    expect(protocol).not.toContain('direction_choice');
    expect(protocol).not.toContain('ConversationTitleBlock');
    expect(protocol).not.toContain('conversation_title');
  });

  it('keeps quiz_result out of the normal tutor protocol', () => {
    const protocol = renderTutorBlockProtocol();

    expect(protocol).not.toContain('type: "quiz_result"');
    expect(protocol).not.toContain('QuizResultBlock');
  });

  it('injects registered avatar ids into dialogue block protocol docs', () => {
    const protocol = renderTutorBlockProtocol([
      'dialogue-character-message',
      'dialogue-transcript',
      'tutor-response-block',
    ]);

    expect(protocol).toContain('avatarId?: string;');
    expect(protocol).toContain('- amara: Amara');
    expect(protocol).toContain('- lucas: Lucas');
    expect(protocol).not.toContain('{{DIALOGUE_AVATAR_OPTIONS}}');
  });

  it('documents fill-in-the-blank input as a free-form learner reply', () => {
    const protocol = renderTutorBlockProtocol();

    expect(protocol).toContain('interface FillInTheBlankInputBlock');
    expect(protocol).toContain('This block is intentionally open-ended.');
    expect(protocol).toContain('model-facing learner message');
    expect(protocol).toContain('exerciseSubmission');
    expect(protocol).toContain('does not render a separate learner chat bubble');
    expect(protocol).not.toContain('next normal chat message');
    expect(protocol).not.toContain('Acceptable English typed answers for this blank.');
  });

  it('does not inject the removed generic start-session prompt', () => {
    const system = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
    });

    expect(system).not.toContain('Start the session.');
    expect(system).not.toContain('start-session');
  });

  it('injects learner profile context as teacher-only background', () => {
    const system = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
      learnerProfile: {
        description: 'Perfil para inglés profesional.',
        learningContext: 'Trabajo en software y quiero practicar reuniones.',
        name: 'Arian',
      },
    });

    expect(system).toContain('## Learner Profile Context');
    expect(system).toContain('Trabajo en software y quiero practicar reuniones.');
    expect(system).toContain('It is not a');
    expect(system).toContain('current-turn');
  });

  it('allows one automatic conversation title once a generic conversation has a clear purpose', () => {
    const system = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
    });

    expect(system).toContain('The current title is generic.');
    expect(system).toContain('call update_conversation_title at most once');
    expect(system).toContain('reason "initial_topic"');
    expect(system).toContain('purpose becomes clear');
    expect(system).toContain('do not call update_conversation_title again');
  });

  it('protects manual or already-specific conversation titles', () => {
    const manualTitleSystem = buildAgentSystemInstruction({
      currentTitle: 'Práctica de reuniones',
      titleUpdatedByUser: true,
    });
    const specificTitleSystem = buildAgentSystemInstruction({
      currentTitle: 'Práctica de reuniones',
    });

    expect(manualTitleSystem).toContain('changed this title manually');
    expect(manualTitleSystem).toContain('unless the learner explicitly asks to rename');
    expect(manualTitleSystem).toContain('reason "explicit_user_request"');
    expect(specificTitleSystem).toContain('already specific');
    expect(specificTitleSystem).toContain('unless the learner explicitly asks to rename');
    expect(specificTitleSystem).toContain('reason "explicit_user_request"');
  });

  it('documents order_sentences as a normal interactive exercise', () => {
    const system = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
    });

    expect(system).toContain('interface OrderSentencesBlock');
    expect(system).toContain('`order_sentences`, and `dialogue_character_message`');
    expect(system).toContain('`message` plus `order_sentences`');
  });

  it('keeps quiz order-sentences support synchronized across prompt repair paths', () => {
    const protocol = renderTutorBlockProtocol();
    const draftCorrection = loadSystemPrompt('resources/quiz-draft-correction.md');
    const revisionCorrection = loadSystemPrompt('resources/quiz-revision-correction.md');

    expect(protocol).toContain('interface QuizOrderSentencesItem');
    expect(protocol).toContain('kind: "quiz_order_sentences"');
    expect(draftCorrection).toContain('quiz_order_sentences');
    expect(revisionCorrection).toContain('quiz_order_sentences');
  });

  it('tells practice-guide chats to adapt older manual ordering instructions', () => {
    const system = buildAgentSystemInstruction({
      currentTitle: 'Nueva conversación',
      practiceGuide: {
        description: 'Ordenar un diálogo desordenado.',
        title: 'Ordenando el diálogo',
        tutorInstructions: 'Presenta frases con letras A, B, C y pide el orden correcto.',
      },
    });

    expect(system).toContain('older manual UI mechanics');
    expect(system).toContain('use the interactive ordering block');
    expect(system).toContain('do not manually pre-shuffle items');
  });
});
