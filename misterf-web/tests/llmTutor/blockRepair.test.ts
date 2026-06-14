import { describe, expect, it } from 'vitest';
import { detectMessageTaskLeakage } from '../../src/server/services/llmTutor/blockRepair.js';
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

  it('does not flag optional navigation lists without answer keys', () => {
    expect(
      detectFromMessage(
        'Podemos seguir así:\n\na) Practicar vocabulario\nb) Hacer una mini conversación\nc) Revisar una frase tuya',
      ),
    ).toEqual([]);
  });
});
