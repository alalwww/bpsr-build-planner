// import.meta.glob(eager: true) の結果を「ファイル名(拡張子なし) → URL」の解決関数へ変換する。
// 各データモジュールに散在していた「glob → パス文字列を組み立てて逆引き」のボイラープレートを
// 置き換える。import.meta.glob の呼び出し自体はパターンがリテラル必須のため各モジュールに残す。
export type AssetResolver = (name: string) => string | undefined;

export function createAssetMap(
  globResult: Record<string, string | { default: string }>,
): AssetResolver {
  const byName: Record<string, string> = {};
  for (const [path, mod] of Object.entries(globResult)) {
    const filename = path
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '');
    if (filename !== undefined) byName[filename] = typeof mod === 'string' ? mod : mod.default;
  }
  return (name) => byName[name];
}
