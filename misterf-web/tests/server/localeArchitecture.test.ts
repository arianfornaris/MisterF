import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Roadmap V3 §2.8: with the profile in English, the app said "hace 3 meses"
 * because code picked its own locale instead of asking for the request's. Every
 * date, collation and translation must take the locale it is given. These
 * checks keep a literal locale from creeping back in.
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The only module allowed to choose how a locale maps onto `Intl`. */
const i18nModule = 'src/server/i18n/';

/**
 * Deliberate literal locales, each with its reason. Add to this list only with
 * a reason a reviewer would accept.
 */
const allowedFiles: Record<string, string> = {
  // Founder-only operations page, never shown to a learner or teacher.
  'src/server/superadmin/routes.ts': 'internal superadmin surface',
  // Prices are charged in US dollars and shown the way a US checkout shows them.
  'views/credits.ejs': 'USD amounts formatted en-US',
};

function listFiles(dir: string, extensions: string[]): string[] {
  return fs
    .readdirSync(path.join(webRoot, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => path.relative(webRoot, path.join(entry.parentPath, entry.name)));
}

function findViolations(pattern: RegExp, files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (file.startsWith(i18nModule) || file in allowedFiles) {
      continue;
    }
    const lines = fs.readFileSync(path.join(webRoot, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return violations;
}

const sourceFiles = [
  ...listFiles('src', ['.ts', '.js']),
  ...listFiles('views', ['.ejs']),
];

describe('locale architecture', () => {
  it('never hands Intl a literal locale', () => {
    expect(
      findViolations(/\bIntl\.[A-Za-z]+\(\s*['"`]/, sourceFiles),
      'pass the request locale through src/server/i18n/dates.ts instead',
    ).toEqual([]);
  });

  it('never formats or collates with a literal locale', () => {
    expect(
      findViolations(
        /\.(localeCompare\([^)]*,\s*|toLocale(Date|Time)?String\(\s*)['"`][a-z]{2}/,
        sourceFiles,
      ),
      'use compareText / formatDateTime, or the client i18n `locale`',
    ).toEqual([]);
  });

  it('never translates into a hardcoded language', () => {
    expect(
      findViolations(/\btranslate\(\s*['"`][a-z]{2}['"`]/, sourceFiles),
      'translate into the conversation, profile or request locale',
    ).toEqual([]);
  });

  it('never defaults a locale parameter to a language', () => {
    // A default is how Spanish became everyone's fallback: callers that forgot
    // the locale compiled fine. Without one, the compiler lists them.
    expect(
      findViolations(/\bLocale\s*=\s*['"`][a-z]{2}['"`]/, sourceFiles),
      'make the locale parameter required',
    ).toEqual([]);
  });
});
