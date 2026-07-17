import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import StatRow from '../components/StatRow';
import { classifyEvoDisplay, getRefineForSlot, getTalentSchoolId } from './equipmentData';
import type { Profession, ProfessionTypeKey } from '../profession';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
} from '../types';
import {
  calcStatValue,
  enchantsData,
  getItemNameColor,
  getSuitInfo,
  resolveEnchantSelection,
  truncate1Str,
} from './equipmentSlotPickerData';
import { calculateEquipmentSlotAbilityScore } from '../stats/calculateAbilityScore';

// マウスカーソルとポップアップの間の余白(px)。
const CURSOR_GAP = 14;

interface EquipmentItemPopupProps {
  /** 現在のマウスカーソル座標(追従表示用)。 */
  mouseX: number;
  mouseY: number;
  /** 'right'(既定): カーソルの右側に表示。'left': 右側に部位が寄っている場合に左側へ表示。 */
  align?: 'right' | 'left';
  slot: EquipmentSlotId;
  item: EquipmentItem;
  equippedItems: EquippedItems;
  refineLevel: number;
  perfectline: number;
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
  evolutionStats: Array<EvolutionStatId | undefined>;
  selectedLegendaryAffix: LegendaryAffixSelection | undefined;
  selectedLegendaryAffixGroup?: Array<LegendaryAffixSelection | undefined>;
  selectedEnchant: number | undefined;
}

// 装備パネルの装備済みスロットにホバーした際に表示する、選択ダイアログと同じ内訳の読み取り専用ポップアップ。
// マウスカーソルに追従し、クリック操作の邪魔にならないようにする。
function EquipmentItemPopup({
  mouseX,
  mouseY,
  align = 'right',
  slot,
  item,
  equippedItems,
  refineLevel,
  perfectline,
  profession,
  professionTypeKey,
  evolutionStats,
  selectedLegendaryAffix,
  selectedLegendaryAffixGroup,
  selectedEnchant,
}: EquipmentItemPopupProps) {
  const { t } = useTranslation();
  const x = align === 'left' ? mouseX - CURSOR_GAP : mouseX + CURSOR_GAP;

  const refineTypeData = getRefineForSlot(slot, profession);
  const cumulativeEffects =
    refineLevel > 0 ? (refineTypeData?.cumulative[refineLevel - 1] ?? null) : null;

  // 進化ステータス表示パターンの分類(classifyEvoDisplay、選択ダイアログ・計算側と共有)。
  const talentSchoolId = getTalentSchoolId(profession, professionTypeKey);
  const { kind: evoKind, isFixedStat, fixedEvoEffects } = classifyEvoDisplay(item, talentSchoolId);
  const sliderValue = isFixedStat ? 100 : perfectline;

  const reforgedStat = evolutionStats[2];
  // 他の個別ステータス表示と異なり、この値は四捨五入した整数として合算されるため
  // (calculateRawStats.tsの改鋳スロット処理を参照)、表示も同じ四捨五入値にする。
  const reforgeEvoValue =
    item.reforgeMaxPerfectline > 0
      ? String(Math.round(calcStatValue(item.reforgeEvoMin, item.reforgeEvoMax, sliderValue)))
      : '0';
  const showReforgeRow =
    (evoKind === 'btFixed' || evoKind === 'dataEvo' || evoKind === 'sameEvo') && !!reforgedStat;

  const suitInfo = useMemo(
    () => getSuitInfo(item, equippedItems, talentSchoolId),
    [item, equippedItems, talentSchoolId],
  );

  const enchantsList = item.enchantId ? (enchantsData[String(item.enchantId)] ?? []) : [];
  const { data: selectedEnchantData } = resolveEnchantSelection(enchantsList, selectedEnchant);

  const selectedAffixEntry = item.legendaryAffix?.find(
    (e) => e.attrId === selectedLegendaryAffix?.attrId,
  );
  const affixDisplayValue =
    selectedAffixEntry && selectedLegendaryAffix
      ? selectedAffixEntry.isPercent
        ? `+${selectedLegendaryAffix.value / 100}%`
        : `+${selectedLegendaryAffix.value}`
      : null;

  const affixGroups = item.legendaryAffixGroups?.[String(talentSchoolId)];
  const selectedAffixGroupRows = (affixGroups ?? [])
    .map((group, i) => {
      const sel = selectedLegendaryAffixGroup?.[i];
      if (!sel) return null;
      const entry = group.find((e) => e.attrId === sel.attrId);
      if (!entry) return null;
      const value = entry.isPercent ? `+${sel.value / 100}%` : `+${sel.value}`;
      return { attrId: sel.attrId, value };
    })
    .filter((row): row is { attrId: number; value: string } => row !== null);

  const name = t(`items.${item.id}.name`, { ns: 'game-data' });

  const abilityScoreTotal = calculateEquipmentSlotAbilityScore(
    item,
    perfectline,
    evolutionStats,
    selectedLegendaryAffix,
    selectedEnchant,
    refineLevel,
    profession,
    professionTypeKey,
    selectedLegendaryAffixGroup,
  ).total;

  return (
    <FloatingTooltip x={x} y={mouseY} clamp align={align} className="equip-item-popup">
      <div className="equip-item-popup__name" style={{ color: getItemNameColor(item) }}>
        {name}
      </div>

      {item.baseStats.length > 0 && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline">
            {t('buildPlanner.baseStats')}
          </h4>
          {item.baseStats.map(([attrId, min, max]) => (
            <StatRow
              key={attrId}
              name={t(`attributes.${attrId}`, { ns: 'game-data' })}
              value={truncate1Str(calcStatValue(min, max, perfectline))}
            />
          ))}
        </div>
      )}

      {(evoKind !== 'selectable' ||
        selectedLegendaryAffix ||
        selectedAffixGroupRows.length > 0) && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline">
            {t('buildPlanner.evolutionStats')}
          </h4>
          {selectedLegendaryAffix && affixDisplayValue && (
            <StatRow
              className="equip-item-popup__affix-row"
              name={t(`attributes.${selectedLegendaryAffix.attrId}`, { ns: 'game-data' })}
              value={affixDisplayValue}
            />
          )}
          {selectedAffixGroupRows.map((row) => (
            <StatRow
              key={row.attrId}
              className="equip-item-popup__affix-row"
              name={t(`attributes.${row.attrId}`, { ns: 'game-data' })}
              value={row.value}
            />
          ))}
          {evoKind === 'seriesFixed' &&
            fixedEvoEffects!.map(([, attrId, min, , isPercent], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={isPercent ? `+${min / 100}%` : `+${min}`}
              />
            ))}
          {evoKind === 'btFixed' &&
            fixedEvoEffects!.map(([, attrId, min, max, isPercent], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={
                  isPercent
                    ? `+${min / 100}%`
                    : `+${truncate1Str(calcStatValue(min, max, sliderValue))}`
                }
              />
            ))}
          {evoKind === 'sameEvo' &&
            [0, 1].map((i) => {
              const statId = evolutionStats[i];
              if (!statId) return null;
              const [, evoMin, evoMax] = item.evo[i] ?? [0, 0, 0];
              return (
                <StatRow
                  key={i}
                  name={t(`buildPlanner.stats.${statId}`)}
                  value={`+${truncate1Str(calcStatValue(evoMin, evoMax, sliderValue))}`}
                />
              );
            })}
          {evoKind === 'dataEvo' &&
            item.evo.map(([attrId, min, max], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={`+${truncate1Str(calcStatValue(min, max, sliderValue))}`}
              />
            ))}
          {showReforgeRow && (
            <StatRow
              name={
                <>
                  <span className="equip-evo-slot__tag">{t('buildPlanner.reforgedSlot')}</span>{' '}
                  {t(`buildPlanner.stats.${reforgedStat}`)}
                </>
              }
              value={`+${reforgeEvoValue}`}
            />
          )}
        </div>
      )}

      {suitInfo && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading">{t('buildPlanner.suitEffects.title')}</h4>
          <div className="suit-effects__suit-count-row">
            <span className="suit-effects__suit-name">
              {t(`buildPlanner.suitEffects.suit${suitInfo.suitId}`)}
            </span>
            <span className="suit-effects__suit-count">
              {suitInfo.count}/{suitInfo.tiers[suitInfo.tiers.length - 1]?.limitNum ?? 4}
            </span>
          </div>
          {suitInfo.tiers
            .filter((tier) => suitInfo.count >= tier.limitNum)
            .map((tier) => {
              const buffId = tier.effects[suitInfo.schoolId] ?? tier.effects['101'] ?? null;
              const desc = buffId
                ? t(`attrDescs.${buffId}`, { ns: 'game-data', defaultValue: '' })
                : '';
              return desc ? (
                <div key={tier.limitNum} className="suit-effects__tier suit-effects__tier--active">
                  <span className="suit-effects__tier-label">
                    {t('buildPlanner.suitEffects.tierLabel', { n: tier.limitNum })}
                  </span>
                  <span className="suit-effects__tier-desc">{desc}</span>
                </div>
              ) : null;
            })}
        </div>
      )}

      {selectedEnchantData && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline">
            {t('buildPlanner.equippedEffects')}
          </h4>
          {selectedEnchantData.effects.map(([attrId, value]) => (
            <StatRow
              key={attrId}
              name={t(`attributes.${attrId}`, { ns: 'game-data' })}
              value={`+${value}`}
            />
          ))}
        </div>
      )}

      {cumulativeEffects && cumulativeEffects.length > 0 && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading">{t('buildPlanner.refineEffect')}</h4>
          {cumulativeEffects.map(([attrId, value]) => (
            <StatRow
              key={attrId}
              name={t(`attributes.${attrId}`, { ns: 'game-data' })}
              value={`+${value}`}
            />
          ))}
        </div>
      )}

      <StatRow
        className="equip-ability-score-row--total"
        name={t('buildPlanner.abilityScore')}
        value={Math.round(abilityScoreTotal).toLocaleString()}
      />
    </FloatingTooltip>
  );
}

export default EquipmentItemPopup;
