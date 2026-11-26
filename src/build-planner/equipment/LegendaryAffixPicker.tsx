import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
import { useArrowKeySelect } from '../components/useArrowKeySelect';
import { getStatIconUrlForAttrId } from '../stats/statIcons';
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

const isSameAffix = (
  a: LegendaryAffixSelection | undefined,
  b: LegendaryAffixSelection | undefined,
) => a?.attrId === b?.attrId && a?.value === b?.value;

// レアステータス(伝説刻印)の選択スロット。トリガーは進化ステータスのスロットと同じ見た目、
// 選択肢リストは共通の Dropdown(位置計算・キーボード操作・スマホのボトムシート表示)と
// SelectDropdown と同じ見た目を使う。開閉状態は呼び出し側が管理する。
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
      ? formatAffixValue(selectedAffixEntry.isPercent, selectedLegendaryAffix.value)
      : null;

  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(選択肢一覧)と一致させる。
  // {attrId, value}のオブジェクト値は参照が毎レンダー変わるため isEqual で構造比較する。
  const affixOptions: (LegendaryAffixSelection | undefined)[] = [
    undefined,
    ...legendaryAffixList.flatMap(({ attrId, values }) =>
      values.map((value) => ({ attrId, value })),
    ),
  ];
  const handleTriggerKeyDown = useArrowKeySelect({
    values: affixOptions,
    current: selectedLegendaryAffix,
    onChange: onSet,
    isEqual: isSameAffix,
  });
  const selectedIcon =
    selectedLegendaryAffix != null
      ? getStatIconUrlForAttrId(selectedLegendaryAffix.attrId)
      : undefined;

  return (
    <div className="equip-evo-slot equip-affix-slot">
      <Dropdown
        open={isOpen}
        onOpenChange={(open) => {
          if (open !== isOpen) onToggleOpen();
        }}
        triggerClassName={`equip-evo-slot__btn${selectedLegendaryAffix != null ? ' equip-evo-slot__btn--set' : ''}`}
        panelClassName="select-dropdown__list"
        panelFitContent
        onTriggerKeyDown={handleTriggerKeyDown}
        renderTrigger={(open) => (
          <>
            <span className="equip-evo-slot__stat equip-affix-slot__stat">
              {selectedIcon && <img src={selectedIcon} alt="" className="equip-evo-slot__icon" />}
              {selectedLegendaryAffix != null
                ? t(`attributes.${selectedLegendaryAffix.attrId}`, { ns: 'game-data' })
                : t('buildPlanner.evolutionStatUnset')}
            </span>
            {selectedAffixDisplayValue && (
              <span className="equip-evo-slot__value">{selectedAffixDisplayValue}</span>
            )}
            <Chevron open={open} className="equip-evo-slot__arrow" />
          </>
        )}
      >
        {(close) => (
          <div role="listbox">
            {affixOptions.map((option) => {
              const isSelected = isSameAffix(option, selectedLegendaryAffix);
              const entry = option
                ? legendaryAffixList.find((e) => e.attrId === option.attrId)
                : undefined;
              const iconUrl = option ? getStatIconUrlForAttrId(option.attrId) : undefined;
              return (
                <button
                  key={option ? `${option.attrId}-${option.value}` : '__unset'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  className={`select-dropdown__option equip-affix-option${isSelected ? ' select-dropdown__option--selected' : ''}`}
                  onClick={() => {
                    onSet(option);
                    close();
                  }}
                >
                  {iconUrl && <img src={iconUrl} alt="" className="select-dropdown__icon" />}
                  <span
                    className={`select-dropdown__label${option ? '' : ' select-dropdown__label--muted'}`}
                  >
                    {option
                      ? t(`attributes.${option.attrId}`, { ns: 'game-data' })
                      : t('buildPlanner.evolutionStatUnset')}
                  </span>
                  {option && entry && (
                    <span className="equip-affix-option__value">
                      {formatAffixValue(entry.isPercent, option.value)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Dropdown>
    </div>
  );
}

export default LegendaryAffixPicker;
