// 浮動小数点演算の誤差(例: 15%のつもりが14.999999...%になる)を吸収するため、
// 十分な精度で四捨五入してから使う。
export function cleanRound(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// 小数点第三位を切り捨てて第二位までに丸める。value*100の時点でも浮動小数点誤差
// (例: 4.6*100が459.999...になる)が起きうるため、floorする直前にもcleanRoundで丸める。
export function truncate2(value: number): number {
  return Math.floor(cleanRound(value * 100)) / 100;
}

// 小数点第三位を切り捨てて第二位まで表示する。
export function truncate2Str(value: number): string {
  const truncated = truncate2(value);
  return truncated.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
