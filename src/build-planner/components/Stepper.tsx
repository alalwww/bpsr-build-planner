import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Chevron from './Chevron';
import { useDelayedUnmount } from './useDelayedUnmount';

const CLOSE_ANIM_MS = 150;

interface StepperProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  formatValue?: (v: number) => string;
  /** 変動する値と±ボタンの間に表示する固定ラベル(例: 上限値 "/100")。 */
  extraLabel?: string;
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
  /** true の場合、±ボタン・入力欄すべてを非活性にする(値の上下限に関わらず)。 */
  disabled?: boolean;
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
  extraLabel,
  onChange,
  className,
  modifierClassName,
  layout = 'stacked',
  options,
  disableList = false,
  disabled = false,
}: StepperProps) {
  const rootClassName = `${className}${modifierClassName ? ` ${modifierClassName}` : ''}`;
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldRenderPanel = useDelayedUnmount(isOpen, CLOSE_ANIM_MS);

  const comboOptions =
    layout === 'inline' && !disableList
      ? (options ?? Array.from({ length: max - min + 1 }, (_, i) => max - i))
      : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !arrowRef.current?.contains(e.target as Node) &&
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
  // shouldRenderPanelはuseDelayedUnmount由来でisOpenがtrueになった1レンダー後にtrueになる
  // (退出アニメーションのため即アンマウントしない仕組み)。依存配列にisOpenしか無いと、
  // パネルがまだDOMに存在しない(panelRef.currentがnullの)最初のレンダーでこのeffectが
  // 実行されてしまい、以降isOpen/valueが変化しない限り再実行されずスクロールが効かなくなる。
  useEffect(() => {
    if (!isOpen || !shouldRenderPanel) return;
    const panel = panelRef.current;
    const selected = panel?.querySelector<HTMLElement>('.stepper-combo-option--selected');
    if (!panel || !selected) return;
    const target = selected.offsetTop - panel.clientHeight / 2 + selected.offsetHeight / 2;
    panel.scrollTop = Math.max(0, Math.min(target, panel.scrollHeight - panel.clientHeight));
  }, [isOpen, value, shouldRenderPanel]);

  // マウスクリックでの入力欄フォーカス時のみリストを開く(Tab等のキーボードフォーカスでは
  // 開かない)。mousedownはclickより先に発火するため、クリックによるフォーカス移動と
  // 同じタイミングで開ける。
  const openListOnClick = () => {
    if (disabled || !comboOptions || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    setIsOpen(true);
  };

  // 開いている間、Tab等でフォーカスがコンポーネント外(入力欄・矢印ボタン・リスト以外)へ
  // 移動したらリストを閉じる。focusoutはバブリングするためルート要素1箇所で監視できる。
  useEffect(() => {
    if (!isOpen) return;
    const root = rootRef.current;
    if (!root) return;
    const handleFocusOut = (e: FocusEvent) => {
      const related = e.relatedTarget as Node | null;
      // パネルはdocument.bodyへportalされておりrootの子孫にならないため、
      // panelRefでも別途チェックする(パネル内の選択肢へのフォーカス移動では閉じない)。
      if (root.contains(related) || panelRef.current?.contains(related)) return;
      setIsOpen(false);
    };
    root.addEventListener('focusout', handleFocusOut);
    return () => root.removeEventListener('focusout', handleFocusOut);
  }, [isOpen]);

  // ▲▼記号部分専用のトグル。テキスト入力欄とは別のクリック領域として扱い、開いている間に
  // クリックした場合は閉じる(記号部分はinput側のフォーカスに委ねず、常に開閉トグルとして
  // 独立させる)。
  const toggleArrow = () => {
    if (disabled || !comboOptions) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    setIsOpen(true);
  };

  if (layout === 'inline') {
    return (
      <div className={rootClassName} ref={rootRef}>
        <button
          type="button"
          className={`${className}__btn`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        {comboOptions ? (
          <div className="stepper-combo-input-wrap">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              className={`${className}__input`}
              value={value}
              min={min}
              max={max}
              disabled={disabled}
              onClick={openListOnClick}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
              }}
            />
            <button
              ref={arrowRef}
              type="button"
              className="stepper-combo-arrow"
              disabled={disabled}
              onClick={toggleArrow}
            >
              <Chevron open={isOpen} />
            </button>
          </div>
        ) : (
          <input
            type="number"
            inputMode="numeric"
            className={`${className}__input`}
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
          />
        )}
        {comboOptions &&
          shouldRenderPanel &&
          pos &&
          createPortal(
            <div
              className={`dropdown-panel-anim${isOpen ? '' : ' dropdown-panel-anim--closing'}`}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 1000,
              }}
            >
              <div className="dropdown-panel-anim__inner">
                <div ref={panelRef} className="stepper-combo-list">
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
                </div>
              </div>
            </div>,
            document.body,
          )}
        {extraLabel && <span className={`${className}__extra-label`}>{extraLabel}</span>}
        <button
          type="button"
          className={`${className}__btn`}
          disabled={disabled || value >= max}
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
      {extraLabel && <span className={`${className}__extra-label`}>{extraLabel}</span>}
      <div className={`${className}__btns`}>
        <button
          type="button"
          className={`${className}__btn`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
        >
          ▲
        </button>
        <button
          type="button"
          className={`${className}__btn`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export default Stepper;
