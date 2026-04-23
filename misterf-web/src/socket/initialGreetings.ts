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

export function pickInitialGreeting(): string {
  const index = Math.floor(Math.random() * initialGreetings.length);
  return initialGreetings[index];
}
