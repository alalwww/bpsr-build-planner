import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import { useCloseOnOutsideClick } from '../components/useCloseOnOutsideClick';
import type { LegendaryAffixEntry, LegendaryAffixSelection } from '../types';

interface LegendaryAffixPickerProps {
  legendaryAffixList: LegendaryAffixEntry[];
  selectedLegendaryAffix: LegendaryAffixSelection | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSet: (selection: LegendaryAffixSelection | undefined) => void;
}

function formatAffixValue(isPercent: boolean, value: number): string {
  return isPercent ? `+${value / 100}%` : `+${value}`;
}

function LegendaryAffixPicker({
  legendaryAffixList,
  selectedLegendaryAffix,
  isOpen,
  onToggleOpen,
  onSet,
}: LegendaryAffixPickerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(containerRef, isOpen, onToggleOpen);
  const selectedAffixEntry = legendaryAffixList.find(
    (e) => e.attrId === selectedLegendaryAffix?.attrId,
  );
  const selectedAffixDisplayValue =
    selectedAffixEntry && selectedLegendaryAffix
      ? formatAffixValue(selectedAffixEntry.isPercent, selectedLegendaryAffix.value)
      : null;

  return (
    <div className="equip-evo-slot equip-affix-slot" ref={containerRef}>
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
          {legendaryAffixList.flatMap(({ attrId, isPercent, values }) =>
            values.map((value) => {
              const isSelected =
                selectedLegendaryAffix?.attrId === attrId &&
                selectedLegendaryAffix?.value === value;
              return (
                <button
                  key={`${attrId}-${value}`}
                  type="button"
                  className={`equip-evo-option equip-affix-option${isSelected ? ' equip-evo-option--selected' : ''}`}
                  onClick={() => onSet({ attrId, value })}
                >
                  <span className="equip-affix-option__name">
                    {t(`attributes.${attrId}`, { ns: 'game-data' })}
                  </span>
                  <span className="equip-affix-option__value">
                    {formatAffixValue(isPercent, value)}
                  </span>
                </button>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}

export default LegendaryAffixPicker;
