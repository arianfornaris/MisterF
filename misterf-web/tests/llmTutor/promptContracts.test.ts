import { describe, expect, it } from 'vitest';
import { renderTutorBlockProtocol } from '../../src/server/services/llmTutor/blockProtocol.js';
import { buildAgentSystemInstruction } from '../../src/server/services/llmTutor/prompt.js';

describe('tutor prompt contracts', () => {
  it('does not include removed block types in the tutor protocol', () => {
    const protocol = renderTutorBlockProtocol();

    expect(protocol).not.toContain('DirectionChoiceBlock');
    expect(protocol).not.toContain('direction_choice');
  });

  it('keeps quiz_result out of the normal tutor protocol', () => {
    const protocol = renderTutorBlockProtocol();

    expect(protocol).not.toContain('type: "quiz_result"');
    expect(protocol).not.toContain('QuizResultBlock');
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
});
