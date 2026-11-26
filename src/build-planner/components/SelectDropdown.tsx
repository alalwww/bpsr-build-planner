import { Fragment, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Chevron from './Chevron';
import Dropdown from './Dropdown';
import FloatingTooltip from './FloatingTooltip';
import { useArrowKeySelect } from './useArrowKeySelect';
import { useMediaQuery } from './useMediaQuery';

export interface SelectOption<T> {
  value: T;
  label: ReactNode;
  /** 選択肢(と選択中のトリガー表示)の文字色。品質色など。 */
  color?: string;
  /** ラベルの左に表示するアイコン画像のURL。 */
  icon?: string;
  /** ラベルの右に薄い文字色で添える補足(型の所属、開放条件等)。 */
  sublabel?: ReactNode;
  /** 見出しグループ名。直前の選択肢とグループが変わる位置に見出しを入れる。 */
  group?: ReactNode;
  /** マウスを乗せたときにリストの左側へ表示する説明(因子の効果等)。 */
  description?: ReactNode;
  /** 「未選択」「なし」等の選択肢として、ラベルを控えめな文字色で表示する。 */
  muted?: boolean;
  disabled?: boolean;
}

interface SelectDropdownProps<T> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** トリガーに追加するクラス(サイズ・配置など、呼び出し側ごとの見た目の調整用)。 */
  className?: string;
  /** 選択肢リストに追加するクラス(文字サイズ等をトリガーと揃える用)。 */
  listClassName?: string;
  disabled?: boolean;
  /** トリガーのツールチップ(ラベルが無い選択欄の説明)。 */
  title?: string;
  /** 選択中の値が選択肢に無い場合のトリガー表示。 */
  placeholder?: ReactNode;
  /** トリガーに表示する選択中ラベルの文字色(選択肢の color より優先。映痕の品質色等)。 */
  triggerColor?: string;
  /** パネル幅をトリガー幅以上・内容の幅に合わせる(既定 true。幅の狭い選択欄でも選択肢が収まる)。 */
  fitContent?: boolean;
  /** 値の同一性判定(既定は ===)。 */
  isEqual?: (a: T, b: T) => boolean;
}

// ブラウザ標準の <select> の代わりに使う、値と選択肢を渡すだけの選択UI。開閉・位置計算・
// キーボード操作は共通の Dropdown が担い、ここでは選択肢の描画(文字色・アイコン・補足・
// 見出しグループ・説明ツールチップ)を全ドロップダウンで統一する。閉じている間は上下矢印キーで
// 選択を直接変更できる(<select> と同じ操作感)。
function SelectDropdown<T>({
  value,
  options,
  onChange,
  className,
  listClassName,
  disabled = false,
  title,
  placeholder,
  triggerColor,
  fitContent = true,
  isEqual = (a, b) => a === b,
}: SelectDropdownProps<T>) {
  const [tooltip, setTooltip] = useState<{ opt: SelectOption<T>; x: number; y: number } | null>(
    null,
  );
  const selected = options.find((o) => isEqual(o.value, value));
  const enabledValues = options.filter((o) => !o.disabled).map((o) => o.value);
  const handleArrowKey = useArrowKeySelect({
    values: enabledValues,
    current: value,
    onChange,
    isEqual,
  });
  const labelClass = (opt: SelectOption<T> | undefined) =>
    `select-dropdown__label${!opt || opt.muted ? ' select-dropdown__label--muted' : ''}`;
  const triggerTextColor = triggerColor ?? selected?.color;
  // マウスを乗せる操作ができないタッチ端末では、説明をツールチップではなく選択肢の中に表示する。
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');

  return (
    <>
      <Dropdown
        triggerClassName={(isOpen) =>
          `select-dropdown${isOpen ? ' select-dropdown--open' : ''}${className ? ` ${className}` : ''}`
        }
        panelClassName={`select-dropdown__list${listClassName ? ` ${listClassName}` : ''}`}
        panelFitContent={fitContent}
        disabled={disabled}
        triggerTitle={title}
        triggerAriaLabel={title}
        onTriggerKeyDown={handleArrowKey}
        renderTrigger={(isOpen) => (
          <>
            <span
              className="select-dropdown__value"
              style={triggerTextColor ? { color: triggerTextColor } : undefined}
            >
              {selected?.icon && (
                <img className="select-dropdown__icon" src={selected.icon} alt="" />
              )}
              <span className={labelClass(selected)}>
                {selected ? selected.label : placeholder}
              </span>
              {selected?.sublabel && (
                <span className="select-dropdown__sublabel">{selected.sublabel}</span>
              )}
            </span>
            <Chevron open={isOpen} className="select-dropdown__arrow" />
          </>
        )}
      >
        {(close) => (
          <div role="listbox">
            {options.map((opt, i) => {
              const isSelected = isEqual(opt.value, value);
              const showGroup = opt.group != null && opt.group !== options[i - 1]?.group;
              return (
                <Fragment key={i}>
                  {showGroup && <div className="select-dropdown__group">{opt.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    disabled={opt.disabled}
                    className={`select-dropdown__option${isSelected ? ' select-dropdown__option--selected' : ''}`}
                    style={opt.color ? { color: opt.color } : undefined}
                    onClick={() => {
                      onChange(opt.value);
                      setTooltip(null);
                      close();
                    }}
                    onMouseEnter={(e) => {
                      if (opt.description == null || touch) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      // リストの右側(画面右端に近く潰れやすい)ではなく左側に表示する。
                      setTooltip({ opt, x: rect.left - 6, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {opt.icon && <img className="select-dropdown__icon" src={opt.icon} alt="" />}
                    {touch && opt.description != null ? (
                      <span className="select-dropdown__option-text">
                        <span className="select-dropdown__option-main">
                          <span className={labelClass(opt)}>{opt.label}</span>
                          {opt.sublabel && (
                            <span className="select-dropdown__sublabel">{opt.sublabel}</span>
                          )}
                        </span>
                        <span className="select-dropdown__option-desc">{opt.description}</span>
                      </span>
                    ) : (
                      <>
                        <span className={labelClass(opt)}>{opt.label}</span>
                        {opt.sublabel && (
                          <span className="select-dropdown__sublabel">{opt.sublabel}</span>
                        )}
                      </>
                    )}
                  </button>
                </Fragment>
              );
            })}
          </div>
        )}
      </Dropdown>
      {/* 選択肢パネルは body 直下に portal される(z-index 1000)ため、説明ツールチップも body へ
          portal し、floating-tooltip 既定の z-index でパネルより前面に出す。 */}
      {tooltip &&
        createPortal(
          <FloatingTooltip
            x={tooltip.x}
            y={tooltip.y}
            clamp
            align="left"
            className="select-dropdown__tooltip"
          >
            <div className="select-dropdown__tooltip-name">{tooltip.opt.label}</div>
            <div className="select-dropdown__tooltip-desc">{tooltip.opt.description}</div>
          </FloatingTooltip>,
          document.body,
        )}
    </>
  );
}

export default SelectDropdown;
