import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The UI illustrations are one set (`.agents/skills/ui-illustrations`): every
 * served file comes from the generator, is registered, fits its class budget,
 * and every image a view points at exists. Drift in any of these is how a set
 * stops being a set — an unregistered PNG nobody can regenerate, a raw 900 KB
 * model output, or a view pointing at a file that was renamed.
 */
const illustrationsDir = path.join(process.cwd(), 'public', 'illustrations');
const registryPath = path.join(process.cwd(), '..', 'design', 'ui-illustrations', 'illustrations.json');
const viewsDir = path.join(process.cwd(), 'views');

const budgetKbByClass: Record<string, number> = { empty: 40, hero: 100, spot: 40 };

function readRegistryNames(): string[] {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
    illustrations: Array<{ name: string }>;
  };
  return registry.illustrations.map((entry) => entry.name);
}

function servedNames(): string[] {
  return fs
    .readdirSync(illustrationsDir)
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replace(/\.png$/, ''));
}

function listViews(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listViews(fullPath) : entry.name.endsWith('.ejs') ? [fullPath] : [];
  });
}

describe('UI illustrations', () => {
  it('registers every served file and serves every registered one', () => {
    expect(servedNames().sort()).toEqual(readRegistryNames().sort());
  });

  it('names every file after a known class and keeps it within that budget', () => {
    for (const name of servedNames()) {
      const illustrationClass = name.split('-', 1)[0];
      const budgetKb = budgetKbByClass[illustrationClass];
      expect(budgetKb, `${name}: unknown class prefix`).toBeDefined();

      const sizeKb = fs.statSync(path.join(illustrationsDir, `${name}.png`)).size / 1024;
      expect(sizeKb, `${name} is ${Math.round(sizeKb)} KB`).toBeLessThanOrEqual(budgetKb);
    }
  });

  it('only references illustrations that exist', () => {
    const referenced = listViews(viewsDir).flatMap((file) =>
      [...fs.readFileSync(file, 'utf8').matchAll(/\/public\/illustrations\/([a-z0-9-]+)\.png/g)].map(
        (match) => match[1],
      ),
    );

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(servedNames(), `a view references a missing ${name}.png`).toContain(name);
    }
  });
});
