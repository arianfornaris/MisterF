import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedGenerateTextCallCounts: Record<string, number> = {
  'src/server/services/llmTutor/blockRepair.ts': 1,
  'src/server/services/llmTutor/index.ts': 3,
  'src/server/services/resourceDrafts.ts': 1,
  'src/server/services/roleplays.ts': 1,
  'src/server/services/sceneMediaResolver.ts': 1,
  'src/server/services/sceneMediaScripts.ts': 1,
  'src/server/services/tutorReports.ts': 1,
};

const creditCheckedEntrypoints = [
  'src/server/quizzes/handlers.ts',
  'src/server/chat/handlers.ts',
  'src/server/practiceGuides/handlers.ts',
  'src/server/roleplays/handlers.ts',
  'src/server/socket/chatSocket.ts',
];

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function listFiles(directory: string, extensions: Set<string>): string[] {
  const absoluteDirectory = path.join(process.cwd(), directory);
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(relativePath, extensions));
      continue;
    }

    if (extensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function countGenerateTextCalls(source: string): number {
  return source.match(/\bgenerateText\s*\(/g)?.length ?? 0;
}

describe('LLM credit gate architecture', () => {
  it('keeps every server-side generateText call inventoried', () => {
    const actualGenerateTextCallCounts = Object.fromEntries(
      listFiles('src/server', new Set(['.ts']))
        .map((file) => [file, countGenerateTextCalls(readProjectFile(file))] as const)
        .filter(([, count]) => count > 0),
    );

    expect(actualGenerateTextCallCounts).toEqual(expectedGenerateTextCallCounts);
  });

  it('keeps generateText in service modules instead of route or socket entrypoints', () => {
    for (const file of Object.keys(expectedGenerateTextCallCounts)) {
      expect(file, `${file} should stay in src/server/services`).toContain(
        'src/server/services/',
      );
    }

    for (const file of listFiles('src/server', new Set(['.ts']))) {
      if (file.startsWith('src/server/services/')) {
        continue;
      }

      expect(
        readProjectFile(file),
        `${file} should not call generateText directly; add a gated service instead`,
      ).not.toMatch(/\bgenerateText\s*\(/);
    }
  });

  it('keeps every provider key OpenRouter-issued, with no BYOK concept', () => {
    // The app used to create user keys with `include_byok_in_limit: false`,
    // which tells OpenRouter not to count BYOK spend against the key limit.
    // With a BYOK provider key configured upstream that made the whole credit
    // system stop enforcing: real money was spent while `usage` stayed at 0 and
    // the limit never depleted. BYOK was removed on 2026-08-03 and is not
    // coming back, so the concept must not reappear anywhere — a single flag is
    // enough to silently disable credit limits again.
    const thisFile = 'tests/server/llmCreditGateArchitecture.test.ts';
    for (const file of [
      ...listFiles('src', new Set(['.ts', '.js'])),
      ...listFiles('tests', new Set(['.ts'])),
    ]) {
      if (file === thisFile) {
        // This file names the thing it bans, in the comment above.
        continue;
      }

      expect(
        readProjectFile(file).toLowerCase(),
        `${file} must not reintroduce BYOK; every key is issued by OpenRouter`,
      ).not.toContain('byok');
    }
  });

  it('lets models use their native output budget', () => {
    for (const file of listFiles('src/server', new Set(['.ts']))) {
      expect(
        readProjectFile(file),
        `${file} should not impose an application-level LLM output token cap`,
      ).not.toContain('maxOutputTokens');
    }
  });

  it('keeps LLM entrypoints connected to the shared credit gate', () => {
    for (const file of creditCheckedEntrypoints) {
      expect(readProjectFile(file), `${file} must use the shared credit gate`).toContain(
        'getCreditCheckedOpenRouterApiKeyForUser',
      );
    }

    for (const file of [
      'src/server/sceneMedia/creation.ts',
      'src/server/sceneMedia/sceneMediaPreview.ts',
    ]) {
      expect(readProjectFile(file), `${file} must use the shared credit gate`).toContain(
        'getCreditCheckedOpenRouterApiKeyForUser',
      );
    }

    expect(readProjectFile('src/server/socket/chatSocket.ts')).toContain(
      'openRouterApiKey: await getCreditCheckedOpenRouterApiKeyForUser(userId)',
    );
  });
});
