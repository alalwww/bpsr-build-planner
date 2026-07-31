import type { MouseEvent, ReactNode } from 'react';

// <br>、<i>、<size=N>、<linktext>、<style> タグをReactノードに変換する
// <size=N> は N/24 を相対サイズとする（デフォルト24相当を基準に拡縮）
const BASE_SIZE = 24;

// <linktext=ID>inner</linktext> をクリック可能にする際の呼び出し元ハンドラ群。
// useLinkTextPopup が実装を提供する(このファイルからは呼び出し元の型としてのみ参照する)。
export interface LinkTextHandlers {
  isOpen: (id: number) => boolean;
  onClick: (id: number, e: MouseEvent<HTMLElement>) => void;
  onMouseEnter: (id: number) => void;
  onMouseLeave: () => void;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

// linkTextHandlers省略時は<linktext>を従来通りタグを剥がしプレーン表示するのみ(クリック不可)。
export function renderMarkup(
  text: string,
  linkTextHandlers?: LinkTextHandlers,
  _key: { n: number } = { n: 0 },
): ReactNode[] {
  const result: ReactNode[] = [];
  const re =
    /<br>|<i>([\s\S]*?)<\/i>|<size=(\d+(?:\.\d+)?)>([\s\S]*?)<\/size>|<linktext=(\d+)>([\s\S]*?)<\/linktext>|<style="([^"]+)">([\s\S]*?)<\/style>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const plain = stripTags(text.slice(lastIdx, m.index));
      if (plain) result.push(plain);
    }
    if (m[6] !== undefined) {
      // <style="cls">content</style>
      result.push(
        <span key={_key.n++} className={`skill-markup--${m[6]}`}>
          {renderMarkup(m[7], linkTextHandlers, _key)}
        </span>,
      );
    } else if (m[4] !== undefined) {
      // <linktext=ID>inner</linktext>
      const linkId = Number(m[4]);
      const inner = renderMarkup(m[5], linkTextHandlers, _key);
      if (linkTextHandlers) {
        result.push(
          <span
            key={_key.n++}
            className={`skill-markup--linktext${linkTextHandlers.isOpen(linkId) ? ' skill-markup--linktext-open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              linkTextHandlers.onClick(linkId, e);
            }}
            onMouseEnter={() => linkTextHandlers.onMouseEnter(linkId)}
            onMouseLeave={() => linkTextHandlers.onMouseLeave()}
          >
            {inner}
          </span>,
        );
      } else {
        for (const node of inner) result.push(node);
      }
    } else if (m[1] !== undefined) {
      // <i>content</i>
      result.push(
        <em key={_key.n++} className="skill-markup--i">
          {renderMarkup(m[1], linkTextHandlers, _key)}
        </em>,
      );
    } else if (m[2] !== undefined) {
      // <size=N>content</size>
      const pct = Math.round((parseFloat(m[2]) / BASE_SIZE) * 100);
      result.push(
        <span key={_key.n++} style={{ fontSize: `${pct}%` }}>
          {renderMarkup(m[3], linkTextHandlers, _key)}
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
