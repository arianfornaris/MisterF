import { languages, type Locale } from '../i18n/index.js';

export function pickInitialGreeting(locale: Locale = 'es'): string {
  const greetings = languages[locale].greetings.initial;
  return greetings[Math.floor(Math.random() * greetings.length)];
}

export function pickKnownVisitorGreeting(locale: Locale = 'es'): string {
  const greetings = languages[locale].greetings.knownVisitor;
  return greetings[Math.floor(Math.random() * greetings.length)];
}
