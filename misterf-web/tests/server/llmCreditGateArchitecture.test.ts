import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedGenerateTextCallCounts: Record<string, number> = {
  'src/server/services/llmTutor/blockRepair.ts': 1,
  'src/server/services/llmTutor/index.ts': 4,
  'src/server/services/resourceDrafts.ts': 1,
  'src/server/services/roleplays.ts': 1,
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

  it('keeps LLM entrypoints connected to the shared credit gate', () => {
    for (const file of creditCheckedEntrypoints) {
      expect(readProjectFile(file), `${file} must use the shared credit gate`).toContain(
        'getCreditCheckedOpenRouterApiKeyForUser',
      );
    }

    expect(readProjectFile('src/server/socket/chatSocket.ts')).toContain(
      'openRouterApiKey: await getCreditCheckedOpenRouterApiKeyForUser(userId)',
    );
  });
});
