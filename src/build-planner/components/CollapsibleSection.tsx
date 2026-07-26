import type { ReactNode } from 'react';
import Chevron from './Chevron';

interface CollapsibleBodyProps {
  open: boolean;
  children: ReactNode;
}

// 折り畳み本体の共通部品。CSS Gridのgrid-template-rows: 0fr⇄1frトリックで、JSでの
// 高さ計測なしに可変長コンテンツの開閉をアニメーションする(components.css参照)。
// 開閉に関わらずchildrenは常時マウントし、表示制御はCSS側(collapsible-section__body)に任せる。
// トグルボタンの見た目が個別ケースで異なる場合(StatsDetailDialog等)は、これを直接使う。
export function CollapsibleBody({ open, children }: CollapsibleBodyProps) {
  return (
    <div className={`collapsible-section__body${open ? ' collapsible-section__body--open' : ''}`}>
      <div className="collapsible-section__body-inner">{children}</div>
    </div>
  );
}

interface CollapsibleSectionProps {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  toggleClassName?: string;
  className?: string;
  children: ReactNode;
}

// 折り畳みトグル(ラベル+Chevron)と本体を1セットにまとめた共通部品
// (絞り込み/絆レベル効果/ノード効果などの折り畳みUIで共通利用)。
export default function CollapsibleSection({
  open,
  onToggle,
  label,
  toggleClassName = 'filter-toggle-btn',
  className,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className={`collapsible-section${className ? ` ${className}` : ''}`}>
      <button type="button" className={toggleClassName} onClick={onToggle} aria-expanded={open}>
        <span>{label}</span>
        <Chevron open={open} />
      </button>
      <CollapsibleBody open={open}>{children}</CollapsibleBody>
    </div>
  );
}
