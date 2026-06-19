import { describe, expect, it, vi } from 'vitest';
import { CreditExhaustedError, getCreditExhaustedMessage } from '../../src/server/services/creditGate.js';
import {
  emitCreditExhaustedIfNeeded,
  emitRoomCreditExhaustedIfNeeded,
} from '../../src/server/socket/creditExhaustion.js';

describe('credit exhaustion UI events', () => {
  it('emits a socket credit exhaustion event for exhausted user credit', () => {
    const emit = vi.fn();

    const emitted = emitCreditExhaustedIfNeeded({ emit }, new CreditExhaustedError());

    expect(emitted).toBe(true);
    expect(emit).toHaveBeenCalledWith('llm:credit_exhausted', {
      message: getCreditExhaustedMessage(),
    });
  });

  it('does not emit a socket credit exhaustion event for unrelated errors', () => {
    const emit = vi.fn();

    const emitted = emitCreditExhaustedIfNeeded({ emit }, new Error('Provider failed.'));

    expect(emitted).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits room-scoped credit exhaustion events for assistant streams', () => {
    const roomEmit = vi.fn();
    const to = vi.fn(() => ({ emit: roomEmit }));

    const emitted = emitRoomCreditExhaustedIfNeeded(
      { to },
      'conversation-1',
      new CreditExhaustedError(),
    );

    expect(emitted).toBe(true);
    expect(to).toHaveBeenCalledWith('conversation-1');
    expect(roomEmit).toHaveBeenCalledWith('llm:credit_exhausted', {
      message: getCreditExhaustedMessage(),
    });
  });
});
