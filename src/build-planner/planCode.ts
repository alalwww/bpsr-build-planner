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
import {
  DEFAULT_PERFECTLINES,
  DEFAULT_REFINE_LEVELS,
  STATIC_AUTOSAVE_DEFAULTS,
} from './planDefaults';

// プランコードのワイヤーフォーマットバージョン。
// 下位互換性を保つため、新フィールドは既存インデックスを変更・再利用せず必ず
// FIELD_SPECS の末尾に追加すること(既存フィールドの並び順は変更しない)。この規約を
// 守る限り、旧バージョンで生成されたコード(要素数が少ない配列)は新バージョンの
// デコード処理でもそのまま読め、末尾の新フィールドは欠損時のデフォルト値にフォールバックする。
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

// ---- フィールド記述子テーブル ----
// AutoSaveState の各フィールドについて {キー, エンコード方法, デコード方法(デフォルト値
// フォールバック込み)} を1箇所にまとめる。配列内の並び順がそのままプランコード上の
// エンコード位置になるため、新フィールドは必ず末尾に追加すること(既存の並びは変更禁止)。
// デフォルト値は極力 planDefaults.ts の定数を参照し、ここでの再定義を避ける。

interface FieldSpec<K extends keyof AutoSaveState> {
  key: K;
  encode: (state: AutoSaveState) => unknown;
  decode: (raw: unknown) => AutoSaveState[K];
}

function field<K extends keyof AutoSaveState>(
  key: K,
  encode: (state: AutoSaveState) => unknown,
  decode: (raw: unknown) => AutoSaveState[K],
): FieldSpec<K> {
  return { key, encode, decode };
}

const FIELD_SPECS = [
  field(
    'name',
    (s) => s.name,
    (raw) => (typeof raw === 'string' ? raw : ''),
  ),
  field(
    'professionKey',
    (s) => PROFESSION_KEY_ORDER.indexOf(s.professionKey),
    (raw) => PROFESSION_KEY_ORDER[raw as number],
  ),
  field(
    'professionTypeKey',
    (s) => (s.professionTypeKey === 'type2' ? 1 : 0),
    (raw) => (raw === 1 ? 'type2' : 'type1') as ProfessionTypeKey,
  ),
  field(
    'equipped',
    (s) => encodeEquipped(s.equipped),
    (raw) => decodeEquipped(raw),
  ),
  field(
    'refineLevels',
    (s) => SLOT_ORDER.map((slot) => s.refineLevels[slot]),
    (raw) =>
      Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, (raw as number[])?.[i] ?? DEFAULT_REFINE_LEVELS[slot]]),
      ) as SlotRefineLevels,
  ),
  field(
    'perfectlines',
    (s) => SLOT_ORDER.map((slot) => s.perfectlines[slot]),
    (raw) =>
      Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, (raw as number[])?.[i] ?? DEFAULT_PERFECTLINES[slot]]),
      ) as SlotRefineLevels,
  ),
  field(
    'evolutionStats',
    (s) => encodeEvolutionStats(s.evolutionStats),
    (raw) => decodeEvolutionStats(raw),
  ),
  field(
    'legendaryAffixState',
    (s) => encodeLegendaryAffix(s.legendaryAffixState),
    (raw) => decodeLegendaryAffix(raw),
  ),
  field(
    'masteryEquipped',
    (s) => s.masteryEquipped.map(b01),
    (raw) => ((raw as unknown[]) ?? []).map(fromB01),
  ),
  field(
    'masteryLevels',
    (s) => s.masteryLevels,
    (raw) => (raw as number[]) ?? [],
  ),
  field(
    'masteryRanks',
    (s) => s.masteryRanks,
    (raw) => (raw as number[]) ?? [],
  ),
  field(
    'fixedLevels',
    (s) => s.fixedLevels,
    (raw) => (raw as number[]) ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
  ),
  field(
    'fixedRanks',
    (s) => s.fixedRanks,
    (raw) => (raw as number[]) ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
  ),
  field(
    'battleImaginaries',
    (s) => s.battleImaginaries,
    (raw) => (raw as Nullable<number>[]) ?? STATIC_AUTOSAVE_DEFAULTS.battleImaginaries,
  ),
  field(
    'imaginaryRanks',
    (s) => s.imaginaryRanks,
    (raw) => (raw as number[]) ?? STATIC_AUTOSAVE_DEFAULTS.imaginaryRanks,
  ),
  field(
    'talentR1EnabledIds',
    (s) => s.talentR1EnabledIds,
    (raw) => (raw as number[]) ?? [],
  ),
  field(
    'talentR2EnabledIds',
    (s) => s.talentR2EnabledIds,
    (raw) => (raw as number[]) ?? [],
  ),
  field(
    'slotEnchants',
    (s) => encodeSlotEnchants(s.slotEnchants ?? {}),
    (raw) => decodeSlotEnchants(raw),
  ),
  field(
    'moduleSlots',
    (s) => encodeModuleSlots(s.moduleSlots),
    (raw) => decodeModuleSlots(raw),
  ),
  field(
    'adventurerLevel',
    (s) => s.adventurerLevel ?? null,
    (raw) => (raw as number | null) ?? undefined,
  ),
  field(
    'phantomEnabled',
    (s) => (s.phantomEnabled === undefined ? null : b01(s.phantomEnabled)),
    (raw) => (raw == null ? undefined : fromB01(raw)),
  ),
  field(
    'phantomLevel',
    (s) => s.phantomLevel ?? null,
    (raw) => (raw as number | null) ?? undefined,
  ),
  field(
    'phantomTemplateId',
    (s) => s.phantomTemplateId ?? null,
    (raw) => (raw as number | null) ?? null,
  ),
  field(
    'phantomBondPoints',
    (s) => s.phantomBondPoints ?? null,
    (raw) => (raw as number | null) ?? undefined,
  ),
  field(
    'phantomNodeSelections',
    (s) => encodePairs(s.phantomNodeSelections ?? {}),
    (raw) => decodePairs(raw),
  ),
  field(
    'phantomFactorSlots',
    (s) => encodePhantomFactorSlots(s.phantomFactorSlots ?? {}),
    (raw) => decodePhantomFactorSlots(raw),
  ),
] as const;

// コンパイル時の網羅性チェック: AutoSaveState にフィールドを追加したのに FIELD_SPECS への
// 追記を忘れると、この型が `never` に収まらずビルドエラーになる。
type AssertNever<T extends never> = T;
const _fieldSpecsCoverAllAutoSaveKeys: AssertNever<
  Exclude<keyof AutoSaveState, (typeof FIELD_SPECS)[number]['key']>
> = undefined as never;
void _fieldSpecsCoverAllAutoSaveKeys;

// ---- プラン全体のエンコード/デコード ----
// 各フィールドの意味は FIELD_SPECS 内での並び順(インデックス)で決まる。

export function encodePlanCode(state: AutoSaveState): string {
  const arr: unknown[] = [PLAN_CODE_VERSION, ...FIELD_SPECS.map((f) => f.encode(state))];
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

    const result: Record<string, unknown> = {};
    FIELD_SPECS.forEach((f, i) => {
      result[f.key] = f.decode(arr[i + 1]);
    });
    if (!result.professionKey) return null;
    return result as AutoSaveState;
  } catch {
    return null;
  }
}
