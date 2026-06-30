# Ideas para provocar escritura en ingles

El objetivo de estas ideas es darle al usuario razones naturales para escribir
en ingles, evaluar lo que produce y convertir sus errores en practica futura.
La meta no es solo corregir frases aisladas, sino construir evidencia real de
su nivel, vocabulario, confianza y dificultades recurrentes.

## Principio central

Mister F debe crear "pretextos" para escribir: situaciones donde el usuario
tenga algo que decir. Mientras mas personal, situacional o comunicativo sea el
prompt, mas util sera la escritura para evaluar progreso real.

Cada actividad deberia producir:

- Texto escrito por el usuario.
- Evaluacion pedagogica del texto.
- Dificultades y patrones de error.
- Vocabulario o frases a reforzar.
- Recomendaciones para practica futura.
- Opcionalmente, eventos compactos para el progreso global.

## Ideas de actividades

### Diario guiado

El usuario escribe unas pocas frases sobre su dia, un recuerdo, un plan o algo
que le preocupa. Mr. F puede dar prompts simples como:

- "Write three sentences about your day."
- "Tell me something you did yesterday."
- "Write about something you want to do this week."

Esta es probablemente la feature mas flexible para empezar. Genera texto
personal, frecuente y evaluable sin requerir una respuesta correcta unica.

### Prompts personales cortos

Preguntas abiertas que obligan al usuario a producir ingles propio:

- "Describe your favorite place."
- "What is something you are learning?"
- "What do you usually do on Sundays?"
- "Tell me about a person you admire."

Funcionan bien para evaluar tiempos verbales, orden de palabras, articulos,
preposiciones y vocabulario cotidiano.

### Situaciones reales

Quizzes de escritura con utilidad practica:

- Escribir un email corto.
- Pedir informacion.
- Enviar una invitacion.
- Disculparse.
- Escribir una queja educada.
- Responder un mensaje de trabajo.
- Crear una bio profesional.
- Escribir una reseña.

Estas actividades pueden tener rubricas segun tono, claridad, naturalidad y
precision gramatical.

### Roleplay asincronico

Una escena simple donde el sistema plantea una situacion y el usuario escribe
su respuesta. A diferencia de las salas de chat, no necesita varios personajes.

Ejemplos:

- "You are checking into a hotel. Write what you say to the receptionist."
- "A friend invites you to dinner, but you cannot go. Write your reply."
- "You are ordering coffee. Write your message."

Mr. F evalua la respuesta y puede continuar la escena o pedir una version
mejorada.

### Picture prompt

El sistema muestra una imagen y el usuario debe describirla, inferir que paso o
inventar una historia breve.

Este formato ayuda mucho con:

- Vocabulario visual.
- Presente continuo.
- Pasado narrativo.
- Descripcion de personas, lugares y acciones.
- Conectores simples.

### Reescribe mejor

El usuario escribe una primera version libre. Mr. F la corrige y luego pide una
segunda version mejorada. Esto entrena revision, no solo respuesta inmediata.

Flujo sugerido:

1. Usuario escribe.
2. Mr. F evalua errores y naturalidad.
3. Mr. F muestra una version modelo o pistas.
4. Usuario reescribe.
5. Mr. F compara ambas versiones.

### Opinion corta

Prompts tipo "Do you agree or disagree?" sobre temas cotidianos:

- "Is it better to work from home?"
- "Do you prefer mornings or nights?"
- "Should people learn a second language?"

Sirve para practicar conectores, razones, ejemplos y estructura basica de
argumentacion.

### Micro-historias

El sistema da tres palabras obligatorias y el usuario escribe una historia
corta.

Ejemplo:

- Palabras: "umbrella", "late", "coffee".
- Quiz: "Write a short story using these three words."

Es una forma ligera de provocar creatividad y escritura narrativa.

### Before / after

El sistema presenta una situacion y el usuario escribe que paso antes o despues.

Ejemplos:

- "You missed the bus. What happened before?"
- "Your phone battery died. What happened next?"

Es util para practicar pasado simple, secuencia de eventos y conectores como
"then", "after that", "because" y "so".

### Explain it simply

El usuario explica algo que conoce:

- Su trabajo.
- Un hobby.
- Una receta.
- Como usar una app.
- Como resolver un problema.

Esto produce lenguaje mas autentico porque el usuario escribe sobre conocimiento
propio.

## Evaluacion sugerida

Cada pieza de escritura puede evaluarse en varias dimensiones:

- Correccion gramatical.
- Claridad.
- Naturalidad.
- Vocabulario.
- Estructura.
- Adecuacion al contexto.
- Errores recurrentes.

No todas las actividades necesitan mostrar una evaluacion larga. Muchas veces
basta con:

- Dos o tres observaciones importantes.
- Una version corregida.
- Una explicacion breve del error principal.
- Un mini ejercicio de seguimiento.

## Bloque actual

Las actividades de escritura libre o semi-libre deben usar `open_text_prompt`
cuando el usuario necesita enviar una respuesta abierta dentro de la UI del
bloque. El bloque muestra un textarea, conserva la respuesta junto al prompt y
envia al modelo la estructura del bloque mas la respuesta del usuario.

`open_text_prompt` hace que el usuario produzca texto en ingles sin una unica
respuesta correcta, para luego evaluarlo y practicar en base a los errores
cometidos.

### Frontera con otros bloques

`open_text_prompt` no deberia reemplazar los bloques existentes. Debe usarse
solo cuando la quiz exige produccion escrita abierta.

Usar `translate_to_english_prompt` cuando:

- Hay una frase concreta en espanol.
- El usuario debe traducirla al ingles.
- Existe una expectativa clara de equivalencia.

Usar `fill_in_the_blank_input` cuando:

- El usuario completa una oracion ya dada.
- La respuesta esperada es una palabra o frase corta.
- La evaluacion depende del espacio en blanco.

Usar `quiz_open_text` cuando:

- La pregunta abierta forma parte de un quiz.
- La evaluacion se hace junto con el resto del quiz.
- El usuario esta en un flujo de examen o prueba multi-pregunta.

Usar `open_text_prompt` cuando:

- El usuario debe escribir un parrafo, email, diario, opinion, descripcion o
  mini-historia.
- No hay una sola respuesta correcta.
- Queremos evaluar claridad, naturalidad, estructura y errores recurrentes.
- Queremos que el texto alimente progreso global y practica futura.

La escritura ya no debe entrar como una respuesta normal del usuario cuando el
tutor esta proponiendo una quiz estructurada de produccion abierta. En ese caso
debe enviarse desde `open_text_prompt`. `sentence_evaluation` sigue siendo util
para corregir texto visible del usuario despues de que el modelo evalua la
respuesta.

### Razon para mantener un solo bloque

Aunque existan muchas variantes de escritura, conviene mantener un bloque
general para este tipo de produccion abierta.

Encima de ese bloque se pueden implementar distintos modos pedagogicos:

- Diario guiado.
- Opinion corta.
- Situacion real.
- Picture prompt.
- Micro-historia.
- Reescritura.

Esto evita multiplicar tipos de bloque demasiado pronto y mantiene simple el
contrato entre modelo, servidor y cliente.

## Conexion con progreso global

Estas actividades deberian tributar al progreso global del perfil.

Datos utiles para guardar:

- Tema de escritura.
- Tipo de actividad.
- Errores principales.
- Fortalezas observadas.
- Vocabulario a reforzar.
- Recomendaciones de practica.
- Extracto compacto para la bitacora.

El vocabulario merece tratamiento especial. Idealmente, pasaria de ser derivado
desde eventos a tener entidad propia, con estado como:

- `needs_practice`
- `practicing`
- `mastered`

## Prioridad recomendada

La primera feature que conviene implementar es una pantalla o flujo de diario
guiado con prompts de escritura.

Razones:

- Es simple de entender.
- Genera mucho texto evaluable.
- Puede usarse a diario.
- No requiere una respuesta correcta unica.
- Alimenta bien el progreso global.
- Puede producir ejercicios personalizados despues de cada entrada.

Una segunda feature fuerte seria `Situaciones reales`, porque conecta la
practica con necesidades concretas de comunicacion.
