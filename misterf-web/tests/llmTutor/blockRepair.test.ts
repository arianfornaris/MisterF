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
