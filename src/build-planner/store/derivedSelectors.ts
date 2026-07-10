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
import { memoize1 } from './memoize';
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

// calculateRawStatsは単一のinputオブジェクトを取るが、そのオブジェクトを呼び出し側
// (computeStatsBundle)で毎回新規のリテラルとして組み立てるとmemoize1の引数比較が
// 常に不一致になり(オブジェクト参照が呼び出しごとに変わるため)キャッシュが機能しない。
// 元のuseMemo依存配列と同じ粒度で個々のフィールドを引数に取り、ここでのみinput
// オブジェクトを組み立てる。
export const selectRawStatsResult = memoize1(
  (
    equipped: CalculateRawStatsInput['equipped'],
    legendaryAffixState: CalculateRawStatsInput['legendaryAffixState'],
    refineLevels: CalculateRawStatsInput['refineLevels'],
    perfectlines: CalculateRawStatsInput['perfectlines'],
    evolutionStats: CalculateRawStatsInput['evolutionStats'],
    profession: CalculateRawStatsInput['profession'],
    professionTypeKey: CalculateRawStatsInput['professionTypeKey'],
    talentR1EnabledIds: CalculateRawStatsInput['talentR1EnabledIds'],
    talentR2EnabledIds: CalculateRawStatsInput['talentR2EnabledIds'],
    talentNodesById: CalculateRawStatsInput['talentNodesById'],
    r1NodeCount: CalculateRawStatsInput['r1NodeCount'],
    battleImagines: CalculateRawStatsInput['battleImagines'],
    imagineRanks: CalculateRawStatsInput['imagineRanks'],
    slotEnchants: CalculateRawStatsInput['slotEnchants'],
    moduleSlots: CalculateRawStatsInput['moduleSlots'],
    adventurerLevel: CalculateRawStatsInput['adventurerLevel'],
    phantomEnabled: CalculateRawStatsInput['phantomEnabled'],
    phantomLevel: CalculateRawStatsInput['phantomLevel'],
    phantomTemplateId: CalculateRawStatsInput['phantomTemplateId'],
    phantomBondPoints: CalculateRawStatsInput['phantomBondPoints'],
    phantomNodeSelections: CalculateRawStatsInput['phantomNodeSelections'],
    phantomFactorSlots: CalculateRawStatsInput['phantomFactorSlots'],
    cookingBuff: CalculateRawStatsInput['cookingBuff'],
  ) =>
    calculateRawStats({
      equipped,
      legendaryAffixState,
      refineLevels,
      perfectlines,
      evolutionStats,
      profession,
      professionTypeKey,
      talentR1EnabledIds,
      talentR2EnabledIds,
      talentNodesById,
      r1NodeCount,
      battleImagines,
      imagineRanks,
      slotEnchants,
      moduleSlots,
      adventurerLevel,
      phantomEnabled,
      phantomLevel,
      phantomTemplateId,
      phantomBondPoints,
      phantomNodeSelections,
      phantomFactorSlots,
      cookingBuff,
    }),
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

// selectRawStatsResultと同じ理由(単一inputオブジェクトを呼び出し側で毎回新規に
// 組み立てるとmemoize1が常にキャッシュミスする)で、個々のフィールドを引数に取る。
export const selectAbilityScore = memoize1(
  (
    equipped: CalculateAbilityScoreInput['equipped'],
    perfectlines: CalculateAbilityScoreInput['perfectlines'],
    evolutionStats: CalculateAbilityScoreInput['evolutionStats'],
    refineLevels: CalculateAbilityScoreInput['refineLevels'],
    legendaryAffixState: CalculateAbilityScoreInput['legendaryAffixState'],
    slotEnchants: CalculateAbilityScoreInput['slotEnchants'],
    profession: CalculateAbilityScoreInput['profession'],
    professionTypeKey: CalculateAbilityScoreInput['professionTypeKey'],
    fixedLevels: CalculateAbilityScoreInput['fixedLevels'],
    fixedRanks: CalculateAbilityScoreInput['fixedRanks'],
    masteryEquipped: CalculateAbilityScoreInput['masteryEquipped'],
    masteryLevels: CalculateAbilityScoreInput['masteryLevels'],
    masteryRanks: CalculateAbilityScoreInput['masteryRanks'],
    battleImagines: CalculateAbilityScoreInput['battleImagines'],
    imagineRanks: CalculateAbilityScoreInput['imagineRanks'],
    moduleSlots: CalculateAbilityScoreInput['moduleSlots'],
    adventurerLevel: CalculateAbilityScoreInput['adventurerLevel'],
    talentR1EnabledIds: CalculateAbilityScoreInput['talentR1EnabledIds'],
    talentR2EnabledIds: CalculateAbilityScoreInput['talentR2EnabledIds'],
    talentNodesById: CalculateAbilityScoreInput['talentNodesById'],
    phantomEnabled: CalculateAbilityScoreInput['phantomEnabled'],
    phantomLevel: CalculateAbilityScoreInput['phantomLevel'],
    phantomTemplateId: CalculateAbilityScoreInput['phantomTemplateId'],
    phantomNodeSelections: CalculateAbilityScoreInput['phantomNodeSelections'],
    phantomFactorSlots: CalculateAbilityScoreInput['phantomFactorSlots'],
    phantomBondPoints: CalculateAbilityScoreInput['phantomBondPoints'],
  ): AbilityScoreBreakdown =>
    calculateAbilityScore({
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
      battleImagines,
      imagineRanks,
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
    }),
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

  const rawStatsResult = selectRawStatsResult(
    state.equipped,
    state.legendaryAffixState,
    state.refineLevels,
    state.perfectlines,
    state.evolutionStats,
    profession,
    state.professionTypeKey,
    state.talentR1EnabledIds,
    state.talentR2EnabledIds,
    talentNodesById,
    r1NodeCount,
    state.battleImagines,
    state.imagineRanks,
    state.slotEnchants,
    state.moduleSlots,
    state.adventurerLevel,
    state.phantomEnabled,
    state.phantomLevel,
    state.phantomTemplateId,
    state.phantomBondPoints,
    state.phantomNodeSelections,
    state.phantomFactorSlots,
    state.cookingBuff,
  );
  const rawStats = rawStatsResult.rawStats;

  const cookingResult = selectCookingResult(state.cookingBuff);

  const derivedStats = selectDerivedStats(
    rawStats,
    profession,
    rawStatsResult.conversionRateBonus,
    rawStatsResult.atkSpeedFinalPctAddend,
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

  const abilityScore = selectAbilityScore(
    state.equipped,
    state.perfectlines,
    state.evolutionStats,
    state.refineLevels,
    state.legendaryAffixState,
    state.slotEnchants,
    profession,
    state.professionTypeKey,
    state.fixedLevels,
    state.fixedRanks,
    state.masteryEquipped,
    state.masteryLevels,
    state.masteryRanks,
    state.battleImagines,
    state.imagineRanks,
    state.moduleSlots,
    state.adventurerLevel,
    state.talentR1EnabledIds,
    state.talentR2EnabledIds,
    talentNodesById,
    state.phantomEnabled,
    state.phantomLevel,
    state.phantomTemplateId,
    state.phantomNodeSelections,
    state.phantomFactorSlots,
    state.phantomBondPoints,
  );

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
