// 装備の進化ステータス(evo配列)が「装備側で確定(Evo1/Evo2のattrIdが異なる)」か
// 「同一attrId またはデータなしでユーザー選択に委ねる」かを判定する。
// calculateRawStats(実数値、evo[1]/evo[2]を参照)とcalculateAbilityScore(戦闘力値、
// evo[3]/evo[4]を参照)の双方で、evo配列の構造(先頭要素=attrId)からの判定ロジックが
// 同一だったため、ここに共通化する。
export function hasDistinctEvoAttrs(evoData: number[][] | undefined): boolean {
  if (!evoData || evoData.length === 0) return false;
  const hasSameAttr = evoData.length > 1 && evoData.every((e) => e[0] === evoData[0][0]);
  return !hasSameAttr;
}
