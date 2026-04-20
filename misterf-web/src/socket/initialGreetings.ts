const initialGreetings = [
  `¡Hola! ¡Qué gusto verte por aquí! Soy Mr. F, tu tutor de inglés personal, y estoy listo para que destrocemos el inglés juntos. Mi misión es que aprendas frases súper útiles para tu día a día, ¡así que prepárate para la acción!

Para empezar, cuéntame:

¿Sobre qué tema te gustaría que fueran las oraciones de hoy? Por ejemplo: viajes, comida, trabajo, vida diaria, hobbies, etc.
¿Qué nivel de dificultad prefieres? Principiante, intermedio o avanzado.

¡Espero tus respuestas para que arranquemos con la primera frase!`,

  `¡Bienvenido! Soy Mr. F, tu entrenador personal de frases en inglés. Hoy vamos a practicar con calma, pero con intención: una frase a la vez, corrigiendo lo importante y afinando tu oído.

Antes de empezar, dime dos cosas:

¿Qué tema quieres practicar hoy? Puede ser viajes, reuniones, restaurantes, familia, compras o cualquier situación real.
¿Qué nivel quieres usar? Principiante, intermedio o avanzado.

Cuando me respondas, te lanzo la primera oración.`,

  `¡Hola! Soy Mr. F. Vamos a convertir frases en español en inglés útil, natural y listo para usar. Yo te reto, tú escribes, y luego pulimos la respuesta juntos.

Para preparar la práctica, dime:

¿Qué tema te interesa hoy?
¿Qué dificultad prefieres: principiante, intermedio o avanzado?

Con eso empezamos de una vez.`,

  `¡Qué bueno tenerte aquí! Soy Mr. F, y hoy vamos a entrenar tu inglés escribiendo frases completas. Nada de teoría eterna: práctica, corrección y avance.

Cuéntame para arrancar:

¿Sobre qué tema quieres que sean las frases?
¿En qué nivel quieres practicar: principiante, intermedio o avanzado?

Te leo y preparo la primera frase.`,

  `¡Hola! Soy Mr. F, tu tutor de inglés. Mi trabajo es ponerte frases en español para que tú las escribas en inglés, y después ayudarte a corregirlas hasta que queden bien.

Antes del primer reto, dime:

¿Qué tema quieres practicar hoy?
¿Qué nivel prefieres?

Puede ser algo cotidiano, profesional, de viajes, comida, hobbies o lo que necesites.`,

  `¡Empezamos! Soy Mr. F, y hoy vamos a practicar inglés con frases que sí podrías usar en la vida real. Tú escribes la versión en inglés y yo te ayudo a mejorarla paso a paso.

Primero necesito saber:

¿Qué tema quieres trabajar?
¿Qué nivel de dificultad quieres: principiante, intermedio o avanzado?

En cuanto me digas eso, va la primera oración.`,

  `¡Hola! Listo para practicar. Soy Mr. F, tu compañero de entrenamiento en inglés. Vamos a trabajar con frases cortas, útiles y corregidas con cariño, pero sin dejar pasar los errores importantes.

Dime:

¿Qué tema te gustaría usar hoy?
¿Qué nivel quieres practicar?

Con tu respuesta preparo el primer desafío.`,

  `¡Bienvenido a la práctica! Soy Mr. F. La idea es simple: yo te doy una oración en español, tú la escribes en inglés, y juntos la dejamos sólida.

Para personalizar el ejercicio, dime:

¿Qué tema quieres hoy? Viajes, trabajo, comida, vida diaria, estudios, hobbies...
¿Qué dificultad prefieres? Principiante, intermedio o avanzado.

Cuando quieras, arrancamos.`,

  `¡Hola! Soy Mr. F. Hoy vamos a darle forma a tu inglés escrito con frases prácticas y feedback directo. No necesitas hacerlo perfecto a la primera: para eso estoy aquí.

Antes de empezar, responde:

¿Sobre qué tema quieres practicar?
¿Qué nivel te conviene hoy: principiante, intermedio o avanzado?

Te preparo la primera frase con eso.`,

  `¡Qué alegría verte por aquí! Soy Mr. F, tu tutor de inglés personal. Vamos a practicar frases útiles, corregir errores y hacer que tu inglés suene cada vez más natural.

Para comenzar, dime:

¿Qué tema quieres usar para las oraciones de hoy?
¿Qué nivel prefieres: principiante, intermedio o avanzado?

Espero tus respuestas y empezamos con la primera frase.`,
];

export function pickInitialGreeting(): string {
  const index = Math.floor(Math.random() * initialGreetings.length);
  return initialGreetings[index];
}
