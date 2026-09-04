import { describe, expect, it, vi } from 'vitest';

/**
 * Attachment bytes must never reach the logs. Before this guard existed, a
 * 37 KB image was serialized byte by byte into the output log as
 * `{"35026":47,"35027":0,...}` on every traced request.
 */

const debug = vi.fn();
vi.mock('../../src/server/services/logger.js', () => ({
  logger: {
    debug: (...args: unknown[]) => debug(...args),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const pngBytes = Buffer.alloc(40_000, 7);

async function logRequestWithAttachment(): Promise<string> {
  debug.mockClear();
  process.env.LLM_TRACE_MODE = 'full';
  vi.resetModules();

  const { logLlmRequest } = await import(
    '../../src/server/services/llmTutor/logging.js'
  );

  logLlmRequest(
    [
      {
        content: [
          { text: 'Look at this worksheet', type: 'text' },
          {
            data: pngBytes,
            filename: 'worksheet.png',
            mediaType: 'image/png',
            type: 'file',
          },
        ],
        role: 'user',
      },
    ],
    'system prompt',
    { operation: 'tutor' },
    1,
  );

  return JSON.stringify(debug.mock.calls);
}

describe('LLM trace redaction', () => {
  it('never writes attachment bytes into a full trace', async () => {
    const logged = await logRequestWithAttachment();

    expect(debug).toHaveBeenCalled();
    // The byte value 7 repeated would show up as a long numeric run.
    expect(logged).not.toContain('"35026"');
    expect(logged).not.toContain('7,7,7,7,7,7,7,7');
    expect(logged.length).toBeLessThan(10_000);
  });

  it('describes the attachment instead of reproducing it', async () => {
    const logged = await logRequestWithAttachment();

    expect(logged).toContain('worksheet.png');
    expect(logged).toContain('image/png');
    expect(logged).toContain('40000');
  });

  it('keeps the user text visible in the trace', async () => {
    expect(await logRequestWithAttachment()).toContain('Look at this worksheet');
  });
});
