import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalEnvFile = process.env.ENV_FILE;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misterf-route-smoke-'));
  process.env.APP_BASE_URL = 'http://127.0.0.1';
  process.env.APP_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
  process.env.DATABASE_PATH = path.join(tempDir, 'routes.sqlite');
  process.env.ENV_FILE = '/dev/null';
  process.env.NODE_ENV = 'test';
  vi.resetModules();

  const serverModule = await import('../../src/server/server.js');
  server = serverModule.server;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const { closeDb } = await import('../../src/server/db/database.js');
  closeDb();
  vi.resetModules();

  restoreEnvValue('APP_BASE_URL', originalAppBaseUrl);
  restoreEnvValue('DATABASE_PATH', originalDatabasePath);
  restoreEnvValue('ENV_FILE', originalEnvFile);
  restoreEnvValue('NODE_ENV', originalNodeEnv);
  restoreEnvValue('APP_SESSION_SECRET', originalSessionSecret);
});

describe('main route smoke tests', () => {
  it.each([
    '/',
    '/login',
    '/signup',
  ])('renders %s for anonymous visitors', async (route) => {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('Mr. F');
  });

  it.each([
    {
      location: '/resources',
      route: '/assignments',
    },
    {
      location: '/resources',
      route: '/practice-modules',
    },
    {
      location: '/resources',
      route: '/chatrooms',
    },
    {
      location: '/resources',
      route: '/chatroom-conversations/test-conversation',
    },
    {
      location: '/login',
      route: '/progress',
    },
    {
      location: '/login',
      route: '/resources',
    },
    {
      location: '/login',
      route: '/resources/folders/test-folder',
    },
    {
      location: '/login',
      route: '/credits',
    },
    {
      location: '/login',
      route: '/settings',
    },
  ])('redirects anonymous visitors from $route to $location', async ({ location, route }) => {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(location);
  });
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
