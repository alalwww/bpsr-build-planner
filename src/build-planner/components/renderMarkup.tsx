import type { ReactNode } from 'react';

// <br>、<i>、<size=N>、<linktext>、<style> タグをReactノードに変換する
// <size=N> は N/24 を相対サイズとする（デフォルト24相当を基準に拡縮）
const BASE_SIZE = 24;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export function renderMarkup(text: string, _key: { n: number } = { n: 0 }): ReactNode[] {
  const result: ReactNode[] = [];
  const re =
    /<br>|<i>([\s\S]*?)<\/i>|<size=(\d+(?:\.\d+)?)>([\s\S]*?)<\/size>|<linktext=[^>]*>([\s\S]*?)<\/linktext>|<style="([^"]+)">([\s\S]*?)<\/style>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const plain = stripTags(text.slice(lastIdx, m.index));
      if (plain) result.push(plain);
    }
    if (m[5] !== undefined) {
      // <style="cls">content</style>
      result.push(
        <span key={_key.n++} className={`skill-markup--${m[5]}`}>
          {renderMarkup(m[6], _key)}
        </span>,
      );
    } else if (m[4] !== undefined) {
      // <linktext=...>inner</linktext> — 内側を通常通り再帰処理
      for (const node of renderMarkup(m[4], _key)) result.push(node);
    } else if (m[1] !== undefined) {
      // <i>content</i>
      result.push(
        <em key={_key.n++} className="skill-markup--i">
          {renderMarkup(m[1], _key)}
        </em>,
      );
    } else if (m[2] !== undefined) {
      // <size=N>content</size>
      const pct = Math.round((parseFloat(m[2]) / BASE_SIZE) * 100);
      result.push(
        <span key={_key.n++} style={{ fontSize: `${pct}%` }}>
          {renderMarkup(m[3], _key)}
        </span>,
      );
    } else {
      // <br>
      result.push(<br key={_key.n++} />);
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) {
    const plain = stripTags(text.slice(lastIdx));
    if (plain) result.push(plain);
  }
  return result;
}
