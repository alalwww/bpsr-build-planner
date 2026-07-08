// docs/STATUS_CALCULATION.md の「実数値→%変換の共通モデル」に対応する定数群。
// これらの定数はシーズン毎にゲーム側で変更されるため、コード中の数式に直接埋め込まず
// この1ファイルにまとめている(シーズン更新時はここだけ差し替える)。
// 現在の値はシーズン2のものを採用している。
export const SEASON_CONSTANTS = {
  // 系列A: 会心・幸運・器用さ・ファスト・レジストの実数値→%変換に使う定数
  diminishingA: 19972,
  // 系列B: 万能の実数値→%変換に使う定数
  diminishingVersatility: 11200,
  // 系列C: 物理/魔法増強・属性強度/属性耐性の実数値→%変換に使う定数
  // S1=4457, S2(現行)=6486, S3=11000(docs/STATUS_CALCULATION.md「物理増強・魔法増強」章参照)
  diminishingEnhance: 6486,
} as const;

// 系列A(diminishingA)のうち、実数値0のときに既に乗っている基礎%。
// ステータスごとに異なる(出典: Wikiの実数値↔%グラフのx=0時点のy値)。
export const DIMINISHING_A_BASE_PERCENT = {
  crit: 5,
  luck: 5,
  haste: 0,
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
