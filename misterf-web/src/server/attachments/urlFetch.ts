/**
 * Fetching a user-supplied URL.
 *
 * This is the only place in the app where a user controls the destination of an
 * outbound request, so it is written against `node:http`/`node:https` rather
 * than `fetch`. The reason is DNS: validating a hostname and then handing it to
 * a client that resolves it again leaves a rebinding window where the second
 * resolution returns an internal address. Here the address is resolved once,
 * validated, and then **pinned** into the connection through the `lookup`
 * option, so the socket goes to the address that was actually checked.
 *
 * Every redirect hop repeats the whole check.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

import { htmlToPlainText } from './htmlText.js';
import {
  maxUploadBytes,
  maxUrlRedirects,
  urlFetchTimeoutMs,
} from './limits.js';
import { isBlockedAddress } from './privateAddresses.js';
import {
  AttachmentRejectedError,
  type AttachmentWarning,
} from './types.js';

export type UrlExtraction = {
  finalUrl: string;
  text: string;
  title: string;
  warnings: AttachmentWarning[];
};

/** Below this many characters an extraction is reported as probably failed. */
const thinContentThreshold = 200;

const allowedContentTypes = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
];

type FetchedPage = {
  body: string;
  finalUrl: string;
};

export function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AttachmentRejectedError('url_blocked');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AttachmentRejectedError('url_blocked');
  }

  // Credentials in a URL are never legitimate here and are a classic way to
  // confuse host parsing.
  if (url.username || url.password) {
    throw new AttachmentRejectedError('url_blocked');
  }

  return url;
}

/**
 * Resolves a hostname and returns only addresses that are safe to contact.
 * Rejects when the name resolves exclusively to blocked space, which is what a
 * hostname pointed at the loopback interface or a metadata endpoint looks like.
 */
async function resolveSafeAddress(hostname: string): Promise<{
  address: string;
  family: number;
}> {
  const resolved = await dnsLookup(hostname, { all: true }).catch(() => null);
  if (!resolved || resolved.length === 0) {
    throw new AttachmentRejectedError('url_fetch_failed');
  }

  // Every answer must be safe, not merely one of them: accepting a name that
  // resolves to both a public and an internal address would let a caller pick
  // the internal one on a later connection.
  for (const entry of resolved) {
    if (isBlockedAddress(entry.address)) {
      throw new AttachmentRejectedError('url_blocked');
    }
  }

  return { address: resolved[0].address, family: resolved[0].family };
}

function readBodyWithCap(
  response: http.IncomingMessage,
  capBytes: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    response.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > capBytes) {
        response.destroy();
        reject(new AttachmentRejectedError('too_large', {
          limitMb: Math.max(1, Math.floor(capBytes / (1024 * 1024))),
        }));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.on('error', () =>
      reject(new AttachmentRejectedError('url_fetch_failed')),
    );
  });
}

async function requestOnce(url: URL): Promise<
  { kind: 'body'; body: string } | { kind: 'redirect'; location: string }
> {
  const { address, family } = await resolveSafeAddress(url.hostname);

  // Pinning the validated address into the socket is the point of this whole
  // function: the connection cannot be redirected by a second DNS answer.
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    (callback as (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void)(null, address, family);
  };

  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'user-agent': 'MisterF/1.0 (+source attachment fetch)',
        },
        lookup: pinnedLookup,
        // TLS still validates against the original hostname, not the pinned
        // address, so certificate checking stays intact.
        servername: url.protocol === 'https:' ? url.hostname : undefined,
        timeout: urlFetchTimeoutMs,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();
          resolve({ kind: 'redirect', location });
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new AttachmentRejectedError('url_fetch_failed', { status }));
          return;
        }

        const contentType = (response.headers['content-type'] ?? '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        if (!allowedContentTypes.includes(contentType)) {
          response.resume();
          reject(new AttachmentRejectedError('unsupported_type'));
          return;
        }

        readBodyWithCap(response, maxUploadBytes.url).then(
          (body) => resolve({ body, kind: 'body' }),
          reject,
        );
      },
    );

    request.on('timeout', () => {
      request.destroy();
      reject(new AttachmentRejectedError('url_fetch_failed'));
    });
    request.on('error', () =>
      reject(new AttachmentRejectedError('url_fetch_failed')),
    );
    request.end();
  });
}

async function fetchPage(startUrl: URL): Promise<FetchedPage> {
  let url = startUrl;

  for (let hop = 0; hop <= maxUrlRedirects; hop += 1) {
    const result = await requestOnce(url);
    if (result.kind === 'body') {
      return { body: result.body, finalUrl: url.toString() };
    }

    // Re-parsing through the public-URL guard means a redirect cannot escape
    // into another scheme or into credentialed form.
    url = parsePublicHttpUrl(new URL(result.location, url).toString());
  }

  throw new AttachmentRejectedError('url_fetch_failed');
}

function extractTitle(html: string, fallback: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match?.[1]?.replace(/\s+/g, ' ').trim();
  return title && title.length > 0 ? title.slice(0, 200) : fallback;
}

export async function extractUrl(rawUrl: string): Promise<UrlExtraction> {
  const url = parsePublicHttpUrl(rawUrl);
  const page = await fetchPage(url);

  const text = htmlToPlainText(page.body);
  const warnings: AttachmentWarning[] = [];
  if (text.length < thinContentThreshold) {
    warnings.push({ code: 'url_content_thin' });
  }

  return {
    finalUrl: page.finalUrl,
    text,
    title: extractTitle(page.body, url.hostname),
    warnings,
  };
}
