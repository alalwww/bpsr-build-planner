interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  /** スイッチ内にON/OFFのテキストラベルを表示したい場合に指定する(潜在パネルの有効化
   * スイッチ等)。省略時はトラック+つまみのみ表示する(外側に独立したラベルを置く用途)。 */
  label?: string;
  className?: string;
}

// フォーム部品(input)ではなく純粋なON/OFF表現として使う共通のスライドスイッチ。
// ARIAのswitchロールを持つbuttonとして実装する(input type=checkboxでもbutton
// type=buttonでも成立する用途のため、disabled/titleがネイティブ属性で完結するbutton側を採用)。
function ToggleSwitch({ checked, onChange, disabled, title, label, className }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch${checked ? ' toggle-switch--on' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
    >
      <span className="toggle-switch__track">
        <span className="toggle-switch__thumb" />
      </span>
      {label !== undefined && <span className="toggle-switch__label">{label}</span>}
    </button>
  );
}

export default ToggleSwitch;
