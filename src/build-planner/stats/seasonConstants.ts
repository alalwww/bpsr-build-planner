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
// ステータスごとに異なる(出典: Wikiの実数値↔%グラフのx=0時点のy値。ただしhasteはS2時代の
// 値(6%)がS3では実測と合わず、ゲーム内実測(俊敏538・装備なしでreal=430/0.85%、
// real=100×430/(430+50000)=0.8536%と一致)によりS3では0%に変更済み)。
export const DIMINISHING_A_BASE_PERCENT = {
  crit: 5,
  luck: 5,
  haste: 0,
  mastery: 6,
  resist: 0,
} as const;

// %系ステータス(illusionPower除く)全種の基礎%。DIMINISHING_A_BASE_PERCENT(系列A)に、
// 系列Bのversatility(常に基礎0%、diminishingPercentのbasePercent省略時の既定値と同じ)を
// 補ったもの。CharacterPanelのステータス説明ポップアップ「初期値」表示用。
export const STAT_BASE_PERCENT = {
  ...DIMINISHING_A_BASE_PERCENT,
  versatility: 0,
} as const;

// %系ステータス(illusionPower除く)を実数値から%へ変換する際に使う収穫逓減カーブの
// シーズン定数。会心/幸運/ファスト/器用さ/レジストは系列A(diminishingA)、万能のみ
// 系列B(diminishingVersatility)を使う(deriveStats.ts参照)。ステータス説明ポップアップの
// 計算式表示用。
export const STAT_SEASON_CONSTANT = {
  crit: SEASON_CONSTANTS.diminishingA,
  luck: SEASON_CONSTANTS.diminishingA,
  haste: SEASON_CONSTANTS.diminishingA,
  mastery: SEASON_CONSTANTS.diminishingA,
  resist: SEASON_CONSTANTS.diminishingA,
  versatility: SEASON_CONSTANTS.diminishingVersatility,
} as const;

// ステータスでは持たない、固定の基礎倍率/軽減率(%)。
export const FIXED_BASE_PERCENT = {
  // 会心ダメージの基礎増加率(会心発生時、非会心時から+50%)
  critDamage: 50,
  // 幸運の一撃ダメージ倍率/回復倍率共通の基礎値(2026-08-09不具合報告: 幸運5%/11%/幸運相乗込み
  // 5%の3点実測41.25%/42.75%/43.75%から基礎40%+幸運%×0.25で寸分違わず一致することを確認。
  // 回復倍率も同じ基礎40%であることをユーザー確認済み)。
  luckyHitBase: 40,
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
