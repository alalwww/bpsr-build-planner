import modulesDataRaw from '../../data/modules.json';
import recommendIconSrcAsset from '../../assets/modules/mod_icon_recommend.png';
import modAttack5Src from '../../assets/modules/item_icons_mod_device_attack5.png';
import modSupport5Src from '../../assets/modules/item_icons_mod_device_5.png';
import modProtect5Src from '../../assets/modules/item_icons_device_protect5.png';
import type { ModuleSlots } from '../types';
import type { Profession } from '../profession';
import { createAssetMap } from '../assetMap';
import {
  MOD_ADAPTIVE_ATK_ATTR_ID,
  MOD_ADAPTIVE_MAIN_STAT_ATTR_ID,
  MOD_ATTR_TO_STAT,
  MOD_CAST_SPEED_FINAL_PCT_ATTR_ID,
  TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID,
} from '../stats/attrMaps';

// 全属性攻撃力(モジュールのet=1加算のうち、rawStats.allAttrAtkへ特殊対応するattrId)。
// calculateRawStats.tsの同名の特殊分岐と対応を揃える(enchant側と同じ扱い)。
const MOD_ALL_ATTR_ATK_ATTR_ID = 11502;

export const recommendIconSrc = recommendIconSrcAsset;

// --- Asset globs ---
const modIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/modules/item_mod_device*.png', {
    eager: true,
  }),
);
const effectIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/modules/mod_effect_icon_*.png', {
    eager: true,
  }),
);
const emptySlotIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/modules/mod_device_empty_*.png', {
    eager: true,
  }),
);
const qualityBg = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/ui/item_quality_*.png', { eager: true }),
);

export function getModIcon(modType: number, quality: number): string | undefined {
  if (quality === 4) {
    if (modType === 1) return modAttack5Src;
    if (modType === 2) return modSupport5Src;
    if (modType === 3) return modProtect5Src;
  }
  const prefix = modType === 1 ? 'attack' : modType === 3 ? 'protect' : '';
  const suffix = quality + 1;
  return modIcon(`item_mod_device_${prefix}${suffix}`);
}

export function getQualityBg(quality: number): string | undefined {
  const bgIdx = quality >= 3 ? 4 : quality + 1;
  return qualityBg(`item_quality_${bgIdx}`);
}

export function getEffectIcon(iconName: string): string | undefined {
  return effectIcon(iconName);
}

export function getEmptySlotIcon(n: number): string | undefined {
  return emptySlotIcon(`mod_device_empty_${Math.min(n, 6)}`);
}

export function getModHoles(quality: number): number {
  if (quality === 1) return 1;
  if (quality === 2) return 2;
  return 3;
}

// --- Data ---
interface ModDataEntry {
  id: number;
  modType: number;
  quality: number;
  holes: number;
}

interface EffectData {
  icon: string;
  levels: ([number, number, number[][], number[]] | null | undefined)[];
}

interface ModsData {
  mods: ModDataEntry[];
  effectsByType: Record<string, number[]>;
  effects: Record<string, EffectData>;
  linkEffects: [number, number, number[][]][];
  recommendedEffects: Record<string, Record<string, number[]>>;
}

export const modulesData = modulesDataRaw as unknown as ModsData;

export function getModById(modId: number): ModDataEntry | undefined {
  return modulesData.mods.find((m) => m.id === modId);
}

export const isExtremeEffect = (effectId: number | null): boolean =>
  effectId != null && Math.floor(effectId / 1000) === 2;

export const MAX_LINK = [10, 10, 5] as const;

export const STAT_ORDER = [
  'maxHp',
  'atk',
  'matk',
  'allAttrAtk',
  'physicalDef',
  'strength',
  'agility',
  'intellect',
  'endurance',
  'crit',
  'haste',
  'luck',
  'mastery',
  'versatility',
  'allAttrStr',
  'critDamageBonus',
  'critRecoveryBonus',
  'luckyHitDamageBonus',
  'luckyHitRecoveryBonus',
  'physicalReductionBonus',
  'magicalReductionBonus',
  'physicalDefIgnoreBonus',
];

// STAT_ORDER のうち、rawStatsへの実数値ポイント加算ではなく%表示(単位100=1%)になる
// もの(会心ダメージ/会心回復/幸運の一撃ダメージ率/回復の倍率/物理・魔法軽減/
// 物理防御力無視)。formatEffectDesc側のMOD_PCT_ATTR_IDSと対象は同じだが、
// こちらはStatId単位(装備効果合計欄の表示用)。
export const MOD_PCT_STAT_IDS = new Set<string>([
  'critDamageBonus',
  'critRecoveryBonus',
  'luckyHitDamageBonus',
  'luckyHitRecoveryBonus',
  'physicalReductionBonus',
  'magicalReductionBonus',
  'physicalDefIgnoreBonus',
]);

// --- Effect category classification ---
const EFFECT_MOD_TYPES: Map<number, Set<number>> = (() => {
  const map = new Map<number, Set<number>>();
  for (const [typeStr, ids] of Object.entries(modulesData.effectsByType)) {
    const t = parseInt(typeStr);
    for (const id of ids as number[]) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(t);
    }
  }
  return map;
})();

export function getEffectCategory(effectId: number): number {
  const isExt = isExtremeEffect(effectId);
  const types = EFFECT_MOD_TYPES.get(effectId) ?? new Set<number>();
  const inDef = types.has(3),
    inSup = types.has(2),
    inAtk = types.has(1);
  const isDefOnly = inDef && !inSup && !inAtk;
  const isSuppOnly = inSup && !inDef && !inAtk;
  const isAtkOnly = inAtk && !inDef && !inSup;
  if (isExt) {
    if (isDefOnly) return 0;
    if (isSuppOnly) return 1;
    if (isAtkOnly) return 2;
    return 3;
  } else {
    if (isDefOnly) return 4;
    if (isSuppOnly) return 5;
    if (isAtkOnly) return 6;
    return 7;
  }
}

export function getMajorGroup(cat: number): number {
  return cat <= 3 ? 0 : cat;
}

// --- Description formatting ---

// et=1(通常のステータス加算)のうち、rawStatsへのポイント加算ではなく%表示(単位100=1%)
// になるattrId。攻撃速度/詠唱速度の%finalバリアント(11722/11732、StatIdを持たないため
// MOD_ATTR_TO_STATには含まれない)、会心ダメージ/会心回復(12512/12742)、
// 物理軽減/魔法軽減(12562/12582)、幸運の一撃ダメージ率/回復の倍率(12532/12722)、
// 物理防御力無視(11392)。後者はMOD_ATTR_TO_STAT経由のrawStats項目だが、
// 表示だけは他の%系ステータスと同様ここで変換する。
const MOD_PCT_ATTR_IDS = new Set<number>([
  11722, 11732, 12512, 12742, 12562, 12582, 12532, 12722, 11392,
]);

// 効果の説明文を行単位の配列で返す(呼び出し元で改行区切りに描画する)。
export function formatEffectDesc(
  config: number[][],
  ev: number[],
  tgAttrDesc: (key: string) => string,
  tgAttr: (key: string) => string,
  tStat: (key: string) => string,
): string[] {
  const parts: string[] = [];
  for (const [et, attrId, val] of config) {
    if (et === 1) {
      const sid = MOD_ATTR_TO_STAT[attrId];
      const name = sid ? tStat(sid) : tgAttr(String(attrId));
      const valueText = MOD_PCT_ATTR_IDS.has(attrId) ? `${(val / 100).toFixed(2)}%` : String(val);
      parts.push(`${name} +${valueText}`);
    } else if (et === 3) {
      const template = tgAttrDesc(String(attrId));
      if (template && !template.startsWith('attrDescs.')) {
        const desc = template.replace(/\{p(\d+)}/g, (_: string, n: string) => {
          const pval = ev[parseInt(n) - 1] ?? 0;
          return `${(pval / 100).toFixed(2)}%`;
        });
        parts.push(desc);
      }
    } else if (et === 5) {
      const template = tgAttrDesc(String(attrId));
      if (template && !template.startsWith('attrDescs.')) {
        parts.push(template.replace(/\{v}/g, String(val)));
      }
    }
  }
  return parts;
}

// --- Stats helpers ---

interface AchievedModuleEffect {
  effectId: number;
  level: number;
  config: number[][];
  ev: number[];
}

// 全ホールのリンクスタック数を effectId 別に集計し、各エフェクトが到達しているレベルの
// config(効果内容)/ev(表示用パラメータ)を返す。集計自体は collectEquippedEffects、
// レベル判定は getEffectLevel を共通利用する。
function getAchievedModuleEffects(moduleSlots: ModuleSlots): AchievedModuleEffect[] {
  const result: AchievedModuleEffect[] = [];
  for (const [effectId, totalLink] of collectEquippedEffects(moduleSlots)) {
    const level = getEffectLevel(effectId, totalLink);
    if (level === 0) continue;
    const lvData = modulesData.effects[String(effectId)]?.levels[level];
    if (!lvData) continue;
    result.push({ effectId, level, config: lvData[2], ev: lvData[3] ?? [] });
  }
  return result;
}

export interface ModuleTotalStatsResult {
  stats: Record<string, number>;
  // 攻撃速度/詠唱速度の%finalバリアント(calculateRawStatsのatkSpeedFinalPctAddend/
  // castSpeedFinalPctAddendと同じ単位: %そのままの数値)。StatId(rawStats)を持たないため
  // statsには含まれず、ここだけ別枠で返す。
  atkSpeedFinalPctAddend: number;
  castSpeedFinalPctAddend: number;
}

// 通常のステータス加算(et=1)に加え、「適応筋力/知力/敏捷」「適応物理/魔法攻撃力」(et=5)も
// クラスのメインステータス/攻撃タイプに応じた実ステータスへ合算する。
// calculateRawStats.tsの同名処理と対応を揃えること(全属性攻撃力の特殊対応、攻撃速度/
// 詠唱速度の%finalバリアントの個別集計)。
export function calcModuleTotalStats(
  moduleSlots: ModuleSlots,
  profession: Profession,
): ModuleTotalStatsResult {
  const stats: Record<string, number> = {};
  let atkSpeedFinalPctAddend = 0;
  let castSpeedFinalPctAddend = 0;
  const atkStatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  for (const eff of getAchievedModuleEffects(moduleSlots)) {
    for (const [et, attrId, val] of eff.config) {
      if (et === 1 && attrId === MOD_ALL_ATTR_ATK_ATTR_ID) {
        stats.allAttrAtk = (stats.allAttrAtk ?? 0) + val;
      } else if (et === 1 && attrId === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) {
        atkSpeedFinalPctAddend += val / 100;
      } else if (et === 1 && attrId === MOD_CAST_SPEED_FINAL_PCT_ATTR_ID) {
        castSpeedFinalPctAddend += val / 100;
      } else if (et === 1) {
        const sid = MOD_ATTR_TO_STAT[attrId];
        if (sid) stats[sid] = (stats[sid] ?? 0) + val;
      } else if (et === 5 && attrId === MOD_ADAPTIVE_MAIN_STAT_ATTR_ID) {
        stats[profession.mainStat] = (stats[profession.mainStat] ?? 0) + val;
      } else if (et === 5 && attrId === MOD_ADAPTIVE_ATK_ATTR_ID) {
        stats[atkStatId] = (stats[atkStatId] ?? 0) + val;
      }
    }
  }
  return { stats, atkSpeedFinalPctAddend, castSpeedFinalPctAddend };
}

export interface ModuleSpecialEffect {
  /** et:attrId をキーとした集約グループの一意キー(複数の効果が同じ属性を持つ場合に合算する単位)。 */
  key: string;
  icon: string | undefined;
  config: number[][];
  ev: number[];
}

// パワーコア効果のうち、通常のステータス加算(et=1)・適応ステータス/攻撃力(et=5)以外の
// 特殊効果(攻撃速度/詠唱速度/極HP変動/極幸運会心等)を抽出する。
// 同じ効果(et+attrId が同一)が複数のホールから発動している場合は値を合算して1件にまとめる。
// 「極」等の条件付き専用効果は attrId が他と重複しないため、自然に単独表示のまま保たれる。
export function calcModuleSpecialEffects(moduleSlots: ModuleSlots): ModuleSpecialEffect[] {
  const groups = new Map<
    string,
    { et: number; attrId: number; valSum: number; evSum: number[]; icon: string | undefined }
  >();
  for (const eff of getAchievedModuleEffects(moduleSlots)) {
    const effData = modulesData.effects[String(eff.effectId)];
    for (const [et, attrId, val] of eff.config) {
      if (et === 1) continue;
      if (
        et === 5 &&
        (attrId === MOD_ADAPTIVE_MAIN_STAT_ATTR_ID || attrId === MOD_ADAPTIVE_ATK_ATTR_ID)
      )
        continue;
      const key = `${et}:${attrId}`;
      let group = groups.get(key);
      if (!group) {
        group = { et, attrId, valSum: 0, evSum: [], icon: effData?.icon };
        groups.set(key, group);
      }
      group.valSum += val;
      eff.ev.forEach((v, i) => {
        group!.evSum[i] = (group!.evSum[i] ?? 0) + v;
      });
    }
  }
  return [...groups.values()].map((g) => ({
    key: `${g.et}:${g.attrId}`,
    icon: g.icon,
    config: [[g.et, g.attrId, g.valSum]],
    ev: g.evSum,
  }));
}

export function calcEffectTotalLink(effectId: number, moduleSlots: ModuleSlots): number {
  return collectEquippedEffects(moduleSlots).get(effectId) ?? 0;
}

export function getEffectLevel(effectId: number, totalLink: number): number {
  const effData = modulesData.effects[String(effectId)];
  if (!effData) return 0;
  for (let lv = effData.levels.length - 1; lv >= 1; lv--) {
    const lvData = effData.levels[lv];
    if (lvData && lvData[1] <= totalLink) return lv;
  }
  return 0;
}

export function calcGlobalLink(moduleSlots: ModuleSlots): number {
  let total = 0;
  for (const link of collectEquippedEffects(moduleSlots).values()) total += link;
  return total;
}

export function collectEquippedEffects(moduleSlots: ModuleSlots): Map<number, number> {
  const effectLinks = new Map<number, number>();
  for (const slot of moduleSlots) {
    if (!slot) continue;
    for (const h of slot.holes) {
      if (h.effectId != null)
        effectLinks.set(h.effectId, (effectLinks.get(h.effectId) ?? 0) + h.linkCount);
    }
  }
  return effectLinks;
}
