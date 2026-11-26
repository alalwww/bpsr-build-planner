import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
import { useArrowKeySelect } from '../components/useArrowKeySelect';

interface EvoSlotPickerProps<T extends string | number> {
  /** ボタン先頭に表示するタグ(改鋳スロット等)。省略時は非表示。 */
  tag?: string;
  /** ステータス名の右に表示する値。undefinedなら非表示。 */
  valueLabel?: string;
  selectedStat: T | undefined;
  availableStats: T[];
  getLabel: (statId: T) => string;
  /** 指定時、キャラクターパネルと同じステータスアイコンをラベルの前に表示する(アイコン未定義の項目は非表示)。 */
  getIcon?: (statId: T) => string | undefined;
  /** 「未設定」選択肢のラベル。省略時は未設定選択肢自体を表示しない(常にいずれか選択済みの場合)。 */
  unsetLabel?: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSelect: (statId: T | undefined) => void;
}

// 進化ステータス選択スロット。改鋳スロット・同一attrId選択スロット・通常スロット・
// 進化ステータス組み合わせ違い装備の切り替えスロットで共通利用する。
// トリガーはタグ・値付きの独自の見た目のまま、選択肢リストは共通の Dropdown(位置計算・
// キーボード操作・スマホのボトムシート表示)と SelectDropdown と同じ見た目を使う。
// 開閉状態は呼び出し側(同時に1スロットだけ編集)が管理する。
function EvoSlotPicker<T extends string | number>({
  tag,
  valueLabel,
  selectedStat,
  availableStats,
  getLabel,
  getIcon,
  unsetLabel,
  isEditing,
  onToggleEdit,
  onSelect,
}: EvoSlotPickerProps<T>) {
  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(選択肢一覧)と一致させる。
  const options: (T | undefined)[] =
    unsetLabel !== undefined ? [undefined, ...availableStats] : availableStats;
  const handleTriggerKeyDown = useArrowKeySelect({
    values: options,
    current: selectedStat,
    onChange: onSelect,
  });
  const selectedIcon = selectedStat != null ? getIcon?.(selectedStat) : undefined;

  return (
    <div className="equip-evo-slot">
      <Dropdown
        open={isEditing}
        onOpenChange={(open) => {
          if (open !== isEditing) onToggleEdit();
        }}
        triggerClassName={`equip-evo-slot__btn${selectedStat != null ? ' equip-evo-slot__btn--set' : ''}`}
        panelClassName="select-dropdown__list"
        panelFitContent
        onTriggerKeyDown={handleTriggerKeyDown}
        triggerAriaLabel={tag}
        renderTrigger={(isOpen) => (
          <>
            {tag && <span className="equip-evo-slot__tag">{tag}</span>}
            <span className="equip-evo-slot__stat">
              {selectedIcon && <img src={selectedIcon} alt="" className="equip-evo-slot__icon" />}
              {selectedStat != null ? getLabel(selectedStat) : unsetLabel}
            </span>
            {valueLabel !== undefined && (
              <span className="equip-evo-slot__value">{valueLabel}</span>
            )}
            <Chevron open={isOpen} className="equip-evo-slot__arrow" />
          </>
        )}
      >
        {(close) => (
          <div role="listbox">
            {options.map((statId) => {
              const isSelected = statId === selectedStat;
              const iconUrl = statId != null ? getIcon?.(statId) : undefined;
              return (
                <button
                  type="button"
                  role="option"
                  key={statId ?? '__unset'}
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  className={`select-dropdown__option${isSelected ? ' select-dropdown__option--selected' : ''}`}
                  onClick={() => {
                    onSelect(statId);
                    close();
                  }}
                >
                  {iconUrl && <img src={iconUrl} alt="" className="select-dropdown__icon" />}
                  <span
                    className={`select-dropdown__label${statId == null ? ' select-dropdown__label--muted' : ''}`}
                  >
                    {statId != null ? getLabel(statId) : unsetLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Dropdown>
    </div>
  );
}

export default EvoSlotPicker;
