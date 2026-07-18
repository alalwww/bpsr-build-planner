import type { DropdownOption } from './CustomDropdown';
import { formatPercentParam, renderEffectDesc } from '../components/gameText';
import { getSTAsset, iconPathToFile, isFactorClassLegacy, pfData, stData } from './phantomData';

// 過去シーズン(S2)の因子はゲーム内で無効化されているため、選択肢からは常に除外する
// (無効なままロードされたデータはstore側(hasLegacyPhantomFactor)で装着解除・リセットされる
// ため、UI側で「(無効)」表記を出す必要はない)。

// 心相投影パネル各所(ツリーSVG/ノード設定/効果表示)で共用する表示用ヘルパー。
// PhantomPanel から抽出したもので、React state には依存しない。

// game-data 名前空間の翻訳関数(react-i18next の t)。コンポーネント外の純ヘルパーでも
// 使えるよう、必要最小限のシグネチャで受ける。
export type GameDataT = (key: string, options?: Record<string, unknown>) => string;

// 潜在因子 effectType=1 のうち、値が%乗算(単位:1/100=1%)であるAttrId
const PHANTOM_FACTOR_PCT_ATTR_IDS = new Set([11014, 11024, 11034, 11044, 11324, 11354]);

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

// スロット(groupId)の因子選択ドロップダウン用オプション。
export function getFactorBaseOptions(
  tg: GameDataT,
  groupId: number,
  professionId: number,
): DropdownOption[] {
  return getFactorsForSlot(groupId, professionId).map((f) => {
    const name = factorBaseName(tg, f.classKey);
    const iconName = pfData.byClass[f.classKey]?.icon;
    const icon = iconName ? getSTAsset(iconName + '.png') : '';
    return { value: f.classKey, label: name, icon };
  });
}

// 固定ノード(ordinaryEffect)の type=3 バフ効果説明
export function getNodeEffectDesc(tg: GameDataT, nodeId: number): string {
  const oe = stData.ordinaryEffects[String(nodeId)];
  if (!oe) return '';
  const idx = oe.effects.findIndex((e) => e[0] === 3);
  if (idx < 0) return '';
  const buffId = oe.effects[idx][1];
  const pars = oe.buffPars[idx] ?? [];
  const tmpl = tg(`attrDescs.${buffId}`, { defaultValue: '' });
  if (!tmpl) return '';
  return renderEffectDesc(tmpl, pars);
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
    if (tmpl) return renderEffectDesc(tmpl, pars, true);
  }
  // type 1: stat boost（極性・恒常性など）
  const type1 = gradeData.effects.filter((e) => e[0] === 1);
  if (type1.length > 0) {
    return type1
      .map((e) => {
        const label = tg(`attributes.${e[1]}`, { defaultValue: String(e[1]) });
        if (PHANTOM_FACTOR_PCT_ATTR_IDS.has(e[1])) {
          return `${label} +${formatPercentParam(e[2], 2)}`;
        }
        return `${label} +${e[2]}`;
      })
      .join(', ');
  }
  return '';
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
