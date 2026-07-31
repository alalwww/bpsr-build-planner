import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import { useArrowKeySelect } from '../components/useArrowKeySelect';
import { useCloseOnOutsideClick } from '../components/useCloseOnOutsideClick';
import { useDelayedUnmount } from '../components/useDelayedUnmount';
import { useDropdownKeyboardNav } from '../components/useDropdownKeyboardNav';
import type { LegendaryAffixEntry, LegendaryAffixSelection } from '../types';

const CLOSE_ANIM_MS = 150;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(containerRef, isOpen, onToggleOpen);
  const shouldRenderPicker = useDelayedUnmount(isOpen, CLOSE_ANIM_MS);
  useDropdownKeyboardNav(panelRef, isOpen && shouldRenderPicker, onToggleOpen, triggerRef);
  const selectedAffixEntry = legendaryAffixList.find(
    (e) => e.attrId === selectedLegendaryAffix?.attrId,
  );
  const selectedAffixDisplayValue =
    selectedAffixEntry && selectedLegendaryAffix
      ? formatAffixValue(selectedAffixEntry.isPercent, selectedLegendaryAffix.value)
      : null;

  // 選択肢を選んだ後は、選択肢ボタン(アンマウントされる)からトリガーへフォーカスを戻す。
  const handleSet = (selection: LegendaryAffixSelection | undefined) => {
    onSet(selection);
    triggerRef.current?.focus();
  };

  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(選択肢一覧)と一致させる。
  // {attrId, value}のオブジェクト値は参照が毎レンダー変わるため isEqual で構造比較する。
  const affixOptions: (LegendaryAffixSelection | undefined)[] = [
    undefined,
    ...legendaryAffixList.flatMap(({ attrId, values }) => values.map((value) => ({ attrId, value }))),
  ];
  const handleTriggerKeyDown = useArrowKeySelect({
    values: affixOptions,
    current: selectedLegendaryAffix,
    onChange: handleSet,
    disabled: isOpen,
    isEqual: (a, b) => a?.attrId === b?.attrId && a?.value === b?.value,
  });

  return (
    <div className="equip-evo-slot equip-affix-slot" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`equip-evo-slot__btn${selectedLegendaryAffix != null ? ' equip-evo-slot__btn--set' : ''}`}
        onClick={onToggleOpen}
        onKeyDown={handleTriggerKeyDown}
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
      {shouldRenderPicker && (
        <div
          className={`equip-evo-picker-anchor dropdown-panel-anim${isOpen ? '' : ' dropdown-panel-anim--closing'}`}
        >
          <div className="dropdown-panel-anim__inner">
            <div className="equip-evo-picker equip-affix-picker" ref={panelRef}>
              <button
                type="button"
                className={`equip-evo-option equip-affix-unset${selectedLegendaryAffix == null ? ' equip-evo-option--selected' : ''}`}
                onClick={() => handleSet(undefined)}
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
                      onClick={() => handleSet({ attrId, value })}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default LegendaryAffixPicker;
