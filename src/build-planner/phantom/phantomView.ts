import type { TFunction } from 'i18next';
import type { DropdownOption } from './CustomDropdown';
import {
  formatPercentParam,
  renderEffectDesc,
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
  const label = tg(`attributes.${effect[1]}`, { defaultValue: String(effect[1]) });
  if (PHANTOM_FACTOR_PCT_ATTR_IDS.has(effect[1])) {
    return `${label} +${formatPercentParam(effect[2], 2)}`;
  }
  return `${label} +${effect[2]}`;
}

// effectType=1効果の列挙表示(例: 「精錬物攻 +15%, 精錬魔攻 +15%」)。
function formatType1Effects(tg: GameDataT, effects: number[][]): string {
  return effects
    .filter((e) => e[0] === 1)
    .map((e) => formatType1Effect(tg, e))
    .join(', ');
}

// 因子クラスの表示名(G1アイテム名から「・G1」を除いた基底名)
export function factorBaseName(tg: GameDataT, classKey: string): string {
  const g1Id = pfData.byClass[classKey]?.grades[0]?.id;
  if (!g1Id) return classKey;
  return tg(`items.${g1Id}.name`).replace(/・G\d+$/, '');
}

// スロット(groupId)に装着可能な因子クラスの一覧。過去シーズン(S2)の因子は除外する。
// 現在のクラス専用 → 共通 → 他クラスの順に並べる。
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
    if (a.typeId !== b.typeId) return a.typeId - b.typeId;
    if (a.profId !== b.profId) return a.profId - b.profId;
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
): DropdownOption[] {
  return getFactorsForSlot(groupId, professionId).map((f) => {
    return {
      value: f.classKey,
      label: factorBaseName(tg, f.classKey),
      icon: getFactorIcon(f.classKey),
    };
  });
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

// 因子のグレード別効果説明(type=3 バフ、なければ type=1 ステータス加算の列挙)
export function getFactorEffectDesc(tg: GameDataT, classKey: string, grade: number): string {
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
    if (tmpl) return renderEffectDesc(tmpl, pars, true, 2);
  }
  // type 1: stat boost（極性・恒常性など）
  return formatType1Effects(tg, gradeData.effects);
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
