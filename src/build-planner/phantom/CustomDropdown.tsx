import { useState } from 'react';
import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
import FloatingTooltip from '../components/FloatingTooltip';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
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

  return (
    <div className={`phantom-dropdown${className ? ` ${className}` : ''}`}>
      <Dropdown
        triggerClassName="phantom-dropdown__trigger"
        panelClassName="phantom-dropdown__list"
        renderTrigger={(isOpen) => (
          <>
            {selected ? (
              <>
                {selected.icon && (
                  <img src={selected.icon} className="phantom-dropdown__icon" alt="" />
                )}
                <span className="phantom-dropdown__label">{selected.label}</span>
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
              <div
                className={`phantom-dropdown__item${!value ? ' phantom-dropdown__item--active' : ''}`}
                onClick={() => {
                  onChange('');
                  close();
                  setTooltip(null);
                }}
              >
                <span className="phantom-dropdown__item-label">{placeholder}</span>
              </div>
            )}
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`phantom-dropdown__item${opt.value === value ? ' phantom-dropdown__item--active' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  close();
                  setTooltip(null);
                }}
                onMouseEnter={(e) => {
                  if (opt.description) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTooltip({ opt, x: rect.right + 6, y: rect.top });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {opt.icon && <img src={opt.icon} className="phantom-dropdown__icon" alt="" />}
                <span className="phantom-dropdown__item-label">{opt.label}</span>
              </div>
            ))}
          </>
        )}
      </Dropdown>
      {tooltip && tooltip.opt.description && (
        <FloatingTooltip x={tooltip.x} y={tooltip.y} className="phantom-dropdown__tooltip">
          <div className="phantom-dropdown__tooltip-name">{tooltip.opt.label}</div>
          <div className="phantom-dropdown__tooltip-desc">{tooltip.opt.description}</div>
        </FloatingTooltip>
      )}
    </div>
  );
}

export default CustomDropdown;
