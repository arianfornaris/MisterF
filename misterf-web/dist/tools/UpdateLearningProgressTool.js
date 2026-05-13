import { upsertProgressForConversation } from '../db/repository.js';
export class UpdateLearningProgressTool {
    name = 'update_learning_progress';
    declaration = {
        name: this.name,
        description: 'Actualiza el resumen de progreso visible del estudiante para la conversación actual. OBLIGATORIA cuando cambie o se confirme claramente el tema, nivel, resumen del avance, errores frecuentes o vocabulario útil del estudiante. OPCIONAL cuando solo quieras refrescar un progreso ya existente con información pedagógica nueva. NO USAR en cada mensaje si no hay nada nuevo, para conversación lateral, para guardar instrucciones internas ni para reemplazar tu respuesta normal en el chat. El progreso debe ser conciso, informativo y útil para el estudiante. Escríbelo en español; usa inglés solo para términos, frases, ejemplos o correcciones que el estudiante esté aprendiendo. No escribas notas internas en inglés como "The user wants..." o "The current focus is...".',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Tema principal de la práctica, escrito en español y de forma breve. Puede incluir un término clave en inglés si es parte del aprendizaje, por ejemplo: "Incidente de tráfico e insurance claim".',
                },
                level: {
                    type: 'string',
                    description: 'Nivel observado o elegido, escrito en español: principiante, intermedio o avanzado.',
                },
                summary: {
                    type: 'string',
                    description: 'Resumen conciso e informativo del progreso actual, escrito en español para el estudiante. No uses notas internas en inglés como "The user wants..." o "The current focus is...".',
                },
                frequentErrors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Lista breve de errores frecuentes observados, escrita en español. Puedes citar la frase incorrecta o corregida en inglés cuando sea necesario.',
                },
                vocabulary: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            term: {
                                type: 'string',
                                description: 'Término o frase en inglés que el estudiante está aprendiendo.',
                            },
                            meaning: {
                                type: 'string',
                                description: 'Explicación o traducción en español. No escribas definiciones completas en inglés.',
                            },
                        },
                        required: ['term', 'meaning'],
                    },
                    description: 'Vocabulario útil detectado durante la práctica. Usa formato bilingüe: término en inglés y significado en español.',
                },
            },
            required: ['topic', 'level', 'summary', 'frequentErrors', 'vocabulary'],
        },
    };
    execute(call, context) {
        const update = normalizeLearningProgressUpdate(call.args);
        if (!update) {
            return { ok: false, error: 'Invalid progress payload.' };
        }
        const progress = upsertProgressForConversation(context.conversationId, toLearningProgressMarkdown(update));
        context.io.to(context.conversationId).emit('progress:updated', {
            conversationId: context.conversationId,
            progress,
        });
        return { ok: true, progressUpdatedAt: progress.updatedAt };
    }
}
function normalizeLearningProgressUpdate(args) {
    const topic = normalizeShortText(args.topic);
    const level = normalizeShortText(args.level);
    const summary = normalizeLongText(args.summary);
    const frequentErrors = Array.isArray(args.frequentErrors)
        ? args.frequentErrors.map(normalizeLongText).filter(Boolean).slice(0, 5)
        : [];
    const vocabulary = Array.isArray(args.vocabulary)
        ? args.vocabulary
            .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const values = item;
            const term = normalizeShortText(values.term);
            const meaning = normalizeLongText(values.meaning);
            return term && meaning ? { term, meaning } : null;
        })
            .filter((item) => Boolean(item))
            .slice(0, 8)
        : [];
    if (!topic &&
        !level &&
        !summary &&
        frequentErrors.length === 0 &&
        vocabulary.length === 0) {
        return null;
    }
    return {
        topic: topic || 'Por definir',
        level: level || 'Por definir',
        summary: summary || 'Aún no hay suficiente información para resumir el avance.',
        frequentErrors,
        vocabulary,
    };
}
function toLearningProgressMarkdown(update) {
    const errors = update.frequentErrors.length > 0
        ? update.frequentErrors.map((error) => `- ${error}`).join('\n')
        : '- Aún no hay errores frecuentes claros.';
    const vocabulary = update.vocabulary.length > 0
        ? update.vocabulary
            .map((entry) => `- **${entry.term}**: ${entry.meaning}`)
            .join('\n')
        : '- Aún no hay vocabulario nuevo destacado.';
    return [
        '## Tema',
        update.topic,
        '',
        '## Nivel',
        update.level,
        '',
        '## Resumen',
        update.summary,
        '',
        '## Errores frecuentes',
        errors,
        '',
        '## Vocabulario',
        vocabulary,
    ].join('\n');
}
function normalizeShortText(value) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
}
function normalizeLongText(value) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, 240)
        : '';
}
//# sourceMappingURL=UpdateLearningProgressTool.js.map