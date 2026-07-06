interface StepperProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
  /** ルートのBEM名(例: 'skill-stepper')。__label/__value/__btns/__btn/__input を派生させる。 */
  className: string;
  /** ルートdivに追加するクラス(サイズ違いのラッパー等)。BEM派生には使わない。 */
  modifierClassName?: string;
  /** 'stacked'(既定): 値表示+▲▼縦積みボタン、非編集。'inline': −/＋の横並び+直接編集可能なinput。 */
  layout?: 'stacked' | 'inline';
}

// 値の増減を行う共通ステッパー。レイアウトを2種類サポートする:
// - stacked: ラベル + 読み取り専用の値表示(formatValue対応) + ▲▼縦積みボタン
// - inline: −ボタン + 直接編集可能なinput + ＋ボタン
function Stepper({
  label,
  value,
  min,
  max,
  formatValue,
  onChange,
  className,
  modifierClassName,
  layout = 'stacked',
}: StepperProps) {
  const rootClassName = `${className}${modifierClassName ? ` ${modifierClassName}` : ''}`;

  if (layout === 'inline') {
    return (
      <div className={rootClassName}>
        <button
          type="button"
          className={`${className}__btn`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          type="number"
          className={`${className}__input`}
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
        />
        <button
          type="button"
          className={`${className}__btn`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          ＋
        </button>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      {label && <span className={`${className}__label`}>{label}.</span>}
      <span className={`${className}__value`}>{formatValue ? formatValue(value) : value}</span>
      <div className={`${className}__btns`}>
        <button
          type="button"
          className={`${className}__btn`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          ▲
        </button>
        <button
          type="button"
          className={`${className}__btn`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export default Stepper;
