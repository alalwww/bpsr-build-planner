import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import type { LegendaryAffixEntry, LegendaryAffixSelection } from '../types';

interface LegendaryAffixPickerProps {
  legendaryAffixList: LegendaryAffixEntry[];
  selectedLegendaryAffix: LegendaryAffixSelection | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSet: (selection: LegendaryAffixSelection | undefined) => void;
}

function LegendaryAffixPicker({
  legendaryAffixList,
  selectedLegendaryAffix,
  isOpen,
  onToggleOpen,
  onSet,
}: LegendaryAffixPickerProps) {
  const { t } = useTranslation();
  const selectedAffixEntry = legendaryAffixList.find(
    (e) => e.attrId === selectedLegendaryAffix?.attrId,
  );
  const selectedAffixDisplayValue =
    selectedAffixEntry && selectedLegendaryAffix
      ? selectedAffixEntry.isPercent
        ? `+${selectedLegendaryAffix.value / 100}%`
        : `+${selectedLegendaryAffix.value}`
      : null;

  return (
    <div className="equip-evo-slot equip-affix-slot">
      <button
        type="button"
        className={`equip-evo-slot__btn${selectedLegendaryAffix != null ? ' equip-evo-slot__btn--set' : ''}`}
        onClick={onToggleOpen}
      >
        <span className="equip-evo-slot__stat equip-affix-slot__stat">
          {selectedLegendaryAffix != null
            ? t(`attributes.${selectedLegendaryAffix.attrId}`, { ns: 'game-data' })
            : t('buildPlanner.evolutionStatUnset')}
        </span>
        {selectedAffixDisplayValue && (
          <span className="equip-evo-slot__value">{selectedAffixDisplayValue}</span>
        )}
        <Chevron open={isOpen} className="equip-evo-slot__arrow" />
      </button>
      {isOpen && (
        <div className="equip-evo-picker equip-affix-picker">
          <button
            type="button"
            className={`equip-evo-option equip-affix-unset${selectedLegendaryAffix == null ? ' equip-evo-option--selected' : ''}`}
            onClick={() => onSet(undefined)}
          >
            {t('buildPlanner.evolutionStatUnset')}
          </button>
          {legendaryAffixList.map(({ attrId, isPercent, values }) => (
            <div key={attrId} className="equip-affix-option-row">
              <span className="equip-affix-option-row__name">
                {t(`attributes.${attrId}`, { ns: 'game-data' })}
              </span>
              <div className="equip-affix-option-row__tiers">
                {values.map((val) => {
                  const displayVal = isPercent ? `+${val / 100}%` : `+${val}`;
                  const isSelected =
                    selectedLegendaryAffix?.attrId === attrId &&
                    selectedLegendaryAffix?.value === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`equip-affix-tier-btn${isSelected ? ' equip-affix-tier-btn--selected' : ''}`}
                      onClick={() => onSet({ attrId, value: val })}
                    >
                      {displayVal}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LegendaryAffixPicker;
