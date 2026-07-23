import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ShortUrlError,
  buildLineShareIntentUrl,
  buildShortUrl,
  buildXShareIntentUrl,
  extractShortCodeFromHash,
  resolveShortCode,
  shortenPlanCode,
} from './shortUrl';

describe('extractShortCodeFromHash', () => {
  it('extracts the code from a "#/CODE" hash', () => {
    expect(extractShortCodeFromHash('#/Ab3xY')).toBe('Ab3xY');
  });

  it('returns null for a hash without the "#/" prefix', () => {
    expect(extractShortCodeFromHash('#Ab3xY')).toBeNull();
    expect(extractShortCodeFromHash('')).toBeNull();
  });

  it('returns null when no code follows "#/"', () => {
    expect(extractShortCodeFromHash('#/')).toBeNull();
  });
});

describe('buildShortUrl', () => {
  it('builds the share URL from a code', () => {
    expect(buildShortUrl('Ab3xY')).toBe('https://bpsr-bp.awairo.net/#/Ab3xY');
  });
});

describe('buildXShareIntentUrl', () => {
  it('URL-encodes the text param, including embedded newlines', () => {
    const text = 'ビルド共有\nhttps://bpsr-bp.awairo.net/#/Ab3xY\n\n#スタレゾ\n#bpsr_bp';
    const url = buildXShareIntentUrl(text);
    expect(url).toContain('https://x.com/intent/post?');
    expect(url).toContain(`text=${encodeURIComponent(text)}`);
  });
});

describe('buildLineShareIntentUrl', () => {
  it('URL-encodes the text, including embedded newlines', () => {
    const text = 'ビルド共有\nhttps://bpsr-bp.awairo.net/#/Ab3xY\n\n#スタレゾ\n#bpsr_bp';
    const url = buildLineShareIntentUrl(text);
    expect(url).toBe(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`);
  });
});

describe('resolveShortCode / shortenPlanCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a plan code from a short code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ planCode: '2:name:data' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveShortCode('Ab3xY')).resolves.toBe('2:name:data');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.awairo.net/shorten?code=Ab3xY',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ShortUrlError with the response error code on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not_found' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await resolveShortCode('missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShortUrlError);
    expect((error as ShortUrlError).status).toBe(404);
    expect((error as ShortUrlError).code).toBe('not_found');
  });

  it('shortens a plan code and returns the full share URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ code: 'Ab3xY' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(shortenPlanCode('2:name:data')).resolves.toBe(
      'https://bpsr-bp.awairo.net/#/Ab3xY',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.awairo.net/shorten',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ planCode: '2:name:data' }),
      }),
    );
  });
});
