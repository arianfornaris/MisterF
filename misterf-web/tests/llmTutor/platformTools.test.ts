import { describe, expect, it } from 'vitest';
import { buildTutorPlatformTools } from '../../src/server/services/llmTutor/platformTools.js';

type PlatformHelpTool = {
  execute: () => Promise<{ overview: string }>;
};

describe('tutor platform help tool', () => {
  it('exposes get_platform_help returning the canonical platform overview', async () => {
    const announced: string[] = [];
    const tools = buildTutorPlatformTools({
      onToolCall: (name) => announced.push(name),
    });
    const platformHelp = tools.get_platform_help as unknown as PlatformHelpTool;

    const result = await platformHelp.execute();

    // Content comes from system-prompts/tutor/platform-overview.md, the single
    // source of truth. Assert a few stable navigational anchors, not prose.
    expect(result.overview).toContain('Mister F Platform Overview');
    expect(result.overview).toContain('/resources');
    expect(result.overview).toContain('/progress');
    expect(result.overview).toContain('/media-library');
    expect(announced).toEqual(['get_platform_help']);
  });

  it('is available without an authenticated user or profile', () => {
    const tools = buildTutorPlatformTools();
    expect(Object.keys(tools)).toEqual(['get_platform_help']);
  });
});
