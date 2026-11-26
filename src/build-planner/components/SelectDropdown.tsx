import { Fragment, type ReactNode } from 'react';
import Chevron from './Chevron';
import Dropdown from './Dropdown';
import { useArrowKeySelect } from './useArrowKeySelect';

export interface SelectOption<T> {
  value: T;
  label: ReactNode;
  /** 選択肢(と選択中のトリガー表示)の文字色。品質色など。 */
  color?: string;
  /** ラベルの左に表示するアイコン画像のURL。 */
  icon?: string;
  /** ラベルの右に薄い文字色で添える補足(型の所属等)。 */
  sublabel?: ReactNode;
  /** 見出しグループ名。直前の選択肢とグループが変わる位置に見出しを入れる。 */
  group?: ReactNode;
  disabled?: boolean;
}

interface SelectDropdownProps<T> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** トリガーに追加するクラス(サイズ・配置など、呼び出し側ごとの見た目の調整用)。 */
  className?: string;
  disabled?: boolean;
  /** トリガーのツールチップ(ラベルが無い選択欄の説明)。 */
  title?: string;
  /** 選択中の値が選択肢に無い場合のトリガー表示。 */
  placeholder?: ReactNode;
  /** パネル幅をトリガー幅以上・内容の幅に合わせる(既定 true。幅の狭い選択欄でも選択肢が収まる)。 */
  fitContent?: boolean;
  /** 値の同一性判定(既定は ===)。 */
  isEqual?: (a: T, b: T) => boolean;
}

// ブラウザ標準の <select> の代わりに使う、値と選択肢を渡すだけの選択UI。開閉・位置計算・
// キーボード操作は共通の Dropdown が担い、ここでは選択肢の描画(文字色・アイコン・補足・
// 見出しグループ)を統一する。閉じている間は上下矢印キーで選択を直接変更できる
// (<select> と同じ操作感)。
function SelectDropdown<T>({
  value,
  options,
  onChange,
  className,
  disabled = false,
  title,
  placeholder,
  fitContent = true,
  isEqual = (a, b) => a === b,
}: SelectDropdownProps<T>) {
  const selected = options.find((o) => isEqual(o.value, value));
  const enabledValues = options.filter((o) => !o.disabled).map((o) => o.value);
  const handleArrowKey = useArrowKeySelect({
    values: enabledValues,
    current: value,
    onChange,
    isEqual,
  });

  return (
    <Dropdown
      triggerClassName={(isOpen) =>
        `select-dropdown${isOpen ? ' select-dropdown--open' : ''}${className ? ` ${className}` : ''}`
      }
      panelClassName="select-dropdown__list"
      panelFitContent={fitContent}
      disabled={disabled}
      triggerTitle={title}
      triggerAriaLabel={title}
      onTriggerKeyDown={handleArrowKey}
      renderTrigger={(isOpen) => (
        <>
          <span
            className="select-dropdown__value"
            style={selected?.color ? { color: selected.color } : undefined}
          >
            {selected?.icon && <img className="select-dropdown__icon" src={selected.icon} alt="" />}
            <span className="select-dropdown__label">
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
                    close();
                  }}
                >
                  {opt.icon && <img className="select-dropdown__icon" src={opt.icon} alt="" />}
                  <span className="select-dropdown__label">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="select-dropdown__sublabel">{opt.sublabel}</span>
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}

export default SelectDropdown;
