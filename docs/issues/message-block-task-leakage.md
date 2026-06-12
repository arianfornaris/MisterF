# Message Block Task Leakage

This document records an observed tutor-output problem: the model sometimes
places the actual learner task inside a `message` block instead of using the
specific structured block intended for that task.

The issue is not that `message` is never allowed to introduce an exercise.
`message` may frame, encourage, explain, or transition. The problem happens
when the `message` contains the learner-facing payload that should belong to a
typed block such as `fill_in_the_blank_input`, `translate_to_english_prompt`,
`multiple_choice`, `matching_pairs`, or `unscramble_sentence`.

## Source

The patterns below were found by inspecting recent PM2 logs:

- `/Users/arian/.pm2/logs/misterf-web-out-0.log`

The analysis parsed `593` logged `[Mr. F LLM response]` objects and inspected
their `message` blocks for task-like content.

## Main Pattern

The tutor often uses `message` as a universal pedagogical container:

```text
feedback + explanation + next learner task
```

That is natural prose, but it breaks the UI contract when the next learner task
should be interactive or semantically typed.

Correct structure:

```text
message: feedback, explanation, transition
typed block: the actual learner task
```

Incorrect structure:

```text
message: feedback, explanation, and the actual learner task
```

## Real Log Examples

### Fill-In-The-Blank Hidden In Message

Observed:

```text
¡Ah, claro! Disculpa si no fui lo suficientemente claro. La palabra que buscamos es "specific". Ahora, intentemos con esta frase. Recuerda que estamos corrigiendo textos técnicos, así que la precisión es clave. Completa la frase con la palabra correcta. Presta atención a la ortografía y al contexto: "The engineer provided ______ instructions for assembling the device."
```

Why it is a problem:

- The sentence contains a visible blank.
- The task asks the learner to complete the sentence.
- This should be represented as `fill_in_the_blank_input`, not just prose.

Observed:

```text
¡Claro que sí! Sigamos practicando. Aquí tienes otra frase para completar: "Many people are learning to code ___." ¿Qué expresión usarías para referirte a "estos días" en plural? Escríbela y la revisamos.
```

Observed:

```text
¡Casi! "Spot" significa "lugar" o "mancha". Como estamos hablando del pasado, el verbo "spit" (escupir) cambia a **"spat"**. Inténtalo de nuevo: "the cat ______ my dog."
```

Observed:

```text
Vamos con el **primer detalle importante** (gramática): En tu frase escribiste: **“I feel that someone is giving me an advice.”** En inglés, **advice** no lleva “an”. Lo correcto es **“advice” sin artículo**, y normalmente usamos **give advice**. Reescribe SOLO esta oración, en inglés, de forma correcta: **I feel that someone is giving me ____ advice.** (Usa la misma idea, pero arregla la parte de “an advice”.)
```

### Translation Prompt Hidden In Message

Observed:

```text
Vamos con otra para seguir practicando. Traduce al inglés: "Ellos no han terminado el trabajo."
```

Why it is a problem:

- The quoted Spanish sentence is the actual learner task.
- This should be `translate_to_english_prompt`.

Observed:

```text
¡Excelente! Has dado en el clavo. "It is perfect for cooking on the grill" suena muy profesional. También podrías decir simplemente "It's perfect for grilling", pero tu opción es totalmente correcta. Vamos con otra situación común. ¿Cómo le preguntarías a tu cliente si desea algo más? Traduce al inglés: "¿Desea algo más?"
```

Observed:

```text
¡Muy bien! Esa frase es perfecta, suena muy profesional. Ahora, para la parte de la música, ¿cómo le preguntarías al pasajero: "¿Te gustaría escuchar algo diferente?"? Traduce al inglés: "¿Te gustaría escuchar algo diferente?"
```

Observed:

```text
¡Excelente! Lo has resuelto perfectamente a la primera. Esos dos *idioms* son muy distintos en su uso: uno describe la dificultad de una tarea (*a piece of cake*) y el otro la frecuencia de un evento (*once in a blue moon*). Tener esa distinción clara es un gran paso. Como me pediste que probáramos todo tipo de ejercicios, ahora vamos a pasar a una traducción para ver cómo los integras en tu propio discurso. Traduce la siguiente frase al inglés:
```

### Half-Split: Correct Block Exists, But Task Also Leaks Into Message

This is a distinct subtype. The model sometimes emits the correct typed block
but also duplicates the learner-facing task inside the `message`.

Observed:

```text
¡Perfecto! Así es, "People vote in the elections." ¡Excelente corrección! Ahora que sabemos cómo se eligen los representantes, es importante hablar de la base de todas las leyes en Estados Unidos: la **Constitution** (Constitución). Es el documento que establece cómo funciona el gobierno y garantiza los derechos de los ciudadanos. Aquí tienes una frase para practicar: Traduce al inglés: "La Constitución es la ley suprema del país."
```

In the same response, the expected `translate_to_english_prompt` block was also
present.

Why it is a problem:

- The structured block exists, but `message` still contains the task payload.
- The UI may show duplicated or confusing instructions.
- The model is not respecting block separation even though it selected the right
  block type.

Observed:

```text
¡Ah, claro! Disculpa si no fui lo suficientemente claro. La palabra que buscamos es "specific". Ahora, intentemos con esta frase. Recuerda que estamos corrigiendo textos técnicos, así que la precisión es clave. Completa la frase con la palabra correcta. Presta atención a la ortografía y al contexto: "The engineer provided ______ instructions for assembling the device."
```

In the same response, a `fill_in_the_blank_input` block was also present.

Observed:

```text
¡Excelente! Lo has hecho a la primera. Esa expresión es muy idiomática y, como bien has demostrado, se usa exactamente así. ¿Quieres probar con una un poco más larga? Esta se usa cuando algo ocurre muy rara vez: "once in a blue moon". Ordena las palabras para decir que algo ocurre muy rara vez:
```

In the same response, an `unscramble_sentence` block was also present.

### Bracketed Error Markup

Observed:

```text
¡Excelente! Ahora esa frase suena mucho más natural. Sigamos con la última parte de tu relato. Aquí tienes las palabras que necesitan corrección ortográfica en inglés: 1. **huracans** -> *hurricanes* 2. **taugh** -> *tough* 3. **bigest** -> *biggest* 4. **Tahino** -> *Taíno* 5. **Caribe** -> *Caribbean* ¿Podrías reescribir la oración completa usando estas correcciones? *When I dance, I forget all the wild animals, all the poisoned fruits, all the [huracans], all these [taugh] life I have as the leader of the [bigest] [Tahino] community in the [Caribe].*
```

Why it is a problem:

- The model uses bracketed text as improvised visual correction markup.
- This competes with `sentence_evaluation`, whose job is to mark text parts as
  correct, improvable, or wrong.
- It also risks teaching the learner an unnatural target sentence with
  artificial markup embedded in it.

Not every bracket is automatically bad. For example, `[Nombre]` or `[Destino]`
may be a placeholder in a natural example. The risky pattern is bracketed text
used to mark the learner's actual errors inside a sentence under review.

### Inline Evaluation JSON

Observed:

```text
Tu último mensaje, por partes:
{"parts":[{"text":"When I dance","status":"correct","explanation":"..."}]}
```

Why it is a problem:

- The message contains an object that looks like a structured
  `sentence_evaluation` payload.
- The JSON is learner-visible noise instead of UI state.
- The tutor should emit `sentence_evaluation` when it wants the client to render
  reviewed text by parts.

## Lower-Confidence Pattern: Lettered Options

The model often uses lettered lists:

```text
a) Practicar frases usando estos verbos.
b) Probar con otros verbos irregulares un poco más difíciles.
c) Hacer una mini conversación donde usemos estos verbos en pasado.
```

This used to be ambiguous because navigation choices could appear as plain
lettered lists in `message`.

Risk:

- If `a)`, `b)`, `c)` represent answer options to an evaluable question, the
  correct block is usually `multiple_choice`.
- If they are navigation choices with no hidden correct answer, the correct
  block is now `direction_choice`.

Therefore, lettered options alone are not a reliable violation detector.

## Candidate Detection Signals

High-confidence signals inside a `message` block:

- `___`, `____`, or `{{blank}}`
- `Traduce al inglés: "..."`
- `Traduce la siguiente frase al inglés:`
- `Ordena las palabras...`
- `Reordena las palabras...`
- `Une cada...`
- `Relaciona...`
- bracketed learner-error tokens such as `[huracans]`, `[taugh]`, `[bigest]`
- JSON-like snippets with keys such as `"parts"`, `"text"`, `"status"`, and
  `"explanation"` inside `message`

Medium-confidence signals:

- `Completa la frase...`
- `Completa el espacio...`
- `Elige la opción correcta...`
- `Selecciona la respuesta correcta...`

Low-confidence signals:

- `a)`, `b)`, `c)` lists
- ordinary examples containing placeholders like `[Nombre]`
- explanatory numbered lists

## Implemented Runtime Fix

The server now runs a dedicated repair pass after the tutor response has passed
the normal schema validation and before blocks are returned to the client.

Implementation files:

- `misterf-web/src/server/services/llmTutor/blockRepair.ts`
- `misterf-web/system-prompts/tutor/block-repair.md`
- `misterf-web/system-prompts/tutor/blocks/*.md`

The detector only flags high-confidence task leakage inside `message`, including
raw JSON/pseudo-block evaluation payloads. It does not rewrite blocks in code
and it does not run in the client. When leakage is found, the server sends the
current response blocks plus the shared block protocol to a small repair prompt.
The repair prompt returns the complete `TutorResponse` again, with prose and
typed task payloads separated.

This keeps the tutor model responsible for structured output while avoiding a
client-side heuristic rewrite layer.
