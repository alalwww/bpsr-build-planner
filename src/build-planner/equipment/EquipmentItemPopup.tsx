import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import StatRow from '../components/StatRow';
import { getRefineForSlot } from './equipmentData';
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
  suitsData,
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
  selectedEnchant,
}: EquipmentItemPopupProps) {
  const { t } = useTranslation();
  const x = align === 'left' ? mouseX - CURSOR_GAP : mouseX + CURSOR_GAP;

  const refineTypeData = getRefineForSlot(slot, profession);
  const cumulativeEffects =
    refineLevel > 0 ? (refineTypeData?.cumulative[refineLevel - 1] ?? null) : null;

  const isFixedStat =
    item.baseStats.length > 0 && item.baseStats.every(([, min, max]) => min === max);
  const sliderValue = isFixedStat ? 100 : perfectline;

  const typeIndex = professionTypeKey === 'type1' ? 0 : 1;
  const talentSchoolId = profession.talentSchoolIds[typeIndex];
  const fixedEvoEffects = item.fixedEvolutionStats[String(talentSchoolId)] ?? null;
  const hasAnyFixedEvo = fixedEvoEffects !== null && fixedEvoEffects.length > 0;
  const isSeriesFixed = isFixedStat && hasAnyFixedEvo;
  const hasBtFixedEvo = !isFixedStat && hasAnyFixedEvo;
  const hasDataEvo = !isFixedStat && !hasBtFixedEvo && item.evo.length > 0;
  const hasSameEvo =
    hasDataEvo && item.evo.length > 1 && item.evo.every(([attrId]) => attrId === item.evo[0][0]);

  const reforgedStat = evolutionStats[2];
  const reforgeEvoValue =
    item.reforgeMaxPerfectline > 0
      ? calcStatValue(item.reforgeEvoMin, item.reforgeEvoMax, sliderValue)
      : 0;
  const showReforgeRow = (hasBtFixedEvo || hasDataEvo) && !!reforgedStat;

  const suitInfo = useMemo(() => {
    const suitId = item.suitId;
    if (!suitId || !suitsData[String(suitId)]) return null;
    let count = 0;
    for (const eq of Object.values(equippedItems)) {
      if (eq?.suitId === suitId) count++;
    }
    return {
      suitId,
      count,
      tiers: suitsData[String(suitId)].tiers,
      schoolId: String(talentSchoolId),
    };
  }, [item, equippedItems, talentSchoolId]);

  const enchantsList = item.enchantId ? (enchantsData[String(item.enchantId)] ?? []) : [];
  const baseEnchantItem =
    selectedEnchant !== undefined
      ? enchantsList.find(
          (e) =>
            e.id === selectedEnchant ||
            e.refined?.id === selectedEnchant ||
            e.perfect?.id === selectedEnchant,
        )
      : undefined;
  const selectedEnchantData =
    baseEnchantItem?.refined?.id === selectedEnchant
      ? baseEnchantItem?.refined
      : baseEnchantItem?.perfect?.id === selectedEnchant
        ? baseEnchantItem?.perfect
        : baseEnchantItem;

  const selectedAffixEntry = item.legendaryAffix?.find(
    (e) => e.attrId === selectedLegendaryAffix?.attrId,
  );
  const affixDisplayValue =
    selectedAffixEntry && selectedLegendaryAffix
      ? selectedAffixEntry.isPercent
        ? `+${selectedLegendaryAffix.value / 100}%`
        : `+${selectedLegendaryAffix.value}`
      : null;

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
              value={calcStatValue(min, max, perfectline)}
            />
          ))}
        </div>
      )}

      {(isSeriesFixed || hasBtFixedEvo || hasDataEvo || selectedLegendaryAffix) && (
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
          {isSeriesFixed &&
            fixedEvoEffects!.map(([, attrId, min, , isPercent], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={isPercent ? `+${min / 100}%` : `+${min}`}
              />
            ))}
          {hasBtFixedEvo &&
            fixedEvoEffects!.map(([, attrId, min, max, isPercent], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={isPercent ? `+${min / 100}%` : `+${calcStatValue(min, max, sliderValue)}`}
              />
            ))}
          {hasSameEvo &&
            [0, 1].map((i) => {
              const statId = evolutionStats[i];
              if (!statId) return null;
              const [, evoMin, evoMax] = item.evo[i] ?? [0, 0, 0];
              return (
                <StatRow
                  key={i}
                  name={t(`buildPlanner.stats.${statId}`)}
                  value={`+${calcStatValue(evoMin, evoMax, sliderValue)}`}
                />
              );
            })}
          {hasDataEvo &&
            !hasSameEvo &&
            item.evo.map(([attrId, min, max], i) => (
              <StatRow
                key={i}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={`+${calcStatValue(min, max, sliderValue)}`}
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
        value={abilityScoreTotal.toLocaleString()}
      />
    </FloatingTooltip>
  );
}

export default EquipmentItemPopup;
