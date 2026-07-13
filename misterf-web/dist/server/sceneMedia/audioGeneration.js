import { env } from '../config/env.js';
// TTS voices grouped by the gender they present. One voice per character, kept
// stable for the whole script; distinct speakers of the same gender cycle within
// the pool so their voices stay distinguishable.
const femaleVoices = ['Kore', 'Aoede', 'Leda'];
const maleVoices = ['Puck', 'Charon', 'Fenrir'];
// Order-based fallback for speakers with no gender (e.g. media authored before
// the gender field existed): preserves the previous round-robin behavior.
const fallbackVoices = ['Kore', 'Puck', 'Aoede'];
const singleVoice = 'Kore';
const pcmChannels = 1;
const pcmSampleRate = 24_000;
const pcmSampleWidthBytes = 2;
export class SceneMediaAudioContentPolicyError extends Error {
    constructor(message = 'Scene media audio script was rejected by content policy.') {
        super(message);
        this.name = 'SceneMediaAudioContentPolicyError';
    }
}
export class SceneMediaAudioProviderError extends Error {
    status;
    constructor(message, options = {}) {
        super(message, { cause: options.cause });
        this.name = 'SceneMediaAudioProviderError';
        this.status = options.status;
    }
}
export async function generateSceneMediaAudio(input) {
    const segments = scriptToAudioSegments(input.script);
    const clips = [];
    for (const segment of segments) {
        input.onClipProgress?.(clips.length + 1, segments.length);
        const pcmBytes = await requestSpeechPcm({
            getOpenRouterApiKey: input.getOpenRouterApiKey,
            input: segment.text,
            voice: segment.voice,
        });
        clips.push({
            bytes: wrapPcmInWav(pcmBytes),
            contentType: 'audio/wav',
            extension: 'wav',
            speaker: segment.speaker,
            turn: segment.turn,
            voice: segment.voice,
        });
    }
    return {
        clips,
        model: env.sceneMediaTtsModel,
        provider: 'openrouter',
        voiceStrategy: 'per_turn_clips',
    };
}
function scriptToAudioSegments(script) {
    if (script.scriptType === 'dialogue') {
        const genderBySpeaker = new Map(script.speakers.map((speaker) => [speaker.name, speaker.gender]));
        const speakerVoiceMap = new Map();
        const poolCursor = { fallback: 0, female: 0, male: 0 };
        return script.turns.map((turn, index) => {
            if (!speakerVoiceMap.has(turn.speaker)) {
                const gender = genderBySpeaker.get(turn.speaker);
                let voice;
                if (gender === 'female') {
                    voice = femaleVoices[poolCursor.female++ % femaleVoices.length] ?? singleVoice;
                }
                else if (gender === 'male') {
                    voice = maleVoices[poolCursor.male++ % maleVoices.length] ?? singleVoice;
                }
                else {
                    voice = fallbackVoices[poolCursor.fallback++ % fallbackVoices.length] ?? singleVoice;
                }
                speakerVoiceMap.set(turn.speaker, voice);
            }
            return {
                speaker: turn.speaker,
                text: turn.text,
                turn: index + 1,
                voice: speakerVoiceMap.get(turn.speaker) ?? singleVoice,
            };
        });
    }
    return [{
            speaker: script.scriptType === 'narration' ? 'Narrator' : 'Speaker',
            text: script.text,
            turn: 1,
            voice: monologueVoice(script.gender),
        }];
}
// A monologue's character voice follows its gender; a narrator (neutral or
// unset) uses the default single voice.
function monologueVoice(gender) {
    if (gender === 'female') {
        return femaleVoices[0] ?? singleVoice;
    }
    if (gender === 'male') {
        return maleVoices[0] ?? singleVoice;
    }
    return singleVoice;
}
async function requestSpeechPcm(input) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const openRouterApiKey = await input.getOpenRouterApiKey();
        let response;
        try {
            response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, '')}/audio/speech`, {
                body: JSON.stringify({
                    input: input.input,
                    model: env.sceneMediaTtsModel,
                    response_format: 'pcm',
                    voice: input.voice,
                }),
                headers: {
                    Authorization: `Bearer ${openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': env.appBaseUrl,
                    'X-Title': 'Mister F',
                },
                method: 'POST',
            });
        }
        catch (error) {
            if (attempt < maxAttempts) {
                await waitForRetry(attempt);
                continue;
            }
            throw new SceneMediaAudioProviderError(error instanceof Error ? error.message : 'OpenRouter speech request failed.', { cause: error });
        }
        if (!response.ok) {
            const message = await readProviderErrorMessage(response);
            if (isContentPolicyFailure(response.status, message)) {
                throw new SceneMediaAudioContentPolicyError();
            }
            if (attempt < maxAttempts && isRetryableStatus(response.status)) {
                await waitForRetry(attempt, response.headers.get('retry-after'));
                continue;
            }
            throw new SceneMediaAudioProviderError(message, { status: response.status });
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.toLowerCase().includes('audio/') &&
            !contentType.toLowerCase().includes('application/octet-stream')) {
            throw new SceneMediaAudioProviderError(`OpenRouter speech response was not audio: ${contentType || 'unknown content type'}.`, { status: response.status });
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0) {
            if (attempt < maxAttempts) {
                await waitForRetry(attempt);
                continue;
            }
            throw new SceneMediaAudioProviderError('OpenRouter speech response was empty.');
        }
        return bytes;
    }
    throw new SceneMediaAudioProviderError('OpenRouter speech request failed.');
}
export function wrapPcmInWav(pcmBytes) {
    const header = Buffer.alloc(44);
    const blockAlign = pcmChannels * pcmSampleWidthBytes;
    const byteRate = pcmSampleRate * blockAlign;
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + pcmBytes.length, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(pcmChannels, 22);
    header.writeUInt32LE(pcmSampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(pcmSampleWidthBytes * 8, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(pcmBytes.length, 40);
    return Buffer.concat([header, pcmBytes]);
}
function isRetryableStatus(status) {
    return status === 408 || status === 409 || status === 429 || status >= 500;
}
async function waitForRetry(attempt, retryAfter = null) {
    const retryAfterSeconds = retryAfter ? Number.parseFloat(retryAfter) : Number.NaN;
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
        ? Math.min(retryAfterSeconds * 1000, 5_000)
        : attempt * 500;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}
async function readProviderErrorMessage(response) {
    const fallback = `OpenRouter speech request failed with HTTP ${response.status}.`;
    try {
        const body = await response.json();
        if (typeof body.error === 'string' && body.error.trim()) {
            return body.error.trim();
        }
        if (body.error &&
            typeof body.error === 'object' &&
            typeof body.error.message === 'string' &&
            body.error.message.trim()) {
            return body.error.message.trim();
        }
        if (typeof body.message === 'string' && body.message.trim()) {
            return body.message.trim();
        }
    }
    catch {
        return fallback;
    }
    return fallback;
}
function isContentPolicyFailure(status, message) {
    if (status !== 400 && status !== 403 && status !== 422) {
        return false;
    }
    const normalized = message.toLowerCase();
    return (normalized.includes('content policy') ||
        normalized.includes('moderation') ||
        normalized.includes('safety') ||
        normalized.includes('unsafe'));
}
//# sourceMappingURL=audioGeneration.js.map