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
    // MasteryDes[0](双炎型): リキャスト加速は対象スキル固有のため対象外。
    // 物理攻撃力+0.2%はMASTERY_FINAL_PCT_EFFECTS(下記)で扱う
    // (atk/matkは%系ではなく実数値ステータスのため、この表の「flat加算」方式では表現できない)。
    // MasteryDes[1](炎舞型): "器用さ1%につき火属性ボーナス+0.72%"
    type2: [{ statId: elementBonusStat('fire'), baseRatePerPoint: 0.72 }],
  },
  heavyGuardian: {
    // MasteryDes[0](剛身型): "器用さ1%につきバリア強度+2.5%"
    type1: [{ statId: 'barrierStrength', baseRatePerPoint: 2.5 }],
    // MasteryDes[1](剛守型): "器用さ1%につきレジストダメージ軽減と幸運レジストダメージ軽減+0.2%"
    // (resistDamageReductionは現状base30%固定で実数値からの加算経路が未実装のため対象外、
    // docs/STATUS_CALCULATION.md 4章「レジストダメージ軽減」参照)
  },
  shieldFighter: {
    // MasteryDes[0](光砕型): "器用さ1%につき光明の盾の取得効率+2.5%、全属性耐性+0.2%"
    // (光明の盾の取得効率は対応StatIdなし、対象外)
    type1: [{ statId: 'allAttrResistBonus', baseRatePerPoint: 0.2 }],
    // MasteryDes[1](光盾型): "器用さ1%につき光盾障壁のHPブースト効果+3%、全属性耐性+0.2%"
    // (光盾障壁のHPブースト効果は対応StatIdなし、対象外)
    type2: [{ statId: 'allAttrResistBonus', baseRatePerPoint: 0.2 }],
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

export interface MasteryFinalPctStatEffect {
  statId: StatId;
  // 器用さ1%あたりの、対象ステータス最終値への%ボーナス(乗算)。
  percentPerPoint: number;
}

// クラス×型ごとの「器用さ→実数値ステータスへの%ボーナス」固有効果。MASTERY_STAT_EFFECTSの
// 対象(属性ボーナス/バリア強度/回復力等)はいずれもそれ自体が"%"で表現されるステータスのため
// rawStatsへのflat加算(実数値/100=%)で表現できるが、atk/matk等は実数値そのもの(damage値)の
// ステータスのため、器用さ%由来のボーナスは最終値への乗算(imagFinalPct/ipct('atk')と同じ仕組み)
// として適用する必要がある。現状ツインストライカー双炎型の「器用さ1%につき物理攻撃力+0.2%」
// (MasteryDes[0]の後半)のみ該当。
export const MASTERY_FINAL_PCT_EFFECTS: Partial<
  Record<ProfessionKey, Partial<Record<ProfessionTypeKey, MasteryFinalPctStatEffect[]>>>
> = {
  twinStriker: {
    // MasteryDes[0](双炎型): "...リキャスト加速+3.2%、物理攻撃力+0.2%"
    type1: [{ statId: 'atk', percentPerPoint: 0.2 }],
  },
};

// 器用さ%から、クラス×型固有の最終値乗算ボーナスを算出する。戻り値のmultiplierは
// そのままstats[statId]に掛け合わせる係数(器用さ0または対象効果なしなら空配列)。
export function calculateMasteryFinalPctEffects(
  professionKey: ProfessionKey,
  professionTypeKey: ProfessionTypeKey,
  finalMasteryPercent: number,
): { statId: StatId; multiplier: number }[] {
  const effects = MASTERY_FINAL_PCT_EFFECTS[professionKey]?.[professionTypeKey];
  if (!effects || finalMasteryPercent <= 0) return [];
  return effects.map(({ statId, percentPerPoint }) => ({
    statId,
    multiplier: 1 + (finalMasteryPercent * percentPerPoint) / 100,
  }));
}
