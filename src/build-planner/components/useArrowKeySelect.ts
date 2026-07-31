import type { KeyboardEvent } from 'react';

interface UseArrowKeySelectOptions<T> {
  /** 選択肢の値一覧(表示順)。 */
  values: T[];
  /** 現在の選択値。 */
  current: T;
  /** 選択変更時に呼ぶコールバック。 */
  onChange: (value: T) => void;
  /** true の間はキー操作を無視する(パネルが開いている間など)。 */
  disabled?: boolean;
  /**
   * 現在値と選択肢の同一性判定(既定は===、indexOfと同じ)。オブジェクト値(例:
   * {attrId, value}のような複合選択)など参照が毎レンダー変わりうる場合に指定する。
   */
  isEqual?: (a: T, b: T) => boolean;
}

// ドロップダウン系トリガーの共通機能: フォーカスがある間、パネルを開かずに上下矢印キーで
// 選択を直接変更する(ネイティブ<select>やStepperのコンボと同じ操作感)。
// 特定のドロップダウン実装に依存しない汎用フックとして、トリガー要素のonKeyDownに
// スプレッドして使う(<button onKeyDown={useArrowKeySelect({...})} ...>)。
// 端(先頭/末尾)ではクランプし、循環はしない(ネイティブ<select>と同じ挙動)。
export function useArrowKeySelect<T>({
  values,
  current,
  onChange,
  disabled,
  isEqual,
}: UseArrowKeySelectOptions<T>) {
  return (e: KeyboardEvent) => {
    if (disabled || values.length === 0) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const currentIndex = isEqual
      ? values.findIndex((v) => isEqual(v, current))
      : values.indexOf(current);
    const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.min(values.length - 1, Math.max(0, resolvedIndex + delta));
    onChange(values[nextIndex]);
  };
}
