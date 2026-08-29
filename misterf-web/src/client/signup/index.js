import {
  answerBrowserChallenge,
  watchForHumanInteraction,
} from './browserChallenge.js';

const form = document.querySelector('[data-signup-form]');
if (form) {
  watchForHumanInteraction(form);
  answerBrowserChallenge(form, globalThis.crypto);
}
