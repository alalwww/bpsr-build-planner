import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { DEFAULT_PROFESSION_KEY, PROFESSIONS } from '../profession';
import type {
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  ModuleSlots,
  SlotEnchants,
  SlotLegendaryAffixGroups,
  SlotRefineLevels,
} from '../types';
import type { PhantomFactorSlotValue } from '../phantom/phantomData';
import { decodePlanCode, encodePlanCode } from './planCode';
import { getDefaultAutoSaveState } from './planDefaults';

export interface BuildPlanData {
  id: string;
  name: string;
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
  equipped: EquippedItems;
  refineLevels: SlotRefineLevels;
  perfectlines: SlotRefineLevels;
  evolutionStats: Partial<Record<EquipmentSlotId, Array<EvolutionStatId | undefined>>>;
  legendaryAffixState: Partial<Record<EquipmentSlotId, LegendaryAffixSelection | undefined>>;
  // 蒼海武器等の4枠選択式レアステータスの選択状態。
  legendaryAffixGroupState: SlotLegendaryAffixGroups;
  masteryEquipped: boolean[];
  masteryLevels: number[];
  masteryRanks: number[];
  fixedLevels: number[];
  fixedRanks: number[];
  battleImagines: (number | null)[];
  imagineRanks: number[];
  // ロールスキル(classData.roleSkill = 固定4種+全ロール共通8種の計12候補)から
  // 4枠に選んで配置する方式(バトルイマジンと同じUIパターン)。null=未設定スロット。
  // デフォルト値はプロフェッション(Talent)依存(先頭固定4種)のため、他の固定デフォルト値を
  // 持つフィールドと異なり optional にしている。値が無い(旧データ・破損データ)場合は
  // undefinedのままにし、呼び出し側(applyPlanState等)でprofessionKey別のロール専用4種に
  // フォールバックする(planCode.ts側でnull埋め配列にフォールバックしないこと)。
  roleSkillSlots?: (number | null)[];
  // 各スロットのランク。固定ロールスキル(maxRank=0)を配置したスロットは未使用。
  // 全ロール共通スキル(シーズン3、maxRank=4)を配置したスロットのみ意味を持つ。
  roleSkillRanks?: number[];
  talentR1EnabledIds: number[];
  talentR2EnabledIds: number[];
  slotEnchants: SlotEnchants;
  moduleSlots: ModuleSlots;
  adventurerLevel?: number;
  phantomEnabled?: boolean;
  phantomLevel?: number;
  phantomTemplateId?: number | null;
  phantomBondPoints?: number;
  phantomNodeSelections?: Record<number, number>;
  phantomFactorSlots?: Record<number, PhantomFactorSlotValue | null>;
}

// 現在の編集状態（自動保存用）。id は不要だが名前欄も保存対象
export type AutoSaveState = Omit<BuildPlanData, 'id'>;

// v2: 現バージョン。保存プラン1件を [id, code] のタプルとして保持し、codeは
// encodePlanCode()の出力(キー名を持たない位置ベースの圧縮文字列)をそのまま使う。
// フィールド名を保存形式に一切含めないため、TS側のフィールドリネームでは
// 一切互換性が壊れない(壊れるのはplanCode.ts側の構造データ配列の並びを変えたときだけで、
// そのときはSAVE_FORMAT_VERSIONを上げて対応する)。
const STORAGE_KEY_V2 = 'bpsr-build-plans-v2';
// v1(0.2.6で配布済み): BuildPlanData[]をフィールド名そのままJSONへ直列化していた旧形式。
// battleImaginaries/imaginaryRanksという旧フィールド名を含む。
const STORAGE_KEY_V1 = 'bpsr-build-plans-v1';
// バージョニング導入前の最古のキー。
const STORAGE_KEY_V0_LEGACY = 'bpsr-build-plans';

const AUTO_SAVE_KEY_V2 = 'bpsr-autosave-v2';
const AUTO_SAVE_KEY_V1 = 'bpsr-autosave-v1';

export type LegacySource = 'v1' | 'v0' | null;

// localStorage自体が使えない環境(プライベートブラウジング等でアクセスが例外を投げる場合)を
// キー不在と同様に扱う。この場合は「データが壊れている」わけではないので loadError にはしない。
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// v1/v0の生JSONは battleImaginaries/imaginaryRanks という旧フィールド名のままキーとして
// 直列化されていた。ここだけが旧フィールド名を参照してよい唯一の場所(移行専用のブリッジ)。
function migrateLegacyImagineFieldNames(raw: Record<string, unknown>): Record<string, unknown> {
  const { battleImaginaries, imaginaryRanks, ...rest } = raw;
  return {
    ...rest,
    battleImagines: raw.battleImagines ?? battleImaginaries,
    imagineRanks: raw.imagineRanks ?? imaginaryRanks,
  };
}

function resolveProfessionKey(raw: unknown): ProfessionKey {
  return typeof raw === 'string' && raw in PROFESSIONS
    ? (raw as ProfessionKey)
    : DEFAULT_PROFESSION_KEY;
}

// v1/v0(バージョニング導入前)の生JSONを現行のAutoSaveStateへ正規化する。
// 当時存在しなかったフィールド(phantom関連等)が欠けていてもデフォルト値で補う。
// AutoSaveStateにはidが無いため、保存プラン由来のraw(idを含む)が渡されても取り除く。
function migrateLegacyAutoSaveState(raw: Record<string, unknown>): AutoSaveState {
  const professionKey = resolveProfessionKey(raw.professionKey);
  const defaults = getDefaultAutoSaveState(professionKey);
  const { id: _id, ...normalized } = migrateLegacyImagineFieldNames(raw);
  void _id;
  return { ...defaults, ...normalized, professionKey } as AutoSaveState;
}

function migrateLegacyPlan(raw: Record<string, unknown>): BuildPlanData {
  const id = typeof raw.id === 'string' ? raw.id : crypto.randomUUID();
  return { id, ...migrateLegacyAutoSaveState(raw) };
}

export interface LoadBuildPlansResult {
  plans: BuildPlanData[];
  legacySource: LegacySource;
  // v2/v1/v0いずれかのキーは存在するのにパースに失敗した(データが破損している)場合にtrue。
  // キー自体が存在しない場合(未使用/初回起動)はfalseのまま次の候補を試す。
  loadError: boolean;
}

const LEGACY_BUILD_PLAN_KEYS = [
  [STORAGE_KEY_V1, 'v1'],
  [STORAGE_KEY_V0_LEGACY, 'v0'],
] as const;

export function loadBuildPlans(): LoadBuildPlansResult {
  const v2Raw = safeGetItem(STORAGE_KEY_V2);
  if (v2Raw != null) {
    try {
      const entries = JSON.parse(v2Raw) as [string, string][];
      const plans = entries
        .map(([id, code]) => {
          const decoded = decodePlanCode(code);
          return decoded ? { id, ...decoded.state } : null;
        })
        .filter((p): p is BuildPlanData => p !== null);
      return { plans, legacySource: null, loadError: false };
    } catch {
      return { plans: [], legacySource: null, loadError: true };
    }
  }

  for (const [key, tag] of LEGACY_BUILD_PLAN_KEYS) {
    const legacyRaw = safeGetItem(key);
    if (legacyRaw == null) continue;
    try {
      const legacyPlans = JSON.parse(legacyRaw) as Record<string, unknown>[];
      const plans = legacyPlans.map((p) => migrateLegacyPlan(p));
      return { plans, legacySource: tag, loadError: false };
    } catch {
      return { plans: [], legacySource: null, loadError: true };
    }
  }
  return { plans: [], legacySource: null, loadError: false };
}

export function persistBuildPlans(plans: BuildPlanData[]): void {
  try {
    const entries: [string, string][] = plans.map(({ id, ...rest }) => [id, encodePlanCode(rest)]);
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(entries));
  } catch {
    // quota exceeded or storage unavailable
  }
}

export interface LoadAutoSaveResult {
  state: AutoSaveState | null;
  legacySource: 'v1' | null;
  loadError: boolean;
}

export function loadAutoSave(): LoadAutoSaveResult {
  const raw = safeGetItem(AUTO_SAVE_KEY_V2);
  if (raw != null) {
    const decoded = decodePlanCode(raw);
    return decoded
      ? { state: decoded.state, legacySource: null, loadError: false }
      : { state: null, legacySource: null, loadError: true };
  }

  const legacyRaw = safeGetItem(AUTO_SAVE_KEY_V1);
  if (legacyRaw != null) {
    try {
      const migrated = migrateLegacyAutoSaveState(JSON.parse(legacyRaw));
      persistAutoSave(migrated);
      return { state: migrated, legacySource: 'v1', loadError: false };
    } catch {
      return { state: null, legacySource: null, loadError: true };
    }
  }
  return { state: null, legacySource: null, loadError: false };
}

export function persistAutoSave(state: AutoSaveState): void {
  try {
    localStorage.setItem(AUTO_SAVE_KEY_V2, encodePlanCode(state));
  } catch {
    // quota exceeded or storage unavailable
  }
}
