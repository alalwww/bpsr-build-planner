import { Fragment, type ReactNode } from 'react';

// formatEffectDesc()が返す行内の数値/%部分("+900"や"+12.00%"等)だけを抽出するための
// キャプチャ付き正規表現。split()に渡すと [平文, 値, 平文, 値, ...] の交互配列になる。
const VALUE_PATTERN = /([+-]\d+(?:\.\d+)?%?)/g;

// 効果説明の1行から、数値/%部分だけを効果値用のクラスで包んだReactNodeを組み立てる。
// et=1の「名前 +値」だけでなく、et=3のテンプレート文中に埋め込まれた値("...+3.10%、...")
// にも同じ正規表現がそのままヒットするため、呼び出し側で行の種類を区別する必要はない。
function renderEffectDescLine(line: string): ReactNode {
  return line
    .split(VALUE_PATTERN)
    .map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="mod-effect-value">
          {part}
        </span>
      ) : (
        part
      ),
    );
}

// formatEffectDesc()の行配列(改行区切り)を、各行の効果値をハイライトしつつ<br>で
// つないだReactNodeとして描画する。EffectInfoPopup/ModuleTotalStatsで共用。
export function renderEffectDescLines(lines: string[]): ReactNode {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderEffectDescLine(line)}
    </Fragment>
  ));
}
