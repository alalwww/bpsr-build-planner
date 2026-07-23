// ゲームデータの効果説明テンプレート(attrDescs)をプレーンテキストへ展開するユーティリティ。
// PhantomPanel(心相投影のノード/因子/絆レベル効果)から抽出したもの。
// タグをReactノードへ変換して装飾を残す用途は renderMarkup.tsx を使う(こちらは文字列化)。

// %値(単位: 1/100 = 1%)を余分な小数を付けずに整形する。整数なら "8%"、小数第1位までなら "7.5%"。
export function formatPercentParam(value: number, fractionDigits = 1): string {
  const pct = value / 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(fractionDigits)}%`;
}

// テンプレート中のプレースホルダを pars(BuffPar配列)の値で置換し、装飾タグを除去する。
//   {*Decision.unmarknormal(n)*} → pars[n-1] の実数値
//   {*Decision.unmarkpercent(n)*} → pars[n-1]/100 を%表示(整数丸め)
//   {*Decision.unmarktime(n)*}   → pars[n-1]/1000 を秒表示
//   {pn}                          → pars[n-1](pAsPercent=true なら 1/100=1% として%表示)
export function renderEffectDesc(template: string, pars: number[], pAsPercent = false): string {
  return template
    .replace(/\{\*Decision\.unmarknormal\((\d+)\)\*}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? String(v) : '?';
    })
    .replace(/\{\*Decision\.unmarkpercent\((\d+)\)\*}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? (v / 100).toFixed(0) + '%' : '?';
    })
    .replace(/\{\*Decision\.unmarktime\((\d+)\)\*}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      return v != null ? (v / 1000).toFixed(1) + '秒' : '?';
    })
    .replace(/\{p(\d+)}/g, (_, n) => {
      const v = pars[parseInt(n) - 1];
      if (v == null) return '?';
      if (pAsPercent) return formatPercentParam(v);
      return String(v);
    })
    .replace(/<style[^>]*>([^<]*)<\/style>/g, '$1')
    .replace(/<linktext=[^>]*>([^<]*)<\/linktext>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}
