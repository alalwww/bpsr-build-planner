import { useState } from 'react';

interface ToggleChipProps {
  selected: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}

// ON/OFF切り替え可能な小さいボタン(チップ)。ラジオボタン等の選択肢1件として使う想定。
// クリック直後、マウスがまだ乗ったままの間はホバースタイルを抑制し、通常時の見た目を維持する
// (マウスが実際に離れるまで解除しない)。クリックで状態が切り替わった瞬間に「新しい状態の
// ホバー時スタイル」へ即座に切り替わって紛らわしくなるのを防ぐため。
function ToggleChip({ selected, label, onClick, className }: ToggleChipProps) {
  const [hoverSuppressed, setHoverSuppressed] = useState(false);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`toggle-chip${selected ? ' toggle-chip--selected' : ''}${hoverSuppressed ? ' toggle-chip--hover-suppressed' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => {
        onClick();
        setHoverSuppressed(true);
      }}
      onMouseLeave={() => setHoverSuppressed(false)}
    >
      {label}
    </button>
  );
}

export default ToggleChip;
