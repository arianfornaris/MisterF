const initialGreetings = [
  `¡Hola, soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar hoy?`,

  `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Qué tema te gustaría practicar hoy?`,

  `¡Hola! Soy Mr. F, tu tutor de inglés. Cuéntame qué quieres trabajar hoy.`,

  `¡Qué bueno verte! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar?`,

  `¡Hola, soy Mr. F, tu tutor de inglés. ¿Qué parte quieres practicar hoy?`,

  `¡Empezamos! Soy Mr. F, tu tutor de inglés. ¿Qué te gustaría mejorar hoy?`,

  `¡Hola! Soy Mr. F, tu tutor de inglés. Dime qué quieres practicar y lo vamos armando juntos.`,

  `¡Bienvenido! Soy Mr. F, tu tutor de inglés. ¿Sobre qué tema quieres practicar?`,

  `¡Hola! Soy Mr. F, tu tutor de inglés. ¿Qué quieres repasar: una situación, una duda o un tema?`,

  `¡Hola, soy Mr. F, tu tutor de inglés. ¿Qué necesitas practicar hoy?`,
];

const knownVisitorGreetings = [
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
];

export function pickInitialGreeting(): string {
  const index = Math.floor(Math.random() * initialGreetings.length);
  return initialGreetings[index];
}

export function pickKnownVisitorGreeting(): string {
  const index = Math.floor(Math.random() * knownVisitorGreetings.length);
  return knownVisitorGreetings[index];
}
