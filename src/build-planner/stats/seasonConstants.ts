import seasonConstantsRaw from '../../data/season-constants.json';

// docs/STATUS_CALCULATION.md の「実数値→%変換の共通モデル」に対応する定数群。
// extract-ztable.mjs の extractSeasonConstants() が ZTable の FightAttrTranTable.json
// (Id=1/2/3 がそれぞれシーズン1/2/3に対応。SeasonIdフィールドは無いためIdをそのまま
// シーズン番号とみなし、現在の最大Id=現行シーズンの係数を抽出している)から機械的に
// 生成するため、シーズン更新時は `npm run extract:ztable` を再実行するだけで追従する
// (このファイルを手動で書き換える必要はない)。
//   diminishingA          ← CriToCrit/HasteToHastePct/LuckToLuckyStrikeProb/
//                            MasteryToMasteryPct/BlockToBlockRate(系列A、いずれも同一値)
//   diminishingVersatility ← VersatilityToVersatilityPct(系列B)
//   diminishingEnhance     ← ElementPowerToDam/PhyPowerToDam/MagPowerToDam(系列C、同一値)
export const SEASON_CONSTANTS: {
  diminishingA: number;
  diminishingVersatility: number;
  diminishingEnhance: number;
} = seasonConstantsRaw;

// 系列A(diminishingA)のうち、実数値0のときに既に乗っている基礎%。
// ステータスごとに異なる(出典: Wikiの実数値↔%グラフのx=0時点のy値)。
export const DIMINISHING_A_BASE_PERCENT = {
  crit: 5,
  luck: 5,
  haste: 6,
  mastery: 6,
  resist: 0,
} as const;

// ステータスでは持たない、固定の基礎倍率/軽減率(%)。
export const FIXED_BASE_PERCENT = {
  // 会心ダメージの基礎増加率(会心発生時、非会心時から+50%)
  critDamage: 50,
  // 幸運の一撃ダメージ倍率の基礎値(攻撃力に対する倍率としての%)
  luckyHitDamage: 40,
  // レジストダメージ軽減の基礎値
  resistDamageReduction: 30,
  // 会心回復(回復時に会心が発生した場合の回復量増加)の基礎値
  critRecovery: 50,
} as const;

// %や実数値ステータスとしては持たない、固定の基礎実数値。
export const FIXED_BASE_VALUE = {
  // 最大スタミナの基礎値(クラス共通)
  maxStamina: 1200,
} as const;
