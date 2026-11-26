import SelectDropdown, { type SelectOption } from '../components/SelectDropdown';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  /** ラベル末尾に添える補足(例: 未開放テンプレートの「（Lv.30で開放）」、特異点因子の型の所属)。 */
  sublabel?: string;
  /** 見出し。直前の選択肢と異なる場合、この選択肢の前に見出し行を挟む(映痕の系統別表示等)。 */
  group?: string;
}

// 心相晶(テンプレート/因子/映痕)の選択用ドロップダウン。見た目と操作は全体共通の
// SelectDropdown に揃え、ここでは文字列値の選択肢と「未選択」の選択肢(placeholder、値 '')の
// 組み立て、心相晶向けの大きめのサイズ(phantom-dropdown)の指定だけを行う薄い部品。
function CustomDropdown({
  options,
  value,
  placeholder,
  onChange,
  className,
  selectedColor,
}: {
  options: DropdownOption[];
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
  /** トリガーに表示する選択中ラベルの文字色(映痕の品質色等)。 */
  selectedColor?: string;
}) {
  const selectOptions: SelectOption<string>[] = [
    ...(placeholder !== undefined ? [{ value: '', label: placeholder, muted: true }] : []),
    ...options.map((o) => ({
      value: o.value,
      label: o.label,
      icon: o.icon,
      sublabel: o.sublabel,
      group: o.group,
      description: o.description,
    })),
  ];
  const sizeClass = `phantom-dropdown${className ? ` ${className}` : ''}`;

  return (
    <div className={sizeClass}>
      <SelectDropdown
        value={value}
        options={selectOptions}
        onChange={onChange}
        className="phantom-dropdown__trigger"
        listClassName={`phantom-dropdown__list${className ? ` ${className}` : ''}`}
        placeholder={placeholder}
        triggerColor={selectedColor}
        fitContent={false}
      />
    </div>
  );
}

export default CustomDropdown;
