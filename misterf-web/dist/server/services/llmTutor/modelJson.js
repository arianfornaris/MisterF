/**
 * Parses the JSON object a model was asked to emit, tolerating the common
 * failure mode of wrapping it in a markdown code fence. Throws with a
 * `JSON parsing failed:` prefix, which the correction-loop classifiers
 * (`isCorrectableLlmOutputError`) treat as a correctable output error.
 */
export function parseJsonFromModelText(text) {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        throw new Error(`JSON parsing failed: ${message}`);
    }
}
//# sourceMappingURL=modelJson.js.map