import battleImaginesRaw from '../../data/battle-imagines.json';
import playerLevelsDataRaw from '../../data/player-levels.json';
import refineDataRaw from '../../data/refine.json';
import skillFightValuesRaw from '../../data/skill-fight-values.json';
import skillRankFightValuesRaw from '../../data/skill-rank-fight-values.json';
import type { ModuleSlots, StatId } from '../types';
import { LEVEL_ATTR_TO_STAT } from './attrMaps';
import { collectEquippedEffects, modulesData } from '../module/moduleData';
import { talentTree, type TreeNode } from '../talent/talentTreeData';
import { enchantsData, suitsData } from '../equipment/equipmentSlotPickerData';

// ZTable由来の静的ゲームデータの読み込み・パース・ルックアップをまとめたモジュール。
// ステータス/能力スコア計算(calculateRawStats.ts, calculateAbilityScore.ts)から参照される。
// 生JSON→型のパースはテーブルごとに単一の定義元を持ち、他テーブル分はここでは
// 再エクスポートと派生ルックアップの構築のみ行う:
//   classes.json → ../classData / talent-tree.json → ../talent/talentTreeData /
//   modules.json → ../module/moduleData / enchants.json・suits.json → ../equipment/equipmentSlotPickerData

export { modulesData };
export { talentTree };
export { suitsData };
export { classesData, type ClassData, getClassData } from '../classData';

// ---- talent tree helpers ----

// 計算側で使ってきた従来名。実体は talentTreeData の TreeNode と同一。
export type TalentTreeNode = TreeNode;

export function initTalentR1Ids(professionId: number): Set<number> {
  const nodes = talentTree.treeNodesByWeaponType[String(professionId)] ?? [];
  const ids = new Set<number>();
  for (const n of nodes) {
    if (n.stage === 0) ids.add(n.id);
  }
  return ids;
}

export function initTalentR2Ids(professionId: number, bdType: 0 | 1): Set<number> {
  const stages = talentTree.stagesByWeaponType[String(professionId)] ?? [];
  const root = stages.find((s) => s.stage === 1 && s.bdType === bdType)?.rootId;
  return root != null ? new Set([root]) : new Set();
}

export function buildTalentNodesById(professionId: number): Map<number, TalentTreeNode> {
  const nodes = talentTree.treeNodesByWeaponType[String(professionId)] ?? [];
  const map = new Map<number, TalentTreeNode>();
  for (const n of nodes) map.set(n.id, n);
  return map;
}

export function countR1Nodes(talentNodesById: Map<number, TalentTreeNode>): number {
  return [...talentNodesById.values()].filter((n) => n.stage === 0).length;
}

// ---- refine data ----

export interface RefineGroup {
  cumulative: [number, number][][];
  milestones: Record<string, [number, number][]>;
  fightValues?: number[];
}

interface RefineData {
  partRefineIds: Record<string, Record<string, number>>;
  refineById: Record<string, RefineGroup>;
}

export const refineData = refineDataRaw as unknown as RefineData;

// ---- skill fight values ----

export const skillFightValues = skillFightValuesRaw as Record<string, number[]>;
export const skillRankFightValues = skillRankFightValuesRaw as Record<string, number[]>;

// ---- player level data ----

interface PlayerLevelEntry {
  level: number;
  levelUpAttr: [number, number][];
  fightValue: number;
}

const playerLevelsData = playerLevelsDataRaw as unknown as { levels: PlayerLevelEntry[] };

// levelCumulativeData[N] = cumulative stats and fightValue for level N (index 0 = level 0 = nothing)
export const levelCumulativeData: Array<{
  stats: Partial<Record<StatId, number>>;
  fightValue: number;
}> = [];
{
  const cumStats: Partial<Record<StatId, number>> = {};
  let cumFV = 0;
  levelCumulativeData.push({ stats: {}, fightValue: 0 });
  for (const entry of [...playerLevelsData.levels].sort((a, b) => a.level - b.level)) {
    for (const [attrId, val] of entry.levelUpAttr) {
      const sid = LEVEL_ATTR_TO_STAT[attrId];
      if (sid) cumStats[sid] = (cumStats[sid] ?? 0) + val;
    }
    cumFV += entry.fightValue;
    levelCumulativeData.push({ stats: { ...cumStats }, fightValue: cumFV });
  }
}

// player-levels.json の season セクション
export const playerLevelSeasonData = (
  playerLevelsDataRaw as unknown as {
    levels: PlayerLevelEntry[];
    season: { count: number; levelUpAttr: [number, number][]; fightValue: number };
  }
).season;

// ---- module data ----
// modulesData(生JSONのパース結果)自体は module/moduleData.ts を単一の定義元とし、ここでは
// 再エクスポートのみ行う。

// levels配列の各要素は [fightValue, totalLinkThreshold, config, ...] の形。4番目以降の要素は
// ここでは使わないため、実データ(moduleData.tsのEffectData)ともテスト用の最小フィクスチャとも
// 構造的に両立するゆるい型で受け取る。
interface EffectLevelsTable {
  [effectId: string]:
    { levels: (readonly [number, number, ...unknown[]] | null | undefined)[] } | undefined;
}

// 全ホールのリンクスタック数を effectId 別に集計し(collectEquippedEffectsを共用)、
// 各エフェクトの達成レベルとリンク合計を返す。
export function calcModuleEffectLevels(
  slots: ModuleSlots,
  effects: EffectLevelsTable,
): { effectId: number; level: number; totalLink: number }[] {
  const result: { effectId: number; level: number; totalLink: number }[] = [];
  for (const [effectId, totalLink] of collectEquippedEffects(slots)) {
    const effData = effects[String(effectId)];
    if (!effData) continue;
    let level = 0;
    for (let lv = effData.levels.length - 1; lv >= 1; lv--) {
      const lvData = effData.levels[lv];
      if (lvData && lvData[1] <= totalLink) {
        level = lv;
        break;
      }
    }
    result.push({ effectId, level, totalLink });
  }
  return result;
}

// 指定effectIdのパワーコア効果の達成レベルを返す(Lv5/6のみ対象。未達成/未装着は0)。
// 幸運会心・HP変動・ダメージ増強・適応力など、Lv5/6到達時のみ発動する特殊バフの判定に使う。
export function getPowerCoreLevel(slots: ModuleSlots, effectId: number): 0 | 5 | 6 {
  const found = calcModuleEffectLevels(slots, modulesData.effects).find(
    (l) => l.effectId === effectId,
  );
  if (!found || found.level < 5) return 0;
  return found.level >= 6 ? 6 : 5;
}

// ---- battle imagine data ----
// battle-imagines.json の単一の定義元。スキルパネル側(skill/skillData.ts)は
// ここから再エクスポートして参照する。

export interface ImagineData {
  id: number;
  rarityType: number;
  // SkillAoyiTable.SeasonId (1=S1, 2=S2, 3=S3)。classification=4(コラボ)の場合は
  // フィルター上コラボ扱いとし、この値は無視する(imagineFilterData.ts参照)。
  seasonId: number;
  // SkillAoyiTable.Classification (1=紫品質, 2=通常橙品質, 3=特殊金品質, 4=コラボ限定)
  classification: number;
  icon: string;
  maxRank: number;
  passiveEffects?: number[][];
  baseFv?: number;
  fightValues?: number[];
}

export const imagineDataById = battleImaginesRaw as unknown as Record<string, ImagineData>;

// passiveEffects format: [attrId, r0_val, r1_val, r2_val, r3_val, r4_val, r5_val]
// value = eff[rank + 1] (rank 0 → eff[1], rank 5 → eff[6])

// ---- enchant data ----

// アイテムID(基本/精/極) → effects / fightValue の高速ルックアップテーブル。
// パース済みの enchantsData(equipmentSlotPickerData.ts)から構築する。
export const enchantEffectsById = new Map<number, [number, number][]>();
export const enchantFightValueById = new Map<number, number>();
for (const items of Object.values(enchantsData)) {
  for (const item of items) {
    for (const entry of [item, item.refined, item.perfect]) {
      if (!entry) continue;
      enchantEffectsById.set(entry.id, entry.effects);
      if (entry.fightValue) enchantFightValueById.set(entry.id, entry.fightValue);
    }
  }
}
