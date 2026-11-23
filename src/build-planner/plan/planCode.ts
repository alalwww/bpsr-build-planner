import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { getItemsBySlot } from '../equipment/equipmentData';
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
  SlotLegendaryAffixGroups,
  SlotRefineLevels,
} from '../types';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import type { PhantomAffixValue, PhantomFactorSlotValue } from '../phantom/phantomData';
import {
  DEFAULT_PERFECTLINES,
  DEFAULT_REFINE_LEVELS,
  STATIC_AUTOSAVE_DEFAULTS,
} from './planDefaults';
import { CURRENT_SAVE_SEASON_ID, LEGACY_SAVE_SEASON_ID } from './saveSeason';

// 映痕のスロット位置の上限(不正なコードで巨大な配列を作らないための安全弁。現データの最大は4)。
const MAX_AFFIX_SLOT_INDEX = 16;

// プランコードのワイヤーフォーマットバージョン。書き出しは常に最新(v3)で、旧バージョンは
// 読み込みのみ対応する。同じバージョン内では、新フィールドは既存インデックスを変更・再利用せず
// 必ず各配列の末尾に追加すること(既存の並び順は変更しない)。この規約を守る限り、要素数が
// 少ない古いコードもそのまま読め、末尾の新フィールドは欠損時のデフォルト値にフォールバックする。
// このビルドより新しいバージョンのコードは拒否する(decodePlanCode参照)。
//
// v1→v2: nameフィールドをFIELD_SPECS(構造データ)から分離し、コード文字列を
// "{version}:{エンコードされたname}:{圧縮された構造データ}" という`:`区切りの3分割
// フォーマットに変更した。名称部分は encodeName()/decodeName() (下部で定義)により
// lz-string圧縮とURLセーフBase64のうち短い方を都度選択してエンコードする(生の文字列や
// 単純なencodeURIComponentは日本語名で大きく肥大化するため採用しない)。どちらの方式も
// 出力に`:`を含まないため、構造データ側(lz-stringのcompressToEncodedURIComponentも同様に
// `:`を含まない)と衝突しない。この分割により、構造データを解凍せずに文字列操作だけで
// 名称を取り出せる(将来、名称を除いた構造データ部分だけをハッシュ化して短縮URL化する
// 用途を見据えたもの)。名称を含む旧v1コードは`:`を一切含まないため、`decodePlanCode`は
// `:`の有無でv1/v2を判別する。
//
// v2→v3(シーズン4): 構造データを、変更される可能性が低いものから順に並べたグループ構造に
// 組み替え(装備は部位毎のエントリにまとめた)、シーズン固有要素(心相投影)を先頭に
// シーズン番号を持つ1要素に分離した(下の「v3 の構造」参照)。v2のコードは装備・スキル等を
// そのまま読み、シーズン固有要素はS3のものとして扱う(読込時に初期化される)。
const SAVE_FORMAT_VERSION = 3;
const LEGACY_PLAN_CODE_VERSION = 1;

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
// 既存データとの互換性を保つため、新しいクラスの追加時は必ず末尾に追記すること
// (途中への挿入や並び替えは既存の保存データのクラス判定を破壊する)。
const PROFESSION_KEY_ORDER: ProfessionKey[] = [
  'heavyGuardian',
  'shieldFighter',
  'galeLancer',
  'stormBlade',
  'divineArcher',
  'frostMage',
  'verdantOracle',
  'beatPerformer',
  'twinStriker',
];

// コンパイル時の網羅性チェック: ProfessionKey にクラスを追加したのに
// PROFESSION_KEY_ORDER への追記を忘れると、この型が `never` に収まらずビルドエラーになる。
type AssertNeverProfessionKey<T extends never> = T;
const _professionKeyOrderCoversAllKeys: AssertNeverProfessionKey<
  Exclude<ProfessionKey, (typeof PROFESSION_KEY_ORDER)[number]>
> = undefined as never;
void _professionKeyOrderCoversAllKeys;

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

function encodeLegendaryAffixGroups(
  state: SlotLegendaryAffixGroups,
): Nullable<Nullable<[number, number]>[]>[] {
  return mapSlots(state, (selections) =>
    selections.map((sel) => (sel ? [sel.attrId, sel.value] : null)),
  );
}

function decodeLegendaryAffixGroups(arr: unknown): SlotLegendaryAffixGroups {
  return unmapSlots(arr, (raw) => {
    if (!Array.isArray(raw)) return undefined;
    return raw.map((entry) => {
      if (!Array.isArray(entry) || typeof entry[0] !== 'number' || typeof entry[1] !== 'number') {
        return undefined;
      }
      return { attrId: entry[0], value: entry[1] } satisfies LegendaryAffixSelection;
    });
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

// 因子エントリ: [groupId, classKey, grade] または映痕付きの [groupId, classKey, grade, 映痕]。
// 映痕は空きスロットを含めず [[スロット位置, group, quality, value], ...] で持つ。
function encodePhantomFactorSlots(
  record: Record<number, PhantomFactorSlotValue | null>,
): unknown[] {
  const result: unknown[] = [];
  for (const [k, v] of Object.entries(record)) {
    if (!v) continue;
    const affixes: [number, number, number, number][] = [];
    v.affixes?.forEach((a, i) => {
      if (a) affixes.push([i, a.group, a.quality, a.value]);
    });
    result.push(
      affixes.length > 0
        ? [Number(k), v.classKey, v.grade, affixes]
        : [Number(k), v.classKey, v.grade],
    );
  }
  return result;
}

function decodePhantomAffixes(arr: unknown): PhantomFactorSlotValue['affixes'] {
  if (!Array.isArray(arr)) return undefined;
  const result: (PhantomAffixValue | null)[] = [];
  for (const entry of arr) {
    if (!Array.isArray(entry) || entry.length < 4 || !entry.every((n) => Number.isInteger(n))) {
      continue;
    }
    const [index, group, quality, value] = entry as number[];
    if (index < 0 || index >= MAX_AFFIX_SLOT_INDEX) continue;
    while (result.length <= index) result.push(null);
    result[index] = { group, quality, value };
  }
  return result.length > 0 ? result : undefined;
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
    const affixes = decodePhantomAffixes(entry[3]);
    result[groupId] = affixes ? { classKey, grade, affixes } : { classKey, grade };
  }
  return result;
}

// ---- 共通のフィールドデコーダ(v2/v3共用) ----
// デフォルト値は極力 planDefaults.ts の定数を参照し、ここでの再定義を避ける。

function decodeProfessionKey(raw: unknown): ProfessionKey | undefined {
  // 修正前のバージョンでは PROFESSION_KEY_ORDER に twinStriker が未登録だったため、
  // ツインストライカーで保存したデータは indexOf が -1 を返し、その値がそのまま
  // 保存されていた。職業選択は必須(未選択のデータは存在しない)なので、-1 は
  // 「当時ツインストライカーとして保存された」ことを示す値として復元する。
  if (raw === -1) return 'twinStriker';
  return PROFESSION_KEY_ORDER[typeof raw === 'number' ? raw : -1];
}

const encodeProfessionTypeKey = (key: ProfessionTypeKey): number => (key === 'type2' ? 1 : 0);
const decodeProfessionTypeKey = (raw: unknown): ProfessionTypeKey =>
  raw === 1 ? 'type2' : 'type1';

// スロット単位の数値(精錬Lv/完成度)。壊れた要素はそのスロットだけデフォルトにする。
function decodeSlotNumbers(raw: unknown, defaults: SlotRefineLevels): SlotRefineLevels {
  const arr: unknown[] = Array.isArray(raw) ? raw : [];
  return Object.fromEntries(
    SLOT_ORDER.map((slot, i) => [slot, asFiniteNumber(arr[i]) ?? defaults[slot]]),
  ) as SlotRefineLevels;
}

const decodeB01Array = (raw: unknown): boolean[] => (Array.isArray(raw) ? raw.map(fromB01) : []);
const decodeOptionalB01 = (raw: unknown): boolean | undefined =>
  raw == null ? undefined : fromB01(raw);
const decodeNumbers = (raw: unknown): number[] => asNumberArray(raw) ?? [];

// optional フィールドも含めて全キーの記述を強制する(書き忘れをコンパイルエラーにする)。
type Complete<T> = { [K in keyof Required<T>]: T[K] };
type StructuralState = Complete<Omit<AutoSaveState, 'name'>>;

// ---- v2(S3まで)の読み込み専用フィールド表 ----
// v2 は AutoSaveState の各フィールドを1要素ずつ並べた位置ベースの配列。書き出しは v3 のみで、
// v2 は読み込み専用。シーズン固有要素(心相投影)も読むが、S3として扱う(saveSeasonId=3)ため
// 読込時にストア側で初期化される(saveSeason.ts の needsPhantomReset)。

interface V2Field {
  key: keyof AutoSaveState;
  decode: (raw: unknown) => unknown;
}

function v2<K extends keyof AutoSaveState>(
  key: K,
  decode: (raw: unknown) => AutoSaveState[K],
): V2Field {
  return { key, decode };
}

const V2_FIELDS: (V2Field | null)[] = [
  v2('professionKey', (raw) => decodeProfessionKey(raw) as ProfessionKey),
  v2('professionTypeKey', decodeProfessionTypeKey),
  v2('equipped', decodeEquipped),
  v2('refineLevels', (raw) => decodeSlotNumbers(raw, DEFAULT_REFINE_LEVELS)),
  v2('perfectlines', (raw) => decodeSlotNumbers(raw, DEFAULT_PERFECTLINES)),
  v2('evolutionStats', decodeEvolutionStats),
  v2('legendaryAffixState', decodeLegendaryAffix),
  v2('masteryEquipped', decodeB01Array),
  v2('masteryLevels', decodeNumbers),
  v2('masteryRanks', decodeNumbers),
  v2('fixedLevels', (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels),
  v2('fixedRanks', (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks),
  v2(
    'battleImagines',
    (raw) => asNullableNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.battleImagines,
  ),
  v2('imagineRanks', (raw) => asNumberArray(raw) ?? STATIC_AUTOSAVE_DEFAULTS.imagineRanks),
  v2('talentR1EnabledIds', decodeNumbers),
  v2('talentR2EnabledIds', decodeNumbers),
  v2('slotEnchants', decodeSlotEnchants),
  v2('moduleSlots', decodeModuleSlots),
  v2('adventurerLevel', asFiniteNumber),
  v2('phantomEnabled', decodeOptionalB01),
  v2('phantomLevel', asFiniteNumber),
  v2('phantomTemplateId', (raw) => asFiniteNumber(raw) ?? null),
  null, // phantomBondPoints(S3の絆レベルポイント。S4で廃止)
  v2('phantomNodeSelections', decodePairs),
  v2('phantomFactorSlots', decodePhantomFactorSlots),
  // roleSkillSlots/roleSkillRanks は値が無い(旧データ)場合 undefined のまま返す。固定デフォルトに
  // フォールバックすると、呼び出し側(applyPlanState)のprofessionKey別「ロール専用4種」への
  // フォールバックが機能しなくなる。
  v2('roleSkillSlots', asNullableNumberArray),
  v2('roleSkillRanks', asNumberArray),
  v2('legendaryAffixGroupState', decodeLegendaryAffixGroups),
];

function decodeV2Array(arr: unknown[], offset: number): Omit<AutoSaveState, 'name'> | null {
  const result: Record<string, unknown> = { saveSeasonId: LEGACY_SAVE_SEASON_ID };
  V2_FIELDS.forEach((f, i) => {
    if (f) result[f.key] = f.decode(arr[i + offset]);
  });
  if (!result.professionKey) return null;
  return result as Omit<AutoSaveState, 'name'>;
}

// ---- v3 の構造 ----
// 変更される可能性が低いものから順に並べる。各グループ内も位置ベースで、要素を足すときは
// その配列の末尾に追加すること(既存の並びは変更禁止)。
//
//   0  冒険者Lv
//   1  クラス(PROFESSION_KEY_ORDER のindex)
//   2  型(0=type1, 1=type2)
//   3  アビリティツリー     [R1有効ID[], R2有効ID[]]
//   4  クラススキル         [Lv[], ランク[]]
//   5  マスタリースキル     [装着(0/1)[], Lv[], ランク[]]
//   6  バトルイマジン       [ID|null[], ランク[]]
//   7  ロールスキル(ロールイマジン) [ID|null[] | null, ランク[] | null]
//   8  部位毎の精錬Lv       SLOT_ORDER順の数値
//   9  部位毎の装備         SLOT_ORDER順の [装備ID|null, 完成度, 進化ステータス|null,
//                           レアステータス|null, 4枠レアステータス|null, 刻印ID|null]
//   10 モジュール           [modId, [[effectId, linkCount], ...]] | null (5枠)
//   11 シーズン固有要素     [シーズン番号, ...] (encodeSeasonBlock 参照)

const V3 = {
  adventurerLevel: 0,
  professionKey: 1,
  professionTypeKey: 2,
  talents: 3,
  classSkills: 4,
  masterySkills: 5,
  imagines: 6,
  roleSkills: 7,
  refineLevels: 8,
  equipment: 9,
  modules: 10,
  season: 11,
} as const;

function encodeEquipment(s: AutoSaveState): unknown[][] {
  // 部位毎のエントリ内の並び(この配列の順がそのままエントリ内の位置になる)。
  const columns: unknown[][] = [
    encodeEquipped(s.equipped),
    SLOT_ORDER.map((slot) => s.perfectlines[slot] ?? null),
    encodeEvolutionStats(s.evolutionStats),
    encodeLegendaryAffix(s.legendaryAffixState),
    encodeLegendaryAffixGroups(s.legendaryAffixGroupState),
    encodeSlotEnchants(s.slotEnchants ?? {}),
  ];
  return SLOT_ORDER.map((_, si) => columns.map((col) => col[si] ?? null));
}

// 部位毎のエントリを、フィールド単位のデコーダが読める列(SLOT_ORDER順の配列)に組み替える。
function equipmentColumn(raw: unknown, index: number): unknown[] {
  const entries: unknown[] = Array.isArray(raw) ? raw : [];
  return SLOT_ORDER.map((_, si) => {
    const entry = entries[si];
    return Array.isArray(entry) ? ((entry[index] as unknown) ?? null) : null;
  });
}

type SeasonFields = Pick<
  StructuralState,
  | 'saveSeasonId'
  | 'phantomEnabled'
  | 'phantomLevel'
  | 'phantomTemplateId'
  | 'phantomNodeSelections'
  | 'phantomFactorSlots'
>;

// シーズン固有要素。先頭がシーズン番号で、2番目以降の並びはシーズンごとに定義する。
// 現行シーズン以外のブロックは中身を読まない(シーズンが変わったらこの要素だけが初期化される)。
// 過去シーズンのまま再保存されるデータ(未読込の保存プランが一覧の更新で書き直される場合等)は、
// 中身を現行の並びで表現できないため、シーズン番号だけを残して中身を捨てる。
//   S4: [4, 有効化(0/1)|null, 祈願Lv|null, テンプレートID|null,
//        ノード選択[[sameGroupId, nodeId], ...], 因子[[groupId, classKey, grade(, 映痕)], ...]]
function encodeSeasonBlock(s: AutoSaveState): unknown[] {
  const seasonId = s.saveSeasonId ?? CURRENT_SAVE_SEASON_ID;
  if (seasonId !== CURRENT_SAVE_SEASON_ID) return [seasonId];
  return [
    seasonId,
    s.phantomEnabled === undefined ? null : b01(s.phantomEnabled),
    s.phantomLevel ?? null,
    s.phantomTemplateId ?? null,
    encodePairs(s.phantomNodeSelections ?? {}),
    encodePhantomFactorSlots(s.phantomFactorSlots ?? {}),
  ];
}

function decodeSeasonBlock(raw: unknown): SeasonFields {
  const block: unknown[] = Array.isArray(raw) ? raw : [];
  const saveSeasonId = asFiniteNumber(block[0]) ?? LEGACY_SAVE_SEASON_ID;
  if (saveSeasonId !== CURRENT_SAVE_SEASON_ID) {
    return {
      saveSeasonId,
      phantomEnabled: undefined,
      phantomLevel: undefined,
      phantomTemplateId: null,
      phantomNodeSelections: {},
      phantomFactorSlots: {},
    };
  }
  return {
    saveSeasonId,
    phantomEnabled: decodeOptionalB01(block[1]),
    phantomLevel: asFiniteNumber(block[2]),
    phantomTemplateId: asFiniteNumber(block[3]) ?? null,
    phantomNodeSelections: decodePairs(block[4]),
    phantomFactorSlots: decodePhantomFactorSlots(block[5]),
  };
}

function encodeV3Array(s: AutoSaveState): unknown[] {
  const arr: unknown[] = [];
  arr[V3.adventurerLevel] = s.adventurerLevel ?? null;
  arr[V3.professionKey] = PROFESSION_KEY_ORDER.indexOf(s.professionKey);
  arr[V3.professionTypeKey] = encodeProfessionTypeKey(s.professionTypeKey);
  arr[V3.talents] = [s.talentR1EnabledIds, s.talentR2EnabledIds];
  arr[V3.classSkills] = [s.fixedLevels, s.fixedRanks];
  arr[V3.masterySkills] = [s.masteryEquipped.map(b01), s.masteryLevels, s.masteryRanks];
  arr[V3.imagines] = [s.battleImagines, s.imagineRanks];
  arr[V3.roleSkills] = [s.roleSkillSlots ?? null, s.roleSkillRanks ?? null];
  arr[V3.refineLevels] = SLOT_ORDER.map((slot) => s.refineLevels[slot] ?? null);
  arr[V3.equipment] = encodeEquipment(s);
  arr[V3.modules] = encodeModuleSlots(s.moduleSlots);
  arr[V3.season] = encodeSeasonBlock(s);
  return arr;
}

// グループ(入れ子配列)を取り出す。配列でなければ空配列(各フィールドはデフォルトに落ちる)。
const group = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);

function decodeV3Array(arr: unknown[]): StructuralState | null {
  const professionKey = decodeProfessionKey(arr[V3.professionKey]);
  if (!professionKey) return null;
  const talents = group(arr[V3.talents]);
  const classSkills = group(arr[V3.classSkills]);
  const masterySkills = group(arr[V3.masterySkills]);
  const imagines = group(arr[V3.imagines]);
  const roleSkills = group(arr[V3.roleSkills]);
  const col = (i: number) => equipmentColumn(arr[V3.equipment], i);
  return {
    adventurerLevel: asFiniteNumber(arr[V3.adventurerLevel]),
    professionKey,
    professionTypeKey: decodeProfessionTypeKey(arr[V3.professionTypeKey]),
    talentR1EnabledIds: decodeNumbers(talents[0]),
    talentR2EnabledIds: decodeNumbers(talents[1]),
    fixedLevels: asNumberArray(classSkills[0]) ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
    fixedRanks: asNumberArray(classSkills[1]) ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
    masteryEquipped: decodeB01Array(masterySkills[0]),
    masteryLevels: decodeNumbers(masterySkills[1]),
    masteryRanks: decodeNumbers(masterySkills[2]),
    battleImagines: asNullableNumberArray(imagines[0]) ?? STATIC_AUTOSAVE_DEFAULTS.battleImagines,
    imagineRanks: asNumberArray(imagines[1]) ?? STATIC_AUTOSAVE_DEFAULTS.imagineRanks,
    // 値が無い場合は undefined のまま(V2_FIELDS の roleSkillSlots と同じ理由)。
    roleSkillSlots: asNullableNumberArray(roleSkills[0]),
    roleSkillRanks: asNumberArray(roleSkills[1]),
    refineLevels: decodeSlotNumbers(arr[V3.refineLevels], DEFAULT_REFINE_LEVELS),
    equipped: decodeEquipped(col(0)),
    perfectlines: decodeSlotNumbers(col(1), DEFAULT_PERFECTLINES),
    evolutionStats: decodeEvolutionStats(col(2)),
    legendaryAffixState: decodeLegendaryAffix(col(3)),
    legendaryAffixGroupState: decodeLegendaryAffixGroups(col(4)),
    slotEnchants: decodeSlotEnchants(col(5)),
    moduleSlots: decodeModuleSlots(arr[V3.modules]),
    ...decodeSeasonBlock(arr[V3.season]),
  };
}

// ---- プラン全体のエンコード/デコード ----

// 名称セグメントのエンコード方式タグ(1文字)。
// L: lz-stringで圧縮(繰り返しの多いテキスト・日本語等で有利)。
// B: UTF-8バイト列をURLセーフBase64化(圧縮の固定オーバーヘッドが無いため短いASCII名で有利)。
// 生の文字列をそのまま埋め込む(可読になる/`:`との衝突回避に別途エスケープが要る)のは避け、
// 都度どちらか短い方を機械的に選ぶことで、常に「悪い方」を選ばないようにする。
const NAME_ENCODING_LZ = 'L';
const NAME_ENCODING_BASE64 = 'B';

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeName(name: string): string {
  const lz = compressToEncodedURIComponent(name);
  const b64 = utf8ToBase64Url(name);
  return lz.length <= b64.length ? `${NAME_ENCODING_LZ}${lz}` : `${NAME_ENCODING_BASE64}${b64}`;
}

// テストから直接呼べるよう公開する(コード全体の解凍を伴わずに名称だけを取り出せることの検証用)。
export function decodeName(encoded: string): string {
  const tag = encoded[0];
  const body = encoded.slice(1);
  try {
    if (tag === NAME_ENCODING_LZ) return decompressFromEncodedURIComponent(body) ?? '';
    if (tag === NAME_ENCODING_BASE64) return base64UrlToUtf8(body);
    return '';
  } catch {
    return '';
  }
}

// v1(`:`を含まない旧フォーマット): [LEGACY_PLAN_CODE_VERSION, name, ...構造データ] を
// まるごと圧縮した1本の文字列。nameのエンコードは素通し(生の文字列)だったため、
// ここでも同様にarr[1]をそのまま読む。
function decodeLegacyV1(code: string): AutoSaveState | null {
  try {
    const json = decompressFromEncodedURIComponent(code);
    if (!json) return null;
    const arr = JSON.parse(json) as unknown[];
    if (!Array.isArray(arr) || arr[0] !== LEGACY_PLAN_CODE_VERSION) return null;
    const name = typeof arr[1] === 'string' ? arr[1] : '';
    const decoded = decodeV2Array(arr, 2);
    return decoded ? { ...decoded, name } : null;
  } catch {
    return null;
  }
}

export function encodePlanCode(state: AutoSaveState): string {
  const structuralArr = encodeV3Array(state);
  const structuralCode = compressToEncodedURIComponent(JSON.stringify(structuralArr));
  return `${SAVE_FORMAT_VERSION}:${encodeName(state.name)}:${structuralCode}`;
}

export function decodePlanCode(code: string): { state: AutoSaveState; isLegacy: boolean } | null {
  const trimmed = code.trim();
  const firstColon = trimmed.indexOf(':');
  // lz-stringのcompressToEncodedURIComponentの出力は`:`を含まないため、`:`が無ければ
  // 名称分離前(v1)の旧フォーマットとみなす。
  if (firstColon === -1) {
    const state = decodeLegacyV1(trimmed);
    return state ? { state, isLegacy: true } : null;
  }

  const secondColon = trimmed.indexOf(':', firstColon + 1);
  if (secondColon === -1) return null;

  const version = Number(trimmed.slice(0, firstColon));
  // このビルドが認識できる範囲の旧バージョン(v2: decodeV2Array / v3: decodeV3Array)は読める。
  // 未知の将来バージョン(このビルドより新しい = 互換性のない変更を含む可能性がある)のみ拒否する。
  if (!Number.isInteger(version) || version < 2 || version > SAVE_FORMAT_VERSION) return null;

  const name = decodeName(trimmed.slice(firstColon + 1, secondColon));
  const structuralCode = trimmed.slice(secondColon + 1);
  try {
    const json = decompressFromEncodedURIComponent(structuralCode);
    if (!json) return null;
    const arr = JSON.parse(json) as unknown[];
    if (!Array.isArray(arr)) return null;
    const decoded = version === 2 ? decodeV2Array(arr, 0) : decodeV3Array(arr);
    return decoded ? { state: { ...decoded, name }, isLegacy: false } : null;
  } catch {
    return null;
  }
}
