import { env } from '../config/env.js';

export type SuperadminModelLevel = {
  family: 'Flash' | 'Flash-Lite' | 'Pro';
  id: string;
  level: 'Advanced' | 'Lite' | 'Regular';
  lifecycle: 'preview' | 'stable';
};

export function getSuperadminModelLevels(): SuperadminModelLevel[] {
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

function getModelLifecycle(
  modelId: string,
): SuperadminModelLevel['lifecycle'] {
  return modelId.toLowerCase().includes('preview') ? 'preview' : 'stable';
}
