interface ChevronProps {
  /** 開いている場合 true。180度回転した見た目になる。 */
  open?: boolean;
  className?: string;
}

// ドロップダウン/折り畳みトグル共通の開閉記号(下向きV字)。
// 色は currentColor 継承のため、呼び出し側は色指定用の className を渡すだけでよい。
function Chevron({ open = false, className }: ChevronProps) {
  return (
    <svg
      className={`dropdown-chevron${open ? ' dropdown-chevron--open' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 10 6"
      aria-hidden="true"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}

export default Chevron;
