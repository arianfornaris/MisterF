import { describe, expect, it, vi } from 'vitest';
import {
  CreditExhaustedError,
  getCreditExhaustedMessage,
  isCreditExhaustedError,
} from '../../src/server/services/creditGate.js';
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

describe('isCreditExhaustedError', () => {
  it('recognizes OpenRouter refusing a request the key cannot afford', () => {
    // The key still holds some credit, but OpenRouter reserves the model's full
    // output window and refuses when the remaining limit cannot cover it. No
    // inference can run until the user adds credit, so the product state is the
    // same and the credits workflow must fire. Regression: this phrasing used to
    // fall through and surface as "Ocurrió un error inesperado".
    const error = new Error(
      'This request requires more credits, or fewer max_tokens. You requested up to '
      + '65536 tokens, but can only afford 29744. To increase, visit '
      + "https://openrouter.ai/keys and adjust the key's total limit",
    );

    expect(isCreditExhaustedError(error)).toBe(true);
  });

  it('still recognizes the classic exhaustion phrasings', () => {
    expect(isCreditExhaustedError(new CreditExhaustedError())).toBe(true);
    expect(isCreditExhaustedError(new Error('Insufficient credits'))).toBe(true);
    expect(isCreditExhaustedError(new Error('You are out of credits'))).toBe(true);
  });

  it('does not misclassify unrelated provider failures', () => {
    expect(isCreditExhaustedError(new Error('Request timed out'))).toBe(false);
    expect(isCreditExhaustedError(new Error('429 Too Many Requests'))).toBe(false);
    expect(isCreditExhaustedError(new Error('Invalid JSON from model'))).toBe(false);
  });
});
