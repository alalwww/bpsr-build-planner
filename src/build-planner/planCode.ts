import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { getItemsBySlot } from './equipment/equipmentData';
import type { AutoSaveState } from './buildPlan';
import type {
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  ModuleConfig,
  ModuleSlots,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
} from './types';
import type { ProfessionKey, ProfessionTypeKey } from './profession';
import type { PhantomFactorSlotValue } from './phantom/phantomData';

// プランコードのワイヤーフォーマットバージョン。
// 下位互換性を保つため、新フィールドは既存インデックスを変更・再利用せず必ず配列の
// 末尾に追加すること(既存インデックスの意味・並び順は変更しない)。この規約を守る限り、
// 旧バージョンで生成されたコード(要素数が少ない配列)は新バージョンのデコード処理でも
// そのまま読め、末尾の新フィールドは欠損時のデフォルト値にフォールバックする。
// デコード時は「このビルドが理解できるバージョン以下か」だけを検証し、将来バージョンを
// 上げても旧コードのインポートが即エラーになることはない(decodePlanCode参照)。
const PLAN_CODE_VERSION = 1;

// キー名を持つJSONオブジェクトの代わりに、位置(インデックス)だけで意味が決まる
// タプル配列としてシリアライズする(gRPCのフィールド番号に相当)。
// これによりキー名の分だけ発生していた冗長さを圧縮前の時点で削減する。
// 装備スロットの固定順序(このリスト内での位置がそのままフィールドindexになる)。
const SLOT_ORDER: EquipmentSlotId[] = [
  'weapon',
  'head',
  'chest',
  'arms',
  'legs',
  'earring',
  'necklace',
  'ring',
  'ringLeft',
  'ringRight',
  'belt',
];

// クラス・進化ステータス・属性は文字列リテラルのままだと繰り返し出現して肥大化するため、
// 固定順序リストのインデックス(数値)に変換する。
const PROFESSION_KEY_ORDER: ProfessionKey[] = [
  'heavyGuardian',
  'shieldFighter',
  'galeLancer',
  'stormBlade',
  'divineArcher',
  'frostMage',
  'verdantOracle',
  'beatPerformer',
];

const EVOLUTION_STAT_ORDER: EvolutionStatId[] = ['haste', 'crit', 'luck', 'versatility', 'mastery'];

type Nullable<T> = T | null;

// ---- 小さな値の変換ヘルパー ----

const b01 = (v: boolean): 0 | 1 => (v ? 1 : 0);
const fromB01 = (v: unknown): boolean => v === 1;

function evoIdx(id: EvolutionStatId | undefined): number | null {
  if (id === undefined) return null;
  const i = EVOLUTION_STAT_ORDER.indexOf(id);
  return i === -1 ? null : i;
}

function evoFromIdx(idx: unknown): EvolutionStatId | undefined {
  if (typeof idx !== 'number') return undefined;
  return EVOLUTION_STAT_ORDER[idx];
}

// ---- スロット単位(11スロット固定順)の Partial<Record> <-> 配列 変換 ----

function mapSlots<T, R>(
  record: Partial<Record<EquipmentSlotId, T>>,
  fn: (v: T) => R,
): Nullable<R>[] {
  return SLOT_ORDER.map((slot) => {
    const v = record[slot];
    return v === undefined ? null : fn(v);
  });
}

function unmapSlots<T>(
  arr: unknown,
  fn: (raw: NonNullable<unknown>) => T,
): Partial<Record<EquipmentSlotId, T>> {
  const result: Partial<Record<EquipmentSlotId, T>> = {};
  if (!Array.isArray(arr)) return result;
  SLOT_ORDER.forEach((slot, i) => {
    const raw = arr[i];
    if (raw !== null && raw !== undefined) result[slot] = fn(raw);
  });
  return result;
}

// ---- 各フィールドのエンコード/デコード ----

function encodeEquipped(equipped: EquippedItems): Nullable<number>[] {
  return SLOT_ORDER.map((slot) => equipped[slot]?.id ?? null);
}

function decodeEquipped(arr: unknown): EquippedItems {
  const equipped: EquippedItems = {};
  if (!Array.isArray(arr)) return equipped;
  SLOT_ORDER.forEach((slot, i) => {
    const id = arr[i];
    if (typeof id !== 'number') return;
    const item = getItemsBySlot(slot).find((it) => it.id === id);
    if (item) equipped[slot] = item;
  });
  return equipped;
}

function encodeEvolutionStats(stats: SlotEvolutionStats): Nullable<Nullable<number>[]>[] {
  return mapSlots(stats, (arr) => [evoIdx(arr[0]), evoIdx(arr[1]), evoIdx(arr[2])]);
}

function decodeEvolutionStats(arr: unknown): SlotEvolutionStats {
  return unmapSlots(arr, (raw) => {
    const tuple = raw as unknown[];
    return [evoFromIdx(tuple[0]), evoFromIdx(tuple[1]), evoFromIdx(tuple[2])];
  });
}

function encodeLegendaryAffix(state: SlotLegendaryAffix): Nullable<[number, number]>[] {
  return mapSlots(state, (sel) => [sel!.attrId, sel!.value]);
}

function decodeLegendaryAffix(arr: unknown): SlotLegendaryAffix {
  return unmapSlots(arr, (raw) => {
    const [attrId, value] = raw as [number, number];
    return { attrId, value } satisfies LegendaryAffixSelection;
  });
}

function encodeSlotEnchants(enchants: SlotEnchants): Nullable<number>[] {
  return mapSlots(enchants as Partial<Record<EquipmentSlotId, number>>, (id) => id);
}

function decodeSlotEnchants(arr: unknown): SlotEnchants {
  return unmapSlots(arr, (raw) => raw as number);
}

function encodeModuleSlots(slots: ModuleSlots): Nullable<[number, Nullable<number>[][]]>[] {
  return slots.map((mod) => {
    if (!mod) return null;
    return [mod.modId, mod.holes.map((h) => [h.effectId, h.linkCount])];
  });
}

function decodeModuleSlots(arr: unknown): ModuleSlots {
  const empty: ModuleSlots = [null, null, null, null, null];
  if (!Array.isArray(arr)) return empty;
  return empty.map((_, i): ModuleConfig | null => {
    const entry = arr[i];
    if (!Array.isArray(entry)) return null;
    const [modId, holes] = entry as [number, unknown[]];
    return {
      modId,
      holes: (holes ?? []).map((h) => {
        const [effectId, linkCount] = h as [Nullable<number>, number];
        return { effectId, linkCount };
      }),
    };
  });
}

function encodePairs(record: Record<number, number>): [number, number][] {
  return Object.entries(record).map(([k, v]) => [Number(k), v]);
}

function decodePairs(arr: unknown): Record<number, number> {
  const result: Record<number, number> = {};
  if (!Array.isArray(arr)) return result;
  for (const entry of arr) {
    const [k, v] = entry as [number, number];
    result[k] = v;
  }
  return result;
}

function encodePhantomFactorSlots(
  record: Record<number, PhantomFactorSlotValue | null>,
): [number, string, number][] {
  const result: [number, string, number][] = [];
  for (const [k, v] of Object.entries(record)) {
    if (!v) continue;
    result.push([Number(k), v.classKey, v.grade]);
  }
  return result;
}

function decodePhantomFactorSlots(arr: unknown): Record<number, PhantomFactorSlotValue | null> {
  const result: Record<number, PhantomFactorSlotValue | null> = {};
  if (!Array.isArray(arr)) return result;
  for (const entry of arr) {
    const [groupId, classKey, grade] = entry as [number, string, number];
    result[groupId] = { classKey, grade };
  }
  return result;
}

// ---- プラン全体のエンコード/デコード ----
// 各要素の意味はインデックス位置で決まる(下記コメントの番号を参照)。

export function encodePlanCode(state: AutoSaveState): string {
  const arr: unknown[] = [
    PLAN_CODE_VERSION, // 0
    state.name, // 1
    PROFESSION_KEY_ORDER.indexOf(state.professionKey), // 2
    state.professionTypeKey === 'type2' ? 1 : 0, // 3
    encodeEquipped(state.equipped), // 4
    SLOT_ORDER.map((slot) => state.refineLevels[slot]), // 5
    SLOT_ORDER.map((slot) => state.perfectlines[slot]), // 6
    encodeEvolutionStats(state.evolutionStats), // 7
    encodeLegendaryAffix(state.legendaryAffixState), // 8
    state.masteryEquipped.map(b01), // 9
    state.masteryLevels, // 10
    state.masteryRanks, // 11
    state.fixedLevels, // 12
    state.fixedRanks, // 13
    state.battleImaginaries, // 14
    state.imaginaryRanks, // 15
    state.talentR1EnabledIds, // 16
    state.talentR2EnabledIds, // 17
    encodeSlotEnchants(state.slotEnchants ?? {}), // 18
    encodeModuleSlots(state.moduleSlots), // 19
    state.adventurerLevel ?? null, // 20
    state.phantomEnabled === undefined ? null : b01(state.phantomEnabled), // 21
    state.phantomLevel ?? null, // 22
    state.phantomTemplateId ?? null, // 23
    state.phantomBondPoints ?? null, // 24
    encodePairs(state.phantomNodeSelections ?? {}), // 25
    encodePhantomFactorSlots(state.phantomFactorSlots ?? {}), // 26
  ];
  return compressToEncodedURIComponent(JSON.stringify(arr));
}

export function decodePlanCode(code: string): AutoSaveState | null {
  try {
    const json = decompressFromEncodedURIComponent(code.trim());
    if (!json) return null;
    const arr = JSON.parse(json) as unknown[];
    if (!Array.isArray(arr)) return null;
    // 末尾追記のみで進化させる規約のため、このビルドが認識できる範囲の旧バージョン
    // (v <= PLAN_CODE_VERSION)はすべて同じロジックで読める。未知の将来バージョン
    // (このビルドより新しい = 互換性のない変更を含む可能性がある)のみ拒否する。
    const codeVersion = arr[0];
    if (typeof codeVersion !== 'number' || codeVersion < 1 || codeVersion > PLAN_CODE_VERSION) {
      return null;
    }

    const professionIdx = arr[2];
    if (typeof professionIdx !== 'number' || !PROFESSION_KEY_ORDER[professionIdx]) return null;

    return {
      name: typeof arr[1] === 'string' ? arr[1] : '',
      professionKey: PROFESSION_KEY_ORDER[professionIdx],
      professionTypeKey: (arr[3] === 1 ? 'type2' : 'type1') as ProfessionTypeKey,
      equipped: decodeEquipped(arr[4]),
      refineLevels: Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, (arr[5] as number[])?.[i] ?? 30]),
      ) as SlotRefineLevels,
      perfectlines: Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, (arr[6] as number[])?.[i] ?? 100]),
      ) as SlotRefineLevels,
      evolutionStats: decodeEvolutionStats(arr[7]),
      legendaryAffixState: decodeLegendaryAffix(arr[8]),
      slotEnchants: decodeSlotEnchants(arr[18]),
      masteryEquipped: ((arr[9] as unknown[]) ?? []).map(fromB01),
      masteryLevels: (arr[10] as number[]) ?? [],
      masteryRanks: (arr[11] as number[]) ?? [],
      fixedLevels: (arr[12] as number[]) ?? [30, 30, 30],
      fixedRanks: (arr[13] as number[]) ?? [6, 6, 6],
      battleImaginaries: (arr[14] as Nullable<number>[]) ?? [null, null],
      imaginaryRanks: (arr[15] as number[]) ?? [5, 5],
      talentR1EnabledIds: (arr[16] as number[]) ?? [],
      talentR2EnabledIds: (arr[17] as number[]) ?? [],
      moduleSlots: decodeModuleSlots(arr[19]),
      adventurerLevel: (arr[20] as number | null) ?? undefined,
      phantomEnabled: arr[21] == null ? undefined : fromB01(arr[21]),
      phantomLevel: (arr[22] as number | null) ?? undefined,
      phantomTemplateId: (arr[23] as number | null) ?? null,
      phantomBondPoints: (arr[24] as number | null) ?? undefined,
      phantomNodeSelections: decodePairs(arr[25]),
      phantomFactorSlots: decodePhantomFactorSlots(arr[26]),
    };
  } catch {
    return null;
  }
}
