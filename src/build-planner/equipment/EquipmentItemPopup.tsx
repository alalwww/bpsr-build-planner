import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import perfectlineLockIconUrl from '../../assets/ui/profession_icon_lock01.png';
import FloatingTooltip from '../components/FloatingTooltip';
import { renderEffectDesc } from '../components/gameText';
import StatRow from '../components/StatRow';
import {
  classifyEvoDisplay,
  getMaxPerfectline,
  getRefineForSlot,
  getTalentSchoolId,
} from './equipmentData';
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
  getEnchantIconUrl,
  getItemNameColor,
  getQualityColor,
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
  /**
   * 装着効果/精錬効果セクションを表示するか(既定true)。装備選択ダイアログの候補一覧
   * ホバー時は、スロットに現在設定中の装着効果/精錬レベルをそのまま流用しているだけで
   * 候補アイテム自身のステータスではないため、falseにして非表示にする。
   */
  showEnchantAndRefine?: boolean;
  /**
   * 改鋳スロットで実際に選択中のステータス名/完成度を表示するか(既定true)。装備パネルの
   * 装備済みスロットホバー時はこの装備自身に設定済みの内容なのでそのまま表示してよいが、
   * 装備選択ダイアログの候補一覧ホバー時は evolutionStats/perfectline がダイアログ側の
   * 現在の状態を指しているだけで候補アイテム自身の情報ではないため、falseにして選択中
   * ステータス名を隠し、完成度100%時点の値のみを表示する。
   */
  showReforgeSelection?: boolean;
  /**
   * レアステータスを枠ごとの内訳(未装着枠は「未装着」表示)で見せるか(既定true)。
   * 装備選択ダイアログの候補一覧ホバー時は、選択状態がダイアログ側の現在の状態でしかなく
   * 候補アイテム自身の情報ではないため、falseにして枠数のみ(内訳なし)を表示する。
   */
  showRareStatsDetail?: boolean;
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
  showEnchantAndRefine = true,
  showReforgeSelection = true,
  showRareStatsDetail = true,
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
  const maxPerfectline = isFixedStat ? 100 : getMaxPerfectline(item);

  const reforgedStat = evolutionStats[2];
  // showReforgeSelection=falseの場合(装備選択ダイアログの候補一覧ホバー時)は、
  // evolutionStats/sliderValueがダイアログ側の現在の状態を指しているだけで候補アイテム
  // 自身の情報ではないため、完成度100%時点の値を使う。
  // 他の個別ステータス表示と異なり、この値は四捨五入した整数として合算されるため
  // (calculateRawStats.tsの改鋳スロット処理を参照)、表示も同じ四捨五入値にする。
  const reforgeEvoValue =
    item.reforgeMaxPerfectline > 0
      ? String(
          Math.round(
            calcStatValue(
              item.reforgeEvoMin,
              item.reforgeEvoMax,
              showReforgeSelection ? sliderValue : 100,
            ),
          ),
        )
      : '0';
  const showReforgeRow = item.reforgeMaxPerfectline > 0;

  const suitInfo = useMemo(
    () => getSuitInfo(item, equippedItems, talentSchoolId),
    [item, equippedItems, talentSchoolId],
  );

  const enchantsList = item.enchantId ? (enchantsData[String(item.enchantId)] ?? []) : [];
  const { base: selectedEnchantBase, data: selectedEnchantData } = resolveEnchantSelection(
    enchantsList,
    selectedEnchant,
  );

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

  // レアステータスの枠ごとの内訳。単一選択式(legendaryAffix)は1枠、蒼海武器等の4枠選択式
  // (legendaryAffixGroups)はグループ数がそのまま枠数になる。未設定の枠も「未設定」行として
  // 含める(showRareStatsDetail=falseの場合は使わず、枠数のみ表示する)。他のドロップダウン
  // (改鋳/装着効果/レアステータス選択)と表記を揃えるため evolutionStatUnset を再利用する。
  const rareStatsRows: { key: string | number; name: string; value: string }[] =
    item.legendaryAffix && item.legendaryAffix.length > 0
      ? [
          selectedLegendaryAffix && affixDisplayValue
            ? {
                key: 'single',
                name: t(`attributes.${selectedLegendaryAffix.attrId}`, { ns: 'game-data' }),
                value: affixDisplayValue,
              }
            : { key: 'single', name: t('buildPlanner.evolutionStatUnset'), value: '' },
        ]
      : (affixGroups ?? []).map((group, i) => {
          const sel = selectedLegendaryAffixGroup?.[i];
          const entry = sel ? group.find((e) => e.attrId === sel.attrId) : undefined;
          if (entry && sel) {
            return {
              key: i,
              name: t(`attributes.${sel.attrId}`, { ns: 'game-data' }),
              value: entry.isPercent ? `+${sel.value / 100}%` : `+${sel.value}`,
            };
          }
          return { key: i, name: t('buildPlanner.evolutionStatUnset'), value: '' };
        });

  const rareStatsSlotCount =
    item.legendaryAffix && item.legendaryAffix.length > 0 ? 1 : (affixGroups?.length ?? 0);

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

      <div className="equip-item-popup__section">
        <label className="equipment-dialog__label">
          {t('buildPlanner.perfectline')}
          <span className="equipment-dialog__slider-value">
            {sliderValue}/{maxPerfectline}
          </span>
        </label>
        <div className="equipment-dialog__slider-wrap">
          <input
            type="range"
            className="equipment-dialog__slider"
            min={1}
            max={100}
            value={sliderValue}
            readOnly
            tabIndex={-1}
          />
          {maxPerfectline < 100 && (
            <img
              src={perfectlineLockIconUrl}
              alt=""
              className="equipment-dialog__slider-lock"
              style={{ left: `${maxPerfectline}%` }}
            />
          )}
        </div>
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

      {evoKind !== 'selectable' && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline">
            {t('buildPlanner.evolutionStats')}
          </h4>
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
                showReforgeSelection && reforgedStat ? (
                  <>
                    <span className="equip-evo-slot__tag">{t('buildPlanner.reforgedSlot')}</span>{' '}
                    {t(`buildPlanner.stats.${reforgedStat}`)}
                  </>
                ) : (
                  <span className="equip-evo-slot__tag">{t('buildPlanner.reforgedSlot')}</span>
                )
              }
              value={
                showReforgeSelection && !reforgedStat
                  ? t('buildPlanner.evolutionStatUnset')
                  : `+${reforgeEvoValue}`
              }
            />
          )}
        </div>
      )}

      {rareStatsSlotCount > 0 && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline equip-item-popup__heading--rare">
            {t('buildPlanner.rareStats')}
            {!showRareStatsDetail && (
              <span className="equip-item-popup__rare-stats-count">×{rareStatsSlotCount}</span>
            )}
          </h4>
          {showRareStatsDetail &&
            rareStatsRows.map((row) => (
              <StatRow
                key={row.key}
                className="equip-item-popup__affix-row"
                name={row.name}
                value={row.value}
              />
            ))}
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
              const effect = tier.effects[suitInfo.schoolId] ?? tier.effects['101'] ?? null;
              const tmpl = effect
                ? t(`attrDescs.${effect.buffId}`, { ns: 'game-data', defaultValue: '' })
                : '';
              const desc = effect && tmpl ? renderEffectDesc(tmpl, effect.params, true) : '';
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

      {showEnchantAndRefine && enchantsList.length > 0 && (
        <div className="equip-item-popup__section">
          <h4 className="equip-details-section__heading equip-item-popup__heading--underline">
            {t('buildPlanner.equippedEffects')}
          </h4>
          {selectedEnchantData ? (
            <>
              <div className="equip-item-popup__enchant-name-row">
                {selectedEnchantBase?.icon && getEnchantIconUrl(selectedEnchantBase.icon) && (
                  <img
                    className="equip-enchant-icon"
                    src={getEnchantIconUrl(selectedEnchantBase.icon)}
                    alt=""
                  />
                )}
                <span
                  className="equip-item-popup__enchant-name"
                  style={{ color: getQualityColor(selectedEnchantBase?.quality ?? 0) }}
                >
                  {t(`items.${selectedEnchantData.id}.name`, { ns: 'game-data' })}
                </span>
              </div>
              {selectedEnchantData.effects.map(([attrId, value]) => (
                <StatRow
                  key={attrId}
                  className="equip-item-popup__enchant-effect-row"
                  name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                  value={`+${value}`}
                />
              ))}
            </>
          ) : (
            <StatRow name={t('buildPlanner.evolutionStatUnset')} value="" />
          )}
        </div>
      )}

      {showEnchantAndRefine && cumulativeEffects && cumulativeEffects.length > 0 && (
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
