import type { TFunction } from 'i18next';
import type { DropdownOption } from './CustomDropdown';
import {
  formatPercentParam,
  stripMarkup,
  substituteEffectDescParams,
} from '../components/gameText';
import { getSTAsset, iconPathToFile, isFactorClassLegacy, pfData, stData } from './phantomData';

// 過去シーズンの因子はゲーム内で無効化されているため、選択肢からは常に除外する
// (無効なままロードされたデータはstore側(hasLegacyPhantomData)で心相投影ごとリセットされる
// ため、UI側で「(無効)」表記を出す必要はない)。

// 心相投影パネル各所(ツリーSVG/ノード設定/効果表示)で共用する表示用ヘルパー。
// PhantomPanel から抽出したもので、React state には依存しない。

// game-data 名前空間の翻訳関数(react-i18next の t)。コンポーネント外の純ヘルパーでも
// 受け取れるよう型エイリアスにしている(i18next 27以降は TFunction のオーバーロードが厳密になり、
// 独自の最小シグネチャでは代入できないため TFunction をそのまま使う)。
export type GameDataT = TFunction<'game-data'>;

// 潜在因子 effectType=1 のうち、値が%乗算(単位:1/100=1%)であるAttrId。
// 11802(被回復力)/11812(バリア強度)もRAW_PERCENT_STAT_IDS(attrMaps.ts)と同じ規約
// (2026-08-11不具合報告で発覚。因子「恒常性X9」等のG1〜G10説明文が+260のような生の実数値
// のまま表示されていた)。
// 11414/11434/11424(精錬物攻/魔攻/防御力の%乗算値)はS4祈願心相晶の「〇〇・精錬」固定ノードで使われる。
// 11334/11344(物理/魔法攻撃力%)と AttrNumType=1 の 12692(祈りダメージ)/11722(攻撃速度)/
// 11732(詠唱速度)/12702(祈りダメージ軽減)はS4の映痕で使われる(2026-11-23 ユーザー確認)。
export const PHANTOM_FACTOR_PCT_ATTR_IDS = new Set([
  11014, 11024, 11034, 11044, 11324, 11354, 11802, 11812, 11414, 11434, 11424, 11334, 11344, 12692,
  11722, 11732, 12702,
]);

// effectType=1(attrId直接参照)効果1件の表示(例: 「精錬物攻 +15%」)。%乗算のattrIdは
// 生の値(1500等)ではなく%表記にする。
export function formatType1Effect(tg: GameDataT, effect: number[]): string {
  return stripMarkup(formatType1EffectMarkup(tg, effect));
}

// formatType1Effect の装飾タグ付き版。効果値部分をゲームの説明文と同じ <style="accent-gn"> で
// 囲む(renderMarkup で描画すると、type=3 の説明文中の値と同じ色でハイライトされる)。
export function formatType1EffectMarkup(tg: GameDataT, effect: number[]): string {
  const label = tg(`attributes.${effect[1]}`, { defaultValue: String(effect[1]) });
  const value = PHANTOM_FACTOR_PCT_ATTR_IDS.has(effect[1])
    ? formatPercentParam(effect[2], 2)
    : String(effect[2]);
  return highlightValueMarkup(label, `+${value}`);
}

// 「ラベル 値」の値部分だけを <style="accent-gn"> で囲んだ装飾タグ付き文字列。
export function highlightValueMarkup(label: string, value: string): string {
  return `${label} <style="accent-gn">${value}</style>`;
}

// effectType=1効果の列挙表示(例: 「精錬物攻 +15%, 精錬魔攻 +15%」)。装飾タグ付き。
function formatType1EffectsMarkup(tg: GameDataT, effects: number[][]): string {
  return effects
    .filter((e) => e[0] === 1)
    .map((e) => formatType1EffectMarkup(tg, e))
    .join(', ');
}

// 因子タイプ名(第六感/恒常性/クラス恒常性/特異点等。game-data の seasonTalents.factorTypes)。
export function factorTypeName(tg: GameDataT, classKey: string): string {
  const typeId = pfData.byClass[classKey]?.typeId;
  return typeId != null ? tg(`seasonTalents.factorTypes.${typeId}`, { defaultValue: '' }) : '';
}

// 因子の型の所属(特異点因子のみ)。型の TalentSchoolId と表示名。型を問わない因子は null。
export function factorTalentSchool(
  tg: GameDataT,
  classKey: string,
): { id: number; name: string } | null {
  const id = pfData.byClass[classKey]?.talentSchoolId;
  if (id == null) return null;
  return { id, name: tg(`talentStages.${id}.typeName`, { defaultValue: String(id) }) };
}

// 因子名の末尾のレベル表記(「・G1」「 - G1」「·G1」等、言語により区切りが異なる)。
const FACTOR_LEVEL_SUFFIX = /[\s・·-]*G\d+$/;

// クラス専用因子の名前の先頭に付くクラス名部分(「ストームブレイド・」「Stormblade 」「雷影」等)。
// 言語ごとに表記・区切りが異なり、クラスの正式名とも一致しない(中国語は略称)ため、そのクラスの
// 全因子名に共通する先頭部分をクラス名部分とみなす(因子タイプ名は互いに異なる語で始まる)。
function factorClassPrefix(tg: GameDataT, professionId: number): string {
  const names = Object.values(pfData.byClass)
    .filter((fc) => fc.professionIds[0] === professionId && fc.grades[0])
    .map((fc) => tg(`items.${fc.grades[0].id}.name`).replace(FACTOR_LEVEL_SUFFIX, ''));
  if (names.length < 2) return '';
  let prefix = names[0];
  for (const name of names) {
    while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

// 因子の短縮名(クラス名部分とレベル表記を除いた名前。例: 「想像因子X1」)。共通因子は基底名のまま。
export function factorShortName(tg: GameDataT, classKey: string): string {
  const fc = pfData.byClass[classKey];
  const g1Id = fc?.grades[0]?.id;
  if (!g1Id) return classKey;
  const name = tg(`items.${g1Id}.name`).replace(FACTOR_LEVEL_SUFFIX, '');
  const professionId = fc.professionIds[0];
  if (professionId == null) return name;
  const prefix = factorClassPrefix(tg, professionId);
  return prefix && name.startsWith(prefix) ? name.slice(prefix.length) || name : name;
}

// クラス専用因子のクラス名(game-data の classes)。共通因子は null。
export function factorClassName(tg: GameDataT, classKey: string): string | null {
  const professionId = pfData.byClass[classKey]?.professionIds[0];
  if (professionId == null) return null;
  return tg(`classes.${professionId}.name`, { defaultValue: String(professionId) });
}

// スロット(groupId)に装着可能な因子クラスの一覧。過去シーズン(S2)の因子は除外する。
// 現在のクラス専用 → 共通 → 他クラス(クラスID順)の順に並べ、同じクラス内は因子タイプ順。
export function getFactorsForSlot(
  groupId: number,
  professionId: number,
): Array<{ classKey: string; typeId: number; profId: number }> {
  const slot = stData.intermediateSlots[String(groupId)];
  if (!slot) return [];
  const validTypes = slot.factorTypes.length > 0 ? slot.factorTypes : [1];
  const result: Array<{ classKey: string; typeId: number; profId: number }> = [];
  for (const [classKey, fc] of Object.entries(pfData.byClass)) {
    if (!validTypes.includes(fc.typeId)) continue;
    if (isFactorClassLegacy(classKey)) continue;
    result.push({ classKey, typeId: fc.typeId, profId: fc.professionIds[0] ?? 0 });
  }
  result.sort((a, b) => {
    const aM = a.profId === professionId ? 0 : a.profId === 0 ? 1 : 2;
    const bM = b.profId === professionId ? 0 : b.profId === 0 ? 1 : 2;
    if (aM !== bM) return aM - bM;
    // 他クラスはクラス単位でまとめる(ドロップダウンのクラス見出しで区切るため)
    if (a.profId !== b.profId) return a.profId - b.profId;
    if (a.typeId !== b.typeId) return a.typeId - b.typeId;
    return a.classKey.localeCompare(b.classKey);
  });
  return result;
}

// 因子のアイコン画像URL(phantom-factors.json の icon は拡張子なしのファイル名)。未解決なら ''。
export function getFactorIcon(classKey: string): string {
  const iconName = pfData.byClass[classKey]?.icon;
  return iconName ? getSTAsset(iconName + '.png') : '';
}

// スロット(groupId)の因子選択ドロップダウン用オプション。
export function getFactorBaseOptions(
  tg: GameDataT,
  groupId: number,
  professionId: number,
  unrestrictedLabel: string,
): DropdownOption[] {
  // クラス専用因子はクラス名部分を除いた短縮名で表示し、クラスごとの見出しで区切る
  // (getFactorsForSlot の並びはクラス単位でまとまっている)。クラスを問わない因子は
  // unrestrictedLabel(「無制限」)の見出し。特異点因子は名前の右に型の所属を添える。
  return getFactorsForSlot(groupId, professionId).map((f) => ({
    value: f.classKey,
    label: factorShortName(tg, f.classKey),
    sublabel: factorTalentSchool(tg, f.classKey)?.name,
    icon: getFactorIcon(f.classKey),
    group: factorClassName(tg, f.classKey) ?? unrestrictedLabel,
  }));
}

// 因子の詳細表示用の情報行(因子タイプ / クラス / 特異点因子なら型の所属)。因子名はクラス名を
// 省いた短縮名で表示するため、省いたクラス名(クラスを問わない因子は「無制限」)をここで補う。
export function factorDetailLines(t: TFunction, tg: GameDataT, classKey: string): string[] {
  const lines = [
    t('buildPlanner.phantom.factorTypeLabel', { type: factorTypeName(tg, classKey) }),
    t('buildPlanner.phantom.factorClassLabel', {
      class: factorClassName(tg, classKey) ?? t('buildPlanner.phantom.factorClassUnrestricted'),
    }),
  ];
  const school = factorTalentSchool(tg, classKey);
  if (school) lines.push(t('buildPlanner.phantom.factorSchoolLabel', { type: school.name }));
  return lines;
}

// 固定ノード(ordinaryEffect)の type=3 バフ効果説明。<br>/<linktext>等のタグは残したまま
// 返すため、呼び出し側は renderMarkup で描画すること(<linktext>のクリック対応のため、
// ここではタグを剥がす renderEffectDesc ではなく substituteEffectDescParams を使う)。
// type=1効果(S4「〇〇・精錬」等)は呼び出し側で formatType1Effect により個別に表示する。
export function getNodeEffectDesc(tg: GameDataT, nodeId: number): string {
  const oe = stData.ordinaryEffects[String(nodeId)];
  if (!oe) return '';
  const idx = oe.effects.findIndex((e) => e[0] === 3);
  if (idx < 0) return '';
  const buffId = oe.effects[idx][1];
  const pars = oe.buffPars[idx] ?? [];
  const tmpl = tg(`attrDescs.${buffId}`, { defaultValue: '' });
  if (!tmpl) return '';
  return substituteEffectDescParams(tmpl, pars);
}

// 因子のレベル別効果説明(type=3 バフ、なければ type=1 ステータス加算の列挙)。プレーン文字列。
export function getFactorEffectDesc(tg: GameDataT, classKey: string, grade: number): string {
  return stripMarkup(getFactorEffectMarkup(tg, classKey, grade));
}

// getFactorEffectDesc の装飾タグ付き版(効果値が <style="accent-gn"> で囲まれている)。
// renderMarkup で描画する。
export function getFactorEffectMarkup(tg: GameDataT, classKey: string, grade: number): string {
  const fc = pfData.byClass[classKey];
  if (!fc) return '';
  const gradeData = fc.grades[grade - 1];
  if (!gradeData) return '';
  // type 3: buff description
  const idx3 = gradeData.effects.findIndex((e) => e[0] === 3);
  if (idx3 >= 0) {
    const buffId = gradeData.effects[idx3][1];
    const pars = gradeData.buffPars?.[idx3] ?? [];
    const tmpl = tg(`attrDescs.${buffId}`, { defaultValue: '' });
    // 因子の極性バフ(例: 極性X6「幸運+7.83%」)はparsが1/100単位(百分の一%まで表現可能)の
    // 精度を持つため、下のtype1分岐(器用さ等)と同じく小数第2位まで表示する
    // (2026-09-03不具合報告: 既定の1桁だと7.83%が7.8%に丸まっていた)。
    if (tmpl) return substituteEffectDescParams(tmpl, pars, true, 2);
  }
  // type 1: stat boost（極性・恒常性など）
  return formatType1EffectsMarkup(tg, gradeData.effects);
}

// ノード種別に応じたアイコンURL(固定ノード=効果アイコン / 因子スロット=品質アイコン)
export function getNodeIcon(nodeId: number, nodeType: 1 | 2): string {
  if (nodeType === 1) {
    const oe = stData.ordinaryEffects[String(nodeId)];
    return oe ? getSTAsset(iconPathToFile(oe.icon)) : '';
  } else {
    const slot = stData.intermediateSlots[String(nodeId)];
    return slot ? getSTAsset(iconPathToFile(slot.icon)) : '';
  }
}
