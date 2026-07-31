import ToggleChip from './ToggleChip';

interface ToggleButtonGroupProps<T extends string> {
  options: T[];
  /** 選択中の値。null は「未選択(絞り込み等なし)」。 */
  value: T | null;
  getLabel: (option: T) => string;
  onChange: (value: T | null) => void;
  /** 選択肢ごとの無効化判定(省略時は全選択肢とも有効)。 */
  getDisabled?: (option: T) => boolean;
  className?: string;
}

// ラジオボタン形式(排他選択)のボタングループ。選択中のボタンを再クリックすると
// 未選択(null)に戻せる点が通常のラジオボタンと異なる(装備GS帯フィルター等で使用)。
function ToggleButtonGroup<T extends string>({
  options,
  value,
  getLabel,
  onChange,
  getDisabled,
  className,
}: ToggleButtonGroupProps<T>) {
  return (
    <div className={`toggle-btn-group${className ? ` ${className}` : ''}`} role="radiogroup">
      {options.map((option) => (
        <ToggleChip
          key={option}
          selected={value === option}
          label={getLabel(option)}
          disabled={getDisabled?.(option)}
          onClick={() => onChange(value === option ? null : option)}
        />
      ))}
    </div>
  );
}

export default ToggleButtonGroup;
