// 完成度(perfectline, 0-100)に基づき min-max 範囲を線形補間した実数値を返す。
// 装備の基礎/進化/改鋳ステータス、能力スコア寄与値(FightValue)双方の算出に使う。
export function calcStatValue(min: number, max: number, perfectline: number): number {
  return Math.floor(min + (max - min) * (perfectline / 100));
}
