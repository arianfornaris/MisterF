import { vocabularyItemSchema } from './schemas.js';
export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function assertUsableProgressMarkdown(markdown) {
    if (!markdown) {
        throw new Error('El progreso no devolvió contenido.');
    }
    const requiredHeadings = [
        'Tema',
        'Nivel',
        'Objetivos',
        'Avance de objetivos',
        'Resumen',
        'Errores frecuentes',
        'Vocabulario',
    ];
    const missingHeadings = requiredHeadings.filter((heading) => !new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'im').test(markdown));
    if (missingHeadings.length > 0) {
        throw new Error(`El progreso del modelo llegó incompleto. Faltan secciones: ${missingHeadings.join(', ')}.`);
    }
    const meaningfulText = markdown
        .replace(/^##\s+.+$/gim, '')
        .replace(/[#*_`>\-\s]/g, '');
    if (meaningfulText.length < 80) {
        throw new Error('El progreso del modelo llegó demasiado corto para ser útil.');
    }
}
export function parseVocabularyJsonLines(text) {
    const items = [];
    const invalidLines = [];
    for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
        const line = rawLine.trim();
        if (!line || line === '```' || line.startsWith('```')) {
            continue;
        }
        const normalizedLine = line.replace(/,$/, '');
        try {
            const parsed = JSON.parse(normalizedLine);
            const item = vocabularyItemSchema.safeParse(parsed);
            if (item.success) {
                items.push(item.data);
                continue;
            }
            invalidLines.push({
                line: normalizedLine.slice(0, 240),
                lineNumber: index + 1,
                reason: item.error.issues.map((issue) => issue.message).join('; '),
            });
        }
        catch (error) {
            invalidLines.push({
                line: normalizedLine.slice(0, 240),
                lineNumber: index + 1,
                reason: error instanceof Error ? error.message : 'Invalid JSON',
            });
        }
    }
    if (invalidLines.length > 0) {
        console.warn('[Mr. F vocabulary JSONL invalid lines ignored]', JSON.stringify({
            invalidLines,
            validItemCount: items.length,
        }, null, 2));
    }
    return items.slice(0, 12);
}
//# sourceMappingURL=parsers.js.map