// 直近の呼び出し引数が全て(Object.is比較で)一致する場合にのみ前回結果を再利用する
// 1スロットメモ化。既存の useMemo チェーンと同じ再計算粒度をZustand selector経由でも
// 保つために使う(Zustandには組み込みのcomputed機構がないため)。
export function memoize1<Args extends readonly unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  let lastArgs: Args | undefined;
  let lastResult: R;

  return (...args: Args): R => {
    if (
      lastArgs !== undefined &&
      lastArgs.length === args.length &&
      lastArgs.every((prev, i) => Object.is(prev, args[i]))
    ) {
      return lastResult;
    }
    lastResult = fn(...args);
    lastArgs = args;
    return lastResult;
  };
}
