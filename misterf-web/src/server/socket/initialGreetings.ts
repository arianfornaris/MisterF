import type { Locale } from '../i18n/index.js';

const initialGreetings: Record<Locale, string[]> = {
  es: [
    `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar hoy?`,
    `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Qué tema te gustaría practicar hoy?`,
    `¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres trabajar hoy.`,
    `¡Qué bueno verte! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar?`,
    `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué parte quieres practicar hoy?`,
    `¡Empezamos! Soy Mr. F, tu tutor de inglés. ¿Qué te gustaría mejorar hoy?`,
    `¡Hola! Soy Mr. F, tu tutor de inglés. Dime qué quieres practicar y lo vamos armando juntos.`,
    `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Sobre qué tema quieres practicar?`,
    `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar: una situación, una duda o un tema?`,
    `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué necesitas practicar hoy?`,
  ],
  en: [
    `Hi! I'm Mr. F, your English tutor. What would you like to review today?`,
    `Welcome! I'm Mr. F, your English tutor. What topic would you like to practice today?`,
    `Hi! I'm Mr. F, your English tutor. Tell me what you'd like to work on today.`,
    `Great to see you! I'm Mr. F, your English tutor. What would you like to review?`,
    `Hi! I'm Mr. F, your English tutor. Which part would you like to practice today?`,
    `Let's get started! I'm Mr. F, your English tutor. What would you like to improve today?`,
    `Hi! I'm Mr. F, your English tutor. Tell me what you want to practice and we'll build it together.`,
    `Welcome! I'm Mr. F, your English tutor. What topic would you like to practice?`,
    `Hi! I'm Mr. F, your English tutor. What would you like to review: a situation, a question, or a topic?`,
    `Hi! I'm Mr. F, your English tutor. What do you need to practice today?`,
  ],
};

const knownVisitorGreetings: Record<Locale, string[]> = {
  es: [
    [
      '¡Hola de nuevo! Soy Mr. F, tu tutor para practicar inglés. Me alegra verte por aquí.',
      'Si ya tienes tu cuenta, puedes [iniciar sesión](/login) y seguimos con tu práctica.',
      'Si todavía no la has creado, también puedes [crear una cuenta](/signup).',
    ].join('\n\n'),
    [
      '¡Bienvenido otra vez! Soy Mr. F, y este espacio es para practicar inglés contigo. Qué gusto tenerte de vuelta.',
      'Si ya habías entrado antes, [inicia sesión](/login) y continuamos desde ahí.',
      'Si lo prefieres, también puedes [crear una cuenta](/signup).',
    ].join('\n\n'),
    [
      '¡Hola! Soy Mr. F, tu tutor de inglés. Creo que ya nos habíamos visto antes.',
      'Si ya tienes tu cuenta, [inicia sesión](/login) y retomamos la práctica.',
      'Y si todavía no, puedes [crear una cuenta](/signup) en un momento.',
    ].join('\n\n'),
    [
      '¡Qué bueno verte de nuevo! Soy Mr. F, y aquí puedes practicar inglés conmigo cuando quieras.',
      'Si ya tienes tu cuenta, [inicia sesión](/login) y seguimos trabajando juntos.',
      'Si aún no la tienes, puedes [crear una cuenta](/signup).',
    ].join('\n\n'),
    [
      '¡Hola otra vez! Soy Mr. F, tu tutor para practicar inglés. Cuando quieras, seguimos.',
      'Si ya tienes tu cuenta, [inicia sesión](/login) para continuar.',
      'Si todavía no, puedes [crear una cuenta](/signup).',
    ].join('\n\n'),
  ],
  en: [
    [
      'Hi again! I\'m Mr. F, your tutor for practicing English. Glad to see you here.',
      'If you already have an account, you can [log in](/login) and we\'ll continue your practice.',
      'If you haven\'t created one yet, you can also [create an account](/signup).',
    ].join('\n\n'),
    [
      'Welcome back! I\'m Mr. F, and this space is for practicing English with you. Great to have you back.',
      'If you\'ve been here before, [log in](/login) and we\'ll continue from there.',
      'If you prefer, you can also [create an account](/signup).',
    ].join('\n\n'),
    [
      'Hi! I\'m Mr. F, your English tutor. I think we\'ve met before.',
      'If you already have an account, [log in](/login) and we\'ll pick the practice back up.',
      'And if you don\'t yet, you can [create an account](/signup) in a moment.',
    ].join('\n\n'),
    [
      'Great to see you again! I\'m Mr. F, and here you can practice English with me whenever you want.',
      'If you already have an account, [log in](/login) and we\'ll keep working together.',
      'If you don\'t have one yet, you can [create an account](/signup).',
    ].join('\n\n'),
    [
      'Hi again! I\'m Mr. F, your tutor for practicing English. Whenever you\'re ready, we\'ll continue.',
      'If you already have an account, [log in](/login) to continue.',
      'If you don\'t yet, you can [create an account](/signup).',
    ].join('\n\n'),
  ],
};

export function pickInitialGreeting(locale: Locale = 'es'): string {
  const greetings = initialGreetings[locale];
  const index = Math.floor(Math.random() * greetings.length);
  return greetings[index];
}

export function pickKnownVisitorGreeting(locale: Locale = 'es'): string {
  const greetings = knownVisitorGreetings[locale];
  const index = Math.floor(Math.random() * greetings.length);
  return greetings[index];
}
