import { useState } from 'react';
import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
import FloatingTooltip from '../components/FloatingTooltip';
import { useArrowKeySelect } from '../components/useArrowKeySelect';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  /** ラベル末尾に添える補足(例: 未開放テンプレートの「（Lv.30で開放）」)。本文より小さく細字で表示。 */
  sublabel?: string;
}

function CustomDropdown({
  options,
  value,
  placeholder,
  onChange,
  className,
}: {
  options: DropdownOption[];
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [tooltip, setTooltip] = useState<{ opt: DropdownOption; x: number; y: number } | null>(
    null,
  );
  const selected = value ? options.find((o) => o.value === value) : null;

  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(選択肢一覧)と一致させる。
  const selectValues = placeholder !== undefined ? ['', ...options.map((o) => o.value)] : options.map((o) => o.value);
  const handleTriggerKeyDown = useArrowKeySelect({
    values: selectValues,
    current: value,
    onChange,
  });

  return (
    <div className={`phantom-dropdown${className ? ` ${className}` : ''}`}>
      <Dropdown
        triggerClassName="phantom-dropdown__trigger"
        panelClassName={`phantom-dropdown__list${className ? ` ${className}` : ''}`}
        onTriggerKeyDown={handleTriggerKeyDown}
        renderTrigger={(isOpen) => (
          <>
            {selected ? (
              <>
                {selected.icon && (
                  <img src={selected.icon} className="phantom-dropdown__icon" alt="" />
                )}
                <span className="phantom-dropdown__label">
                  {selected.label}
                  {selected.sublabel && (
                    <span className="phantom-dropdown__sublabel">{selected.sublabel}</span>
                  )}
                </span>
              </>
            ) : (
              <span className="phantom-dropdown__placeholder">{placeholder ?? '選択'}</span>
            )}
            <Chevron open={isOpen} className="phantom-dropdown__arrow" />
          </>
        )}
      >
        {(close) => (
          <>
            {placeholder !== undefined && (
              <button
                type="button"
                className={`phantom-dropdown__item${!value ? ' phantom-dropdown__item--active' : ''}`}
                data-selected={!value}
                onClick={() => {
                  onChange('');
                  close();
                  setTooltip(null);
                }}
              >
                <span className="phantom-dropdown__item-label">{placeholder}</span>
              </button>
            )}
            {options.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`phantom-dropdown__item${opt.value === value ? ' phantom-dropdown__item--active' : ''}`}
                data-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  close();
                  setTooltip(null);
                }}
                onMouseEnter={(e) => {
                  if (opt.description) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    // リストの右側(画面右端に近く潰れやすい)ではなく左側に表示する。
                    setTooltip({ opt, x: rect.left - 6, y: rect.top });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {opt.icon && <img src={opt.icon} className="phantom-dropdown__icon" alt="" />}
                <span className="phantom-dropdown__item-label">
                  {opt.label}
                  {opt.sublabel && (
                    <span className="phantom-dropdown__sublabel">{opt.sublabel}</span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
      </Dropdown>
      {tooltip && tooltip.opt.description && (
        <FloatingTooltip
          x={tooltip.x}
          y={tooltip.y}
          clamp
          align="left"
          className="phantom-dropdown__tooltip"
        >
          <div className="phantom-dropdown__tooltip-name">{tooltip.opt.label}</div>
          <div className="phantom-dropdown__tooltip-desc">{tooltip.opt.description}</div>
        </FloatingTooltip>
      )}
    </div>
  );
}

export default CustomDropdown;
