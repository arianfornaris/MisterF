import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// The client bundle is plain browser JavaScript with no declarations, so this
// one import is untyped on purpose; the stub below pins the shape it expects.
// @ts-expect-error -- untyped browser module
import { answerBrowserChallenge, humanInteractionEvents, watchForHumanInteraction } from '../../src/client/signup/browserChallenge.js';
import { expectedBrowserAnswer } from '../../src/server/auth/signupBotTrap.js';

/**
 * Covers the client half of the signup browser checks against a minimal form
 * stub. The stub is deliberately hand-rolled rather than a DOM library: these
 * functions touch four methods in total, and naming them here documents the
 * whole browser surface the module depends on.
 */

type Listener = () => void;

function createFormStub(fields: Record<string, string>) {
  const values = { ...fields };
  const listeners = new Map<string, Set<Listener>>();

  return {
    listeners,
    values,
    addEventListener(eventName: string, listener: Listener) {
      const existing = listeners.get(eventName) ?? new Set<Listener>();
      existing.add(listener);
      listeners.set(eventName, existing);
    },
    removeEventListener(eventName: string, listener: Listener) {
      listeners.get(eventName)?.delete(listener);
    },
    querySelector(selector: string) {
      const name = selector.match(/name="([^"]+)"/)?.[1] ?? '';
      if (!(name in values)) {
        return null;
      }

      return {
        get value() {
          return values[name];
        },
        set value(next: string) {
          values[name] = next;
        },
      };
    },
    /** Fires one event name, as a browser would after it bubbled to the form. */
    fire(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener();
      }
    },
  };
}

describe('signup human-interaction signal', () => {
  /**
   * The regression this test exists for: narrowing the event list to keyboard
   * events would lock out every phone user who fills the form from a password
   * manager and taps submit without ever pressing a key.
   */
  it('watches touch and pointer events, not only the keyboard', () => {
    expect(humanInteractionEvents).toContain('pointerdown');
    expect(humanInteractionEvents).toContain('touchstart');
    expect(humanInteractionEvents).toContain('input');
    expect(humanInteractionEvents).toContain('keydown');
  });

  it.each(['pointerdown', 'touchstart', 'input', 'keydown'])(
    'marks the form as touched from %s alone',
    (eventName) => {
      const form = createFormStub({ signupInteraction: '' });
      watchForHumanInteraction(form);

      expect(form.values.signupInteraction).toBe('');
      form.fire(eventName);
      expect(form.values.signupInteraction).toBe('1');
    },
  );

  it('leaves the flag empty when nothing ever touches the form', () => {
    const form = createFormStub({ signupInteraction: '' });
    watchForHumanInteraction(form);

    expect(form.values.signupInteraction).toBe('');
  });

  it('stops listening after the first interaction', () => {
    const form = createFormStub({ signupInteraction: '' });
    watchForHumanInteraction(form);
    form.fire('pointerdown');

    for (const eventName of humanInteractionEvents) {
      expect(form.listeners.get(eventName)?.size ?? 0).toBe(0);
    }
  });
});

describe('signup browser challenge answer', () => {
  it('computes the answer the server expects from the stamp', async () => {
    const stamp = '1787985221127.abc-signature';
    const form = createFormStub({
      signupBrowserAnswer: '',
      signupFormStamp: stamp,
    });

    await answerBrowserChallenge(form, webcrypto);

    expect(form.values.signupBrowserAnswer).toBe(expectedBrowserAnswer(stamp));
  });

  /**
   * Without a secure context there is no `crypto.subtle`. An empty answer is
   * the correct outcome: the server records it while the check reports only.
   */
  it('leaves the answer empty when Web Crypto is unavailable', async () => {
    const form = createFormStub({
      signupBrowserAnswer: '',
      signupFormStamp: '1787985221127.abc-signature',
    });

    await answerBrowserChallenge(form, undefined);

    expect(form.values.signupBrowserAnswer).toBe('');
  });
});
