import { languages } from '../i18n/index.js';
export function pickInitialGreeting(locale = 'es') {
    const greetings = languages[locale].greetings.initial;
    return greetings[Math.floor(Math.random() * greetings.length)];
}
export function pickKnownVisitorGreeting(locale = 'es') {
    const greetings = languages[locale].greetings.knownVisitor;
    return greetings[Math.floor(Math.random() * greetings.length)];
}
//# sourceMappingURL=initialGreetings.js.map