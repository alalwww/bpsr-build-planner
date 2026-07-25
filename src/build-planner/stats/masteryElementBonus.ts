import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import type { StatId } from '../types';
import { ELEMENT_BONUS_STAT } from './attrMaps';

export interface MasteryElementBonusCoefficient {
  element: keyof typeof ELEMENT_BONUS_STAT;
  // 器用さ1%あたりの属性ボーナス%(基礎変換率)。
  baseRatePerPoint: number;
  // 「器用さ強化」型の型のみ持つ、基礎変換率自体への器用さ依存ボーナス(器用さ1%あたり+X%、
  // 単位は基礎変換率に対する百分率。例: 3なら器用さ6%で基礎変換率が18%増しになる)。
  rateBoostPerPoint?: number;
}

// クラス×型ごとの「器用さ→属性ボーナス」固有効果。ZTable ProfessionSystemTable.MasteryDes
// (S3、2026-07実測)のテキストから、既存StatId(ELEMENT_BONUS_STAT)で表現できる属性ボーナス
// 部分のみを抜粋したもの。MasteryDesはクラスごとに全く異なる効果(バリア強度/回復力/
// レジストダメージ軽減/特定スキルのダメージ%/リソース獲得効率等)を記述する自由記述文で、
// ZTable上に構造化された係数テーブルは存在しないため、この対応表は手動で書き起こしている
// (docs/STATUS_CALCULATION.md「器用さ」章 8.6「未着手」参照)。属性ボーナス以外の効果
// (下記コメント参照)は対応するStatId/UIが未整備のため未実装。
//
// フロストメイジ霜天型で確認した通り、シーズン間でMasteryDesの数値が変わることがある
// (S2: 氷属性ボーナス+0.4%固定 → S3: +0.2%+器用さ強化+3%/pt に変更)。
// `npm run extract:ztable`後にProfessionSystemTable.MasteryDesを再確認し、変更があれば
// この表も追従させること。
export const MASTERY_ELEMENT_BONUS: Partial<
  Record<ProfessionKey, Partial<Record<ProfessionTypeKey, MasteryElementBonusCoefficient>>>
> = {
  frostMage: {
    // MasteryDes[0](氷牙型): "器用さ1%につき氷属性ボーナス+0.65%"
    type1: { element: 'ice', baseRatePerPoint: 0.65 },
    // MasteryDes[1](霜天型): "器用さ1%につき凍源の取得効率+1%、氷属性ボーナス+0.2%
    //   器用さ強化：器用さ1%につき氷属性ボーナス変換率+3%"
    // (凍源の取得効率はゲーム内リソース機構でStatId未対応のため未実装)
    type2: { element: 'ice', baseRatePerPoint: 0.2, rateBoostPerPoint: 3 },
  },
  galeLancer: {
    // MasteryDes[0](烈風型): "器用さ1%につき風属性ボーナス+0.35%
    //   器用さ強化：器用さ1%につき風属性ボーナス変換率+3%"
    type1: { element: 'wind', baseRatePerPoint: 0.35, rateBoostPerPoint: 3 },
    // MasteryDes[1](乱風型): "器用さ1%につき風属性ボーナス+0.65%"
    type2: { element: 'wind', baseRatePerPoint: 0.65 },
  },
  verdantOracle: {
    // MasteryDes[0](威咲型): "器用さ1%につき森属性ボーナス+0.75%、バリア強度+0.3%"
    // (バリア強度部分はStatId自体は存在するが、この効果専用の加算経路が未整備のため未実装)
    type1: { element: 'forest', baseRatePerPoint: 0.75 },
    // MasteryDes[1](森癒型): "器用さ1%につき回復力+1%"(属性ボーナスなし、対象外)
  },
  divineArcher: {
    // MasteryDes[0](狼弓型): "器用さ1%につき臣獣のダメージ+2.75%"(属性ボーナスなし、対象外)
    // MasteryDes[1](鷹弓型): "器用さ1%につき光属性ボーナス+0.6%"
    type2: { element: 'light', baseRatePerPoint: 0.6 },
  },
  twinStriker: {
    // MasteryDes[0]: リキャスト加速/物理攻撃力(属性ボーナスなし、対象外)
    // MasteryDes[1]: "器用さ1%につき火属性ボーナス+0.72%"
    type2: { element: 'fire', baseRatePerPoint: 0.72 },
  },
};

// 器用さ%(収益逓減カーブ・finalPctAddend・料理バフ等すべて適用済みの最終表示値)から、
// クラス×型固有の属性ボーナス加算量を算出する。戻り値は蒼海武器レアステータス等の
// 属性ボーナス直接加算(EVO_PCT_ATTR_TO_STAT経由)と同じrawStats単位("実数値/100=%")。
export function calculateMasteryElementBonus(
  professionKey: ProfessionKey,
  professionTypeKey: ProfessionTypeKey,
  finalMasteryPercent: number,
): { statId: StatId; addend: number } | null {
  const coeff = MASTERY_ELEMENT_BONUS[professionKey]?.[professionTypeKey];
  if (!coeff || finalMasteryPercent <= 0) return null;
  const statId = ELEMENT_BONUS_STAT[coeff.element];
  if (!statId) return null;
  const rate =
    coeff.baseRatePerPoint *
    (1 + (finalMasteryPercent * (coeff.rateBoostPerPoint ?? 0)) / 100);
  return { statId, addend: finalMasteryPercent * rate * 100 };
}
