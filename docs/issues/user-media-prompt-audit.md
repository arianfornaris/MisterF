# User Media Generation Prompt Audit

Date: 2026-07-12

Status: **Implemented 2026-07-13 (commit `b87c2a45`).** All findings below (P0–P3)
were applied to the user-generation path: `sceneMediaScripts.ts` (gender in the
schema/prompt, complexity-based levels, narrative/TTS rules, no-description-phrase
validation), `audioGeneration.ts` (gender-keyed voices), and the revision
template. Human review of generated output against these rules is still valuable.

Update 2026-07-14: the legacy media revision chat, its service, and its prompts
were removed after layer-specific preview flows replaced it. References to
`sceneMediaRevisions.ts` below describe the historical implementation audited
at the time.

Update 2026-07-14: the follow-up full-surface review is complete. Image
generation now enforces scene-only output with a narrow in-world-signage
exception; source context is explicitly untrusted and layer-aware; image edits
receive kept script continuity; title generation has its own typed contract;
and CI structurally checks prompt types against Zod plus built-in/design data.

Roadmap: [V3, Scene Media Library](../roadmap/roadmap-v3.md#12-scene-media-library)

## Scope

What drives user media creation/editing today:

- `src/server/services/sceneMediaScripts.ts` — the script + metadata **system
  prompt** and JSON schema (`buildSceneMediaScriptSystemPrompt`,
  `buildSceneMediaScriptUserPrompt`, `sceneMediaScriptGenerationSchema`).
- `src/server/sceneMedia/audioGeneration.ts` — **voice assignment** and TTS.
- `src/server/services/sceneMediaRevisions.ts` — historical revision/authoring
  chat removed 2026-07-14 (it produced a *plan*, then regenerated through the
  same generator).
- `src/server/sceneMedia/creation.ts` — orchestration (image → metadata/script →
  audio). The image is generated first and **passed to the script generator as
  `imageBytes`**, so the model already sees the picture when it writes the script.

Reference quality bar (curated built-in library):

- `design/scene-scripts/README.md` — "Script & Audio Quality Requirements" P1–P7.
- `design/scene-scripts/script-levels.md` — CEFR complexity bands.

The built-in guidelines are rich and battle-tested (they drove the July 2026
gender/identity audit). The app prompt is a thin subset and reproduces, by
construction, the exact class of bug the built-in library just fixed.

## Findings (by priority)

### P0 — Voice assignment is gender-blind (reproduces the bug we just fixed)

`audioGeneration.ts` assigns voices by **speaker order**, not gender:

```js
const dialogueVoices = ['Kore', 'Puck', 'Aoede']; // F, M, F
// first distinct speaker -> Kore (female), second -> Puck (male), third -> Aoede (female)
const singleVoice = 'Kore'; // monologue/narration always female
```

- A dialogue between two men becomes Kore (female) + Puck (male). A single-speaker
  monologue is always female. This is precisely README **P7**'s failure mode
  ("the store clerk shown is a man, but the clerk turns used the Kore voice";
  "assigned a female-presenting voice" to a male child).
- The generation schema (`sceneMediaScriptSchema`) has **no gender field**, so the
  model cannot express the intended gender even though it sees the image, and
  nothing maps character → gender → voice.
- The built-in library now carries an explicit `gender` on every speaker; the user
  path has no equivalent, so user media cannot reach the same quality bar.

**Recommended fix (closes the loop end-to-end):**

1. Add `gender: 'female' | 'male' | 'neutral'` to each dialogue speaker (and a
   character gender for monologue/narration) in `sceneMediaScriptSchema` and the
   prompt's JSON shape. Reuse the runtime `SceneMediaSpeakerGender` type.
2. Add a system-prompt rule: *"Inspect the image and assign each speaker the
   gender of the person who performs that role; the audio voice will follow it."*
3. In `audioGeneration.ts`, pick the voice from a **gender-keyed pool**
   (female: Kore/Aoede/Leda; male: Puck/Charon/Fenrir) instead of round-robin by
   order, keeping one stable voice per character.

### P1 — No guard against mixing narration into spoken turns

The discriminated union (`dialogue | monologue | narration`) structurally prevents
a "mixed" *type*, which is good. But nothing stops narration-style content **inside**
a turn (e.g. a dialogue turn `"He opens the door and says hello"`, or meta lines
like `"this image shows…"`). The built-in pipeline forbids this (README **P2**,
enforced offline by `validate_no_description_phrases`); the app has **no equivalent
rule in the prompt and no validation**.

**Recommended fix:** add prompt rules — dialogue turns contain only spoken words
(no stage directions / third-person description); never say "this image shows",
"the listener can", "the learner can", "this wordless story". Optionally add a
lightweight server-side check mirroring `validate_no_description_phrases`.

### P1 — Level guidance is duration-based, not complexity-based

The user prompt levels are audio-duration targets ("about 20–45 seconds"), but
`script-levels.md` is explicit: **"Level is defined by linguistic complexity, not
word count,"** with per-band grammar, vocabulary, connectors, and the key
listening-load rule (*"listening load is higher than reading load — prefer shorter
sentences parseable in a single pass by ear"*). None of that nuance reaches the app.

**Recommended fix:** replace the duration hints with the `script-levels.md` bands
(grammar/vocab/connectors per level + the listening-load rule).

### P2 — Missing narrative-quality and identity specifics (README P1/P3)

Present and good: the identity-strategy rules (`named_in_dialogue` / `role_only` /
`nameSpokenInAudio`) and a version of the **answerability rule** are ported.

Missing:
- "Name each character aloud in the **first one or two turns**" (P1 specifics).
- **Cast size scales by level**: two speakers for A1-A2, at most three higher up.
  The prompt says "at most three" always, not level-scaled.
- "Each script stands alone with a clear arc: setup, complication, action,
  resolution" (P3).

### P2 — No TTS-safe text guidance (README P5)

Nothing tells the model to keep text TTS-safe (spell out abbreviations/numbers so
names like "Mr. James", times, and figures are pronounced correctly). User scripts
can produce audio the learner mishears.

### P3 — Schema edge cases

- Dialogue `speakers` is `min(1)` — a one-speaker "dialogue" validates, contradicting
  the definition ("two or more in-scene speakers"). Consider `min(2)` for dialogue.
- Turn text cap is 320 chars and dialogue is 2–8 turns; fine, but revisit against the
  level word-count bands once level guidance is complexity-based.

### P3 — Revision path inherits every gap

`sceneMediaRevisions.ts` only produces a plan (keep/generate image, script type,
level) and then regenerates through the same generator, so all P0–P2 gaps apply to
edits too. There is no separate lever for voice/gender/style in the revision chat
(tracked separately by the "authoring control over audio voice and delivery style"
roadmap item).

## Priority Summary

| # | Finding | File | Priority |
| --- | --- | --- | --- |
| 1 | Voice assignment ignores gender; no gender field | `audioGeneration.ts`, `sceneMediaScripts.ts` | **P0** |
| 2 | No guard against narration/meta text inside turns | `sceneMediaScripts.ts` | P1 |
| 3 | Level guidance is duration-based, not complexity-based | `sceneMediaScripts.ts` | P1 |
| 4 | Missing name-aloud-early, level-scaled cast, story-arc rules | `sceneMediaScripts.ts` | P2 |
| 5 | No TTS-safe text guidance | `sceneMediaScripts.ts` | P2 |
| 6 | `dialogue` allows a single speaker | `sceneMediaScripts.ts` | P3 |
| 7 | Revision path inherits all gaps | `sceneMediaRevisions.ts` | P3 |

## Suggested Sequencing

1. **P0 gender end-to-end** — highest value, closes the loop with the metadata work
   already shipped, and is self-contained (schema + prompt rule + voice pool).
2. **P1 prompt hardening** — no-narration-in-turns rule + complexity-based levels.
3. **P2 narrative/identity/TTS specifics** — port the remaining README P1/P3/P5 rules.
4. **P3 schema tightening + revision parity.**

A natural home for the shared rules is a single prompt fragment distilled from
`README.md` P1–P7 and `script-levels.md`, referenced by both the generation and
revision system prompts so the two never drift.
