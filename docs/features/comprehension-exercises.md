# Ejercicios de comprensión: estímulo + preguntas

Status: proposal (not implemented), 2026-07-04. Planned for V2
([Roadmap V2](../roadmap/roadmap-v2.md), section 1.2).

La idea es que el usuario reciba un estímulo — un texto, un audio o una
imagen — y a partir de ahí responda preguntas de comprensión. Aunque parecen
tres features distintas (reading, listening, visual comprehension), las tres
comparten la misma estructura pedagógica, y conviene diseñarlas como un solo
concepto reutilizable.

## Principio central

Un ejercicio de comprensión es siempre **un estímulo más preguntas atadas a
ese estímulo**. Hoy Mr. F puede emitir un pasaje en un bloque `message` y
luego un `multiple_choice`, pero nada ata las preguntas al pasaje, y la regla
de "un solo bloque de ejercicio por respuesta" limita a una pregunta por
turno.

La propuesta es introducir el concepto de estímulo en el protocolo de bloques
y reutilizar la maquinaria de preguntas que ya existe:

- Los item kinds de `quiz` (`quiz_multiple_choice`, `quiz_open_text`, etc.)
  sirven como preguntas de comprensión sin cambios.
- El flujo de evaluación y persistencia de `quiz_result` sirve como pipeline
  de resultados sin cambios.
- El render agrupa estímulo y preguntas en una sola card, de modo que la
  conversación no se fragmenta.

Dos formas posibles de modelarlo (a decidir en diseño detallado):

1. Un campo opcional `stimulus` dentro del bloque `quiz` existente, con
   `kind: reading | listening | image`.
2. Bloques de estímulo dedicados (`reading_passage`, `listening_prompt`,
   `image_prompt`) que contienen sus preguntas embebidas.

La opción 1 reutiliza más y evita multiplicar tipos de bloque demasiado
pronto, siguiendo el mismo criterio que se aplicó con `open_text_prompt` en
[Writing Practice Ideas](./writing-practice-ideas.md).

## Fase 1: texto (reading comprehension)

La más barata: es puro trabajo de protocolo de bloques + UI, sin
infraestructura nueva. Sirve para validar el patrón estímulo + preguntas
antes de invertir en audio o imágenes.

- El LLM genera un pasaje corto al nivel del alumno (los niveles CEFR
  estandarizados ayudarían aquí; ver la idea de niveles en el inbox).
- El pasaje se renderiza como card destacada; las preguntas debajo, dentro
  de la misma card.
- El resultado entra al pipeline de `quiz_result` y tributa al progreso del
  perfil como cualquier quiz.

Variantes pedagógicas sobre el mismo bloque: idea principal, detalle
específico, inferencia, vocabulario en contexto, ordenar los eventos del
texto.

## Fase 2: audio (listening comprehension)

Decisión tomada: **TTS de calidad generado server-side**, no la voz del
navegador (`speechSynthesis`). La voz del navegador es gratuita pero varía
demasiado entre dispositivos para evaluar listening de forma consistente.

Diseño propuesto:

- El LLM genera un **transcript** (monólogo o diálogo corto al nivel del
  alumno) dentro del bloque de estímulo.
- El servidor convierte el transcript a audio con un proveedor de TTS
  (OpenAI TTS o similar) y lo cachea en almacenamiento de objetos
  (DigitalOcean Spaces encaja con el deploy actual). El cliente recibe una
  URL de audio, nunca genera voz localmente.
- Para diálogos de dos personajes se necesitan dos voces distintas y
  concatenación de segmentos.

UX de listening:

- Reproductor sin transcript visible.
- Botón de replay, posiblemente limitado (2-3 escuchas) para que la métrica
  de comprensión signifique algo.
- Control de velocidad 0.75x como ayuda.
- **Revelar el transcript después de responder**, como momento pedagógico.

Anti-trampa pragmático: el transcript viaja dentro del bloque de todas
formas; para el MVP basta con no renderizarlo hasta que el usuario responda.

Costos y operación:

- El TTS tiene costo por carácter; el caché por hash del transcript evita
  regenerar audio idéntico.
- Debe entrar al mismo esquema de guardarraíles de crédito que las demás
  llamadas LLM (ver el doc de guardarraíles V1 en `issues/completed/`).

Esta fase también abre la puerta a la idea más general de voz-a-texto y
texto-a-voz del inbox (leer en voz alta cualquier bloque, dictado, etc.),
pero ese alcance queda fuera de este doc.

## Fase 3: imágenes (visual comprehension)

La más cara y la última. Generar imágenes on-demand por pregunta es lento,
caro y de calidad impredecible. La alternativa sana es convertir el problema
de generación en un problema de **selección**:

- **Biblioteca curada de assets con metadata**: escenas pre-generadas en
  lote (o de banco de imágenes; el inbox menciona Pixabay API como opción
  gratuita), cada una con una descripción rica de su contenido.
- El tutor elige una imagen por su metadata y genera preguntas sobre esa
  descripción: "What is the man holding?", "Choose the sentence that
  describes the picture".
- Ya existe precedente de biblioteca de assets curada en
  [Roleplay Character Assets](./roleplay-character-assets.md).

Este mismo estímulo de imagen puede alimentar ejercicios de producción
escrita (picture prompt, historia sobre un cómic), pero eso pertenece a
[Writing Practice Ideas](./writing-practice-ideas.md); aquí el foco es
comprensión con preguntas cerradas o semi-cerradas.

## Orden recomendado

1. **Texto**: valida el patrón estímulo + preguntas sin infraestructura
   nueva.
2. **Audio**: reutiliza el patrón; añade la capa TTS + caché de audio.
3. **Imágenes**: reutiliza el patrón; añade la biblioteca curada.

## Conexión con el resto del sistema

- Los resultados deben tributar al progreso global del perfil igual que los
  quizzes actuales.
- Estos ejercicios son buenos candidatos para las cards de sugerencias de la
  home ("Practice listening", "Read a short story") cuando exista ese
  sistema.
- Los quizzes de profesores (Teacher-Assigned Practice) podrían incluir
  secciones de listening/reading una vez que el bloque exista en el
  protocolo.
