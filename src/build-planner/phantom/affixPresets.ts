import type { NamedPreset } from '../components/preset/presetStorage';
import { factorWithAffixes, fitAffixesToSlots, getEmbedSlots } from './phantomAffixData';
import type { PhantomAffixValue, PhantomFactorSlotValue } from './phantomData';

// 映痕プリセット: 因子設定ダイアログで使う、因子レベル(スロット数)と映痕4種の選択状況・値の保存。
// モジュールプリセットと同様、ビルドプラン/自動保存/共有コードとは独立したローカル専用の保存機能。
// 因子の種類は保存しない(どの因子にも適用できる。スロット構成は因子レベルで決まり全因子共通)。

export interface AffixPreset extends NamedPreset {
  /** 因子レベル(スロット数)。保存データの因子と同じく grade と呼ぶ。 */
  grade: number;
  /** スロット順の映痕(null は空きスロット)。長さはそのレベルのスロット数。 */
  affixes: (PhantomAffixValue | null)[];
}

export type AffixPresetContent = Omit<AffixPreset, 'id' | 'name'>;

export const MAX_AFFIX_PRESETS = 20;
export const MAX_AFFIX_PRESET_NAME_LENGTH = 100;

export const AFFIX_PRESETS_STORAGE_KEY = 'bpsr-affix-presets-v1';

// 因子の現在の状態からプリセットの保存内容を作る(現在のレベルで開放されているスロットの分のみ)。
export function affixPresetContentOf(factor: PhantomFactorSlotValue): AffixPresetContent {
  const slotCount = getEmbedSlots(factor.classKey, factor.grade).length;
  return {
    grade: factor.grade,
    affixes: Array.from({ length: slotCount }, (_, i) => factor.affixes?.[i] ?? null),
  };
}

function affixEqual(a: PhantomAffixValue | null, b: PhantomAffixValue | null): boolean {
  if (a === null || b === null) return a === b;
  return a.group === b.group && a.quality === b.quality && a.value === b.value;
}

// プリセットの保存内容と因子の現在の状態が一致するか(保存ボタンの活性制御・
// プリセット切り替え時の無確認スイッチ可否判定・ダイアログを開いた時点のロード中表示に使う)。
export function affixPresetMatches(preset: AffixPresetContent, factor: PhantomFactorSlotValue) {
  const current = affixPresetContentOf(factor);
  if (preset.grade !== current.grade) return false;
  const length = Math.max(preset.affixes.length, current.affixes.length);
  for (let i = 0; i < length; i++) {
    if (!affixEqual(preset.affixes[i] ?? null, current.affixes[i] ?? null)) return false;
  }
  return true;
}

// 因子にプリセットを適用する。因子レベルを復元してスロット数を確保してから、映痕をスロット順に
// 復元する(種類の合わないスロットの映痕は、空いている合うスロットへ詰め直すか外す)。
export function applyAffixPreset(
  factor: PhantomFactorSlotValue,
  preset: AffixPresetContent,
): PhantomFactorSlotValue {
  const slots = getEmbedSlots(factor.classKey, preset.grade);
  return factorWithAffixes(factor.classKey, preset.grade, fitAffixesToSlots(preset.affixes, slots));
}
