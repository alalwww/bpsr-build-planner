import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Chevron from './Chevron';

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
  /**
   * inlineレイアウトの選択肢一覧。省略時は max〜min の降順で自動生成する
   * (inlineは既定でコンボボックス化される)。順序を変えたい場合に指定する。
   */
  options?: number[];
  /** inlineレイアウトでコンボボックス化(フォーカスインでの一覧表示)を無効にし、自由入力のみにする。 */
  disableList?: boolean;
}

// 値の増減を行う共通ステッパー。レイアウトを2種類サポートする:
// - stacked: ラベル + 読み取り専用の値表示(formatValue対応) + ▲▼縦積みボタン
// - inline: −ボタン + 直接編集可能なinput + ＋ボタン (既定でフォーカスインで開くリスト選択も併用)
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
  options,
  disableList = false,
}: StepperProps) {
  const rootClassName = `${className}${modifierClassName ? ` ${modifierClassName}` : ''}`;
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const comboOptions =
    layout === 'inline' && !disableList
      ? (options ?? Array.from({ length: max - min + 1 }, (_, i) => max - i))
      : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // 開いている間、選択値の位置までスクロールする(開いた瞬間だけでなく、
  // 開いたまま入力して value が変わった場合も追従させる)。
  // scrollIntoView はposition:fixedパネル内では祖先スクロールコンテナの判定が不安定なため、
  // panelRefのscrollTopを直接計算して中央寄せする。
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const selected = panel?.querySelector<HTMLElement>('.stepper-combo-option--selected');
    if (!panel || !selected) return;
    const target = selected.offsetTop - panel.clientHeight / 2 + selected.offsetHeight / 2;
    panel.scrollTop = Math.max(0, Math.min(target, panel.scrollHeight - panel.clientHeight));
  }, [isOpen, value]);

  const handleFocus = () => {
    if (!comboOptions || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    setIsOpen(true);
  };

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
        {comboOptions ? (
          <div className="stepper-combo-input-wrap">
            <input
              ref={inputRef}
              type="number"
              className={`${className}__input`}
              value={value}
              min={min}
              max={max}
              onFocus={handleFocus}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
              }}
            />
            <Chevron open={isOpen} className="stepper-combo-arrow" />
          </div>
        ) : (
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
        )}
        {comboOptions &&
          isOpen &&
          pos &&
          createPortal(
            <div
              ref={panelRef}
              className="stepper-combo-list"
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 1000,
              }}
            >
              {comboOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`stepper-combo-option${opt === value ? ' stepper-combo-option--selected' : ''}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                >
                  {formatValue ? formatValue(opt) : opt}
                </button>
              ))}
            </div>,
            document.body,
          )}
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
