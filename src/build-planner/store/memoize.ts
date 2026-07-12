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

// 単一のオブジェクト引数を取り、キー集合と各値(Object.is比較)がすべて一致する場合にのみ
// 前回結果を再利用する1スロットメモ化。呼び出しごとに新規リテラルとして組み立てられる
// inputオブジェクトをそのまま渡せる(memoize1ではオブジェクト参照が毎回変わり常に
// キャッシュミスになるため、従来は20超の位置引数へ展開する必要があった)。
export function memoizeByKeys<Input extends object, R>(
  fn: (input: Input) => R,
): (input: Input) => R {
  let lastInput: Record<string, unknown> | undefined;
  let lastResult: R;

  return (input: Input): R => {
    const inputRec = input as Record<string, unknown>;
    if (lastInput !== undefined) {
      const prev = lastInput;
      const keys = Object.keys(inputRec);
      if (
        Object.keys(prev).length === keys.length &&
        keys.every((k) => Object.is(prev[k], inputRec[k]))
      ) {
        return lastResult;
      }
    }
    lastResult = fn(input);
    lastInput = inputRec;
    return lastResult;
  };
}
