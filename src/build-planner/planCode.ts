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

// ---- decode時の構造検証ヘルパー ----
// 不正・破損したプランコード(想定と異なる型のJSON)が下流(applyPlanState以降、
// このファイルのtry/catchの外)でクラッシュしたり、NaN等の不正値が計算式全体に
// 伝播したりしないよう、配列/数値であることを都度確認してからのみ値を採用する。

function asFiniteNumber(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function asNumberArray(raw: unknown): number[] | undefined {
  return Array.isArray(raw) && raw.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? (raw as number[])
    : undefined;
}

function asNullableNumberArray(raw: unknown): Nullable<number>[] | undefined {
  return Array.isArray(raw) &&
    raw.every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)))
    ? (raw as Nullable<number>[])
    : undefined;
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

// fnがundefinedを返した場合(構造検証に失敗した要素)はそのスロットを未設定のまま
// スキップする(プラン全体を無効にせず、その1スロットだけデフォルトにフォールバックさせる)。
function unmapSlots<T>(
  arr: unknown,
  fn: (raw: NonNullable<unknown>) => T | undefined,
): Partial<Record<EquipmentSlotId, T>> {
  const result: Partial<Record<EquipmentSlotId, T>> = {};
  if (!Array.isArray(arr)) return result;
  SLOT_ORDER.forEach((slot, i) => {
    const raw = arr[i];
    if (raw === null || raw === undefined) return;
    const value = fn(raw);
    if (value !== undefined) result[slot] = value;
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
    if (!Array.isArray(raw)) return undefined;
    return [evoFromIdx(raw[0]), evoFromIdx(raw[1]), evoFromIdx(raw[2])];
  });
}

function encodeLegendaryAffix(state: SlotLegendaryAffix): Nullable<[number, number]>[] {
  return mapSlots(state, (sel) => [sel!.attrId, sel!.value]);
}

function decodeLegendaryAffix(arr: unknown): SlotLegendaryAffix {
  return unmapSlots(arr, (raw) => {
    if (!Array.isArray(raw) || typeof raw[0] !== 'number' || typeof raw[1] !== 'number') {
      return undefined;
    }
    return { attrId: raw[0], value: raw[1] } satisfies LegendaryAffixSelection;
  });
}

function encodeSlotEnchants(enchants: SlotEnchants): Nullable<number>[] {
  return mapSlots(enchants as Partial<Record<EquipmentSlotId, number>>, (id) => id);
}

function decodeSlotEnchants(arr: unknown): SlotEnchants {
  return unmapSlots(arr, (raw) => (typeof raw === 'number' ? raw : undefined));
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
    if (!Array.isArray(entry) || typeof entry[0] !== 'number') return null;
    const [modId, holes] = entry as [number, unknown[]];
    return {
      modId,
      holes: (Array.isArray(holes) ? holes : []).map((h) => {
        if (!Array.isArray(h)) return { effectId: null, linkCount: 0 };
        const [effectId, linkCount] = h as [Nullable<number>, number];
        return {
          effectId: typeof effectId === 'number' ? effectId : null,
          linkCount: typeof linkCount === 'number' ? linkCount : 0,
        };
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
    if (!Array.isArray(entry) || typeof entry[0] !== 'number' || typeof entry[1] !== 'number') {
      continue;
    }
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
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== 'number' ||
      typeof entry[1] !== 'string' ||
      typeof entry[2] !== 'number'
    ) {
      continue;
    }
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
    (raw) => PROFESSION_KEY_ORDER[typeof raw === 'number' ? raw : -1],
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
    (raw) => {
      const arr = asNumberArray(raw);
      return Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, arr?.[i] ?? DEFAULT_REFINE_LEVELS[slot]]),
      ) as SlotRefineLevels;
    },
  ),
  field(
    'perfectlines',
    (s) => SLOT_ORDER.map((slot) => s.perfectlines[slot]),
    (raw) => {
      const arr = asNumberArray(raw);
      return Object.fromEntries(
        SLOT_ORDER.map((slot, i) => [slot, arr?.[i] ?? DEFAULT_PERFECTLINES[slot]]),
      ) as SlotRefineLevels;
    },
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
    (raw) => (Array.isArray(raw) ? raw.map(fromB01) : []),
  ),
  field(
    'masteryLevels',
    (s) => s.masteryLevels,
    (raw) => asNumberArray(raw) ?? [],
  ),
  field(
    'masteryRanks',
    (s) => s.masteryRanks,
    (raw) => asNumberArray(raw) ?? [],
  ),
  field(
    'fixedLevels',
    (s) => s.fixedLevels,
    (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
  ),
  field(
    'fixedRanks',
    (s) => s.fixedRanks,
    (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
  ),
  field(
    'battleImagines',
    (s) => s.battleImagines,
    (raw) => asNullableNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.battleImagines,
  ),
  field(
    'imagineRanks',
    (s) => s.imagineRanks,
    (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.imagineRanks,
  ),
  field(
    'talentR1EnabledIds',
    (s) => s.talentR1EnabledIds,
    (raw) => asNumberArray(raw) ?? [],
  ),
  field(
    'talentR2EnabledIds',
    (s) => s.talentR2EnabledIds,
    (raw) => asNumberArray(raw) ?? [],
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
    (raw) => asFiniteNumber(raw),
  ),
  field(
    'phantomEnabled',
    (s) => (s.phantomEnabled === undefined ? null : b01(s.phantomEnabled)),
    (raw) => (raw == null ? undefined : fromB01(raw)),
  ),
  field(
    'phantomLevel',
    (s) => s.phantomLevel ?? null,
    (raw) => asFiniteNumber(raw),
  ),
  field(
    'phantomTemplateId',
    (s) => s.phantomTemplateId ?? null,
    (raw) => asFiniteNumber(raw) ?? null,
  ),
  field(
    'phantomBondPoints',
    (s) => s.phantomBondPoints ?? null,
    (raw) => asFiniteNumber(raw),
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
