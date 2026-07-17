// 完成度(perfectline, 0-100)に基づき min-max 範囲を線形補間した実数値を返す。
// 装備の基礎/進化/改鋳ステータス、能力スコア寄与値(FightValue)双方の算出に使う。
// ここでは丸めない(呼び出すたびに丸めると、複数装備を合算する際に端数の切り捨てが
// 積み重なって誤差になるため)。合算後、表示の直前にのみ丸める設計とする
// (character/statFormat.ts の truncate2/truncate2Str、本ファイルの truncate1/truncate1Str を参照)。
export function calcStatValue(min: number, max: number, perfectline: number): number {
  return min + (max - min) * (perfectline / 100);
}

// 浮動小数点演算の誤差(例: 46のつもりが45.999999...になる)を吸収するため、
// 十分な精度で丸めてから使う。
const CLEAN_ROUND_SCALE = 1e6;
function cleanRound(value: number): number {
  return Math.round(value * CLEAN_ROUND_SCALE) / CLEAN_ROUND_SCALE;
}

// 小数点第二位を切り捨てて第一位までに丸める。装備1つぶんの個別ステータス表示
// (基礎/進化/改鋳)に使う。合算後の最終ステータス表示は character/statFormat.ts の
// truncate2/truncate2Str(小数点第2位まで)を使う。
export function truncate1(value: number): number {
  return Math.floor(cleanRound(value * 10)) / 10;
}

export function truncate1Str(value: number): string {
  return truncate1(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
