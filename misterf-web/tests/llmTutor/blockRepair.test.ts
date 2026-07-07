import { describe, expect, it } from 'vitest';
import {
  detectMessageTaskLeakage,
  detectMultiExerciseBatch,
} from '../../src/server/services/llmTutor/blockRepair.js';
import type { TutorAgentResponseBlock } from '../../src/server/services/llmTutor/types.js';

function detectFromMessage(markdown: string) {
  const blocks: TutorAgentResponseBlock[] = [
    {
      markdown,
      type: 'message',
    },
  ];

  return detectMessageTaskLeakage(blocks).map((issue) => issue.kind);
}

describe('message task leakage detection', () => {
  it('flags fill-in-the-blank placeholders inside message blocks', () => {
    expect(
      detectFromMessage('Completa la oración: I ___ coffee every morning.'),
    ).toContain('blank_placeholder');
  });

  it('flags evaluable multiple-choice prompts inside message blocks', () => {
    expect(
      detectFromMessage('Elige la opción correcta: a) go b) goes c) going'),
    ).toContain('multiple_choice_prompt');
  });

  it('flags inline sentence_evaluation-shaped JSON inside message blocks', () => {
    expect(
      detectFromMessage(
        'Revisemos esta parte: {"parts":[{"text":"has","status":"error","explanation":"Usa have."}]}',
      ),
    ).toContain('inline_evaluation_json');
  });

  it('flags open-ended writing prompts inside message blocks', () => {
    expect(
      detectFromMessage('Por favor, escribe una oración usando in para hablar de un lugar cerrado.'),
    ).toContain('open_text_prompt');
  });

  it('flags polite infinitive writing prompts inside message blocks', () => {
    expect(
      detectFromMessage(
        'Ahora, para completar nuestro paso de producción guiada, ¿podrías escribir una oración usando for para indicar una duración?',
      ),
    ).toContain('open_text_prompt');
  });

  it('flags correction-analysis prompts with numbered sentence lists inside message blocks', () => {
    expect(
      detectFromMessage(
        'Aquí tienes un nuevo grupo de oraciones. ¿Podrías decirme cuál es el error en cada una y cómo las corregirías?\n\n1. I have been waiting for the bus in 30 minutes.\n2. The project was completed in my boss.\n3. We are going to meet for 9:00 AM.',
      ),
    ).toContain('open_text_prompt');
  });

  it('does not flag optional navigation lists without answer keys', () => {
    expect(
      detectFromMessage(
        'Podemos seguir así:\n\na) Practicar vocabulario\nb) Hacer una mini conversación\nc) Revisar una frase tuya',
      ),
    ).toEqual([]);
  });
});

describe('multi-exercise batch detection', () => {
  const messageBlock: TutorAgentResponseBlock = {
    markdown: 'Vamos a practicar el presente simple.',
    type: 'message',
  };
  const multipleChoiceBlock: TutorAgentResponseBlock = {
    options: [
      { isCorrect: true, text: 'goes' },
      { isCorrect: false, text: 'go' },
    ],
    question: 'She ___ to school every day.',
    selectionMode: 'single',
    type: 'multiple_choice',
  };
  const openTextBlock: TutorAgentResponseBlock = {
    prompt: 'Write a sentence about your morning routine.',
    type: 'open_text_prompt',
  };
  const unscrambleBlock: TutorAgentResponseBlock = {
    tokens: ['every', 'she', 'day', 'runs'],
    type: 'unscramble_sentence',
  };
  const quizBlock: TutorAgentResponseBlock = {
    items: [
      { kind: 'quiz_open_text', prompt: 'Describe your weekend.' },
      { kind: 'quiz_open_text', prompt: 'Describe your job.' },
    ],
    prompt: 'Answer both questions.',
    type: 'quiz',
  };

  it('flags every exercise block beyond the first', () => {
    const issues = detectMultiExerciseBatch([
      messageBlock,
      multipleChoiceBlock,
      openTextBlock,
      unscrambleBlock,
    ]);

    expect(issues.map((issue) => issue.kind)).toEqual([
      'multi_exercise_batch',
      'multi_exercise_batch',
    ]);
    expect(issues.map((issue) => issue.blockIndex)).toEqual([2, 3]);
    expect(issues[0].expectedBlockTypes).toEqual(['quiz']);
  });

  it('flags two quiz blocks in one response', () => {
    expect(
      detectMultiExerciseBatch([messageBlock, quizBlock, quizBlock]).map(
        (issue) => issue.kind,
      ),
    ).toEqual(['multi_exercise_batch']);
  });

  it('does not flag a single exercise accompanied by feedback blocks', () => {
    const blocks: TutorAgentResponseBlock[] = [
      messageBlock,
      {
        parts: [
          { status: 'correct', text: 'She goes' },
          { explanation: 'Use "to school".', status: 'error', text: 'at school' },
        ],
        sourceText: 'She goes at school.',
        type: 'sentence_evaluation',
      },
      multipleChoiceBlock,
    ];

    expect(detectMultiExerciseBatch(blocks)).toEqual([]);
  });

  it('counts a dialogue character turn as an exercise block', () => {
    const dialogueBlock: TutorAgentResponseBlock = {
      markdown: 'Hi! Welcome to the cafe. What would you like?',
      name: 'Ana',
      type: 'dialogue_character_message',
    };

    expect(
      detectMultiExerciseBatch([messageBlock, dialogueBlock, multipleChoiceBlock]).map(
        (issue) => issue.blockIndex,
      ),
    ).toEqual([2]);
    expect(
      detectMultiExerciseBatch([messageBlock, dialogueBlock, dialogueBlock]).map(
        (issue) => issue.kind,
      ),
    ).toEqual(['multi_exercise_batch']);
    expect(detectMultiExerciseBatch([messageBlock, dialogueBlock])).toEqual([]);
  });

  it('does not flag one quiz block with multiple items', () => {
    expect(detectMultiExerciseBatch([messageBlock, quizBlock])).toEqual([]);
  });

  it('does not flag responses with no exercise blocks', () => {
    expect(detectMultiExerciseBatch([messageBlock])).toEqual([]);
  });
});
