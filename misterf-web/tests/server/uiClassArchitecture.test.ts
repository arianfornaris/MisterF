import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const forbiddenSharedClassNames = [
  'practice-guides-view',
  'practice-guides-header',
  'practice-guides-header-actions',
  'practice-guides-header-detail',
  'practice-guides-header-has-close',
  'practice-guides-kicker',
  'practice-guides-title',
  'practice-guides-copy',
  'practice-guide-close-button',
  'practice-guide-detail-shell',
  'practice-guide-form-card',
  'practice-guide-form-shell',
  'practice-guide-section-copy',
  'practiceGuide-section-copy',
  'practiceGuide-section-kicker',
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

function extractClassAttributeValues(source: string): string {
  return Array.from(source.matchAll(/\bclass="([^"]*)"/g))
    .map((match) => match[1])
    .join(' ');
}

describe('UI class architecture', () => {
  it('uses neutral resource-page classes for shared resource layouts', () => {
    const viewFiles = listFiles('views', new Set(['.ejs']));
    const stylesheetFiles = listFiles('src/client/styles', new Set(['.css']));

    for (const file of viewFiles) {
      const classValues = extractClassAttributeValues(readProjectFile(file));
      for (const className of forbiddenSharedClassNames) {
        expect(classValues, `${file} should not use ${className}`).not.toContain(className);
      }
    }

    for (const file of stylesheetFiles) {
      const source = readProjectFile(file);
      for (const className of forbiddenSharedClassNames) {
        expect(source, `${file} should not style ${className}`).not.toContain(className);
      }
    }
  });

  it('keeps resource and practice-guide styles outside the app shell stylesheet', () => {
    const appCss = readProjectFile('src/client/styles/app.css');
    const appShellCss = readProjectFile('src/client/styles/app-shell.css');

    expect(appCss).toContain("@import './resource-pages.css';");
    expect(appCss).toContain("@import './practice-guides.css';");
    expect(appShellCss).not.toContain('.app-resource-view');
    expect(appShellCss).not.toContain('.practice-guides-page');
    expect(appShellCss).not.toContain('.practice-guide-card');
  });
});
