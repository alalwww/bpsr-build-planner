import type { TFunction } from 'i18next';
import phantomAffixesRaw from '../../data/phantom-affixes.json';
import { stripMarkup, substituteEffectDescParams } from '../components/gameText';
import { SEA_BREEZE_NAME_COLOR } from '../equipment/equipmentSlotPickerData';
import { PHANTOM_EFFECT_TYPE_BUFF } from '../stats/attrMaps';
import type { PhantomAffixValue, PhantomFactorSlotValue } from './phantomData';
import { pfData } from './phantomData';
import { highlightValueMarkup, PHANTOM_FACTOR_PCT_ATTR_IDS, type GameDataT } from './phantomView';

// 祈願因子のスロットに埋め込む「映痕」(シーズン4新規、phantom-affixes.json)の表示/編集用ヘルパー。
// 映痕は group(同一効果のまとまり)ごとに、品質(quality)別の離散段階(上級4/卓越3/エピック3/不朽1、
// 全11段階)を持つ。プランナーでは「映痕(group) + 品質 + 効果値(その品質の範囲内)」で保持する。

interface RawAffix {
  libId: number;
  affixType: number;
  quality: number;
  group: number;
  extremum: number;
  profession: number;
  effects: number[][];
  buffPars?: number[][];
  fightValue: number;
}

const affixesData = phantomAffixesRaw as unknown as {
  affixes: Record<string, RawAffix>;
  qualityColors?: Record<string, string>;
};
const affixesRaw = affixesData.affixes;

// 映痕の値の表示単位。percent は値/100 を%表示(小数第2位まで)、flat は実数表示。
type AffixUnit = 'percent' | 'flat';

interface AffixQualityRange {
  quality: number;
  min: number;
  max: number;
}

export interface AffixGroup {
  group: number;
  libId: number;
  affixType: number;
  /** クラス映痕の対象クラス(ステータス映痕は0)。 */
  profession: number;
  /** [effectType, attrId/buffId]。effectType=1 は属性直接、3 は BuffId 参照(値は buffPars[0][0])。 */
  effectType: number;
  effectId: number;
  unit: AffixUnit;
  /** 品質昇順。 */
  qualities: AffixQualityRange[];
  /** 全段階の [効果値, 能力スコア](効果値昇順)。能力スコアの補間に使う。 */
  steps: [number, number][];
}

// 系統(libId)の表示順。ステータス・主/副/極性/耐久力/元素 → クラスの映痕。
const AFFIX_LIB_ORDER = [102, 101, 103, 104, 105, 1001] as const;

// 最高品質(不朽)は1段階のみで、効果値は常に最大値(入力欄は編集不可にする)。
export const AFFIX_FIXED_QUALITY = 5;

// 品質の文字色。卓越/エピック/不朽はゲームデータの色(SeasonTalentReforgeItemTable の説明文の色タグ、
// phantom-affixes.json の qualityColors)。上級はデータに無いため、蒼海・暁光シリーズの名前色(青)を流用する。
export function getAffixQualityColor(quality: number): string {
  return affixesData.qualityColors?.[String(quality)] ?? SEA_BREEZE_NAME_COLOR;
}

// 品質名。卓越/エピック/不朽はゲームデータ(game-data の seasonTalents.affixQualities)、
// 上級はデータに無いため UI 文言(buildPlanner.phantom.affixQuality.2)。
export function affixQualityName(t: TFunction, tg: GameDataT, quality: number): string {
  return (
    tg(`seasonTalents.affixQualities.${quality}`, { defaultValue: '' }) ||
    t(`buildPlanner.phantom.affixQuality.${quality}`)
  );
}

// BuffId参照の映痕で、説明文の値が実数表記({*Decision.unmarknormal(N)*})のもの(ヘヴィガーディアン
// 「巨岩躯体」「勇壮砦壁」/ シールドファイター「ブレイヴバッシュ」「ホーリーガード」)。それ以外
// (極性 3058050〜080 の p1 を含む {pN})は buffPars/100 が%(2026-11-23 ユーザー確認)。
// phantomAffixData.test.ts で説明文の書式と突き合わせている。
export const FLAT_CLASS_AFFIX_BUFF_IDS = new Set([3055607, 3055609, 3054602, 3054610]);

function affixValue(a: RawAffix): number {
  const e = a.effects[0];
  return e[0] === 1 ? e[2] : (a.buffPars?.[0]?.[0] ?? 0);
}

function buildAffixGroups(): Map<number, AffixGroup> {
  const byGroup = new Map<number, RawAffix[]>();
  for (const a of Object.values(affixesRaw)) {
    const list = byGroup.get(a.group);
    if (list) list.push(a);
    else byGroup.set(a.group, [a]);
  }
  const result = new Map<number, AffixGroup>();
  for (const [group, list] of byGroup) {
    const first = list[0];
    const [effectType, effectId] = first.effects[0];
    const qualities: AffixQualityRange[] = [];
    for (const q of [...new Set(list.map((a) => a.quality))].sort((x, y) => x - y)) {
      const values = list.filter((a) => a.quality === q).map(affixValue);
      qualities.push({ quality: q, min: Math.min(...values), max: Math.max(...values) });
    }
    let unit: AffixUnit;
    if (effectType === 1) {
      unit = PHANTOM_FACTOR_PCT_ATTR_IDS.has(effectId) ? 'percent' : 'flat';
    } else {
      unit = FLAT_CLASS_AFFIX_BUFF_IDS.has(effectId) ? 'flat' : 'percent';
    }
    result.set(group, {
      group,
      libId: first.libId,
      affixType: first.affixType,
      profession: first.profession,
      effectType,
      effectId,
      unit,
      qualities,
      steps: list
        .map((a): [number, number] => [affixValue(a), a.fightValue])
        .sort((x, y) => x[0] - y[0]),
    });
  }
  return result;
}

const AFFIX_GROUPS = buildAffixGroups();

export function getAffixGroup(group: number): AffixGroup | undefined {
  return AFFIX_GROUPS.get(group);
}

// スロットに埋め込める映痕の一覧(系統の表示順 → クラス映痕はクラス順 → group順)。
// ゲーム内では因子と異なるクラスの映痕も埋め込めるため、クラス映痕は全クラス分を返す。
// preferredProfessionId(因子のクラス)のクラス映痕を先頭に、残りはクラスID順に並べる。
export function getAffixGroupsForSlot(
  affixTypes: readonly number[],
  preferredProfessionId: number,
): AffixGroup[] {
  const libOrder = (lib: number) => {
    const i = (AFFIX_LIB_ORDER as readonly number[]).indexOf(lib);
    return i < 0 ? AFFIX_LIB_ORDER.length : i;
  };
  // クラス共通(0)と優先クラスは同順位(先頭)、他クラスはクラスID順。
  const professionOrder = (profession: number) =>
    profession === 0 || profession === preferredProfessionId ? -1 : profession;
  return [...AFFIX_GROUPS.values()]
    .filter((g) => affixTypes.includes(g.affixType))
    .sort(
      (a, b) =>
        libOrder(a.libId) - libOrder(b.libId) ||
        professionOrder(a.profession) - professionOrder(b.profession) ||
        a.group - b.group,
    );
}

// 因子のクラス(クラス専用因子ならそのクラス、共通因子なら null)。
export function getFactorProfessionId(classKey: string): number | null {
  return pfData.byClass[classKey]?.professionIds[0] ?? null;
}

export function getAffixQualityRange(
  group: number,
  quality: number,
): AffixQualityRange | undefined {
  return getAffixGroup(group)?.qualities.find((q) => q.quality === quality);
}

// 効果値を表示単位の文字列にする(例: 267 → percent "2.67%" / flat "267")。
export function formatAffixValue(unit: AffixUnit, value: number): string {
  if (unit === 'flat') return String(value);
  const pct = value / 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : String(Number(pct.toFixed(2)))}%`;
}

// 表示単位の入力値(%なら 2.67)→ 内部値(267)。
export function affixInputToValue(unit: AffixUnit, input: number): number {
  return Math.round(unit === 'percent' ? input * 100 : input);
}

// 内部値 → 入力欄の表示値(%なら 2.67、実数ならそのまま)。
export function affixValueToInput(unit: AffixUnit, value: number): number {
  return unit === 'percent' ? Number((value / 100).toFixed(2)) : value;
}

// 映痕の選択肢ラベル(値を含まない)。属性直接の映痕は属性名、BuffId参照は説明文の値を「X」に置き換えたもの。
export function affixLabel(tg: GameDataT, group: number): string {
  const g = getAffixGroup(group);
  if (!g) return String(group);
  if (g.effectType === 1) {
    return tg(`attributes.${g.effectId}`, { defaultValue: String(g.effectId) });
  }
  const desc = tg(`attrDescs.${g.effectId}`, { defaultValue: '' });
  if (!desc) return String(group);
  return desc
    .replace(/\{\*Decision\.unmark\w+\(\d+\)\*}/g, 'X')
    .replace(/\{p\d+}/g, g.unit === 'percent' ? 'X%' : 'X')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// 映痕の効果説明(値込み)。例: 「会心 +267」「「刃影」の祈りダメージ+2.67%。」
export function affixEffectText(tg: GameDataT, affix: PhantomAffixValue): string {
  return stripMarkup(affixEffectMarkup(tg, affix));
}

// affixEffectText の装飾タグ付き版(効果値が <style="accent-gn"> で囲まれている)。
// renderMarkup で描画する。
export function affixEffectMarkup(tg: GameDataT, affix: PhantomAffixValue): string {
  const g = getAffixGroup(affix.group);
  if (!g) return '';
  if (g.effectType === 1) {
    const label = tg(`attributes.${g.effectId}`, { defaultValue: String(g.effectId) });
    return highlightValueMarkup(label, `+${formatAffixValue(g.unit, affix.value)}`);
  }
  const desc = tg(`attrDescs.${g.effectId}`, { defaultValue: '' });
  return substituteEffectDescParams(desc, [affix.value], g.unit === 'percent', 2);
}

// 映痕の品質(レアリティ)の一覧(低い順)。全映痕で共通(上級/卓越/エピック/不朽)。
export const AFFIX_QUALITIES: number[] = [
  ...new Set([...AFFIX_GROUPS.values()].flatMap((g) => g.qualities.map((q) => q.quality))),
].sort((x, y) => x - y);

// 映痕を新たに選んだときの初期値(既定の品質・その品質の最大値)。preferredQuality はユーザーが
// 選んだ既定の品質(因子設定ダイアログのレアリティ一括変更)。映痕がその品質を持たなければ最低品質。
export function defaultAffixValue(
  group: number,
  preferredQuality?: number,
): PhantomAffixValue | null {
  const g = getAffixGroup(group);
  const q = g?.qualities.find((r) => r.quality === preferredQuality) ?? g?.qualities[0];
  if (!q) return null;
  return { group, quality: q.quality, value: q.max };
}

// 因子に埋め込んだ映痕(現在のレベルで開放されているスロットの分)の品質をまとめて変更する。
// 品質が変わる映痕の効果値は新しい品質の最大値にリセットする(affixWithQuality)。
// 戻り値の changed は品質が変わる映痕の数(確認ダイアログ用。その品質を持たない映痕は変えない)。
export function withAffixQualities(
  factor: PhantomFactorSlotValue,
  quality: number,
): { factor: PhantomFactorSlotValue; changed: number } {
  const slotCount = getEmbedSlots(factor.classKey, factor.grade).length;
  let changed = 0;
  const affixes = (factor.affixes ?? []).map((affix, i) => {
    if (!affix || i >= slotCount || affix.quality === quality) return affix;
    if (!getAffixQualityRange(affix.group, quality)) return affix;
    changed++;
    return affixWithQuality(affix, quality);
  });
  return {
    factor: changed > 0 ? factorWithAffixes(factor.classKey, factor.grade, affixes) : factor,
    changed,
  };
}

// 品質を変更したときの値(新しい品質の最大値)。
export function affixWithQuality(affix: PhantomAffixValue, quality: number): PhantomAffixValue {
  const range = getAffixQualityRange(affix.group, quality);
  return { ...affix, quality, value: range ? range.max : affix.value };
}

// 効果値をその品質の範囲内に収める。
export function clampAffixValue(affix: PhantomAffixValue, value: number): PhantomAffixValue {
  const range = getAffixQualityRange(affix.group, affix.quality);
  if (!range) return { ...affix, value };
  return { ...affix, value: Math.min(range.max, Math.max(range.min, value)) };
}

// 因子のレベル別スロット構成(1要素=1スロット、値=埋め込める AffixType)。
export function getEmbedSlots(classKey: string, grade: number): number[][] {
  return pfData.byClass[classKey]?.grades[grade - 1]?.embedSlots ?? [];
}

// 因子クラスの最大スロット数(全レベル中の最大)。
export function getMaxEmbedSlotCount(classKey: string): number {
  const fc = pfData.byClass[classKey];
  return Math.max(0, ...(fc?.grades.map((g) => g.embedSlots?.length ?? 0) ?? []));
}

// スロット index が開放される最小レベル(どのレベルでも開放されないなら null)。
export function getSlotUnlockLevel(classKey: string, index: number): number | null {
  const fc = pfData.byClass[classKey];
  const g = fc?.grades.find((gr) => (gr.embedSlots?.length ?? 0) > index);
  return g ? g.level : null;
}

// 映痕をスロット構成に合わせて並べ直す。レベル変更でスロットの種類・数が変わる
// (例: G2の2番目はクラス用、G3の2番目はステータス用)ため、既存の映痕を先頭から順に
// 「空いている、種類の合うスロット」へ詰め直す。収まらない映痕は外れる。
export function fitAffixesToSlots(
  affixes: readonly (PhantomAffixValue | null)[] | undefined,
  slots: number[][],
): (PhantomAffixValue | null)[] {
  const result: (PhantomAffixValue | null)[] = slots.map(() => null);
  if (!affixes) return result;
  // 現在のスロット位置で種類が合うものはそのまま残す。
  const pending: PhantomAffixValue[] = [];
  affixes.forEach((affix, i) => {
    if (!affix) return;
    const type = getAffixGroup(affix.group)?.affixType;
    if (i < slots.length && type != null && slots[i].includes(type) && result[i] == null) {
      result[i] = affix;
    } else {
      pending.push(affix);
    }
  });
  for (const affix of pending) {
    const type = getAffixGroup(affix.group)?.affixType;
    if (type == null) continue;
    const i = result.findIndex((v, idx) => v == null && slots[idx].includes(type));
    if (i >= 0) result[i] = affix;
  }
  return result;
}

// 「効果は重複不可」の映痕(極性 3058050〜080)。同じ効果が複数あれば値が大きい方だけが反映される
// (2026-11-23 ユーザー確認)。
const NON_STACKING_AFFIX_BUFF_IDS = new Set([3058050, 3058060, 3058070, 3058080]);

function isNonStackingAffix(group: number): boolean {
  const g = getAffixGroup(group);
  return g?.effectType === PHANTOM_EFFECT_TYPE_BUFF && NON_STACKING_AFFIX_BUFF_IDS.has(g.effectId);
}

// 映痕の効果を同種(group)ごとにまとめる。通常は値を合計し、重複不可の映痕は最大値を採る。
// 並びは最初に現れたスロット順。quality は表示に使わない(先に現れたものを残す)。
export function aggregateAffixEffects(
  affixes: readonly (PhantomAffixValue | null)[] | undefined,
): PhantomAffixValue[] {
  const byGroup = new Map<number, PhantomAffixValue>();
  for (const affix of affixes ?? []) {
    if (!affix) continue;
    const prev = byGroup.get(affix.group);
    if (!prev) {
      byGroup.set(affix.group, { ...affix });
      continue;
    }
    prev.value = isNonStackingAffix(affix.group)
      ? Math.max(prev.value, affix.value)
      : prev.value + affix.value;
  }
  return [...byGroup.values()];
}

// 因子の映痕のうち、現在のレベルで開放されているスロットに埋め込まれているもの(空きは除く)。
export function getActiveAffixes(
  factor: PhantomFactorSlotValue | null | undefined,
): PhantomAffixValue[] {
  if (!factor?.affixes) return [];
  const slots = getEmbedSlots(factor.classKey, factor.grade);
  // スロットの種類(ステータス/クラス)に合わない映痕は数えない(UIでは選べないが、手で編集された
  // プランコード等への備え)。
  return factor.affixes.filter((a, i): a is PhantomAffixValue => {
    if (a == null || i >= slots.length) return false;
    const type = getAffixGroup(a.group)?.affixType;
    return type != null && slots[i].includes(type);
  });
}

// 映痕1つ分の能力スコア。データ上は全11段階それぞれに能力スコアがあり(効果値にほぼ比例)、
// 効果値は段階の間も自由入力できるため、前後の段階から線形補間して四捨五入する
// (段階ちょうどの値ならデータどおり)。
export function affixFightValue(affix: PhantomAffixValue): number {
  const steps = getAffixGroup(affix.group)?.steps;
  if (!steps || steps.length === 0) return 0;
  if (affix.value <= steps[0][0]) return steps[0][1];
  for (let i = 1; i < steps.length; i++) {
    const [v1, f1] = steps[i];
    if (affix.value > v1) continue;
    const [v0, f0] = steps[i - 1];
    return Math.round(f0 + ((f1 - f0) * (affix.value - v0)) / (v1 - v0));
  }
  return steps[steps.length - 1][1];
}

// 因子の映痕のうち、現在のレベルで開放されているスロットの分の効果(同種は合計、重複不可は最大値)。
export function getActiveAffixEffects(
  factor: PhantomFactorSlotValue | null | undefined,
): PhantomAffixValue[] {
  return aggregateAffixEffects(getActiveAffixes(factor));
}

// 重複不可の映痕の効果は、全因子を通じて1つ(値が最大のもの)しか反映されない(2026-11-23 ユーザー確認)。
// 複数の因子・スロットにまたがって2つ以上選ばれている重複不可の映痕の group を返す(警告表示用。
// 重なっているスロットすべてに警告を出す)。各因子は現在のレベルで開放されているスロットのみ数える。
export function getDuplicatedNonStackingGroups(
  factors: Iterable<PhantomFactorSlotValue | null | undefined>,
): Set<number> {
  const counts = new Map<number, number>();
  for (const factor of factors) {
    for (const affix of getActiveAffixes(factor)) {
      if (!isNonStackingAffix(affix.group)) continue;
      counts.set(affix.group, (counts.get(affix.group) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n >= 2).map(([group]) => group));
}

// 末尾の空スロットを除いた映痕配列(すべて空なら undefined)。保存データを小さく保つための正規化。
function trimAffixes(
  affixes: (PhantomAffixValue | null)[] | undefined,
): (PhantomAffixValue | null)[] | undefined {
  if (!affixes) return undefined;
  let end = affixes.length;
  while (end > 0 && affixes[end - 1] == null) end--;
  return end === 0 ? undefined : affixes.slice(0, end);
}

// 因子の値を作る(映痕は末尾の空きを除き、すべて空なら持たせない)。
export function factorWithAffixes(
  classKey: string,
  grade: number,
  affixes: (PhantomAffixValue | null)[] | undefined,
): PhantomFactorSlotValue {
  const trimmed = trimAffixes(affixes);
  return trimmed ? { classKey, grade, affixes: trimmed } : { classKey, grade };
}

// 映痕をスロット番号の若い順に、移行先で「空いている、種類の合う」最も若いスロットへ順番に入れる。
// 収まらない映痕は外れる。レベルを下げる際に使う(fitAffixesToSlots は元の位置に合うものを
// 優先して残すため、G3→G2 で若いスロットの映痕が後ろの映痕に押し出されることがある)。
export function packAffixesInOrder(
  affixes: readonly (PhantomAffixValue | null)[] | undefined,
  slots: number[][],
): (PhantomAffixValue | null)[] {
  const result: (PhantomAffixValue | null)[] = slots.map(() => null);
  for (const affix of affixes ?? []) {
    if (!affix) continue;
    const type = getAffixGroup(affix.group)?.affixType;
    if (type == null) continue;
    const i = result.findIndex((v, idx) => v == null && slots[idx].includes(type));
    if (i >= 0) result[i] = affix;
  }
  return result;
}

// 因子のレベルを変更する(映痕をスロット構成に合わせて詰め直す)。レベルを下げる場合は
// スロット番号の若い映痕から順に、移行先の若いスロットへ詰める(packAffixesInOrder)。
export function withFactorLevel(
  factor: PhantomFactorSlotValue,
  grade: number,
): PhantomFactorSlotValue {
  if (grade < factor.grade) {
    const active = getActiveAffixes(factor);
    return factorWithAffixes(
      factor.classKey,
      grade,
      packAffixesInOrder(active, getEmbedSlots(factor.classKey, grade)),
    );
  }
  return withFactorClass(factor, factor.classKey, grade);
}

// 因子のレベルを変更したときに外れる映痕の数(確認ダイアログ用)。
export function countAffixesLostByLevelChange(
  factor: PhantomFactorSlotValue | null | undefined,
  grade: number,
): number {
  if (!factor) return 0;
  return getActiveAffixes(factor).length - getActiveAffixes(withFactorLevel(factor, grade)).length;
}

// 因子の種類を変更する(映痕はできるだけ引き継ぐ)。
export function withFactorClass(
  factor: PhantomFactorSlotValue | null,
  classKey: string,
  grade: number,
): PhantomFactorSlotValue {
  return factorWithAffixes(
    classKey,
    grade,
    fitAffixesToSlots(factor?.affixes, getEmbedSlots(classKey, grade)),
  );
}
