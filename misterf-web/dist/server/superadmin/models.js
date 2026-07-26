import { env } from '../config/env.js';
export function getSuperadminModelLevels() {
    return [
        {
            family: 'Flash-Lite',
            id: env.llmLiteModel,
            level: 'Lite',
            lifecycle: getModelLifecycle(env.llmLiteModel),
        },
        {
            family: 'Flash',
            id: env.llmRegularModel,
            level: 'Regular',
            lifecycle: getModelLifecycle(env.llmRegularModel),
        },
        {
            family: 'Pro',
            id: env.llmAdvancedModel,
            level: 'Advanced',
            lifecycle: getModelLifecycle(env.llmAdvancedModel),
        },
    ];
}
function getModelLifecycle(modelId) {
    return modelId.toLowerCase().includes('preview') ? 'preview' : 'stable';
}
//# sourceMappingURL=models.js.map