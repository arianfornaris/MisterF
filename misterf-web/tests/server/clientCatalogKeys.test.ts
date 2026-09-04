import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  getClientCatalog,
  supportedLocales,
} from '../../src/server/i18n/index.js';

/**
 * Every `t('namespace.key')` reference in the client bundles must resolve in
 * the client catalog shipped as `window.__APP_I18N__`, for every supported
 * locale. The `t` helper falls back to the literal key when a lookup misses,
 * so a missing key renders as raw text like "CARD.KINDOPENTEXT" in the UI —
 * this test turns that silent fallback into a build-time failure.
 */

const clientRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/client',
);

function listClientScripts(): string[] {
  return fs
    .readdirSync(clientRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function collectReferencedKeys(shippedNamespaces: Set<string>): string[] {
  const keys = new Set<string>();
  for (const file of listClientScripts()) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /t\(\s*['"]([A-Za-z0-9_]+)\.([A-Za-z0-9_.]+)['"]/g,
    )) {
      if (shippedNamespaces.has(match[1])) {
        keys.add(`${match[1]}.${match[2]}`);
      }
    }
  }
  return [...keys].sort();
}

/**
 * Namespaces the client asks for that the server never ships.
 *
 * Filtering references down to shipped namespaces is right for the key check —
 * an unshipped namespace has no keys to resolve — but on its own it means a
 * reference to a namespace nobody exposed is silently ignored, which is the
 * same "renders the raw key" failure the key check exists to prevent. It let
 * `t('common.cancel')` ship a button labelled `common.cancel`.
 */
function collectUnshippedNamespaces(shippedNamespaces: Set<string>): string[] {
  const missing = new Set<string>();
  for (const file of listClientScripts()) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /t\(\s*['"]([A-Za-z0-9_]+)\.([A-Za-z0-9_.]+)['"]/g,
    )) {
      if (!shippedNamespaces.has(match[1] as string)) {
        missing.add(match[1] as string);
      }
    }
  }
  return [...missing].sort();
}

function lookup(catalog: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
}

describe('client catalog keys', () => {
  it('ships every namespace the client references', () => {
    const shippedNamespaces = new Set(Object.keys(getClientCatalog('es')));

    expect(
      collectUnshippedNamespaces(shippedNamespaces),
      'client code references a namespace that is not in clientNamespaces, so every key in it renders as raw text',
    ).toEqual([]);
  });

  it('resolves every client-referenced key in every locale', () => {
    const shippedNamespaces = new Set(Object.keys(getClientCatalog('es')));
    const referencedKeys = collectReferencedKeys(shippedNamespaces);

    expect(referencedKeys.length).toBeGreaterThan(100);

    for (const locale of supportedLocales) {
      const catalog = getClientCatalog(locale);
      const missing = referencedKeys.filter(
        (key) => typeof lookup(catalog, key) !== 'string',
      );
      expect(
        missing,
        `client references keys missing from the '${locale}' client catalog`,
      ).toEqual([]);
    }
  });
});
