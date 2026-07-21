// useBuildState.ts の useMemo チェーン(calculateRawStats → deriveStats →
// applyFinalStatModifiers → cookingAdjustments → stats/rawStatsBreakdown、および
// talentNodesById/r1NodeCount/skillReplacements/roleSkills/abilityScore)を、
// Zustandのselectorから呼べる形に移植したもの。
//
// Zustandには組み込みのcomputed機構がないため、各段を memoize1 で1スロットメモ化し、
// 元の useMemo と同じ引数集合(=同じ再計算粒度)を維持する。selectorはこれらの関数を
// 呼ぶだけにし、pure計算関数(calculateRawStats等)を直接呼ばないこと(店舗全体のリスク
// 注意点参照)。
import type { AbilityScoreBreakdown, CookingBuffState, ModuleSlots, StatId } from '../types';
import { TALENT_EFFECT_TYPE_SKILL_REPLACEMENT } from '../stats/attrMaps';
import { calculateAbilityScore } from '../stats/calculateAbilityScore';
import type { CalculateAbilityScoreInput } from '../stats/calculateAbilityScore';
import { applyFinalStatModifiers, calculateRawStats } from '../stats/calculateRawStats';
import type { CalculateRawStatsInput } from '../stats/calculateRawStats';
import {
  AGILE_VALUES,
  applyCookingBuff,
  computeCookingAdjustments,
  INSPIRATION_VALUES,
  LIFE_WAVE_VALUES,
  POWER_CORE_EFFECT_IDS,
} from '../stats/cookingBuff';
import { deriveStats } from '../stats/deriveStats';
import {
  buildTalentNodesById,
  countR1Nodes,
  getClassData,
  getPowerCoreLevel,
  talentTree,
  type TalentTreeNode,
} from '../stats/gameData';
import { PROFESSIONS } from '../profession';
import { memoize1, memoizeByKeys } from './memoize';
import type { BuildStore } from './types';

export const selectTalentNodesById = memoize1((professionId: number) =>
  buildTalentNodesById(professionId),
);

export const selectR1NodeCount = memoize1((nodesById: Map<number, TalentTreeNode>) =>
  countR1Nodes(nodesById),
);

export const selectSkillReplacements = memoize1(
  (
    talentR1EnabledIds: Set<number>,
    talentR2EnabledIds: Set<number>,
    talentNodesById: Map<number, TalentTreeNode>,
  ) => {
    const result: Record<number, number> = {};
    const allIds = new Set([...talentR1EnabledIds, ...talentR2EnabledIds]);
    for (const nodeId of allIds) {
      const treeNode = talentNodesById.get(nodeId);
      if (!treeNode) continue;
      const td = talentTree.nodes[String(treeNode.talentId)];
      if (!td) continue;
      for (const eff of td.effects) {
        if (eff[0] === TALENT_EFFECT_TYPE_SKILL_REPLACEMENT) result[eff[1]] = eff[2];
      }
    }
    return result;
  },
);

export const selectRoleSkills = memoize1(
  (professionId: number) => getClassData(professionId)?.roleSkill ?? [],
);

// inputオブジェクトは呼び出し側(computeStatsBundle)で毎回新規リテラルとして組み立てられる
// ため、参照比較のmemoize1ではなく、キーごとの値をshallow比較するmemoizeByKeysでメモ化する
// (再計算粒度は個々のフィールド単位で従来と同じ。同型の位置引数20超を並べる必要がなくなり、
// フィールドの並び順ミスがコンパイル・実行時とも起こらない)。
export const selectRawStatsResult = memoizeByKeys((input: CalculateRawStatsInput) =>
  calculateRawStats(input),
);

export const selectCookingResult = memoize1((cookingBuff: CookingBuffState) =>
  applyCookingBuff(cookingBuff),
);

export const selectDerivedStats = memoize1((...args: Parameters<typeof deriveStats>) =>
  deriveStats(...args),
);

export const selectFinalStatsResult = memoize1(
  (...args: Parameters<typeof applyFinalStatModifiers>) => applyFinalStatModifiers(...args),
);

export const selectCookingAdjustments = memoize1(
  (...args: Parameters<typeof computeCookingAdjustments>) => computeCookingAdjustments(...args),
);

const selectStatsWithCooking = memoize1(
  (
    finalStats: Record<StatId, number>,
    cookingAdjustments: ReturnType<typeof computeCookingAdjustments>,
  ) => {
    if (cookingAdjustments.length === 0) return finalStats;
    const result = { ...finalStats };
    for (const { statId, multiplier, addend } of cookingAdjustments) {
      if (multiplier !== undefined) result[statId] = result[statId] * multiplier;
      if (addend !== undefined) result[statId] = result[statId] + addend;
    }
    return result;
  },
);

const selectBreakdownWithCooking = memoize1(
  (
    finalBreakdown: ReturnType<typeof applyFinalStatModifiers>['breakdown'],
    cookingAdjustments: ReturnType<typeof computeCookingAdjustments>,
  ) => {
    if (cookingAdjustments.length === 0) return finalBreakdown;
    const merged = { ...finalBreakdown };
    for (const { statId, multiplier, addend } of cookingAdjustments) {
      const entry = merged[statId];
      merged[statId] = {
        ...entry,
        ...(multiplier !== undefined ? { multiplier: entry.multiplier * multiplier } : {}),
        ...(addend !== undefined ? { cookingBonus: (entry.cookingBonus ?? 0) + addend } : {}),
      };
    }
    return merged;
  },
);

// selectRawStatsResultと同じ理由で、inputオブジェクトをmemoizeByKeysでメモ化する。
export const selectAbilityScore = memoizeByKeys(
  (input: CalculateAbilityScoreInput): AbilityScoreBreakdown => calculateAbilityScore(input),
);

// モジュールパワーコア効果由来のHP変動/適応力レベルは moduleSlots に依存する軽量な参照のため、
// メモ化はせずその都度参照する(元の useBuildState.ts でも useMemo化されていなかった箇所)。
function getCookingModifiers(cookingBuff: CookingBuffState, moduleSlots: ModuleSlots) {
  const inspirationPercentBonus = cookingBuff.inspirationEnabled
    ? INSPIRATION_VALUES[cookingBuff.inspirationVariant].percent
    : 0;
  const lifeWaveLevel = cookingBuff.lifeWaveEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.lifeWave)
    : 0;
  const lifeWaveBonus = lifeWaveLevel !== 0 ? LIFE_WAVE_VALUES[lifeWaveLevel] : 0;
  const agileLevel = cookingBuff.agileEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.agile)
    : 0;
  const agileAtkMultPercent = agileLevel !== 0 ? AGILE_VALUES[agileLevel].atkMultPercent : 0;
  return { inspirationPercentBonus, lifeWaveBonus, agileAtkMultPercent };
}

export interface StatsBundle {
  rawStats: Record<StatId, number>;
  rawStatsBreakdown: ReturnType<typeof applyFinalStatModifiers>['breakdown'];
  derivedStats: ReturnType<typeof deriveStats>;
  stats: Record<StatId, number>;
  abilityScore: AbilityScoreBreakdown;
  roleSkills: ReturnType<typeof selectRoleSkills>;
  talentNodesById: Map<number, TalentTreeNode>;
  r1NodeCount: number;
  skillReplacements: Record<number, number>;
}

// state から stats/abilityScore 等の全派生値をまとめて計算する。各段は memoize1 済みの
// selectXxx を呼ぶだけなので、依存する入力(参照)が変わらない限り実際の再計算は発生しない。
export function computeStatsBundle(state: BuildStore): StatsBundle {
  const profession = PROFESSIONS[state.professionKey];

  const talentNodesById = selectTalentNodesById(profession.professionId);
  const r1NodeCount = selectR1NodeCount(talentNodesById);
  const skillReplacements = selectSkillReplacements(
    state.talentR1EnabledIds,
    state.talentR2EnabledIds,
    talentNodesById,
  );
  const roleSkills = selectRoleSkills(profession.professionId);

  const rawStatsResult = selectRawStatsResult({
    equipped: state.equipped,
    legendaryAffixState: state.legendaryAffixState,
    legendaryAffixGroupState: state.legendaryAffixGroupState,
    refineLevels: state.refineLevels,
    perfectlines: state.perfectlines,
    evolutionStats: state.evolutionStats,
    profession,
    professionTypeKey: state.professionTypeKey,
    talentR1EnabledIds: state.talentR1EnabledIds,
    talentR2EnabledIds: state.talentR2EnabledIds,
    talentNodesById,
    r1NodeCount,
    battleImagines: state.battleImagines,
    imagineRanks: state.imagineRanks,
    slotEnchants: state.slotEnchants,
    moduleSlots: state.moduleSlots,
    adventurerLevel: state.adventurerLevel,
    phantomEnabled: state.phantomEnabled,
    phantomLevel: state.phantomLevel,
    phantomTemplateId: state.phantomTemplateId,
    phantomBondPoints: state.phantomBondPoints,
    phantomNodeSelections: state.phantomNodeSelections,
    phantomFactorSlots: state.phantomFactorSlots,
    cookingBuff: state.cookingBuff,
  });
  const rawStats = rawStatsResult.rawStats;

  const cookingResult = selectCookingResult(state.cookingBuff);

  const derivedStats = selectDerivedStats(
    rawStats,
    profession,
    rawStatsResult.conversionRateBonus,
    rawStatsResult.atkSpeedFinalPctAddend,
    rawStatsResult.atkSpeedPerHastePercentBonus,
    rawStatsResult.castSpeedFinalPctAddend,
  );

  const finalStatsResult = selectFinalStatsResult(
    rawStats,
    rawStatsResult.breakdown,
    derivedStats,
    state.legendaryAffixState,
    state.battleImagines,
    state.imagineRanks,
    rawStatsResult.phantomFinalPct,
    rawStatsResult.finalPctAddend,
    state.legendaryAffixGroupState,
  );

  const cookingAtkStatId: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  const { inspirationPercentBonus, lifeWaveBonus, agileAtkMultPercent } = getCookingModifiers(
    state.cookingBuff,
    state.moduleSlots,
  );

  const cookingAdjustments = selectCookingAdjustments(
    finalStatsResult.stats,
    cookingAtkStatId,
    cookingResult.atkBonus,
    inspirationPercentBonus,
    rawStatsResult.highestStatFinalPctBonus,
    lifeWaveBonus,
    agileAtkMultPercent,
  );

  const stats = selectStatsWithCooking(finalStatsResult.stats, cookingAdjustments);
  const rawStatsBreakdown = selectBreakdownWithCooking(
    finalStatsResult.breakdown,
    cookingAdjustments,
  );

  const abilityScore = selectAbilityScore({
    equipped: state.equipped,
    perfectlines: state.perfectlines,
    evolutionStats: state.evolutionStats,
    refineLevels: state.refineLevels,
    legendaryAffixState: state.legendaryAffixState,
    legendaryAffixGroupState: state.legendaryAffixGroupState,
    slotEnchants: state.slotEnchants,
    profession,
    professionTypeKey: state.professionTypeKey,
    fixedLevels: state.fixedLevels,
    fixedRanks: state.fixedRanks,
    masteryEquipped: state.masteryEquipped,
    masteryLevels: state.masteryLevels,
    masteryRanks: state.masteryRanks,
    battleImagines: state.battleImagines,
    imagineRanks: state.imagineRanks,
    moduleSlots: state.moduleSlots,
    adventurerLevel: state.adventurerLevel,
    talentR1EnabledIds: state.talentR1EnabledIds,
    talentR2EnabledIds: state.talentR2EnabledIds,
    talentNodesById,
    phantomEnabled: state.phantomEnabled,
    phantomLevel: state.phantomLevel,
    phantomTemplateId: state.phantomTemplateId,
    phantomNodeSelections: state.phantomNodeSelections,
    phantomFactorSlots: state.phantomFactorSlots,
    phantomBondPoints: state.phantomBondPoints,
  });

  return {
    rawStats,
    rawStatsBreakdown,
    derivedStats,
    stats,
    abilityScore,
    roleSkills,
    talentNodesById,
    r1NodeCount,
    skillReplacements,
  };
}
