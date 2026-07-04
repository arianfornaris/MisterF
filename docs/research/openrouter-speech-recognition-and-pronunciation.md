# OpenRouter Speech Recognition and Pronunciation Research

Last researched: 2026-07-04.

This note evaluates how Mister F could let learners speak, convert speech to text, and optionally receive pronunciation-oriented feedback.

The main conclusion is that speech-to-text and pronunciation assessment should be treated as related but different product features:

- speech-to-text converts learner audio into text;
- speaking evaluation checks whether the learner communicated the expected content;
- pronunciation assessment tries to judge how clearly and accurately the learner pronounced the utterance.

OpenRouter is a good fit for speech-to-text and lightweight speaking evaluation. True phoneme-level pronunciation scoring is a more specialized task and may require a dedicated pronunciation assessment provider if the product needs rigorous per-sound feedback.

## Executive Recommendation

Start with an OpenRouter-first pipeline:

1. Record the learner in the browser with `MediaRecorder`.
2. Upload the audio blob to the Mister F server.
3. Transcribe it with OpenRouter's `/api/v1/audio/transcriptions` endpoint.
4. Evaluate the transcript against the exercise target with deterministic text checks plus a low-cost LLM rubric.
5. Give learner-friendly feedback about meaning, missing words, fluency, and likely pronunciation issues.

Use `openai/whisper-1` as the recommended production baseline when the product values an established, widely trusted STT model and the transcript quality bar matters more than the absolute cheapest price. In a local test using a 20-second generated dialogue, Whisper transcribed accurately and reported a cost of $0.002, which is still reasonable for learner speaking exercises. Keep `openai/gpt-4o-mini-transcribe` as the low-cost option for high-volume checks or internal tests; it also transcribed the sample accurately at $0.00053375.

Gemini does have an important role here, but it should be framed as an audio-capable speaking evaluator rather than only a plain transcriber. In a local audio-chat test, `google/gemini-3.1-flash-lite` correctly transcribed the same sample and returned intelligibility, fluency, and learner-facing pronunciation feedback in one response. It reported an upstream cost of about $0.000487. `google/gemini-2.5-flash-lite` did the same for about $0.000253. Because the test prompt included the expected script, these results should be treated as a strong signal for read-aloud and pronunciation-adjacent evaluation, not definitive proof that Gemini should replace Whisper for unconstrained transcription.

Do not use the browser Web Speech API as the primary production recognizer. It can be useful for quick prototypes, but browser support is uneven and it gives the product less control over billing, model choice, storage, and evaluation.

For pronunciation feedback, begin with an "intelligibility-first" approach:

- compare expected text to transcript;
- detect omitted, added, or substituted words;
- use Gemini audio input to produce concise coaching feedback from the expected text, transcript, learner level, exercise context, and optionally the original audio;
- optionally use a cheaper text-only LLM when no audio-level feedback is needed.

Only integrate a dedicated pronunciation assessment engine if Mister F needs phoneme-level scores, word-level pronunciation diagnostics, or high-stakes assessment. Microsoft Azure Pronunciation Assessment is the most obvious candidate for that tier, but it would add a non-OpenRouter provider.

## OpenRouter STT API

OpenRouter documents a dedicated endpoint for transcription:

```http
POST https://openrouter.ai/api/v1/audio/transcriptions
```

The request sends base64-encoded audio:

```json
{
  "model": "openai/whisper-1",
  "input_audio": {
    "data": "<base64 audio bytes>",
    "format": "wav"
  },
  "language": "en",
  "temperature": 0
}
```

The response includes text and usage data:

```json
{
  "text": "Hi Daniel, did you finish the listening homework for today?",
  "usage": {
    "seconds": 20,
    "cost": 0.002
  }
}
```

Supported input formats include common audio formats such as `wav`, `mp3`, `flac`, `m4a`, `ogg`, `webm`, and `aac`.

## Recommended Models

### Recommended Baseline: Whisper 1

Model: `openai/whisper-1`

Why it fits:

- It is the established baseline model for speech recognition workflows.
- It is a familiar and trusted option for teams evaluating STT quality.
- It worked successfully through OpenRouter's transcription endpoint.
- The observed cost is acceptable for learner speaking exercises if recording duration and retry counts are controlled.

OpenRouter listed pricing:

- $0.006 per minute.

Local demo:

- Source: `docs/research/demo-audio/conversation/gemini-conversation.wav`
- Duration: about 20 seconds.
- Reported cost: $0.002.
- Transcript quality: accurate for the generated sample.
- Demo summary: `docs/research/demo-speech-recognition/stt-demo-summary.json`

### Low-Cost Option: GPT-4o Mini Transcribe

Model: `openai/gpt-4o-mini-transcribe`

Why it fits:

- It is the cheapest dedicated STT model currently listed by OpenRouter.
- It produced an accurate transcript in the local demo.
- It reported token-level usage and cost.
- It is a good fit for high-volume learner speech checks where the product mostly needs text and cost is the main constraint.

OpenRouter listed pricing:

- $1.25 per million input tokens.
- $5 per million output tokens.

Local demo:

- Source: `docs/research/demo-audio/conversation/gemini-conversation.wav`
- Duration: about 20 seconds.
- Reported cost: $0.00053375.
- Transcript quality: accurate for the generated sample.
- Demo summary: `docs/research/demo-speech-recognition/stt-demo-summary.json`

### Quality Fallback: GPT-4o Transcribe

Model: `openai/gpt-4o-transcribe`

Why it fits:

- It returned the same words as the mini model in the local demo.
- It added useful paragraph breaks between turns.
- It may be preferable for longer, noisier, or more important recordings if future QA shows better accuracy.

OpenRouter listed pricing:

- $2.50 per million input tokens.
- $10 per million output tokens.

Local demo:

- Reported cost: $0.0010675 for the same sample.
- It was about twice the cost of `gpt-4o-mini-transcribe`.

### Audio Evaluation Candidate: Gemini Flash Lite

Models:

- `google/gemini-3.1-flash-lite`
- `google/gemini-2.5-flash-lite`

Why it fits:

- Gemini can accept the learner audio directly through OpenRouter chat completions.
- It can combine transcription, expected-script comparison, and feedback generation in one call.
- It is especially relevant for read-aloud, repeat-after-me, and pronunciation-adjacent coaching where the product already knows the target phrase.
- In the local demo, both tested Gemini models transcribed the sample correctly and returned intelligibility and fluency scores plus learner-facing feedback.

Local demo:

- Source: `docs/research/demo-audio/conversation/gemini-conversation.wav`
- Prompt included the expected script, so the result should be interpreted as evaluation-assisted transcription.
- `google/gemini-3.1-flash-lite`: upstream cost about $0.000487.
- `google/gemini-2.5-flash-lite`: upstream cost about $0.000253.
- Demo summary: `docs/research/demo-speech-recognition/gemini-audio-analysis-summary.json`

Recommended use:

- Use Whisper or `gpt-4o-mini-transcribe` when the product only needs a transcript.
- Use Gemini when the product needs speaking feedback, fluency notes, or pronunciation-adjacent coaching.
- For read-aloud exercises, prototype a single Gemini call that receives the expected phrase and original audio, then returns transcript, word-level issues, intelligibility, fluency, and coaching text.

Risk:

- If the expected script is included in the prompt, Gemini may be biased toward that script. That is helpful for read-aloud evaluation but risky for free speech transcription.
- Gemini feedback should be treated as coaching, not a precise phoneme-level pronunciation score.

## Product Architecture

### Browser Capture

Use `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` to capture a short learner recording.

Recommended browser output:

- Prefer `audio/webm;codecs=opus` where supported because it is efficient and works well from Chromium browsers.
- Accept whatever the browser records and let the server normalize if needed.
- Keep speaking exercises short, ideally 5-30 seconds.

Avoid relying on `SpeechRecognition` for the core feature. MDN marks the SpeechRecognition interface as limited availability, and support differs across major browsers.

### Server Flow

Suggested flow:

1. Receive the audio upload.
2. Enforce duration, file size, and MIME type limits.
3. Store the raw learner audio only if needed for review or debugging.
4. Convert or normalize with `ffmpeg` when the transcription endpoint rejects the browser format.
5. Base64 encode the audio.
6. Call OpenRouter STT.
7. Save transcript, model id, usage cost, audio duration, and confidence-like metadata when available.
8. Evaluate the result.
9. Return feedback to the learner.

### Suggested Data to Persist

Persist enough to support debugging, cost control, and teacher review:

- attempt id;
- resource id;
- user id or guest attempt id;
- expected prompt or target text;
- transcript;
- STT model id;
- audio duration;
- usage cost;
- upload format;
- storage key for audio if retained;
- evaluation rubric result;
- created timestamp.

## Evaluation Modes

### Mode 1: Free Speaking Response

Example prompt:

> Tell me what happened in the picture.

Use STT to transcribe the answer, then evaluate the transcript with an LLM:

- Did the learner answer the prompt?
- Did they mention required story elements?
- Is the response understandable?
- What should they improve?

This is a speaking/writing-like content evaluation, not pronunciation scoring.

### Mode 2: Repeat-after-me or Read-aloud

Example prompt:

> Say: "The wallet is on the floor."

Use STT plus deterministic comparison:

- normalize expected text and transcript;
- compute word error rate or a simpler word-level diff;
- identify omitted or substituted words;
- return targeted feedback.

This is the best first pronunciation-adjacent feature because transcript mismatch often exposes intelligibility problems.

Example feedback:

> I heard "The wall is on the floor." Try the word "wallet" again. Make the second syllable clear: "wal-let."

### Mode 3: Pronunciation Coaching

For pronunciation-oriented feedback, combine:

- expected phrase;
- transcript;
- level;
- learner's first language if known;
- optional audio metadata such as duration and speaking rate;
- optionally the original audio sent to an audio-capable model.

Gemini Flash Lite is a strong OpenRouter-compatible candidate for this mode because it can inspect the original audio and produce feedback in the same response. The feedback should still be framed as coaching, not as a precise phonetic grade, unless a dedicated pronunciation engine is used.

Suggested scoring dimensions:

- intelligibility: could a listener understand the target meaning?
- completeness: did the learner say the required words?
- fluency: was the speech too fragmented or too hesitant?
- pacing: too fast, too slow, or appropriate?
- likely focus words: words that need another attempt.

## Pronunciation Assessment Limits

STT alone cannot reliably measure phonemes, stress, rhythm, or accent quality. It tells us what the system heard, not exactly why it heard that.

This matters because:

- a learner can pronounce something poorly but still be transcribed correctly;
- a learner can pronounce something understandably but be mistranscribed by the model;
- accent is not the same as incorrect pronunciation;
- scoring pronunciation too aggressively can discourage learners.

For Mister F, the safer first product is "speaking intelligibility feedback" rather than "pronunciation grading."

## Dedicated Pronunciation Assessment Option

If the product later needs phoneme-level or word-level pronunciation assessment, use a dedicated provider rather than pretending STT is enough.

Microsoft Azure Pronunciation Assessment is the most mature option found in this research. It is designed to evaluate pronunciation with scores such as accuracy, fluency, completeness, and prosody. Microsoft documents that pronunciation assessment uses a specific speech-to-text model variant for more consistent assessment, separate from ordinary STT.

Tradeoffs:

- It adds a new provider outside OpenRouter.
- It adds SDK/API complexity.
- It may still have edge cases, especially for very short phrases or substitutions.
- It is better suited for read-aloud practice than open-ended conversation.

Recommendation:

- Do not start here.
- Add it only after the OpenRouter STT pipeline proves valuable and the product needs more precise pronunciation diagnostics.

## Cost Notes

Local STT demo using a 20-second generated English dialogue:

| Model | Result | Reported cost |
| --- | --- | ---: |
| `openai/gpt-4o-mini-transcribe` | Accurate transcript | $0.00053375 |
| `openai/gpt-4o-transcribe` | Same transcript with paragraph breaks | $0.0010675 |
| `openai/whisper-1` | Accurate transcript | $0.002 |
| `google/gemini-3.1-flash-lite` | Accurate transcript plus speaking feedback with expected script in prompt | upstream $0.000487 |
| `google/gemini-2.5-flash-lite` | Accurate transcript plus speaking feedback with expected script in prompt | upstream $0.000253 |

For learner practice, these costs are small enough that the main cost-control levers should be:

- duration limits;
- maximum attempts per exercise;
- only storing audio when useful;
- using Whisper as the default when quality confidence matters;
- using the mini transcribe model for high-volume or low-stakes attempts;
- using Gemini when the product wants combined transcription plus speaking feedback;
- promoting a low-cost transcript to Whisper only when the learner contests the result or the attempt affects a teacher-visible score.

## Implementation Recommendation

Build this in phases.

Phase 1: Speech-to-text attempts

- Add browser recording to selected speaking exercises.
- Transcribe with `openai/whisper-1` for the production baseline, or `openai/gpt-4o-mini-transcribe` for low-cost experiments.
- Show the transcript to the learner.
- Let the learner retry if the transcript is wrong.

Phase 2: Speaking evaluation

- Add expected-answer rubrics.
- Compare transcript to expected content.
- Return short feedback and a score.
- Persist transcript and cost.

Phase 3: Pronunciation-adjacent coaching

- Add read-aloud exercises.
- Compare transcript to target text.
- Prototype Gemini audio evaluation with the expected text and learner audio.
- Highlight likely problem words and produce learner-facing coaching.
- Avoid phoneme claims unless using a dedicated engine.

Phase 4: Dedicated pronunciation assessment if needed

- Prototype Azure Pronunciation Assessment on a small set of read-aloud exercises.
- Compare teacher judgment, STT-based feedback, and Azure scoring.
- Only integrate it if it improves learner outcomes enough to justify the extra provider.

## Sources

- OpenRouter Speech-to-Text guide: https://openrouter.ai/docs/guides/overview/multimodal/stt
- OpenRouter Transcriptions API reference: https://openrouter.ai/docs/api/api-reference/transcriptions/create-audio-transcriptions
- OpenRouter Audio guide: https://openrouter.ai/docs/guides/overview/multimodal/audio
- OpenRouter Speech-to-Text models collection: https://openrouter.ai/collections/speech-to-text-models
- OpenRouter Models API reference: https://openrouter.ai/docs/api/api-reference/models/get-models
- Gemini Flash Lite model page: https://openrouter.ai/google/gemini-3.1-flash-lite
- Gemini 2.5 Flash Lite model page: https://openrouter.ai/google/gemini-2.5-flash-lite
- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN Using the MediaStream Recording API: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API
- MDN SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- Microsoft Azure Pronunciation Assessment guide: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
- Microsoft Pronunciation Assessment transparency note: https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/pronunciation-assessment/transparency-note-pronunciation-assessment
