// 実数値を「収益減少カーブ」で%に変換する共通関数。
// stat% = basePercent + 100 * real / (real + k)
// k が大きいほど変換効率が落ちる速度が緩やかになる。
export function diminishingPercent(real: number, k: number, basePercent = 0): number {
  if (real <= 0) {
    return basePercent;
  }
  return basePercent + (100 * real) / (real + k);
}
