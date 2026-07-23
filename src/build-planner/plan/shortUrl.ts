// 短縮URL機能のバックエンドAPI呼び出し。仕様は docs/SHORT_URL.md を参照。
// Web版のみ対象(呼び出し側で isTauri 判定して使用箇所を制限する)。

const API_BASE = 'https://api.awairo.net';
const SHARE_ORIGIN = 'https://bpsr-bp.awairo.net';

export class ShortUrlError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`short url request failed: ${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // レスポンスボディがJSONでない場合はnullのまま扱う
  }
  if (!res.ok) {
    const code =
      body !== null &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'unknown_error';
    throw new ShortUrlError(res.status, code);
  }
  return body as T;
}

/** 短縮コードからエクスポートコード(planCode.tsの生コード)を解決する。 */
export async function resolveShortCode(code: string): Promise<string> {
  const res = await fetch(`${API_BASE}/shorten?code=${encodeURIComponent(code)}`, {
    method: 'GET',
  });
  const body = await parseJsonResponse<{ planCode: string }>(res);
  return body.planCode;
}

/** エクスポートコードから短縮コードを発行し、共有用の完全なURLを返す。 */
export async function shortenPlanCode(planCode: string): Promise<string> {
  const res = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planCode }),
  });
  const body = await parseJsonResponse<{ code: string }>(res);
  return buildShortUrl(body.code);
}

export function buildShortUrl(code: string): string {
  return `${SHARE_ORIGIN}/#/${code}`;
}

/** location.hashが「#/{code}」形式であれば短縮コードを取り出す。該当しなければnull。 */
export function extractShortCodeFromHash(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const code = hash.slice(2);
  return code.length > 0 ? code : null;
}

// X(旧Twitter)の投稿作成画面を開くURLを組み立てる。urlパラメータは使わず、URL・改行・
// ハッシュタグの位置を完全に制御するためすべてtext一本にまとめる(urlやhashtagsパラメータは
// 末尾に追記されるだけでレイアウトを制御できないため)。
export function buildXShareIntentUrl(text: string): string {
  const params = new URLSearchParams({ text });
  return `https://x.com/intent/post?${params.toString()}`;
}

// LINEの「トークを選んで送信」画面を開くURLを組み立てる。X同様、テキスト全体を1パラメータで
// 渡す(公式の共有ボタン等で広く使われているURLスキーム)。
export function buildLineShareIntentUrl(text: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}
