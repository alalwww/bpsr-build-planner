import { useRef } from 'react';
import Chevron from '../components/Chevron';
import { useArrowKeySelect } from '../components/useArrowKeySelect';
import { useCloseOnOutsideClick } from '../components/useCloseOnOutsideClick';
import { useDelayedUnmount } from '../components/useDelayedUnmount';
import { useDropdownKeyboardNav } from '../components/useDropdownKeyboardNav';

const CLOSE_ANIM_MS = 150;

interface EvoSlotPickerProps<T extends string | number> {
  /** ボタン先頭に表示するタグ(改鋳スロット等)。省略時は非表示。 */
  tag?: string;
  /** ステータス名の右に表示する値。undefinedなら非表示。 */
  valueLabel?: string;
  selectedStat: T | undefined;
  availableStats: T[];
  getLabel: (statId: T) => string;
  /** 「未設定」選択肢のラベル。省略時は未設定選択肢自体を表示しない(常にいずれか選択済みの場合)。 */
  unsetLabel?: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSelect: (statId: T | undefined) => void;
}

// 進化ステータス選択スロット。改鋳スロット・同一attrId選択スロット・通常スロット・
// 進化ステータス組み合わせ違い装備の切り替えスロットで共通利用する。
function EvoSlotPicker<T extends string | number>({
  tag,
  valueLabel,
  selectedStat,
  availableStats,
  getLabel,
  unsetLabel,
  isEditing,
  onToggleEdit,
  onSelect,
}: EvoSlotPickerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(containerRef, isEditing, onToggleEdit);
  const shouldRenderPicker = useDelayedUnmount(isEditing, CLOSE_ANIM_MS);
  useDropdownKeyboardNav(panelRef, isEditing && shouldRenderPicker, onToggleEdit, triggerRef);
  // 選択肢を選んだ後は、選択肢ボタン(アンマウントされる)からトリガーへフォーカスを戻す。
  const handleSelect = (statId: T | undefined) => {
    onSelect(statId);
    triggerRef.current?.focus();
  };
  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(選択肢一覧)と一致させる。
  const options: (T | undefined)[] =
    unsetLabel !== undefined ? [undefined, ...availableStats] : availableStats;
  const handleTriggerKeyDown = useArrowKeySelect({
    values: options,
    current: selectedStat,
    onChange: handleSelect,
    disabled: isEditing,
  });
  return (
    <div className="equip-evo-slot" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`equip-evo-slot__btn${selectedStat != null ? ' equip-evo-slot__btn--set' : ''}`}
        onClick={onToggleEdit}
        onKeyDown={handleTriggerKeyDown}
      >
        {tag && <span className="equip-evo-slot__tag">{tag}</span>}
        <span className="equip-evo-slot__stat">
          {selectedStat != null ? getLabel(selectedStat) : unsetLabel}
        </span>
        {valueLabel !== undefined && <span className="equip-evo-slot__value">{valueLabel}</span>}
        <Chevron open={isEditing} className="equip-evo-slot__arrow" />
      </button>
      {shouldRenderPicker && (
        <div
          className={`equip-evo-picker-anchor dropdown-panel-anim${isEditing ? '' : ' dropdown-panel-anim--closing'}`}
        >
          <div className="dropdown-panel-anim__inner">
            <div className="equip-evo-picker" ref={panelRef}>
              {unsetLabel !== undefined && (
                <button
                  type="button"
                  className={`equip-evo-option${selectedStat == null ? ' equip-evo-option--selected' : ''}`}
                  onClick={() => handleSelect(undefined)}
                >
                  {unsetLabel}
                </button>
              )}
              {availableStats.map((statId) => (
                <button
                  type="button"
                  key={statId}
                  className={`equip-evo-option${selectedStat === statId ? ' equip-evo-option--selected' : ''}`}
                  onClick={() => handleSelect(statId)}
                >
                  {getLabel(statId)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvoSlotPicker;
