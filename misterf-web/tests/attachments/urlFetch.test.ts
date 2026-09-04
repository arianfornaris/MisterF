import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { htmlToPlainText } from '../../src/server/attachments/htmlText.js';
import {
  extractUrl,
  parsePublicHttpUrl,
} from '../../src/server/attachments/urlFetch.js';
import { isAttachmentRejectedError } from '../../src/server/attachments/types.js';

async function rejectionCodeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (isAttachmentRejectedError(error)) {
      return error.code;
    }
    throw error;
  }

  throw new Error('Expected the fetch to be rejected.');
}

describe('parsePublicHttpUrl', () => {
  it('accepts ordinary http and https URLs', () => {
    expect(parsePublicHttpUrl('https://example.com/page').hostname).toBe(
      'example.com',
    );
    expect(parsePublicHttpUrl(' http://example.com/a?b=c ').protocol).toBe(
      'http:',
    );
  });

  it('rejects non-http schemes', async () => {
    for (const value of [
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://example.com',
      'data:text/html,<h1>hi</h1>',
    ]) {
      expect(
        await rejectionCodeOf(async () => parsePublicHttpUrl(value)),
        value,
      ).toBe('url_blocked');
    }
  });

  it('rejects credentials embedded in the URL', async () => {
    expect(
      await rejectionCodeOf(async () =>
        parsePublicHttpUrl('http://user:pass@example.com/'),
      ),
    ).toBe('url_blocked');
  });

  it('rejects unparseable input', async () => {
    expect(
      await rejectionCodeOf(async () => parsePublicHttpUrl('not a url')),
    ).toBe('url_blocked');
  });
});

describe('extractUrl SSRF guards', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><head><title>Internal</title></head><body>secret</body></html>');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('refuses a loopback IP even though a real server answers there', async () => {
    expect(
      await rejectionCodeOf(() => extractUrl(`http://127.0.0.1:${port}/`)),
    ).toBe('url_blocked');
  });

  it('refuses a hostname that resolves to loopback', async () => {
    expect(
      await rejectionCodeOf(() => extractUrl(`http://localhost:${port}/`)),
    ).toBe('url_blocked');
  });

  it('refuses the cloud metadata endpoint', async () => {
    expect(
      await rejectionCodeOf(() => extractUrl('http://169.254.169.254/latest/meta-data/')),
    ).toBe('url_blocked');
  });

  it('refuses a private-network address', async () => {
    expect(
      await rejectionCodeOf(() => extractUrl('http://192.168.0.1/admin')),
    ).toBe('url_blocked');
  });
});

describe('htmlToPlainText', () => {
  it('keeps body content and drops page chrome', () => {
    const text = htmlToPlainText(`
      <html><head><style>p{color:red}</style></head>
      <body>
        <nav>Home About Contact</nav>
        <header>Site banner</header>
        <main><h1>Past Simple</h1><p>Complete the sentences.</p></main>
        <footer>Copyright notice</footer>
        <script>console.log('tracking')</script>
      </body></html>
    `);

    expect(text).toContain('Past Simple');
    expect(text).toContain('Complete the sentences.');
    expect(text).not.toContain('Home About Contact');
    expect(text).not.toContain('Site banner');
    expect(text).not.toContain('Copyright notice');
    expect(text).not.toContain('tracking');
  });

  it('preserves list structure so numbered exercises stay legible', () => {
    const text = htmlToPlainText(
      '<ol><li>She ___ (go) home.</li><li>They ___ (be) late.</li></ol>',
    );

    expect(text).toContain('She ___ (go) home.');
    expect(text).toContain('They ___ (be) late.');
  });

  it('collapses runaway whitespace', () => {
    expect(htmlToPlainText('<p>a</p>\n\n\n\n\n<p>b</p>')).toBe('a\n\nb');
  });
});
