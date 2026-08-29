/**
 * Proves to the signup handler that a real browser rendered and filled the
 * form. See `src/server/auth/signupBotTrap.ts` for why this is a plain hash
 * and not proof of work: the attacker registers about once an hour, so
 * imposing CPU on it buys nothing, while the tuning proof of work would need
 * on budget Android hardware would cost us plenty.
 *
 * Both signals are cheap enough to be invisible on any phone.
 */

/**
 * The events that count as "a person touched this form".
 *
 * This is a union on purpose, and `keydown` alone would be a bug: on a phone
 * someone can fill every field from the password manager and tap submit
 * without ever producing a key event, and iOS Safari's autofill fires `input`
 * without `keydown`. Touch and pointer events are what actually arrive on
 * mobile, so they lead. Do not narrow this list.
 */
export const humanInteractionEvents = [
  'pointerdown',
  'touchstart',
  'input',
  'keydown',
];

/**
 * Answers the challenge by hashing the form stamp the server already signed.
 *
 * Runs at load rather than on submit: the digest of a short string finishes in
 * well under a millisecond, so it is long settled by the time anyone has
 * filled four fields, and doing it here keeps the submit path synchronous.
 */
export async function answerBrowserChallenge(signupForm, cryptoApi) {
  const stampField = signupForm.querySelector('input[name="signupFormStamp"]');
  const answerField = signupForm.querySelector('input[name="signupBrowserAnswer"]');
  if (!stampField?.value || !answerField) {
    return;
  }

  // Web Crypto needs a secure context. Production is HTTPS and localhost
  // counts as secure, so a real browser lacks this only in setups we do not
  // serve — leaving the field empty is the correct answer there, and the
  // server records it rather than rejecting while the check reports only.
  if (!cryptoApi?.subtle) {
    return;
  }

  try {
    const digest = await cryptoApi.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(stampField.value),
    );
    answerField.value = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Same as above: an unanswered challenge is data for the server, not an
    // error worth showing someone who is trying to sign up.
  }
}

/** Records that a person, rather than a script, touched this form. */
export function watchForHumanInteraction(signupForm) {
  const interactionField = signupForm.querySelector('input[name="signupInteraction"]');
  if (!interactionField) {
    return;
  }

  const onFirstInteraction = () => {
    interactionField.value = '1';
    for (const eventName of humanInteractionEvents) {
      signupForm.removeEventListener(eventName, onFirstInteraction);
    }
  };

  for (const eventName of humanInteractionEvents) {
    signupForm.addEventListener(eventName, onFirstInteraction, { passive: true });
  }
}
