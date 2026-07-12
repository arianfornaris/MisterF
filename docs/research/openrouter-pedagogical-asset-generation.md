# OpenRouter Asset Generation Research

Last researched: 2026-07-04.

This note evaluates low-cost OpenRouter-compatible models for generating pedagogical exercise assets:

- square or near-square images for activities, where 720x720 is usually enough;
- spoken dialogue audio generated from text for listening exercises.

The goal is not premium creative output. The goal is acceptable quality, predictable cost, and an API path that can be integrated into Mister F without adding another model provider.

## Executive Recommendation

Use a two-tier approach, with Gemini as the winner for learner-facing assets that require quality, clarity, or narrative control.

For images, use `google/gemini-3.1-flash-lite-image` as the recommended production model when the asset needs to communicate a situation, a sequence, or a small story. A local four-panel comic test showed Gemini followed the narrative much better than `black-forest-labs/flux.2-klein-4b`, maintained clearer character continuity, and produced a more useful writing prompt for students. Generate the closest supported square output, then downscale and compress to 720x720 WebP or JPEG before storing.

Keep `black-forest-labs/flux.2-klein-4b` available as the budget option for simple visual assets where narrative sequencing and strict prompt-following are less important. It has predictable per-megapixel pricing and is cheaper in the current OpenRouter test, but it was weaker for story-based pedagogical images.

For audio, use `google/gemini-3.1-flash-tts-preview` as the recommended production model for listening exercises. A local demo comparing it with `hexgrad/kokoro-82m` showed Gemini was much clearer, had better intonation, and sounded less robotic. Kokoro remains useful as the cheapest baseline or draft model, but Gemini's quality improvement is large enough that its higher cost is acceptable for learner-facing listening content.

Recommended first implementation:

1. Add a generation adapter that can call OpenRouter image and speech endpoints behind feature flags.
2. Use Gemini 3.1 Flash Lite Image for narrative, comic-style, or prompt-sensitive exercise images.
3. Use Gemini 3.1 Flash TTS Preview for final listening content.
4. Keep FLUX.2 Klein and Kokoro available for low-cost drafts, smoke tests, and fallback generation.

## OpenRouter API Surfaces

Images are generated through the dedicated Image API:

```http
POST https://openrouter.ai/api/v1/images
```

OpenRouter documents model discovery at:

```http
GET https://openrouter.ai/api/v1/images/models
GET https://openrouter.ai/api/v1/images/models/{model}/endpoints
```

Speech is generated through:

```http
POST https://openrouter.ai/api/v1/audio/speech
```

The TTS endpoint accepts `model`, `input`, `voice`, optional `response_format`, optional `speed`, and provider-specific passthrough options.

## Image Generation Options

### Budget Baseline: FLUX.2 Klein 4B

Model: `black-forest-labs/flux.2-klein-4b`

Why it fits:

- OpenRouter describes it as the fastest and most cost-effective model in the FLUX.2 family.
- Pricing is simple: $0.014 for the first generated megapixel, then $0.001 for each additional megapixel.
- A 720x720 image is about 0.52 megapixels, but the pricing language implies the first megapixel is charged as the first unit. Treat this as approximately $0.014 per generated 720x720-class image unless usage receipts prove lower.
- Supports text-to-image and image-reference workflows, with PNG or JPEG output.
- Good fit for simple educational illustrations where narrative precision is less important than cost.
- In a local four-panel story image test, it produced an attractive image but failed the pedagogical sequence: it jumped ahead in the story and changed character continuity in the final panel.

Use cases:

- vocabulary scene images;
- simple roleplay context images;
- quiz illustrations;
- worksheet-style image prompts;
- low-stakes thumbnails;
- low-cost drafts before regenerating with Gemini.

Implementation note:

Generate at the nearest supported square size, then post-process to 720x720. If FLUX returns a 1K image, resizing locally is cheaper and more predictable than trying to find an exact 720 output model.

### Recommended Winner: Gemini 3.1 Flash Lite Image

Model: `google/gemini-3.1-flash-lite-image`

Why it fits:

- OpenRouter describes it as Google's fastest and most cost-efficient Gemini image model.
- It supports text-to-image, image editing, and multi-image composition.
- It supports 1K output and many aspect ratios.
- It follows educational prompts better than FLUX.2 Klein when the prompt includes a sequence, a situation, or a visual story.
- In a local four-panel comic demo, Gemini produced the best usable result for a no-text writing prompt. The first attempt included cafe sign text, but a stricter "wordless pantomime comic" prompt produced a clearer no-text visual story.

Cost caution:

- OpenRouter's model page lists $0.25 per million input tokens and $1.50 per million output tokens.
- The image endpoint reports output-image token billing.
- Google's own pricing materials for image output describe 1K images as consuming a fixed number of image tokens. Because the exact OpenRouter receipt can vary by endpoint and model revision, measure real cost from OpenRouter usage logs before making this the default.

Use cases:

- scenes requiring better prompt adherence;
- image editing from an existing character or scene;
- cases where character consistency matters;
- generation where text reasoning and visual generation need to work together;
- wordless comic-style images where students write a story from the picture.

Demo evidence:

- FLUX output cost: $0.014. Result was visually pleasant but weaker as a four-step story prompt.
- Gemini first output upstream cost: about $0.03436. Result followed the story better but included text on cafe signs.
- Gemini second output upstream cost: about $0.03450. Result was the best candidate: clear four-panel story, consistent enough characters, and no readable text.
- Best image artifact: `docs/research/demo-images/gemini-flash-lite-image-four-panel-story-v2-720.png`
- Comparison summary: `docs/research/demo-images/four-panel-story-summary.json`
- Strict Gemini prompt summary: `docs/research/demo-images/four-panel-story-v2-summary.json`

### Other Models Considered

`sourceful/riverflow-v2.5-fast` is usable but not cheaper than FLUX for this use case. Its endpoint pricing is $0.019 per 1K image and $0.021 per 2K image.

`x-ai/grok-imagine-image-quality` is more expensive for routine educational images. Its OpenRouter endpoint lists $0.05 per 1K output image and $0.07 per 2K output image.

`openai/gpt-image-1-mini` may be strong, but endpoint pricing is token-based and likely more expensive than FLUX for simple 720x720-class images. Keep it as an optional comparison model, not the default budget path.

## Text-to-Speech Options

### Cheapest Baseline: Kokoro 82M

Model: `hexgrad/kokoro-82m`

Why it fits:

- It is the cheapest TTS model found in OpenRouter's current speech model list.
- OpenRouter lists it at $0.62 per million characters.
- OpenRouter describes it as a lightweight open-weight TTS model with 54 preset voices across 8 languages.
- It includes American and British English voices, which helps for listening exercises that contrast accents.

Estimated cost:

- 1,000 characters: about $0.00062.
- 5,000 characters: about $0.0031.
- 1,000 listening exercises at 1,000 characters each: about $0.62 before storage/CDN costs.

Dialogue strategy:

Generate each speaker turn separately with a different voice, then concatenate the clips with short pauses. This gives predictable speaker alternation even if the model does not natively perform multi-speaker dialogue from a single script.

Risk:

Kokoro is extremely cheap, but learner-facing listening content may expose weaknesses in naturalness, prosody, pronunciation, or emotion. It needs a small human QA set before production use.

### Recommended Winner: Gemini 3.1 Flash TTS Preview

Model: `google/gemini-3.1-flash-tts-preview`

Why it fits:

- OpenRouter describes it as a substantial step up from Gemini 2.5 Flash TTS.
- It supports 70+ languages, 200+ inline audio tags for delivery and emotion, up to two speakers with independent voice/style configuration, and PCM output at 24 kHz / 16-bit mono.
- This is a strong fit for listening exercises because dialogue naturalness matters more than image polish.
- In a local male/female dialogue demo, Gemini produced noticeably clearer audio with better prosody and less robotic delivery than Kokoro.

Pricing:

- OpenRouter lists $1 per million input tokens and $20 per million output tokens.
- Because audio output is token-priced, cost should be measured from OpenRouter usage receipts during prototyping. In the local demo, OpenRouter's `/auth/key` usage did not update immediately, so the cost was estimated from text size and PCM duration.
- The demo used a 266-character, four-turn dialogue and produced about 19.5 seconds of audio. Estimated cost was about $0.00931 for Gemini versus about $0.000165 for Kokoro. The Gemini price is higher, but still reasonable for generated listening exercises given the quality difference.

Dialogue strategy:

Prefer one request per dialogue if OpenRouter exposes the provider's multi-speaker controls cleanly through `provider.options`. If that is not reliable, fall back to the same turn-by-turn concatenation strategy used for Kokoro.

Risk:

The model is marked Preview, so behavior, availability, and pricing may change. Use it behind a model setting rather than hard-coding it.

Demo artifacts:

- Kokoro comparison audio: `docs/research/demo-audio/conversation/kokoro-conversation.mp3`
- Gemini winner audio: `docs/research/demo-audio/conversation/gemini-conversation.wav`
- Generation summary: `docs/research/demo-audio/conversation/generation-summary.json`

### Finding: Multi-Speaker vs. Turn-by-Turn Concatenation (2026-07-11)

The scene-scripts audio pipeline (`design/scene-scripts/generate_batch_01.py`) currently uses `voiceStrategy: turn_by_turn_concatenation`: one TTS request per dialogue turn through OpenRouter's OpenAI-compatible `/api/v1/audio/speech` endpoint, then local assembly (PCM silence between turns, WAV concat, `ffmpeg` to MP3). The open question from line 169 above — "prefer one request per dialogue if OpenRouter exposes multi-speaker controls" — is now resolved.

What was confirmed:

- **Gemini TTS natively supports multi-speaker, but exactly 2 speakers max.** Native Gemini `generateContent` (`responseModalities: ["AUDIO"]`) accepts `speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs`, with turns marked by speaker name in the prompt text (`Maria: ...\nMr. James: ...`). Supported on Gemini 3.1 Flash TTS Preview, 2.5 Flash Preview TTS, and 2.5 Pro Preview TTS.
- **OpenRouter's speech endpoint does NOT expose it.** The `/audio/speech` endpoint is OpenAI-style and accepts only a single `voice`. Multi-speaker (`multiSpeakerVoiceConfig`) is not documented as a passthrough option. To use native 2-speaker generation we would have to call the Gemini native API (Google AI Studio / Vertex) directly for audio, leaving the OpenRouter speech surface.

What this changes about the trade-off:

- **It is not a cost saver.** Audio is priced by output tokens (≈ duration). A single multi-speaker call and N per-turn calls cost roughly the same in dollars. The real win is operational: 1 request instead of N, no artificial silence, no `ffmpeg` stitching step, and natural conversational prosody / turn-taking instead of glued clips.
- **Quality risk specific to our use case.** Multiple sources report that in multi-speaker mode voice differentiation is not reliably applied — both speakers can render with the same timbre despite distinct voice assignments (e.g. Kore vs. Puck). Our exercises depend on two distinguishable character voices, which is exactly what this mode can degrade. The current turn-by-turn strategy *guarantees* distinct voices because each turn is a separate single-voice call.
- **2-speaker ceiling.** Any scene with 3+ speakers cannot use native multi-speaker at all and would still need concatenation.

**Decision (2026-07-11): ship per-turn MP3 clips; do not concatenate. Skip native multi-speaker.**

The driver turned out to be runtime, not the offline build. When a user generates listening audio in the app, any server-side concatenation forces an `ffmpeg` encoding step — which in practice means an encoding queue plus a separate worker droplet, since MP3 files cannot be reliably byte-joined. That infrastructure is not worth it for a first version. Native multi-speaker was also rejected: it caps at 2 speakers, requires leaving the OpenRouter speech endpoint for the native Gemini API, and carries the voice-differentiation risk above.

Correction to the earlier note: OpenRouter's `/audio/speech` endpoint documents `mp3` and `pcm`, but **Gemini TTS specifically returns PCM only** — a direct `mp3` request is rejected with `HTTP 400: Gemini TTS only supports response_format="pcm"`. So "MP3 directly from the API" is not available for the chosen model. This does not change the decision: each turn's PCM is wrapped in a WAV header (pure code, stdlib `wave`; a WAV file is just PCM + a ~44-byte header), which the browser plays natively with no encoding step.

The adopted architecture:

- Request each turn from OpenRouter as PCM, then wrap it as a WAV clip. No `ffmpeg`, no MP3 encoding — the WAV header is written in code.
- Store one clip per turn (`audio.clips[]`), in order. Narration/monologue = one clip; dialogue = one clip per turn. `format: "wav"`.
- The client plays the clips back to back through a single sequencer. The gap between clips is the natural pause between speakers; single-line replay is just playing one clip's URL.
- Distinct speaker voices are guaranteed because each turn remains a separate single-voice call.
- No durations or timing marks are stored — the client reads a clip's duration on load if needed, so nothing re-introduces an `ffprobe`/`ffmpeg` dependency.

Format note: WAV is uncompressed (24 kHz / 16-bit mono ≈ 48 KB/s), so the built-in library is larger on disk than the old MP3s. That is an accepted trade for a single format with zero encoding on any path (build or runtime). If compressed built-in assets are ever needed, encode them offline where `ffmpeg` is fine — the runtime path stays WAV.

This makes built-in listening, runtime-generated audio, and roleplay (feature 1.3) share one audio shape and one playback path. Runtime shape: `docs/features/scene-media-library.md` (`SceneMediaLevel.audio.clips`); generation-side details: `design/scene-scripts/README.md` ("Audio Packaging").

### Other TTS Models Considered

`mistralai/voxtral-mini-tts-2603` is listed at $16 per million characters and includes expressive English and French voices. It is much more expensive than Kokoro, so it only makes sense if voice cloning or its specific voice set is needed.

`microsoft/mai-voice-2` is listed at $22 per million characters and is described as high-fidelity and expressive, with Azure-style voices and SSML-style controls. It may be useful for premium content or Spanish/English voice quality tests, but it is not the cheapest acceptable default.

`zyphra/zonos-v0.1-transformer`, `zyphra/zonos-v0.1-hybrid`, `sesame/csm-1b`, and `canopylabs/orpheus-3b-0.1-ft` were all listed by OpenRouter at $7 per million characters. They are viable middle-tier candidates if Kokoro quality is insufficient and Gemini's output-token pricing proves too high.

### Finding: Child Voices (2026-07-12)

Question raised by authoring: a request to make a character sound like a young
child (e.g. a 7-year-old) produced no change. Checked every alternative in this
note for child-voice support. **None ships a dedicated preset child voice** —
all prebuilt catalogs are adult voices:

- **Gemini 3.1 Flash TTS** (current default): fixed prebuilt catalog, adult only.
- **Kokoro 82M**: 54 presets (`af_`, `am_`, `bf_`, `bm_`, …), all adult.
- **Voxtral Mini TTS**: 20 adult presets; custom cloning only via the Mistral API.
- **MAI-Voice-2**: prompted synthesis + zero-shot cloning from a 5–60s reference,
  with consent guardrails; no documented child preset.
- **Zonos**: zero-shot cloning + pitch/rate/emotion control; no preset and no
  age control.
- **Sesame CSM-1b**: cloning-based; no presets.
- **Orpheus 3B**: adult presets (`tara`, `leah`, …); a "child voice" only as a
  post-processing pitch/speed effect, not a real child timbre.

Only two paths to a child-sounding voice, both weak:

1. **Voice cloning** (Voxtral, MAI-Voice-2, Zonos, Sesame, Orpheus): would need a
   recording of an actual child as the reference. Cloning a minor's voice is a
   consent/ethics/legal problem — MAI-Voice-2 explicitly blocks non-consented
   cloning — so this is not viable without a properly consented child voice actor.
2. **Pitch/rate shifting** (Zonos, Orpheus effect): approximates a higher register
   but sounds like a sped-up adult ("chipmunk"), not a convincing 7-year-old.

Real **preset** child voices exist only in the classic **Azure Neural TTS**
catalog (e.g. `en-US-AnaNeural`), which is a different product from Microsoft's
MAI-Voice-2. Using it means adding a provider outside OpenRouter — exactly what
this research set out to avoid. Conclusion: within the OpenRouter-only scope
there is no path to a convincing child voice; a genuine child voice requires a
new provider (Azure) or a consented cloned sample.

## Suggested Evaluation Plan

Run a small bake-off before committing the default model.

Image test set:

- 20 vocabulary-card prompts;
- 20 scene prompts for roleplay or quiz context;
- 10 prompts requiring culturally neutral classroom-safe imagery;
- 10 prompts with reference image edits if this workflow is needed.

Audio test set:

- 20 short A1/A2 listening dialogues;
- 10 slower pronunciation-focused scripts;
- 10 emotional or situational dialogues, such as a restaurant, doctor visit, or school conversation;
- at least 5 Spanish-accent-sensitive examples if the product will generate bilingual scaffolding.

Score each output on:

- prompt adherence;
- learner clarity;
- pronunciation and prosody for audio;
- absence of distracting artifacts;
- generation latency;
- observed OpenRouter cost from usage receipts.

Promotion rule:

- Use Gemini 3.1 Flash TTS Preview as the default if the task is learner-facing listening content.
- Use Kokoro only when the task explicitly prioritizes minimum cost over audio quality, or for non-learner-facing drafts and automated tests.
- If audio naturalness is below the quality bar, upgrade audio before upgrading images. Listening exercises are more sensitive to bad generation than image-supported tasks.

## Integration Notes

Store generated assets rather than regenerating them on every view. Even cheap models become expensive if exercise pages regenerate media repeatedly.

Persist:

- model id;
- prompt/script;
- voice id;
- provider options;
- response format;
- generation cost when OpenRouter returns usage;
- asset dimensions or audio duration;
- moderation/safety status if added later.

For images:

- request square output where possible;
- downscale to 720x720;
- save WebP or JPEG for routine visuals;
- keep PNG only when transparency is needed.

For audio:

- request `mp3` for browser playback and storage efficiency unless PCM is needed for post-processing;
- normalize loudness after concatenating speaker turns;
- add 250-500 ms pauses between dialogue turns;
- cache the final merged audio file.

## Sources

- OpenRouter Image Generation guide: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- OpenRouter Image Models API: https://openrouter.ai/docs/api/api-reference/images/list-image-models
- OpenRouter Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts
- OpenRouter Speech API reference: https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech
- OpenRouter Models API reference: https://openrouter.ai/docs/api/api-reference/models/get-models
- FLUX.2 Klein 4B model page: https://openrouter.ai/black-forest-labs/flux.2-klein-4b
- Gemini 3.1 Flash Lite Image model page: https://openrouter.ai/google/gemini-3.1-flash-lite-image
- Kokoro 82M model page: https://openrouter.ai/hexgrad/kokoro-82m
- Gemini 3.1 Flash TTS Preview model page: https://openrouter.ai/google/gemini-3.1-flash-tts-preview
- Voxtral Mini TTS model page: https://openrouter.ai/mistralai/voxtral-mini-tts-2603
- MAI-Voice-2 model page: https://openrouter.ai/microsoft/mai-voice-2
- Google Gemini API pricing, used only to interpret image-output token billing: https://ai.google.dev/gemini-api/docs/pricing
