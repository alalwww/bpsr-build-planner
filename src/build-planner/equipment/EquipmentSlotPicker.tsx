import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import DraggableDialog from '../components/DraggableDialog';
import Dropdown from '../components/Dropdown';
import FloatingTooltip from '../components/FloatingTooltip';
import StatRow from '../components/StatRow';
import Stepper from '../components/Stepper';
import { getMaxPerfectline, getRefineForSlot, getRestrictedEvoStat } from './equipmentData';
import { calculateEquipmentSlotAbilityScore } from '../stats/calculateAbilityScore';
import type { Profession, ProfessionTypeKey } from '../profession';
import type {
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
} from '../types';
import type { EnchantItem } from './equipmentSlotPickerData';
import {
  calcStatValue,
  enchantsData,
  EVOLUTION_STAT_IDS,
  getEnchantIconUrl,
  getEquipBgUrlFrom,
  getItemNameColor,
  getPickerEquipUrl,
  getPlaceholderStatIds,
  getQualityColor,
  REFINE_LEVEL_MILESTONES,
  suitsData,
} from './equipmentSlotPickerData';
import EvoSlotPicker from './EvoSlotPicker';
import LegendaryAffixPicker from './LegendaryAffixPicker';

interface EquipmentSlotPickerProps {
  slot: EquipmentSlotId;
  slotLabel: string;
  candidates: EquipmentItem[];
  equippedId: number | undefined;
  equippedItems: EquippedItems;
  refineLevel: number;
  perfectline: number;
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
  evolutionStats: Array<EvolutionStatId | undefined>;
  selectedLegendaryAffix: LegendaryAffixSelection | undefined;
  selectedEnchant: number | undefined;
  onSelect: (item: EquipmentItem) => void;
  onUnequip: () => void;
  onRefineLevel: (level: number) => void;
  onPerfectline: (value: number) => void;
  onSetEvolutionStat: (slotIndex: number, statId: EvolutionStatId | undefined) => void;
  onSetLegendaryAffix: (selection: LegendaryAffixSelection | undefined) => void;
  onSetEnchant: (itemId: number | undefined) => void;
  onClose: () => void;
}

function EquipmentSlotPicker({
  slot,
  slotLabel,
  candidates,
  equippedId,
  equippedItems,
  refineLevel,
  perfectline,
  profession,
  professionTypeKey,
  evolutionStats,
  selectedLegendaryAffix,
  selectedEnchant,
  onSelect,
  onUnequip,
  onRefineLevel,
  onPerfectline,
  onSetEvolutionStat,
  onSetLegendaryAffix,
  onSetEnchant,
  onClose,
}: EquipmentSlotPickerProps) {
  const { t } = useTranslation();
  const [editingEvoSlot, setEditingEvoSlot] = useState<number | null>(null);
  const [affixPickerOpen, setAffixPickerOpen] = useState(false);
  const [enchantTooltip, setEnchantTooltip] = useState<{
    enchant: EnchantItem;
    x: number;
    y: number;
  } | null>(null);
  const enchantTooltipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEnchantTooltip = (enchant: EnchantItem, e: React.MouseEvent<HTMLElement>) => {
    if (enchantTooltipHideTimer.current !== null) {
      clearTimeout(enchantTooltipHideTimer.current);
      enchantTooltipHideTimer.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setEnchantTooltip({ enchant, x: rect.right + 6, y: rect.top });
  };
  const hideEnchantTooltip = () => {
    enchantTooltipHideTimer.current = setTimeout(() => setEnchantTooltip(null), 80);
  };

  const equippedItem =
    equippedId !== undefined ? candidates.find((c) => c.id === equippedId) : undefined;
  const placeholderStatIds = getPlaceholderStatIds(slot, profession);
  const refineTypeData = getRefineForSlot(slot, profession);

  // この部位の能力スコア内訳(基礎/進化/装着効果/精錬)
  const abilityScoreBreakdown = equippedItem
    ? calculateEquipmentSlotAbilityScore(
        equippedItem,
        perfectline,
        evolutionStats,
        selectedLegendaryAffix,
        selectedEnchant,
        refineLevel,
        profession,
        professionTypeKey,
      )
    : { total: 0, baseStats: 0, evolution: 0, enchant: 0, refine: 0 };

  // プレビューボックス用アイコン URL
  const bgUrl = getEquipBgUrlFrom(equippedItem);
  const iconUrl = equippedItem
    ? slot === 'weapon'
      ? (getPickerEquipUrl(equippedItem.icon + '_t') ?? getPickerEquipUrl(equippedItem.icon))
      : (getPickerEquipUrl(equippedItem.icon + '_l') ?? getPickerEquipUrl(equippedItem.icon))
    : undefined;

  // 装着効果データ (enchantId がある場合のみ)
  // 装備レベル降順 → レア度降順 → 名前昇順 → ID昇順
  const sortedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        if (b.equipGs !== a.equipGs) return b.equipGs - a.equipGs;
        if (b.quality !== a.quality) return b.quality - a.quality;
        const na = t(`items.${a.id}.name`, { ns: 'game-data' });
        const nb = t(`items.${b.id}.name`, { ns: 'game-data' });
        const nc = na.localeCompare(nb);
        if (nc !== 0) return nc;
        return a.id - b.id;
      }),
    [candidates, t],
  );

  const enchantsList = equippedItem?.enchantId
    ? (enchantsData[String(equippedItem.enchantId)] ?? [])
    : [];
  const sortedEnchants = [...enchantsList].sort(
    (a, b) => (b.level ?? 0) - (a.level ?? 0) || b.id - a.id,
  );
  // selectedEnchant は基本/精/極いずれかのID。base → refined/perfect を逆引き。
  const baseEnchantItem =
    selectedEnchant !== undefined
      ? sortedEnchants.find(
          (e) =>
            e.id === selectedEnchant ||
            e.refined?.id === selectedEnchant ||
            e.perfect?.id === selectedEnchant,
        )
      : undefined;
  const enchantGrade: 'base' | 'refined' | 'perfect' =
    baseEnchantItem?.refined?.id === selectedEnchant
      ? 'refined'
      : baseEnchantItem?.perfect?.id === selectedEnchant
        ? 'perfect'
        : 'base';
  const selectedEnchantData =
    enchantGrade === 'refined'
      ? baseEnchantItem?.refined
      : enchantGrade === 'perfect'
        ? baseEnchantItem?.perfect
        : baseEnchantItem;
  const hasEnchantGrades =
    !!baseEnchantItem && (!!baseEnchantItem.refined || !!baseEnchantItem.perfect);

  // 全ステータスが min===max の場合は固定ステータス装備（蒼海シリーズ等）。
  const isFixedStat =
    equippedItem !== undefined &&
    equippedItem.baseStats.length > 0 &&
    equippedItem.baseStats.every(([, min, max]) => min === max);
  const maxPerfectline = equippedItem ? getMaxPerfectline(equippedItem) : 80;
  const sliderValue = isFixedStat ? 100 : perfectline;
  const sliderDisabled = isFixedStat || !equippedItem;
  const sliderDisplay = equippedItem
    ? `${sliderValue}/${isFixedStat ? 100 : maxPerfectline}`
    : '--';
  const cumulativeEffects =
    refineLevel > 0 ? (refineTypeData?.cumulative[refineLevel - 1] ?? null) : null;

  // 進化ステータス: talentSchoolId でクラス型別のデータを取得。
  const typeIndex = professionTypeKey === 'type1' ? 0 : 1;
  const talentSchoolId = profession.talentSchoolIds[typeIndex];
  const fixedEvoEffects = equippedItem?.fixedEvolutionStats[String(talentSchoolId)] ?? null;

  // セット効果: 装備中アイテムのsuitId別ピース数
  const suitInfo = useMemo(() => {
    const suitId = equippedItem?.suitId;
    if (!suitId || !suitsData[String(suitId)]) return null;
    let count = 0;
    for (const item of Object.values(equippedItems)) {
      if (item?.suitId === suitId) count++;
    }
    const schoolId = String(talentSchoolId);
    return { suitId, count, tiers: suitsData[String(suitId)].tiers, schoolId };
  }, [equippedItem, equippedItems, talentSchoolId]);
  const hasAnyFixedEvo = fixedEvoEffects !== null && fixedEvoEffects.length > 0;

  // 進化ステータス表示パターンの分類:
  //   isSeriesFixed:  isFixedStat + fixedEvoEffects あり → シリーズ装備、全 Evo 固定、改鋳なし
  //   hasBtFixedEvo:  isFixedStat でない + fixedEvoEffects あり → BT防具、Evo1/2 固定 + 改鋳
  //   hasDataEvo:     fixedEvoEffects なし + evo あり
  //     hasSameEvo:   Evo1/2 が同一 attrId → 2スロット選択可能 + 改鋳
  //     それ以外:      Evo1/2 固定 + 改鋳
  //   その他: 全スロット選択可能（低レベル装備等）
  const isSeriesFixed = isFixedStat && hasAnyFixedEvo;
  const hasBtFixedEvo = !isFixedStat && hasAnyFixedEvo;
  const hasDataEvo = !isFixedStat && !hasBtFixedEvo && (equippedItem?.evo?.length ?? 0) > 0;
  // Evo1/Evo2 が同一 attrId の場合は選択式にする
  const hasSameEvo =
    hasDataEvo &&
    equippedItem!.evo.length > 1 &&
    equippedItem!.evo.every(([attrId]) => attrId === equippedItem!.evo[0][0]);

  // 改鋳ステータス値: 装備の完成度(sliderValue)のみで決まる。
  const reforgeEvoValue =
    equippedItem && equippedItem.reforgeMaxPerfectline > 0
      ? calcStatValue(equippedItem.reforgeEvoMin, equippedItem.reforgeEvoMax, sliderValue)
      : 0;
  const reforgedStat = evolutionStats[2];

  // 選択不可 Evo ステータス（部位 × 装備属性タイプによる制限）
  const restrictedEvoStat = equippedItem ? getRestrictedEvoStat(equippedItem, slot) : null;

  // 他スロットで選択済み、または部位制限に該当するステータスを除いた選択肢を返す。
  const availableEvoStats = (slotIdx: number): EvolutionStatId[] =>
    EVOLUTION_STAT_IDS.filter(
      (statId) =>
        statId !== restrictedEvoStat &&
        !evolutionStats.some((s, i) => i !== slotIdx && s === statId),
    );

  // BT グループ: 同 btGroupId のバリアントを equipGs 降順で並べる。
  const btGroup =
    equippedItem?.btGroupId != null
      ? candidates
          .filter((c) => c.btGroupId === equippedItem.btGroupId)
          .sort((a, b) => (b.btTime ?? 0) - (a.btTime ?? 0))
      : null;
  const showBtSelector = btGroup !== null && btGroup.length > 1;

  // 改鋳スロット UI (hasBtFixedEvo / hasDataEvo で共通利用)
  const showReforgeSection = (equippedItem?.reforgeEvoMax ?? 0) > 0;
  const reforgeSection = showReforgeSection ? (
    <div className="equip-evo-reforge">
      <EvoSlotPicker
        tag={t('buildPlanner.reforgedSlot')}
        valueLabel={reforgedStat ? `+${reforgeEvoValue}` : ''}
        selectedStat={reforgedStat}
        availableStats={EVOLUTION_STAT_IDS}
        isEditing={editingEvoSlot === 2}
        onToggleEdit={() => setEditingEvoSlot(editingEvoSlot === 2 ? null : 2)}
        onSelect={(statId) => {
          onSetEvolutionStat(2, statId);
          setEditingEvoSlot(null);
        }}
      />
    </div>
  ) : null;

  // 伝説刻印: quality=4 かつ legendaryAffix データがある場合のみ表示。
  const legendaryAffixList = equippedItem?.legendaryAffix ?? null;

  const legendaryAffixPicker =
    legendaryAffixList && legendaryAffixList.length > 0 ? (
      <LegendaryAffixPicker
        legendaryAffixList={legendaryAffixList}
        selectedLegendaryAffix={selectedLegendaryAffix}
        isOpen={affixPickerOpen}
        onToggleOpen={() => setAffixPickerOpen(!affixPickerOpen)}
        onSet={(sel) => {
          onSetLegendaryAffix(sel);
          setAffixPickerOpen(false);
        }}
      />
    ) : null;

  const enchantTooltipNode = enchantTooltip
    ? createPortal(
        <FloatingTooltip
          x={enchantTooltip.x}
          y={enchantTooltip.y}
          clamp
          className="equip-enchant-tooltip"
          onMouseEnter={() => {
            if (enchantTooltipHideTimer.current !== null) {
              clearTimeout(enchantTooltipHideTimer.current);
              enchantTooltipHideTimer.current = null;
            }
          }}
          onMouseLeave={hideEnchantTooltip}
        >
          <div
            className="equip-item-popup__name"
            style={{ color: getQualityColor(enchantTooltip.enchant.quality) }}
          >
            {t(`items.${enchantTooltip.enchant.id}.name`, { ns: 'game-data' })}
          </div>
          <div className="equip-item-popup__section">
            {enchantTooltip.enchant.effects.map(([attrId, value]) => (
              <StatRow
                key={attrId}
                name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                value={`+${value}`}
              />
            ))}
          </div>
          {enchantTooltip.enchant.cost && enchantTooltip.enchant.cost.length > 0 && (
            <div className="equip-enchant-cost">
              {t('buildPlanner.enchantCost')}:
              {enchantTooltip.enchant.cost.map(([itemId, qty]) => (
                <div key={itemId} className="equip-enchant-cost__row">
                  {t(`items.${itemId}.name`, { ns: 'game-data' })} x{qty}
                </div>
              ))}
            </div>
          )}
        </FloatingTooltip>,
        document.body,
      )
    : null;

  return (
    <>
      {enchantTooltipNode}
      <DraggableDialog
        title={t('buildPlanner.selectEquipmentTitle', { slot: slotLabel })}
        onClose={onClose}
        className="equipment-dialog--wide"
      >
        <div className="equipment-dialog__columns">
          {/* 左列: アイコンプレビュー / 装備選択 / 完成度 */}
          <div className="equipment-dialog__col-left">
            {/* アイコンプレビュー */}
            <div className="equip-preview-box">
              {equippedItem && bgUrl && (
                <img className="equip-preview-box__bg" src={bgUrl} alt="" />
              )}
              {equippedItem && iconUrl && (
                <img className="equip-preview-box__icon" src={iconUrl} alt="" />
              )}
            </div>

            <div className="equip-details-section">
              <label className="equipment-dialog__label">{slotLabel}</label>
              <Dropdown
                autoFocus
                panelWidthScale={1.3}
                triggerClassName={(isOpen) =>
                  `equipment-dialog__select-trigger${isOpen ? ' equipment-dialog__select-trigger--open' : ''}`
                }
                panelClassName="equipment-dialog__select-list"
                renderTrigger={(isOpen) => (
                  <>
                    <span
                      className="equipment-dialog__select-trigger-name"
                      style={equippedItem ? { color: getItemNameColor(equippedItem) } : undefined}
                    >
                      {equippedItem
                        ? `${equippedItem.equipGs} ${t(`items.${equippedItem.id}.name`, { ns: 'game-data' })}`
                        : t('buildPlanner.emptySlot')}
                    </span>
                    <Chevron open={isOpen} />
                  </>
                )}
              >
                {(close) => (
                  <>
                    <button
                      type="button"
                      className={`equipment-dialog__select-option${equippedId === undefined ? ' equipment-dialog__select-option--selected' : ''}`}
                      onClick={() => {
                        onUnequip();
                        close();
                      }}
                    >
                      {t('buildPlanner.emptySlot')}
                    </button>
                    {sortedCandidates.map((candidate) => {
                      const name = t(`items.${candidate.id}.name`, { ns: 'game-data' });
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className={`equipment-dialog__select-option${candidate.id === equippedId ? ' equipment-dialog__select-option--selected' : ''}`}
                          style={{ color: getItemNameColor(candidate) }}
                          onClick={() => {
                            onSelect(candidate);
                            close();
                          }}
                        >
                          {`${candidate.equipGs} ${name}`}
                        </button>
                      );
                    })}
                  </>
                )}
              </Dropdown>
            </div>

            <div className="equip-details-section">
              <label className="equipment-dialog__label">
                {t('buildPlanner.perfectline')}
                <span className="equipment-dialog__slider-value">{sliderDisplay}</span>
              </label>
              <input
                type="range"
                className="equipment-dialog__slider"
                min={1}
                max={100}
                value={sliderValue}
                onChange={(e) => onPerfectline(Math.min(Number(e.target.value), maxPerfectline))}
                disabled={sliderDisabled}
              />
            </div>

            {/* この部位で増える能力スコアと内訳 */}
            <section className="equip-details-section">
              <h3 className="equip-details-section__heading">{t('buildPlanner.abilityScore')}</h3>
              <StatRow
                className="equip-ability-score-row--total"
                name={t('buildPlanner.abilityScoreBreakdown.total')}
                value={abilityScoreBreakdown.total.toLocaleString()}
              />
              <StatRow
                name={t('buildPlanner.baseStats')}
                value={abilityScoreBreakdown.baseStats.toLocaleString()}
              />
              <StatRow
                name={t('buildPlanner.evolutionStats')}
                value={abilityScoreBreakdown.evolution.toLocaleString()}
              />
              <StatRow
                name={t('buildPlanner.equippedEffects')}
                value={abilityScoreBreakdown.enchant.toLocaleString()}
              />
              <StatRow
                name={t('buildPlanner.refineEffect')}
                value={abilityScoreBreakdown.refine.toLocaleString()}
              />
            </section>
          </div>

          {/* 中列: 基礎ステータス / 進化ステータス / 装着効果(エンチャント) */}
          <div className="equipment-dialog__col-center">
            {/* 基礎ステータス */}
            <section className="equip-details-section">
              <h3 className="equip-details-section__heading">{t('buildPlanner.baseStats')}</h3>
              {equippedItem ? (
                equippedItem.baseStats.length > 0 ? (
                  equippedItem.baseStats.map(([attrId, min, max]) => (
                    <StatRow
                      key={attrId}
                      name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                      value={calcStatValue(min, max, perfectline)}
                    />
                  ))
                ) : (
                  <p className="equip-stat-row__value--placeholder equip-details-section__placeholder">
                    ---
                  </p>
                )
              ) : (
                placeholderStatIds.map((statId) => (
                  <StatRow
                    key={statId}
                    name={t(`buildPlanner.stats.${statId}`)}
                    value="---"
                    valueClassName="equip-stat-row__value--placeholder"
                  />
                ))
              )}
            </section>

            {/* 進化ステータス */}
            <section className="equip-details-section">
              {/* 見出し行: 「進化ステータス」 + 突破Lv切り替えプルダウン */}
              <div className="equip-details-section__heading-row">
                <h3 className="equip-details-section__heading">
                  {t('buildPlanner.evolutionStats')}
                </h3>
                {showBtSelector && (
                  <div className="equip-bt-selector">
                    <span className="equip-bt-selector__label">
                      {t('buildPlanner.breakthrough')}
                    </span>
                    <select
                      className="equip-bt-selector__select"
                      value={String(equippedId)}
                      onChange={(e) => {
                        const selected = candidates.find((c) => String(c.id) === e.target.value);
                        if (selected) onSelect(selected);
                      }}
                    >
                      {btGroup!.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          Lv.{item.equipGs}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 伝説刻印ピッカー: 進化ステータスの先頭に表示 */}
              {legendaryAffixPicker}

              {isSeriesFixed ? (
                // シリーズ装備: クラス型に応じた固定値を読み取り専用で表示。改鋳なし。
                <div className="equip-evo-fixed">
                  {fixedEvoEffects!.map(([, attrId, min, , isPercent], i) => (
                    <StatRow
                      key={i}
                      name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                      value={isPercent ? `+${min / 100}%` : `+${min}`}
                    />
                  ))}
                </div>
              ) : hasBtFixedEvo ? (
                // BT突破防具: TalentSchoolId別固定Evo1/Evo2(完成度依存) + 改鋳スロット選択可。
                <div className="equip-evo-mixed">
                  {fixedEvoEffects!.map(([, attrId, min, max, isPercent], i) => (
                    <StatRow
                      key={i}
                      name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                      value={
                        isPercent ? `+${min / 100}%` : `+${calcStatValue(min, max, sliderValue)}`
                      }
                    />
                  ))}
                  {reforgeSection}
                </div>
              ) : hasSameEvo ? (
                // Evo1/Evo2 が同一 attrId の装備: 2スロット選択可能 + 改鋳。
                <div className="equip-evo-mixed">
                  {[0, 1].map((i) => {
                    const selected = evolutionStats[i];
                    const isEditing = editingEvoSlot === i;
                    const available = availableEvoStats(i);
                    const [, evoMin, evoMax] = equippedItem!.evo[i] ?? [0, 0, 0];
                    const evoValue = calcStatValue(evoMin, evoMax, sliderValue);
                    return (
                      <EvoSlotPicker
                        key={i}
                        valueLabel={`+${evoValue}`}
                        selectedStat={selected}
                        availableStats={available}
                        isEditing={isEditing}
                        onToggleEdit={() => setEditingEvoSlot(isEditing ? null : i)}
                        onSelect={(statId) => {
                          onSetEvolutionStat(i, statId);
                          setEditingEvoSlot(null);
                        }}
                      />
                    );
                  })}
                  {reforgeSection}
                </div>
              ) : hasDataEvo ? (
                // 通常装備(type=1、Evo1/Evo2 が異なる attrId): 固定表示 + 改鋳のみ選択可能。
                <div className="equip-evo-mixed">
                  {equippedItem!.evo.map(([attrId, min, max], i) => (
                    <StatRow
                      key={i}
                      name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                      value={`+${calcStatValue(min, max, sliderValue)}`}
                    />
                  ))}
                  {reforgeSection}
                </div>
              ) : (
                // 進化ステータスデータなし: 3スロットすべて選択可能（低レベル装備等）。
                <div className="equip-evo-slots">
                  {[0, 1, 2].map((i) => {
                    const isReforge = i === 2;
                    const selected = evolutionStats[i];
                    const isEditing = editingEvoSlot === i;
                    const available = availableEvoStats(i);
                    return (
                      <EvoSlotPicker
                        key={i}
                        tag={isReforge ? t('buildPlanner.reforgedSlot') : undefined}
                        selectedStat={selected}
                        availableStats={available}
                        isEditing={isEditing}
                        onToggleEdit={() => setEditingEvoSlot(isEditing ? null : i)}
                        onSelect={(statId) => {
                          onSetEvolutionStat(i, statId);
                          setEditingEvoSlot(null);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* セット効果 */}
            {suitInfo && (
              <section className="equip-details-section equip-suit-section">
                <h3 className="equip-details-section__heading">
                  {t('buildPlanner.suitEffects.title')}
                </h3>
                <div className="suit-effects__suit-count-row">
                  <span className="suit-effects__suit-name">
                    {t(`buildPlanner.suitEffects.suit${suitInfo.suitId}`)}
                  </span>
                  <span className="suit-effects__suit-count">
                    {suitInfo.count}/{suitInfo.tiers[suitInfo.tiers.length - 1]?.limitNum ?? 4}
                    点装備中
                  </span>
                </div>
                {suitInfo.tiers.map((tier) => {
                  const active = suitInfo.count >= tier.limitNum;
                  const buffId = tier.effects[suitInfo.schoolId] ?? tier.effects['101'] ?? null;
                  const desc = buffId
                    ? t(`attrDescs.${buffId}`, { ns: 'game-data', defaultValue: '' })
                    : '';
                  return (
                    <div
                      key={tier.limitNum}
                      className={`suit-effects__tier${active ? ' suit-effects__tier--active' : ''}`}
                    >
                      <span className="suit-effects__tier-label">
                        {t('buildPlanner.suitEffects.tierLabel', { n: tier.limitNum })}
                      </span>
                      {desc && <span className="suit-effects__tier-desc">{desc}</span>}
                      {tier.fightValue > 0 && (
                        <span className="suit-effects__tier-fv">+{tier.fightValue}</span>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </div>

          {/* 3列目: 装着効果(エンチャント) */}
          <div className="equipment-dialog__col-enchant">
            <section className="equip-details-section">
              <div className="equip-details-section__heading-row">
                <h3 className="equip-details-section__heading">
                  {t('buildPlanner.equippedEffects')}
                </h3>
                {hasEnchantGrades && (
                  <div className="equip-bt-selector">
                    <select
                      className="equip-bt-selector__select"
                      value={String(selectedEnchant)}
                      onChange={(e) => onSetEnchant(Number(e.target.value))}
                    >
                      <option value={String(baseEnchantItem!.id)}>
                        {t('buildPlanner.enchantGradeBase')}
                      </option>
                      {baseEnchantItem!.refined && (
                        <option value={String(baseEnchantItem!.refined.id)}>
                          {t('buildPlanner.enchantGradeRefined')}
                        </option>
                      )}
                      {baseEnchantItem!.perfect && (
                        <option value={String(baseEnchantItem!.perfect.id)}>
                          {t('buildPlanner.enchantGradePerfect')}
                        </option>
                      )}
                    </select>
                  </div>
                )}
              </div>
              {enchantsList.length > 0 ? (
                <div className="equip-enchant-section">
                  <Dropdown
                    panelWidthScale={1.3}
                    triggerClassName={`equip-enchant-trigger${selectedEnchantData ? ' equip-enchant-trigger--set' : ''}`}
                    panelClassName="equip-enchant-list"
                    renderTrigger={(isOpen) => (
                      <>
                        {baseEnchantItem?.icon && getEnchantIconUrl(baseEnchantItem.icon) && (
                          <img
                            className="equip-enchant-icon"
                            src={getEnchantIconUrl(baseEnchantItem.icon)!}
                            alt=""
                          />
                        )}
                        <span
                          className="equip-enchant-trigger__name"
                          style={
                            baseEnchantItem
                              ? { color: getQualityColor(baseEnchantItem.quality) }
                              : undefined
                          }
                        >
                          {selectedEnchant !== undefined
                            ? t(`items.${selectedEnchant}.name`, { ns: 'game-data' })
                            : t('buildPlanner.evolutionStatUnset')}
                        </span>
                        <Chevron open={isOpen} className="equip-evo-slot__arrow" />
                      </>
                    )}
                  >
                    {(close) => (
                      <>
                        <button
                          type="button"
                          className={`equip-enchant-option${selectedEnchant === undefined ? ' equip-enchant-option--selected' : ''}`}
                          onClick={() => {
                            onSetEnchant(undefined);
                            close();
                          }}
                        >
                          {t('buildPlanner.evolutionStatUnset')}
                        </button>
                        {sortedEnchants.map((enchant) => {
                          const enchantIcon = enchant.icon
                            ? getEnchantIconUrl(enchant.icon)
                            : undefined;
                          return (
                            <button
                              key={enchant.id}
                              type="button"
                              className={`equip-enchant-option${selectedEnchant === enchant.id ? ' equip-enchant-option--selected' : ''}`}
                              onClick={() => {
                                onSetEnchant(enchant.id);
                                close();
                              }}
                              onMouseEnter={(e) => showEnchantTooltip(enchant, e)}
                              onMouseLeave={hideEnchantTooltip}
                            >
                              {enchantIcon && (
                                <img className="equip-enchant-icon" src={enchantIcon} alt="" />
                              )}
                              <span style={{ color: getQualityColor(enchant.quality) }}>
                                {t(`items.${enchant.id}.name`, { ns: 'game-data' })}
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </Dropdown>
                  {/* 選択中エンチャントの効果・コスト */}
                  {selectedEnchantData && (
                    <div className="equip-enchant-details">
                      {selectedEnchantData.effects.map(([attrId, value]) => (
                        <StatRow
                          key={attrId}
                          name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                          value={`+${value}`}
                        />
                      ))}
                      {selectedEnchantData.cost && selectedEnchantData.cost.length > 0 && (
                        <div className="equip-enchant-cost">
                          {t('buildPlanner.enchantCost')}:
                          {selectedEnchantData.cost.map(([itemId, qty]) => (
                            <div key={itemId} className="equip-enchant-cost__row">
                              {t(`items.${itemId}.name`, { ns: 'game-data' })} x{qty}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="equip-stat-row__value--placeholder equip-details-section__placeholder">
                  ---
                </p>
              )}
            </section>
          </div>

          {/* 4列目: 精錬レベル / 精錬効果 / 精錬レベル効果 */}
          <div className="equipment-dialog__col-right">
            <div className="equip-details-section">
              <label className="equipment-dialog__label">{t('buildPlanner.refineLevel')}</label>
              <Stepper
                className="equip-refine-level-control"
                layout="inline"
                value={refineLevel}
                min={0}
                max={30}
                onChange={onRefineLevel}
              />
            </div>

            <section className="equip-details-section">
              <h3 className="equip-details-section__heading">{t('buildPlanner.refineEffect')}</h3>
              {cumulativeEffects && cumulativeEffects.length > 0 ? (
                cumulativeEffects.map(([attrId, value]) => (
                  <StatRow
                    key={attrId}
                    name={t(`attributes.${attrId}`, { ns: 'game-data' })}
                    value={`+${value}`}
                  />
                ))
              ) : (
                <p className="equip-stat-row__value--placeholder equip-details-section__placeholder">
                  ---
                </p>
              )}
            </section>

            <section className="equip-details-section">
              <h3 className="equip-details-section__heading">
                {t('buildPlanner.refineLevelEffects')}
              </h3>
              {refineTypeData
                ? REFINE_LEVEL_MILESTONES.flatMap((level) => {
                    const effects = refineTypeData.milestones[String(level)];
                    const isActive = level <= refineLevel;
                    if (!effects || effects.length === 0) {
                      return [
                        <div
                          key={level}
                          className={`equip-refine-row${isActive ? ' equip-refine-row--active' : ''}`}
                        >
                          {t('buildPlanner.refineLevelEffect', { level })}
                          <span className="equip-refine-row__placeholder">---</span>
                        </div>,
                      ];
                    }
                    return effects.map(([attrId, value]) => (
                      <div
                        key={`${level}-${attrId}`}
                        className={`equip-refine-row${isActive ? ' equip-refine-row--active' : ''}`}
                      >
                        {t('buildPlanner.refineLevelEffect', { level })}
                        {t(`attributes.${attrId}`, { ns: 'game-data' })}+{value}
                      </div>
                    ));
                  })
                : REFINE_LEVEL_MILESTONES.map((level) => (
                    <div
                      key={level}
                      className={`equip-refine-row${level <= refineLevel ? ' equip-refine-row--active' : ''}`}
                    >
                      {t('buildPlanner.refineLevelEffect', { level })}
                      <span className="equip-refine-row__placeholder">---</span>
                    </div>
                  ))}
            </section>
          </div>
        </div>
      </DraggableDialog>
    </>
  );
}

export default EquipmentSlotPicker;
