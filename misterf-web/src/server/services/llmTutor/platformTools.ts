import { tool } from 'ai';
import { z } from 'zod';
import { loadSystemPrompt } from '../systemPrompts.js';

export function buildTutorPlatformTools(input?: {
  onToolCall?: (toolName: string) => void;
}) {
  const onToolCall = input?.onToolCall;

  return {
    get_platform_help: tool({
      description:
        'Get reference knowledge about the Mister F app itself — its features and where to find them — to answer a learner or teacher question about how the product works or where something lives (for example "how do I create a quiz?", "where are my shared resources?", "can I make a roleplay?", "where do I see my progress?"). Use this only for questions about the app/platform, never for normal tutoring, explanations, corrections, or exercises, and do not call it proactively just because product knowledge could be useful. Answer briefly, in the learner\'s instruction language, using the app\'s on-screen section names, then return to the tutoring task. You cannot perform app actions for the learner (there are no tools to create, edit, share, open, or delete resources); point them to where they can do it themselves. This tool is internal; do not mention it to the learner.',
      inputSchema: z.object({}),
      execute: async () => {
        onToolCall?.('get_platform_help');
        return { overview: loadSystemPrompt('tutor/platform-overview.md') };
      },
    }),
  };
}
