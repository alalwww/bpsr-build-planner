import type { Profession } from '../profession';
import type { StatId } from '../types';
import { COMMON_STAT_COEFFICIENTS } from './commonCoefficients';
import { diminishingPercent } from './formulas';
import {
  DIMINISHING_A_BASE_PERCENT,
  FIXED_BASE_PERCENT,
  SEASON_CONSTANTS,
} from './seasonConstants';

// メインステータス→攻撃力/ファスト等の変換は、基礎係数とR1アビリティ由来の追加係数
// (conversionRateBonus)を先に合算してから1回だけ乗算するのではなく、ゲーム内は
// それぞれの変換元(基礎係数/アビリティ係数)を別々に整数へ切り捨ててから加算しているらしい
// (2026-08-06不具合報告: 知力2249×基礎0.5=1124.5と知力2249×R1分0.1=224.9をそれぞれ
// floorしてから足すと1348、先に0.6として1回で乗算すると1349になり、ゲーム内実測値は前者
// (1348)と一致した)。raw側の実数値ステータス自体は既にcalculateRawStats側で整数へ
// 切り捨て済みのため、ここでは追加のfloorは行わない。
function convertBySeparatelyTruncatedRates(rawValue: number, baseRate: number, bonusRate: number): number {
  return Math.floor(rawValue * baseRate) + Math.floor(rawValue * bonusRate);
}

// docs/STATUS_CALCULATION.md に記載した式から導出される、実数値ステータスでは
// 直接表現できないステータス群(%変換後の値、クラス係数で導出される値)。
export interface DerivedStats {
  maxHp: number;
  // 耐久力からmaxHpへ変換された分(ステータス詳細のバフ効果表示用)
  enduranceMaxHpBonus: number;
  physicalAtk: number;
  magicalAtk: number;
  // メインステータスからphysicalAtk/magicalAtkへ変換された分(attackTypeにより一方のみ非0。
  // ステータス詳細のバフ効果表示用)
  physicalAtkMainStatBonus: number;
  magicalAtkMainStatBonus: number;
  physicalDef: number;
  // 筋力からphysicalDefへ変換された分(ステータス詳細のバフ効果表示用)
  physicalDefStrengthBonus: number;
  magicalDef: number;
  // 知力からmagicalDefへ変換された分(ステータス詳細のバフ効果表示用)
  magicalDefIntellectBonus: number;

  critPercent: number;
  // 会心発生時のダメージ増加率(現状ステータスとしては存在せず、固定の基礎値)
  critDamageBonusPercent: number;

  // %変換前の実数値(装備等のhaste加算 + 俊敏由来の変換分)。CharacterPanelのツールチップ表示用。
  hasteReal: number;
  // 俊敏からhasteReal(ファストの加算列)へ変換された分(ステータス詳細のバフ効果表示用)
  hasteAgilityBonus: number;
  hastePercent: number;
  atkSpeedPercent: number;
  castSpeedPercent: number;

  luckPercent: number;
  // 幸運の一撃が発生した際、攻撃力に乗算するダメージ倍率(%)
  luckyHitDamageMultiplierPercent: number;
  // 幸運増強(幸運の一撃を含むすべての幸運効果に乗る与ダメージ増加バフ。幸運%と同値)
  luckyHitBoostPercent: number;

  masteryPercent: number;

  versatilityPercent: number;
  // 万能由来の、与ダメージ/回復量/バリア付与量の増加率(他の効果と乗算される)
  versatilityDamageBonusPercent: number;
  // 万能由来の、被ダメージの軽減率(他の効果と乗算される)
  versatilityDamageReductionPercent: number;

  resistPercent: number;
  // レジスト発生時の被ダメージ軽減率(現状ステータスとしては存在せず、固定の基礎値)
  resistDamageReductionPercent: number;

  // 物理/魔法増強(系列C): 与える物理/魔法ダメージ・回復量の増加率
  physicalBoostPercent: number;
  magicalBoostPercent: number;

  // 会心回復(回復時に会心が発生した場合の回復量増加率。基礎値+装備等の加算)
  critRecoveryPercent: number;

  // 物理軽減/魔法軽減(基礎値0% + モジュール「物理耐性」「魔法耐性」等由来の加算)
  physicalReductionPercent: number;
  magicalReductionPercent: number;

  // 幸運の一撃回復の倍率(幸運の一撃ダメージ倍率と同じ基礎40% + 係数0.25×幸運% + モジュール
  // 「集中・幸運」等由来の加算。幸運会心の幸運ダメージ加算(luckyHitDamageBonus)はダメージ
  // 倍率側専用で乗らない)
  luckyHitRecoveryMultiplierPercent: number;

  // 物理防御力無視(基礎値0% + モジュール「筋力強化」等由来の加算)
  physicalDefIgnorePercent: number;

  // 戦闘時のスタミナ秒間回復量(クラス基礎値 + 心相ツリー等由来の加算)
  staminaRegenPerSecond: number;
}

// ファスト%(hastePercent)から攻撃速度%/詠唱速度%を算出する共通ロジック。deriveStats内の
// 初期計算(実数値rawStats由来、finalPctAddend/イマジン最終%乗算/料理バフ等の後付け加算を
// 含まない中間値)と、それら全てが確定した後の最終ファスト%(stats.haste)を使った再計算
// (recalculateSpeedPercents)の双方から呼ぶ。
function computeSpeedPercents(
  hastePercent: number,
  profession: Profession,
  atkSpeedPerHastePercentBonus: number,
  atkSpeedFinalPctAddend: number,
  castSpeedFinalPctAddend: number,
): { atkSpeedPercent: number; castSpeedPercent: number } {
  return {
    atkSpeedPercent:
      hastePercent * (profession.atkSpeedPerHastePercent + atkSpeedPerHastePercentBonus) +
      atkSpeedFinalPctAddend,
    castSpeedPercent:
      hastePercent * profession.castSpeedPerHastePercent + castSpeedFinalPctAddend,
  };
}

// 武器レアステータス(月影型「ファスト+6%」等)のfinalPctAddend.haste/イマジン最終%乗算/
// 料理バフ(HP変動・二段増幅・鼓舞・ステ補正)を含む、全ての調整が適用済みの最終ファスト%
// (stats.haste)から、攻撃速度%/詠唱速度%を再計算する。ゲーム内では「攻撃速度」は表示上
// 独立したステータスに見えるが、実体はファスト%にクラス係数を掛けた派生値であり、ファスト%への
// 加算はすべて同じ変換を経て攻撃速度%に反映される(不具合報告2026-08-05で判明。deriveStats内の
// 初期計算はrawStats由来のhastePercentしか見ないため、上記の後付け加算を取りこぼしていた)。
export function recalculateSpeedPercents(
  hasteFinalPercent: number,
  profession: Profession,
  atkSpeedPerHastePercentBonus: number,
  atkSpeedFinalPctAddend: number,
  castSpeedFinalPctAddend: number,
): { atkSpeedPercent: number; castSpeedPercent: number } {
  return computeSpeedPercents(
    hasteFinalPercent,
    profession,
    atkSpeedPerHastePercentBonus,
    atkSpeedFinalPctAddend,
    castSpeedFinalPctAddend,
  );
}

// 幸運%(luckPercent)から幸運の一撃ダメージ倍率/回復倍率を算出する共通ロジック。
// computeSpeedPercentsと同じ理由(ファスト%→攻撃速度%と同型の後付け加算取りこぼし問題)で、
// deriveStats内の初期計算(rawStats由来のluckPercentのみ見る中間値)と、finalPctAddend/
// イマジン最終%乗算/料理バフ等すべてが確定した後の最終幸運%(stats.luck)を使った再計算
// (recalculateLuckyHitMultipliers)の双方から呼ぶ。
function computeLuckyHitMultipliers(
  luckPercent: number,
  luckyHitDamageRatioBonus: number,
  luckyHitDamageBonus: number,
  luckyHitRecoveryBonus: number,
): { luckyHitDamageMultiplierPercent: number; luckyHitRecoveryMultiplierPercent: number } {
  return {
    luckyHitDamageMultiplierPercent:
      FIXED_BASE_PERCENT.luckyHitBase +
      (0.25 + luckyHitDamageRatioBonus) * luckPercent +
      luckyHitDamageBonus / 100,
    luckyHitRecoveryMultiplierPercent:
      FIXED_BASE_PERCENT.luckyHitBase + 0.25 * luckPercent + luckyHitRecoveryBonus / 100,
  };
}

// finalPctAddend.luck/イマジン最終%乗算/料理バフ(HP変動・二段増幅・鼓舞・ステ補正)を含む、
// 全ての調整が適用済みの最終幸運%(stats.luck)から、幸運の一撃ダメージ倍率/回復倍率を
// 再計算する。deriveStats内の初期計算はrawStats由来のluckPercentしか見ないため、上記の
// 後付け加算を取りこぼしていた(不具合報告2026-08-09、recalculateSpeedPercentsと同種の問題)。
export function recalculateLuckyHitMultipliers(
  luckFinalPercent: number,
  luckyHitDamageRatioBonus: number,
  luckyHitDamageBonus: number,
  luckyHitRecoveryBonus: number,
): { luckyHitDamageMultiplierPercent: number; luckyHitRecoveryMultiplierPercent: number } {
  return computeLuckyHitMultipliers(
    luckFinalPercent,
    luckyHitDamageRatioBonus,
    luckyHitDamageBonus,
    luckyHitRecoveryBonus,
  );
}

export function deriveStats(
  raw: Record<StatId, number>,
  profession: Profession,
  // R1アビリティ(type=4効果)によるメインステータス→攻撃力/物理防御力/ファストの変換率ボーナス。
  // calculateRawStatsのconversionRateBonusをそのまま渡す(未指定時は基礎変換率のみ)。
  conversionRateBonus: Partial<Record<StatId, number>> = {},
  // アビリティ(例: ディバインアーチャー「迅射」)による攻撃速度への直接加算量(%そのままの数値)。
  // calculateRawStatsのatkSpeedFinalPctAddendをそのまま渡す。
  atkSpeedFinalPctAddend = 0,
  // アビリティ(例: ストームブレイド/ツインストライカー/ゲイルランサー「迅速」)による
  // 「ファスト%→攻撃速度%」変換率へのボーナス。calculateRawStatsのatkSpeedPerHastePercentBonus
  // をそのまま渡す(profession.atkSpeedPerHastePercentに加算する)。
  atkSpeedPerHastePercentBonus = 0,
  // モジュール効果(例: 「集中・詠唱」)による詠唱速度への直接加算量(%そのままの数値)。
  // calculateRawStatsのcastSpeedFinalPctAddendをそのまま渡す。
  castSpeedFinalPctAddend = 0,
  // アビリティ(ビートパフォーマー「幸運相乗」)による、幸運%1ptあたりの幸運の一撃ダメージ
  // 倍率への変換率ボーナス。calculateRawStatsのluckyHitDamageRatioBonusをそのまま渡す
  // (基礎係数0.25に加算する)。
  luckyHitDamageRatioBonus = 0,
): DerivedStats {
  const enduranceMaxHpBonus = raw.endurance * profession.hpPerEndurancePoint;
  const maxHp = raw.maxHp + enduranceMaxHpBonus;

  const atkTargetStat: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  const mainStatBonus = convertBySeparatelyTruncatedRates(
    raw[profession.mainStat],
    profession.atkPerMainStatPoint,
    conversionRateBonus[atkTargetStat] ?? 0,
  );
  const physicalAtkMainStatBonus = profession.attackType === 'physical' ? mainStatBonus : 0;
  const magicalAtkMainStatBonus = profession.attackType === 'magical' ? mainStatBonus : 0;
  const physicalAtk = raw.atk + physicalAtkMainStatBonus;
  const magicalAtk = raw.matk + magicalAtkMainStatBonus;

  const physicalDefStrengthBonus =
    raw.strength *
    (COMMON_STAT_COEFFICIENTS.physicalDefPerStrengthPoint + (conversionRateBonus.physicalDef ?? 0));
  const physicalDef = raw.physicalDef + physicalDefStrengthBonus;
  const magicalDefIntellectBonus =
    raw.intellect * COMMON_STAT_COEFFICIENTS.magicalDefPerIntellectPoint;
  const magicalDef = raw.magicalDef + magicalDefIntellectBonus;

  const critPercent = diminishingPercent(
    raw.crit,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.crit,
  );

  const hasteAgilityBonus = convertBySeparatelyTruncatedRates(
    raw.agility,
    COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint,
    conversionRateBonus.haste ?? 0,
  );
  const hasteReal = raw.haste + hasteAgilityBonus;
  const hastePercent = diminishingPercent(
    hasteReal,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.haste,
  );

  const luckPercent = diminishingPercent(
    raw.luck,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.luck,
  );

  const masteryPercent = diminishingPercent(
    raw.mastery,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.mastery,
  );

  const versatilityPercent = diminishingPercent(
    raw.versatility,
    SEASON_CONSTANTS.diminishingVersatility,
  );

  const resistPercent = diminishingPercent(
    raw.resist,
    SEASON_CONSTANTS.diminishingA,
    DIMINISHING_A_BASE_PERCENT.resist,
  );

  const physicalBoostPercent = diminishingPercent(
    raw.physicalEnhance,
    SEASON_CONSTANTS.diminishingEnhance,
  );
  const magicalBoostPercent = diminishingPercent(
    raw.magicalEnhance,
    SEASON_CONSTANTS.diminishingEnhance,
  );

  const luckyHitMultipliers = computeLuckyHitMultipliers(
    luckPercent,
    luckyHitDamageRatioBonus,
    raw.luckyHitDamageBonus,
    raw.luckyHitRecoveryBonus,
  );

  return {
    maxHp,
    enduranceMaxHpBonus,
    physicalAtk,
    magicalAtk,
    physicalAtkMainStatBonus,
    magicalAtkMainStatBonus,
    physicalDef,
    physicalDefStrengthBonus,
    magicalDef,
    magicalDefIntellectBonus,

    critPercent,
    critDamageBonusPercent: FIXED_BASE_PERCENT.critDamage + raw.critDamageBonus / 100,

    hasteReal,
    hasteAgilityBonus,
    hastePercent,
    ...computeSpeedPercents(
      hastePercent,
      profession,
      atkSpeedPerHastePercentBonus,
      atkSpeedFinalPctAddend,
      castSpeedFinalPctAddend,
    ),

    luckPercent,
    // 基礎40% + 幸運%×0.25が基礎式(2026-08-09不具合報告: 幸運5%/11%/(5%+幸運相乗)の3点実測
    // 41.25%/42.75%/43.75%と、いずれも寸分違わず一致することを確認済み。ZTableの幸運説明文
    // 「幸運確率1%につき+1%」(幸運強化)は、この倍率とは別枠の・幸運効果自体へのバフのような
    // 無関係な効果と判明したため未対応のままでよい)。ビートパフォーマー「幸運相乗」(+0.5)等、
    // この変換率そのものを底上げする効果はluckyHitDamageRatioBonusとして基礎係数0.25に加算
    // する。ここでの値はrawStats由来のluckPercentのみを見た中間値(再計算はrecalculate
    // LuckyHitMultipliers参照)。
    ...luckyHitMultipliers,
    luckyHitBoostPercent: luckPercent,

    masteryPercent,

    versatilityPercent,
    versatilityDamageBonusPercent: versatilityPercent * 0.35,
    versatilityDamageReductionPercent: versatilityPercent * 0.15,

    resistPercent,
    resistDamageReductionPercent: FIXED_BASE_PERCENT.resistDamageReduction,

    physicalBoostPercent,
    magicalBoostPercent,

    critRecoveryPercent: FIXED_BASE_PERCENT.critRecovery + raw.critRecoveryBonus / 100,

    physicalReductionPercent: raw.physicalReductionBonus / 100,
    magicalReductionPercent: raw.magicalReductionBonus / 100,

    physicalDefIgnorePercent: raw.physicalDefIgnoreBonus / 100,

    staminaRegenPerSecond: profession.staminaRegenPerSecond + raw.staminaRegen,
  };
}
