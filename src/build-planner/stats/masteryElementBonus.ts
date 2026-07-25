import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import type { ElementId, StatId } from '../types';
import { ELEMENT_BONUS_STAT } from './attrMaps';

// ELEMENT_BONUS_STATは(闇属性を除き)対応するStatIdが必ず存在する属性のみをテーブル定義で
// 使うため、非nullを断定するヘルパーとして使う。
function elementBonusStat(elem: ElementId): StatId {
  const statId = ELEMENT_BONUS_STAT[elem];
  if (!statId) throw new Error(`no ELEMENT_BONUS_STAT entry for element: ${elem}`);
  return statId;
}

export interface MasteryStatEffectCoefficient {
  statId: StatId;
  // 器用さ1%あたりの加算量%(基礎変換率)。
  baseRatePerPoint: number;
  // 「器用さ強化」型の型のみ持つ、基礎変換率自体への器用さ依存ボーナス(器用さ1%あたり+X%、
  // 単位は基礎変換率に対する百分率。例: 3なら器用さ6%で基礎変換率が18%増しになる)。
  rateBoostPerPoint?: number;
}

// クラス×型ごとの「器用さ→ステータス」固有効果。ZTable ProfessionSystemTable.MasteryDes
// (S3、2026-07実測)のテキストから、既存StatId(属性ボーナス/バリア強度/回復力)で表現できる
// 部分のみを抜粋したもの。MasteryDesはクラスごとに全く異なる効果(レジストダメージ軽減/
// 全属性耐性/特定スキルのダメージ%・リソース獲得効率等)を記述する自由記述文で、ZTable上に
// 構造化された係数テーブルは存在しないため、この対応表は手動で書き起こしている
// (docs/STATUS_CALCULATION.md「器用さ」章 8.6参照)。1つの型が複数効果を持つ場合は配列で保持する
// (例: 威咲型は森属性ボーナスとバリア強度の両方を持つ)。
//
// フロストメイジ霜天型で確認した通り、シーズン間でMasteryDesの数値が変わることがある
// (S2: 氷属性ボーナス+0.4%固定 → S3: +0.2%+器用さ強化+3%/pt に変更)。
// `npm run extract:ztable`後にProfessionSystemTable.MasteryDesを再確認し、変更があれば
// この表も追従させること。
export const MASTERY_STAT_EFFECTS: Partial<
  Record<ProfessionKey, Partial<Record<ProfessionTypeKey, MasteryStatEffectCoefficient[]>>>
> = {
  frostMage: {
    // MasteryDes[0](氷牙型): "器用さ1%につき氷属性ボーナス+0.65%"
    type1: [{ statId: elementBonusStat('ice'), baseRatePerPoint: 0.65 }],
    // MasteryDes[1](霜天型): "器用さ1%につき凍源の取得効率+1%、氷属性ボーナス+0.2%
    //   器用さ強化：器用さ1%につき氷属性ボーナス変換率+3%"
    // (凍源の取得効率はゲーム内リソース機構でStatId未対応のため未実装)
    type2: [{ statId: elementBonusStat('ice'), baseRatePerPoint: 0.2, rateBoostPerPoint: 3 }],
  },
  galeLancer: {
    // MasteryDes[0](烈風型): "器用さ1%につき風属性ボーナス+0.35%
    //   器用さ強化：器用さ1%につき風属性ボーナス変換率+3%"
    type1: [{ statId: elementBonusStat('wind'), baseRatePerPoint: 0.35, rateBoostPerPoint: 3 }],
    // MasteryDes[1](乱風型): "器用さ1%につき風属性ボーナス+0.65%"
    type2: [{ statId: elementBonusStat('wind'), baseRatePerPoint: 0.65 }],
  },
  verdantOracle: {
    // MasteryDes[0](威咲型): "器用さ1%につき森属性ボーナス+0.75%、バリア強度+0.3%"
    type1: [
      { statId: elementBonusStat('forest'), baseRatePerPoint: 0.75 },
      { statId: 'barrierStrength', baseRatePerPoint: 0.3 },
    ],
    // MasteryDes[1](森癒型): "器用さ1%につき回復力+1%"
    type2: [{ statId: 'healingPower', baseRatePerPoint: 1 }],
  },
  divineArcher: {
    // MasteryDes[0](狼弓型): "器用さ1%につき臣獣のダメージ+2.75%"(対応StatIdなし、対象外)
    // MasteryDes[1](鷹弓型): "器用さ1%につき光属性ボーナス+0.6%"
    type2: [{ statId: elementBonusStat('light'), baseRatePerPoint: 0.6 }],
  },
  twinStriker: {
    // MasteryDes[0]: リキャスト加速/物理攻撃力(対応StatIdなし、対象外)
    // MasteryDes[1]: "器用さ1%につき火属性ボーナス+0.72%"
    type2: [{ statId: elementBonusStat('fire'), baseRatePerPoint: 0.72 }],
  },
  heavyGuardian: {
    // MasteryDes[0](剛身型): "器用さ1%につきバリア強度+2.5%"
    type1: [{ statId: 'barrierStrength', baseRatePerPoint: 2.5 }],
    // MasteryDes[1](剛守型): "器用さ1%につきレジストダメージ軽減と幸運レジストダメージ軽減+0.2%"
    // (resistDamageReductionは現状base30%固定で実数値からの加算経路が未実装のため対象外、
    // docs/STATUS_CALCULATION.md 4章「レジストダメージ軽減」参照)
  },
};

// 器用さ%(収益逓減カーブ・finalPctAddend・料理バフ等すべて適用済みの最終表示値)から、
// クラス×型固有のステータス加算量を算出する。戻り値は蒼海武器レアステータス等の属性ボーナス
// 直接加算(EVO_PCT_ATTR_TO_STAT経由)と同じrawStats単位("実数値/100=%")。
// 1つの型が複数効果を持つ場合(例: 威咲型)は複数件返す。
export function calculateMasteryStatEffects(
  professionKey: ProfessionKey,
  professionTypeKey: ProfessionTypeKey,
  finalMasteryPercent: number,
): { statId: StatId; addend: number }[] {
  const coeffs = MASTERY_STAT_EFFECTS[professionKey]?.[professionTypeKey];
  if (!coeffs || finalMasteryPercent <= 0) return [];
  return coeffs.map(({ statId, baseRatePerPoint, rateBoostPerPoint }) => {
    const rate = baseRatePerPoint * (1 + (finalMasteryPercent * (rateBoostPerPoint ?? 0)) / 100);
    return { statId, addend: finalMasteryPercent * rate * 100 };
  });
}
