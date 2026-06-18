import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const forbiddenSharedClassNames = [
  'practice-modules-view',
  'practice-modules-header',
  'practice-modules-header-actions',
  'practice-modules-header-detail',
  'practice-modules-header-has-close',
  'practice-modules-kicker',
  'practice-modules-title',
  'practice-modules-copy',
  'practice-module-close-button',
  'practice-module-detail-shell',
  'practice-module-form-card',
  'practice-module-form-shell',
  'practice-module-section-copy',
  'practiceModule-section-copy',
  'practiceModule-section-kicker',
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

  it('keeps resource and practice-module styles outside the app shell stylesheet', () => {
    const appCss = readProjectFile('src/client/styles/app.css');
    const appShellCss = readProjectFile('src/client/styles/app-shell.css');

    expect(appCss).toContain("@import './resource-pages.css';");
    expect(appCss).toContain("@import './practice-modules.css';");
    expect(appShellCss).not.toContain('.app-resource-view');
    expect(appShellCss).not.toContain('.practice-modules-page');
    expect(appShellCss).not.toContain('.practice-module-card');
  });
});
