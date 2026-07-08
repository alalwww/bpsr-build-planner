import type { Profession, ProfessionTypeKey } from '../profession';
import { getMaxPerfectline } from '../equipment/equipmentData';
import type {
  AbilityScoreBreakdown,
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  ModuleSlots,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
} from '../types';
import type {
  AdvancedEffect,
  OrdinaryEffect,
  PhantomFactorGrade,
  PhantomFactorSlotValue,
} from '../phantom/phantomData';
import {
  getActivePhantomNodeIds,
  pfData as phantomFactorData,
  stData as seasonTalentData,
} from '../phantom/phantomData';
import {
  calcModuleEffectLevels,
  enchantFightValueById,
  getClassData,
  imaginaryDataById,
  levelCumulativeData,
  modulesData,
  playerLevelSeasonData,
  refineData,
  skillFightValues,
  skillRankFightValues,
  suitsData,
  talentTree,
  type TalentTreeNode,
} from './gameData';
import { calcStatValue } from './statValue';
import { hasDistinctEvoAttrs } from './evoResolution';

export interface CalculateAbilityScoreInput {
  equipped: EquippedItems;
  perfectlines: SlotRefineLevels;
  evolutionStats: SlotEvolutionStats;
  refineLevels: SlotRefineLevels;
  legendaryAffixState: SlotLegendaryAffix;
  slotEnchants: SlotEnchants;
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
  fixedLevels: number[];
  fixedRanks: number[];
  masteryEquipped: boolean[];
  masteryLevels: number[];
  masteryRanks: number[];
  battleImaginaries: (number | null)[];
  imaginaryRanks: number[];
  moduleSlots: ModuleSlots;
  adventurerLevel: number;
  talentR1EnabledIds: Set<number>;
  talentR2EnabledIds: Set<number>;
  talentNodesById: Map<number, TalentTreeNode>;
  phantomEnabled: boolean;
  phantomLevel: number;
  phantomTemplateId: number | null;
  phantomNodeSelections: Record<number, number>;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
  phantomBondPoints: number;
}

export interface EquipmentSlotAbilityScoreBreakdown {
  total: number;
  baseStats: number;
  evolution: number;
  enchant: number;
  refine: number;
}

// 装備1部位分の能力スコア(FightValue)を内訳付きで算出する。集計版(calculateAbilityScore)と
// 装備選択ダイアログ/装備パネルのポップアップ双方から同じロジックで呼び出せるよう共通化。
export function calculateEquipmentSlotAbilityScore(
  item: EquipmentItem,
  perfectline: number,
  evolutionStats: Array<EvolutionStatId | undefined>,
  legendaryAffix: LegendaryAffixSelection | undefined,
  enchantItemId: number | undefined,
  refineLevel: number,
  profession: Profession,
  professionTypeKey: ProfessionTypeKey,
): EquipmentSlotAbilityScoreBreakdown {
  const pLine = Math.min(perfectline, getMaxPerfectline(item));
  const typeIdx = professionTypeKey === 'type1' ? 0 : 1;
  const talentSchoolIdFv = profession.talentSchoolIds[typeIdx];

  let baseStats = 0;
  for (const stat of item.baseStats as number[][]) {
    const fvMin = stat[3] ?? 0;
    const fvMax = stat[4] ?? 0;
    if (fvMax > 0) baseStats += calcStatValue(fvMin, fvMax, pLine);
  }

  let evolution = 0;
  const fixedEvoFvEffects = item.fixedEvolutionStats[String(talentSchoolIdFv)];
  if (fixedEvoFvEffects) {
    for (const eff of fixedEvoFvEffects) {
      const fvMin = eff[5] ?? 0;
      const fvMax = eff[6] ?? 0;
      if (fvMax > 0) evolution += calcStatValue(fvMin, fvMax, pLine);
    }
  }
  const evoDataFv = (item.evo as number[][]) ?? [];
  const useAttrIdDrivenFv = hasDistinctEvoAttrs(evoDataFv);
  for (let i = 0; i <= 1; i++) {
    if (!useAttrIdDrivenFv && !evolutionStats[i]) continue;
    const evo = evoDataFv[i];
    if (!evo || evo.length < 5) continue;
    const fvMin = evo[3];
    const fvMax = evo[4];
    if (fvMax > 0) evolution += calcStatValue(fvMin, fvMax, pLine);
  }
  if (evolutionStats[2] && item.reforgeEvoFvMax > 0) {
    evolution += calcStatValue(item.reforgeEvoFvMin, item.reforgeEvoFvMax, pLine);
  }
  if (legendaryAffix && item.legendaryAffix) {
    const affixEntry = item.legendaryAffix.find((a) => a.attrId === legendaryAffix.attrId);
    if (affixEntry?.fightValues) {
      const tierIdx = affixEntry.values.indexOf(legendaryAffix.value);
      if (tierIdx >= 0) evolution += affixEntry.fightValues[tierIdx] ?? 0;
    }
  }

  const enchant = enchantItemId != null ? (enchantFightValueById.get(enchantItemId) ?? 0) : 0;

  let refine = 0;
  const refineId = refineData.partRefineIds[String(item.part)]?.[String(profession.professionId)];
  if (refineId != null && refineLevel > 0) {
    refine = refineData.refineById[String(refineId)]?.fightValues?.[refineLevel - 1] ?? 0;
  }

  return {
    total: baseStats + evolution + enchant + refine,
    baseStats,
    evolution,
    enchant,
    refine,
  };
}

// 固定/マスタリースキル、バトルイマジン1体分の能力スコア(FightValue)を算出する。
// isImagine=true の場合、level は無視され rank(凸数)のみで baseFv+fightValues[rank-1] を返す。
export function calculateSkillAbilityScore(
  skillId: number,
  level: number | undefined,
  rank: number,
  isImagine: boolean,
): number {
  if (isImagine) {
    const ima = imaginaryDataById[String(skillId)];
    if (!ima) return 0;
    let fv = ima.baseFv ?? 0;
    if (rank > 0) fv += ima.fightValues?.[rank - 1] ?? 0;
    return fv;
  }
  if (level == null) return 0;
  let fv = skillFightValues[String(skillId)]?.[level - 1] ?? 0;
  if (rank > 0) fv += skillRankFightValues[String(skillId)]?.[rank - 1] ?? 0;
  return fv;
}

export interface ModuleAbilityScore {
  link: number;
  core: number;
}

// モジュール構成全体(5スロット)から、リンク効果/パワーコア効果それぞれの能力スコアを算出する。
export function calculateModuleAbilityScore(moduleSlots: ModuleSlots): ModuleAbilityScore {
  let core = 0;
  const modEffLevels = calcModuleEffectLevels(moduleSlots, modulesData.effects);
  for (const { effectId, level } of modEffLevels) {
    if (level === 0) continue;
    const modLvData = modulesData.effects[String(effectId)]?.levels[level];
    if (modLvData) core += modLvData[0];
  }
  let link = 0;
  let modGlobalLink = 0;
  for (const slot of moduleSlots) {
    if (!slot) continue;
    for (const hole of slot.holes) {
      if (hole.effectId != null) modGlobalLink += hole.linkCount;
    }
  }
  if (modGlobalLink > 0) {
    const linkRow = [...modulesData.linkEffects].reverse().find(([lt]) => lt <= modGlobalLink);
    if (linkRow) link = linkRow[1];
  }
  return { link, core };
}

// 装備・アビリティ・スキル・モジュール・心相投影等、各要素の能力スコア(FightValue)寄与を
// 内訳付きで算出する。UIやReact stateには依存しない純粋関数。
export function calculateAbilityScore(input: CalculateAbilityScoreInput): AbilityScoreBreakdown {
  const {
    equipped,
    perfectlines,
    evolutionStats,
    refineLevels,
    legendaryAffixState,
    slotEnchants,
    profession,
    professionTypeKey,
    fixedLevels,
    fixedRanks,
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    battleImaginaries,
    imaginaryRanks,
    moduleSlots,
    adventurerLevel,
    talentR1EnabledIds,
    talentR2EnabledIds,
    talentNodesById,
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomNodeSelections,
    phantomFactorSlots,
    phantomBondPoints,
  } = input;

  // --- その他: 冒険者レベル ---
  const lvData = levelCumulativeData[Math.min(adventurerLevel, levelCumulativeData.length - 1)];
  const other = lvData?.fightValue ?? 0;

  // --- 潜在レベル (enabled に関わらず常時反映) ---
  let phantomLevelFv = 0;
  if (phantomLevel > 0) {
    phantomLevelFv = phantomLevel * playerLevelSeasonData.fightValue;
  }

  // --- 装備・精錬・装着効果 ---
  let equipmentBaseFv = 0;
  let equipmentEnchantFv = 0;
  let equipmentRefineFv = 0;
  for (const [slotId, equipmentItem] of Object.entries(equipped)) {
    const slotKey = slotId as EquipmentSlotId;
    const breakdown = calculateEquipmentSlotAbilityScore(
      equipmentItem,
      perfectlines[slotKey] ?? getMaxPerfectline(equipmentItem),
      evolutionStats[slotKey] ?? [],
      legendaryAffixState[slotKey],
      slotEnchants[slotKey] ?? undefined,
      refineLevels[slotKey] ?? 0,
      profession,
      professionTypeKey,
    );
    equipmentBaseFv += breakdown.baseStats + breakdown.evolution;
    equipmentEnchantFv += breakdown.enchant;
    equipmentRefineFv += breakdown.refine;
  }

  // --- スキル ---
  let skillFixedFv = 0;
  let skillMasteryFv = 0;
  let skillImaginaryFv = 0;
  const cls = getClassData(profession.professionId);
  if (cls) {
    const fixedGroups = [cls.normalAttackSkill, cls.specialSkill, cls.ultimateSkill];
    for (let gi = 0; gi < fixedGroups.length; gi++) {
      const level = fixedLevels[gi] ?? 1;
      const rank = fixedRanks[gi] ?? 0;
      for (const skillId of fixedGroups[gi] ?? []) {
        skillFixedFv += calculateSkillAbilityScore(skillId, level, rank, false);
      }
    }
    for (let i = 0; i < masteryEquipped.length; i++) {
      if (!masteryEquipped[i]) continue;
      const skillId = cls.normalSkill?.[i];
      if (skillId == null) continue;
      skillMasteryFv += calculateSkillAbilityScore(
        skillId,
        masteryLevels[i] ?? 1,
        masteryRanks[i] ?? 0,
        false,
      );
    }
  }

  // バトルイマジン (baseFv + fightValues[rank-1] の累積FV)
  for (let i = 0; i < battleImaginaries.length; i++) {
    const id = battleImaginaries[i];
    if (id == null) continue;
    skillImaginaryFv += calculateSkillAbilityScore(id, undefined, imaginaryRanks[i] ?? 0, true);
  }

  // --- アビリティ (武器熟練ツリーノード: R1/R2別) ---
  let abilityR1Fv = 0;
  for (const nodeId of talentR1EnabledIds) {
    const treeNode = talentNodesById.get(nodeId);
    if (!treeNode) continue;
    const talentData = talentTree.nodes[String(treeNode.talentId)];
    abilityR1Fv += talentData?.fightValue ?? 0;
  }
  let abilityR2Fv = 0;
  for (const nodeId of talentR2EnabledIds) {
    const treeNode = talentNodesById.get(nodeId);
    if (!treeNode) continue;
    const talentData = talentTree.nodes[String(treeNode.talentId)];
    abilityR2Fv += talentData?.fightValue ?? 0;
  }

  // --- モジュール (パワーコア/リンク効果別) ---
  const moduleScore = calculateModuleAbilityScore(moduleSlots);
  const moduleCoreFv = moduleScore.core;
  const moduleLinkFv = moduleScore.link;

  // --- 心相投影 (enabled 時のみ) ---
  let phantomFv = 0;
  if (phantomEnabled && phantomTemplateId != null) {
    const tmpl = seasonTalentData.templates[String(phantomTemplateId)];
    if (tmpl) {
      const activeIds = getActivePhantomNodeIds(
        tmpl.rootNodeId,
        phantomTemplateId,
        phantomNodeSelections,
      );
      for (const nodeId of activeIds) {
        const node = seasonTalentData.treeNodes[String(nodeId)];
        if (!node) continue;
        if (node.nodeType === 1) {
          const eff = seasonTalentData.ordinaryEffects[String(node.groupId)] as
            OrdinaryEffect | undefined;
          if (eff) phantomFv += eff.fightValue;
        } else if (node.nodeType === 2) {
          const slot = phantomFactorSlots[node.groupId];
          if (slot) {
            const grade = phantomFactorData.byClass[slot.classKey]?.grades[slot.grade - 1] as
              PhantomFactorGrade | undefined;
            if (grade) phantomFv += grade.fightValue;
          }
        }
      }
      // 上位効果: fightValueはZTable上で累積値のため、解放済み最高レベルの値を使用
      const maxAdvEff = (Object.values(seasonTalentData.advancedEffects) as AdvancedEffect[])
        .filter(
          (ae) => ae.effectId === tmpl.advancedEffectId && phantomBondPoints >= ae.unlockFraction,
        )
        .reduce<AdvancedEffect | null>(
          (best, ae) => (ae.level > (best?.level ?? 0) ? ae : best),
          null,
        );
      if (maxAdvEff) phantomFv += maxAdvEff.fightValue;
    }
  }

  // --- セット効果 FV ---
  let equipmentSuitFv = 0;
  const suitCounts: Record<number, number> = {};
  for (const item of Object.values(equipped)) {
    if (item?.suitId) suitCounts[item.suitId] = (suitCounts[item.suitId] ?? 0) + 1;
  }
  for (const [suitIdStr, suitDataEntry] of Object.entries(suitsData)) {
    const count = suitCounts[Number(suitIdStr)] ?? 0;
    for (const tier of suitDataEntry.tiers) {
      if (count >= tier.limitNum) equipmentSuitFv += tier.fightValue;
    }
  }

  const total =
    other +
    abilityR1Fv +
    abilityR2Fv +
    skillFixedFv +
    skillMasteryFv +
    skillImaginaryFv +
    equipmentBaseFv +
    equipmentEnchantFv +
    equipmentRefineFv +
    equipmentSuitFv +
    moduleCoreFv +
    moduleLinkFv +
    phantomLevelFv +
    phantomFv;

  return {
    total,
    other,
    abilityR1: abilityR1Fv,
    abilityR2: abilityR2Fv,
    skillFixed: skillFixedFv,
    skillMastery: skillMasteryFv,
    skillImaginary: skillImaginaryFv,
    equipmentBase: equipmentBaseFv,
    equipmentEnchant: equipmentEnchantFv,
    equipmentRefine: equipmentRefineFv,
    equipmentSuit: equipmentSuitFv,
    moduleLink: moduleLinkFv,
    moduleCore: moduleCoreFv,
    phantomLevel: phantomLevelFv,
    phantom: phantomFv,
  };
}
