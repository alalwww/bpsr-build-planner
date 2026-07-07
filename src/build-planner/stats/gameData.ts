import classesDataRaw from '../../data/classes.json';
import talentTreeRaw from '../../data/talent-tree.json';
import battleImaginariesRaw from '../../data/battle-imaginaries.json';
import playerLevelsDataRaw from '../../data/player-levels.json';
import enchantsDataRaw from '../../data/enchants.json';
import refineDataRaw from '../../data/refine.json';
import skillFightValuesRaw from '../../data/skill-fight-values.json';
import skillRankFightValuesRaw from '../../data/skill-rank-fight-values.json';
import modulesDataRaw from '../../data/modules.json';
import suitsDataRaw from '../../data/suits.json';
import type { ModuleSlots, StatId } from '../types';
import { LEVEL_ATTR_TO_STAT } from './attrMaps';

// ZTable由来の静的ゲームデータの読み込み・パース・ルックアップをまとめたモジュール。
// ステータス/能力スコア計算(calculateRawStats.ts, calculateAbilityScore.ts)から参照される。

// ---- class data ----

export interface ClassData {
  normalAttackSkill: number[];
  specialSkill: number[];
  ultimateSkill: number[];
  normalSkill: number[];
  talentSkill: number[];
  roleSkill: number[];
}

const classesData = classesDataRaw as Record<string, ClassData>;

export function getClassData(professionId: number): ClassData | undefined {
  return classesData[String(professionId)];
}

// ---- talent tree helpers ----

export interface TalentTreeNode {
  id: number;
  talentId: number;
  stage: number;
  bdType: number;
  preNodes: number[];
  nextNodes: number[];
  position: [number, number];
  unlock?: number[][];
}

interface TalentStageInfo {
  id: number;
  stage: number;
  bdType: number;
  rootId: number;
  recommendTalent: number[];
}

export interface TalentNodeData {
  effects: number[][];
  fightValue: number;
}

export const talentTree = talentTreeRaw as unknown as {
  nodes: Record<string, TalentNodeData>;
  stagesByWeaponType: Record<string, TalentStageInfo[]>;
  treeNodesByWeaponType: Record<string, TalentTreeNode[]>;
};

export function initTalentR1Ids(professionId: number): Set<number> {
  const nodes = (talentTree.treeNodesByWeaponType[String(professionId)] ?? []) as TalentTreeNode[];
  const ids = new Set<number>();
  for (const n of nodes) {
    if (n.stage === 0) ids.add(n.id);
  }
  return ids;
}

export function initTalentR2Ids(professionId: number, bdType: 0 | 1): Set<number> {
  const stages = (talentTree.stagesByWeaponType[String(professionId)] ?? []) as TalentStageInfo[];
  const root = stages.find((s) => s.stage === 1 && s.bdType === bdType)?.rootId;
  return root != null ? new Set([root]) : new Set();
}

export function buildTalentNodesById(professionId: number): Map<number, TalentTreeNode> {
  const nodes = (talentTree.treeNodesByWeaponType[String(professionId)] ?? []) as TalentTreeNode[];
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

export interface ModData {
  mods: { id: number; modType: number; quality: number; holes: number }[];
  effectsByType: Record<string, number[]>;
  effects: Record<string, { icon: string; levels: [number, number, number[][]][] }>;
  linkEffects: [number, number, number[][]][]; // [linkTime, fightValue, [[effectType, attrId, value],...]]
}

export const modulesData = modulesDataRaw as unknown as ModData;

// 全ホールのリンクスタック数を effectId 別に集計し、各エフェクトの達成レベルとリンク合計を返す
export function calcModuleEffectLevels(
  slots: ModuleSlots,
  effects: ModData['effects'],
): { effectId: number; level: number; totalLink: number }[] {
  const linkByEffectId = new Map<number, number>();
  for (const slot of slots) {
    if (!slot) continue;
    for (const hole of slot.holes) {
      if (hole.effectId != null) {
        linkByEffectId.set(
          hole.effectId,
          (linkByEffectId.get(hole.effectId) ?? 0) + hole.linkCount,
        );
      }
    }
  }
  const result: { effectId: number; level: number; totalLink: number }[] = [];
  for (const [effectId, totalLink] of linkByEffectId) {
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

// ---- battle imaginary data ----

export interface ImaginaryData {
  passiveEffects?: number[][];
  baseFv?: number;
  fightValues?: number[];
}

export const imaginaryDataById = battleImaginariesRaw as unknown as Record<string, ImaginaryData>;

// passiveEffects format: [attrId, r0_val, r1_val, r2_val, r3_val, r4_val, r5_val]
// value = eff[rank + 1] (rank 0 → eff[1], rank 5 → eff[6])

// ---- enchant data ----

// アイテムID(基本/精/極) → effects / fightValue の高速ルックアップテーブル
interface EnchantEntryRaw {
  id: number;
  effects: [number, number][];
  fightValue?: number;
  refined?: { id: number; effects: [number, number][]; fightValue?: number };
  perfect?: { id: number; effects: [number, number][]; fightValue?: number };
}

export const enchantEffectsById = new Map<number, [number, number][]>();
export const enchantFightValueById = new Map<number, number>();
for (const items of Object.values(
  enchantsDataRaw as unknown as Record<string, EnchantEntryRaw[]>,
)) {
  for (const item of items) {
    enchantEffectsById.set(item.id, item.effects);
    if (item.fightValue) enchantFightValueById.set(item.id, item.fightValue);
    if (item.refined) {
      enchantEffectsById.set(item.refined.id, item.refined.effects);
      if (item.refined.fightValue)
        enchantFightValueById.set(item.refined.id, item.refined.fightValue);
    }
    if (item.perfect) {
      enchantEffectsById.set(item.perfect.id, item.perfect.effects);
      if (item.perfect.fightValue)
        enchantFightValueById.set(item.perfect.id, item.perfect.fightValue);
    }
  }
}

// ---- suit (set effect) data ----

export const suitsData = suitsDataRaw as Record<
  string,
  { tiers: { limitNum: number; fightValue: number }[] }
>;
