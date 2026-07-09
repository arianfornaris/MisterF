import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env.js';
const dialogueVoices = ['Kore', 'Puck', 'Aoede'];
const singleVoice = 'Kore';
const silenceSeconds = 0.35;
export class SceneMediaAudioContentPolicyError extends Error {
    constructor(message = 'Scene media audio script was rejected by content policy.') {
        super(message);
        this.name = 'SceneMediaAudioContentPolicyError';
    }
}
export class SceneMediaAudioProviderError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SceneMediaAudioProviderError';
    }
}
export async function generateSceneMediaAudio(input) {
    const segments = scriptToAudioSegments(input.script);
    const audioParts = [];
    for (const segment of segments) {
        audioParts.push(await requestSpeechSegment({
            input: segment.text,
            openRouterApiKey: input.openRouterApiKey,
            voice: segment.voice,
        }));
    }
    const bytes = audioParts.length === 1
        ? audioParts[0] ?? Buffer.alloc(0)
        : await combineMp3Segments(audioParts);
    return {
        bytes,
        contentType: 'audio/mpeg',
        durationSeconds: await resolveMp3DurationSeconds(bytes, input.script),
        extension: 'mp3',
        model: env.sceneMediaTtsModel,
        provider: 'openrouter',
        voices: uniqueVoices(segments),
    };
}
function scriptToAudioSegments(script) {
    if (script.scriptType === 'dialogue') {
        const speakerVoiceMap = new Map();
        return script.turns.map((turn) => {
            if (!speakerVoiceMap.has(turn.speaker)) {
                speakerVoiceMap.set(turn.speaker, dialogueVoices[speakerVoiceMap.size % dialogueVoices.length] ?? singleVoice);
            }
            return {
                speaker: turn.speaker,
                text: turn.text,
                voice: speakerVoiceMap.get(turn.speaker) ?? singleVoice,
            };
        });
    }
    return [{
            speaker: script.scriptType === 'narration' ? 'Narrator' : 'Speaker',
            text: script.text,
            voice: singleVoice,
        }];
}
async function requestSpeechSegment(input) {
    const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, '')}/audio/speech`, {
        body: JSON.stringify({
            input: input.input,
            model: env.sceneMediaTtsModel,
            response_format: 'mp3',
            voice: input.voice,
        }),
        headers: {
            Authorization: `Bearer ${input.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env.appBaseUrl,
            'X-Title': 'Mister F',
        },
        method: 'POST',
    });
    if (!response.ok) {
        const message = await readProviderErrorMessage(response);
        if (isContentPolicyFailure(response.status, message)) {
            throw new SceneMediaAudioContentPolicyError();
        }
        throw new SceneMediaAudioProviderError(message);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('audio/')) {
        throw new SceneMediaAudioProviderError(`OpenRouter speech response was not audio: ${contentType || 'unknown content type'}.`);
    }
    return Buffer.from(await response.arrayBuffer());
}
async function combineMp3Segments(segments) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'misterf-scene-audio-'));
    try {
        const silencePath = path.join(tempDir, 'silence.mp3');
        await runCommand('ffmpeg', [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=r=24000:cl=mono',
            '-t',
            String(silenceSeconds),
            '-q:a',
            '9',
            '-acodec',
            'libmp3lame',
            silencePath,
        ]);
        const listEntries = [];
        for (const [index, segment] of segments.entries()) {
            const segmentPath = path.join(tempDir, `segment-${index}.mp3`);
            await fs.writeFile(segmentPath, segment);
            listEntries.push(`file '${segmentPath.replace(/'/g, "'\\''")}'`);
            if (index < segments.length - 1) {
                listEntries.push(`file '${silencePath.replace(/'/g, "'\\''")}'`);
            }
        }
        const listPath = path.join(tempDir, 'concat.txt');
        const outputPath = path.join(tempDir, 'combined.mp3');
        await fs.writeFile(listPath, `${listEntries.join('\n')}\n`, 'utf8');
        await runCommand('ffmpeg', [
            '-y',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            listPath,
            '-c:a',
            'libmp3lame',
            '-q:a',
            '4',
            outputPath,
        ]);
        return await fs.readFile(outputPath);
    }
    catch (error) {
        throw new SceneMediaAudioProviderError(error instanceof Error ? error.message : 'Unable to combine audio segments.');
    }
    finally {
        await fs.rm(tempDir, { force: true, recursive: true });
    }
}
async function resolveMp3DurationSeconds(bytes, script) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'misterf-scene-duration-'));
    try {
        const filePath = path.join(tempDir, 'audio.mp3');
        await fs.writeFile(filePath, bytes);
        const output = await runCommand('ffprobe', [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);
        const duration = Number.parseFloat(output.trim());
        if (Number.isFinite(duration) && duration > 0) {
            return Math.round(duration * 10) / 10;
        }
    }
    catch {
        // Fall through to a text-length estimate when ffprobe is unavailable.
    }
    finally {
        await fs.rm(tempDir, { force: true, recursive: true });
    }
    return estimateScriptDurationSeconds(script);
}
function estimateScriptDurationSeconds(script) {
    const text = script.scriptType === 'dialogue'
        ? script.turns.map((turn) => turn.text).join(' ')
        : script.text;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((wordCount / 135) * 60));
}
function uniqueVoices(segments) {
    const seen = new Set();
    const voices = [];
    for (const segment of segments) {
        const key = `${segment.speaker}:${segment.voice}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        voices.push({
            speaker: segment.speaker,
            voice: segment.voice,
        });
    }
    return voices;
}
async function readProviderErrorMessage(response) {
    const text = await response.text().catch(() => '');
    if (!text.trim()) {
        return `OpenRouter speech request failed with HTTP ${response.status}.`;
    }
    try {
        const json = JSON.parse(text);
        return json.error?.message ?? text;
    }
    catch {
        return text;
    }
}
function isContentPolicyFailure(status, message) {
    const text = message.toLowerCase();
    return (status === 400 ||
        status === 403 ||
        status === 422) && (text.includes('policy') ||
        text.includes('safety') ||
        text.includes('moderation') ||
        text.includes('content') ||
        text.includes('unsafe'));
}
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', (chunk) => stdout.push(chunk));
        child.stderr.on('data', (chunk) => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(stdout).toString('utf8'));
                return;
            }
            reject(new Error(`${command} exited with ${code ?? 'unknown'}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        });
    });
}
//# sourceMappingURL=audioGeneration.js.map