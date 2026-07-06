import { useTranslation } from 'react-i18next';
import type { EvolutionStatId } from '../types';

interface EvoSlotPickerProps {
  /** ボタン先頭に表示するタグ(改鋳スロット等)。省略時は非表示。 */
  tag?: string;
  /** ステータス名の右に表示する値。undefinedなら非表示。 */
  valueLabel?: string;
  selectedStat: EvolutionStatId | undefined;
  availableStats: EvolutionStatId[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onSelect: (statId: EvolutionStatId | undefined) => void;
}

// 進化ステータス選択スロット。改鋳スロット・同一attrId選択スロット・通常スロットで共通利用。
function EvoSlotPicker({
  tag,
  valueLabel,
  selectedStat,
  availableStats,
  isEditing,
  onToggleEdit,
  onSelect,
}: EvoSlotPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="equip-evo-slot">
      <button
        type="button"
        className={`equip-evo-slot__btn${selectedStat ? ' equip-evo-slot__btn--set' : ''}`}
        onClick={onToggleEdit}
      >
        {tag && <span className="equip-evo-slot__tag">{tag}</span>}
        <span className="equip-evo-slot__stat">
          {selectedStat
            ? t(`buildPlanner.stats.${selectedStat}`)
            : t('buildPlanner.evolutionStatUnset')}
        </span>
        {valueLabel !== undefined && <span className="equip-evo-slot__value">{valueLabel}</span>}
        <span className="equip-evo-slot__arrow">{isEditing ? '▴' : '▾'}</span>
      </button>
      {isEditing && (
        <div className="equip-evo-picker">
          <button
            type="button"
            className={`equip-evo-option${!selectedStat ? ' equip-evo-option--selected' : ''}`}
            onClick={() => onSelect(undefined)}
          >
            {t('buildPlanner.evolutionStatUnset')}
          </button>
          {availableStats.map((statId) => (
            <button
              type="button"
              key={statId}
              className={`equip-evo-option${selectedStat === statId ? ' equip-evo-option--selected' : ''}`}
              onClick={() => onSelect(statId)}
            >
              {t(`buildPlanner.stats.${statId}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EvoSlotPicker;
