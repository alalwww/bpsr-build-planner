import { useRef } from 'react';
import Chevron from '../components/Chevron';
import { useCloseOnOutsideClick } from '../components/useCloseOnOutsideClick';

interface EvoSlotPickerProps<T extends string | number> {
  /** ボタン先頭に表示するタグ(改鋳スロット等)。省略時は非表示。 */
  tag?: string;
  /** ステータス名の右に表示する値。undefinedなら非表示。 */
  valueLabel?: string;
  selectedStat: T | undefined;
  availableStats: T[];
  getLabel: (statId: T) => string;
  /** 「未設定」選択肢のラベル。省略時は未設定選択肢自体を表示しない(常にいずれか選択済みの場合)。 */
  unsetLabel?: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSelect: (statId: T | undefined) => void;
}

// 進化ステータス選択スロット。改鋳スロット・同一attrId選択スロット・通常スロット・
// 進化ステータス組み合わせ違い装備の切り替えスロットで共通利用する。
function EvoSlotPicker<T extends string | number>({
  tag,
  valueLabel,
  selectedStat,
  availableStats,
  getLabel,
  unsetLabel,
  isEditing,
  onToggleEdit,
  onSelect,
}: EvoSlotPickerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(containerRef, isEditing, onToggleEdit);
  return (
    <div className="equip-evo-slot" ref={containerRef}>
      <button
        type="button"
        className={`equip-evo-slot__btn${selectedStat != null ? ' equip-evo-slot__btn--set' : ''}`}
        onClick={onToggleEdit}
      >
        {tag && <span className="equip-evo-slot__tag">{tag}</span>}
        <span className="equip-evo-slot__stat">
          {selectedStat != null ? getLabel(selectedStat) : unsetLabel}
        </span>
        {valueLabel !== undefined && <span className="equip-evo-slot__value">{valueLabel}</span>}
        <Chevron open={isEditing} className="equip-evo-slot__arrow" />
      </button>
      {isEditing && (
        <div className="equip-evo-picker">
          {unsetLabel !== undefined && (
            <button
              type="button"
              className={`equip-evo-option${selectedStat == null ? ' equip-evo-option--selected' : ''}`}
              onClick={() => onSelect(undefined)}
            >
              {unsetLabel}
            </button>
          )}
          {availableStats.map((statId) => (
            <button
              type="button"
              key={statId}
              className={`equip-evo-option${selectedStat === statId ? ' equip-evo-option--selected' : ''}`}
              onClick={() => onSelect(statId)}
            >
              {getLabel(statId)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EvoSlotPicker;
