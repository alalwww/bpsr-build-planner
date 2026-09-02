// useBuildState.ts の useMemo チェーン(calculateRawStats → deriveStats →
// applyFinalStatModifiers → cookingAdjustments → stats/rawStatsBreakdown、および
// talentNodesById/r1NodeCount/skillReplacements/roleSkills/abilityScore)を、
// Zustandのselectorから呼べる形に移植したもの。
//
// Zustandには組み込みのcomputed機構がないため、各段を memoize1 で1スロットメモ化し、
// 元の useMemo と同じ引数集合(=同じ再計算粒度)を維持する。selectorはこれらの関数を
// 呼ぶだけにし、pure計算関数(calculateRawStats等)を直接呼ばないこと(店舗全体のリスク
// 注意点参照)。
import type {
  AbilityScoreBreakdown,
  CookingBuffState,
  ModuleSlots,
  StatCorrectionEntry,
  StatId,
} from '../types';
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
import {
  deriveStats,
  recalculateLuckyHitMultipliers,
  recalculateSpeedPercents,
} from '../stats/deriveStats';
import type { DerivedStats } from '../stats/deriveStats';
import {
  calculateMasteryFinalPctEffects,
  calculateMasteryStatEffects,
} from '../stats/masteryElementBonus';
import { calculateSuitAtkSpeedBonus } from '../stats/suitEffects';
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

// statCorrectionEnabled=falseの際にcomputeCookingAdjustmentsへ渡す空オブジェクト。呼び出し側
// (computeStatsBundle)で都度{}リテラルを生成すると、selectCookingAdjustments(memoize1)の
// 引数がObject.is比較で常に不一致になりキャッシュが効かず、以降のselectStatsWithCooking等の
// 参照も毎回変わって無限再レンダリングを引き起こすため、安定した参照として切り出す。
const EMPTY_STAT_CORRECTIONS: Partial<Record<StatId, StatCorrectionEntry>> = {};

export const selectDerivedStats = memoize1((...args: Parameters<typeof deriveStats>) =>
  deriveStats(...args),
);

// computeCookingAdjustmentsの「二段増幅」判定用の実数値(%変換前)。rawStatsを
// そのままスプレッドすると毎回新規オブジェクトになりselectCookingAdjustments(memoize1)のキャッシュが
// 効かなくなる(EMPTY_STAT_CORRECTIONSと同じ理由)ため、rawStats参照とhasteReal値が両方
// 前回と同じ場合のみ同一オブジェクトを返すよう1スロットメモ化する。
const selectHighestOfFiveRawStats = memoize1(
  (rawStats: Record<StatId, number>, hasteReal: number): Record<StatId, number> => ({
    ...rawStats,
    haste: hasteReal,
  }),
);

export const selectFinalStatsResult = memoize1(
  (...args: Parameters<typeof applyFinalStatModifiers>) => applyFinalStatModifiers(...args),
);

// 最終ファスト%(finalPctAddend/イマジン最終%乗算/料理バフ等すべて確定済みのstats.haste)を
// 使った攻撃速度%/詠唱速度%の再計算。deriveStats内の初期計算(rawStats由来のhastePercentのみ
// 見る中間値)はこれらの後付け加算を反映していないため、後段で上書きする(不具合報告
// 2026-08-05)。
export const selectFinalSpeedPercents = memoize1(
  (...args: Parameters<typeof recalculateSpeedPercents>) => recalculateSpeedPercents(...args),
);

export const selectSuitAtkSpeedBonus = memoize1(
  (...args: Parameters<typeof calculateSuitAtkSpeedBonus>) => calculateSuitAtkSpeedBonus(...args),
);

// 最終幸運%(finalPctAddend/イマジン最終%乗算/料理バフ等すべて確定済みのstats.luck)を使った
// 幸運の一撃ダメージ倍率/回復倍率の再計算。selectFinalSpeedPercentsと同じ理由(不具合報告
// 2026-08-09、recalculateSpeedPercentsと同種の後付け加算取りこぼし)。
export const selectFinalLuckyHitMultipliers = memoize1(
  (...args: Parameters<typeof recalculateLuckyHitMultipliers>) =>
    recalculateLuckyHitMultipliers(...args),
);

// derivedStatsのatkSpeedPercent/castSpeedPercent/luckyHitDamageMultiplierPercent/
// luckyHitRecoveryMultiplierPercentを、上記の再計算結果で上書きする。値が変化しない場合は
// 元の参照をそのまま返す(useShallowでの不要な再レンダリング防止、selectStatsWithMasteryFinalPctBonus
// 等と同じ理由)。
const selectDerivedStatsWithFinalAdjustments = memoize1(
  (
    derivedStats: DerivedStats,
    atkSpeedPercent: number,
    castSpeedPercent: number,
    luckyHitDamageMultiplierPercent: number,
    luckyHitRecoveryMultiplierPercent: number,
  ): DerivedStats => {
    if (
      atkSpeedPercent === derivedStats.atkSpeedPercent &&
      castSpeedPercent === derivedStats.castSpeedPercent &&
      luckyHitDamageMultiplierPercent === derivedStats.luckyHitDamageMultiplierPercent &&
      luckyHitRecoveryMultiplierPercent === derivedStats.luckyHitRecoveryMultiplierPercent
    ) {
      return derivedStats;
    }
    return {
      ...derivedStats,
      atkSpeedPercent,
      castSpeedPercent,
      luckyHitDamageMultiplierPercent,
      luckyHitRecoveryMultiplierPercent,
    };
  },
);

export const selectCookingAdjustments = memoize1(
  (...args: Parameters<typeof computeCookingAdjustments>) => computeCookingAdjustments(...args),
);

// 器用さ→ステータス(クラス×型固有効果)を適用したrawStats。1スロットメモ化しないと
// (効果が1件以上ある場合)毎回新規オブジェクトを返してしまい、useShallowでの参照比較が
// 常に「変化あり」判定になって無限再レンダリングを引き起こす。
const selectRawStatsWithMasteryBonus = memoize1(
  (
    rawStats: Record<StatId, number>,
    professionKey: BuildStore['professionKey'],
    professionTypeKey: BuildStore['professionTypeKey'],
    finalMasteryPercent: number,
  ): Record<StatId, number> => {
    const effects = calculateMasteryStatEffects(
      professionKey,
      professionTypeKey,
      finalMasteryPercent,
    );
    if (effects.length === 0) return rawStats;
    const result = { ...rawStats };
    for (const { statId, addend } of effects) {
      result[statId] += addend;
    }
    return result;
  },
);

// 器用さ→実数値ステータス(atk/matk等)への最終値乗算ボーナス。selectRawStatsWithMasteryBonus
// と同じ理由(器用さ0以外の効果がある場合、毎回新規オブジェクトになるのを防ぐ)で1スロット
// メモ化する。stats(料理バフ等すべて適用済みの最終値)を受け取り、対象ステータスにのみ
// 乗算するため、selectRawStatsWithMasteryBonus(flat加算)とは適用対象・タイミングが異なる。
const selectStatsWithMasteryFinalPctBonus = memoize1(
  (
    stats: Record<StatId, number>,
    professionKey: BuildStore['professionKey'],
    professionTypeKey: BuildStore['professionTypeKey'],
    finalMasteryPercent: number,
  ): Record<StatId, number> => {
    const effects = calculateMasteryFinalPctEffects(
      professionKey,
      professionTypeKey,
      finalMasteryPercent,
    );
    if (effects.length === 0) return stats;
    const result = { ...stats };
    for (const { statId, multiplier } of effects) {
      result[statId] = result[statId] * multiplier;
    }
    return result;
  },
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
    rawStatsResult.luckyHitDamageRatioBonus,
    rawStatsResult.finalPctAddend,
    rawStatsResult.hasteRealAdjusted,
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
    selectHighestOfFiveRawStats(rawStats, derivedStats.hasteReal),
    state.cookingBuff.statCorrectionEnabled
      ? state.cookingBuff.statCorrections
      : EMPTY_STAT_CORRECTIONS,
  );

  const stats = selectStatsWithCooking(finalStatsResult.stats, cookingAdjustments);
  const rawStatsBreakdown = selectBreakdownWithCooking(
    finalStatsResult.breakdown,
    cookingAdjustments,
  );

  // 最終ファスト%(stats.haste)を使って攻撃速度%/詠唱速度%を再計算し、レイドセット効果のうち
  // 現在の攻撃速度%を閾値とする条件付き効果(例: S2セット ストームブレイド月影型「攻撃速度が
  // 80%未満の場合、攻撃速度+6%」)を上乗せする。
  const finalSpeedPercents = selectFinalSpeedPercents(
    stats.haste,
    profession,
    rawStatsResult.atkSpeedPerHastePercentBonus,
    rawStatsResult.atkSpeedFinalPctAddend,
    rawStatsResult.castSpeedFinalPctAddend,
  );
  const suitAtkSpeedBonus = selectSuitAtkSpeedBonus(
    state.equipped,
    profession,
    state.professionTypeKey,
    finalSpeedPercents.atkSpeedPercent,
  );

  // 最終幸運%(stats.luck)を使って幸運の一撃ダメージ倍率/回復倍率を再計算する
  // (finalSpeedPercentsと同じ理由)。
  const finalLuckyHitMultipliers = selectFinalLuckyHitMultipliers(
    stats.luck,
    rawStatsResult.luckyHitDamageRatioBonus,
    rawStats.luckyHitDamageBonus,
    rawStats.luckyHitRecoveryBonus,
  );
  const derivedStatsFinal = selectDerivedStatsWithFinalAdjustments(
    derivedStats,
    finalSpeedPercents.atkSpeedPercent + suitAtkSpeedBonus,
    finalSpeedPercents.castSpeedPercent,
    finalLuckyHitMultipliers.luckyHitDamageMultiplierPercent,
    finalLuckyHitMultipliers.luckyHitRecoveryMultiplierPercent,
  );

  // 器用さ→ステータス(クラス×型固有効果。属性ボーナス/バリア強度/回復力)。実際に
  // キャラクターパネルに表示される最終器用さ%(料理バフの「ひらめき」等も含めすべての
  // 調整が終わった後のstats.mastery)に依存するため、calculateRawStats内では計算できず
  // ここで後付けする(highestStatFinalPctBonus等と同じ理由)。対象StatIdのrawStatsに
  // 直接加算し、蒼海武器レアステータス等の既存の直接加算と同じ表示経路
  // (StatsDetailDialogのelemDirectBonusPercent/バリア強度・回復力行)に乗せる。
  const rawStatsWithMasteryBonus = selectRawStatsWithMasteryBonus(
    rawStats,
    state.professionKey,
    state.professionTypeKey,
    stats.mastery,
  );

  // 器用さ→実数値ステータス(atk/matk等)への最終値乗算ボーナス(例: ツインストライカー
  // 双炎型の物理攻撃力+0.2%/pt)。上と同じくstats.mastery確定後にのみ計算できる。
  const statsWithMasteryFinalPctBonus = selectStatsWithMasteryFinalPctBonus(
    stats,
    state.professionKey,
    state.professionTypeKey,
    stats.mastery,
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
    rawStats: rawStatsWithMasteryBonus,
    rawStatsBreakdown,
    derivedStats: derivedStatsFinal,
    stats: statsWithMasteryFinalPctBonus,
    abilityScore,
    roleSkills,
    talentNodesById,
    r1NodeCount,
    skillReplacements,
  };
}
