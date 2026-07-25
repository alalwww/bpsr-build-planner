import { useMemo } from 'react';
import Stepper from '../components/Stepper';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import type { PhantomFactorSlotValue } from './phantomData';

export interface FactorSlotProps {
  groupId: number;
  current: PhantomFactorSlotValue | null;
  /** 未装着時に表示するグレード。装着時にはこの値が初期グレードとして使われる。 */
  pendingGrade: number;
  onPendingGradeChange: (grade: number) => void;
  options: DropdownOption[];
  getDesc: (classKey: string, grade: number) => string;
  unequippedLabel: string;
  onSet: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
}

// FactorSlot: 未装着時のグレードは呼び出し元(親)が保持する制御コンポーネント
// (因子ランク一括変更が未装着スロットの表示値も上書きできるようにするため)。
function FactorSlot({
  groupId,
  current,
  pendingGrade,
  onPendingGradeChange,
  options,
  getDesc,
  unequippedLabel,
  onSet,
}: FactorSlotProps) {
  const grade = current?.grade ?? pendingGrade;

  const optionsWithDesc = useMemo(
    () => options.map((opt) => ({ ...opt, description: getDesc(opt.value, grade) })),
    [options, grade, getDesc],
  );

  return (
    <div className="phantom-factor-slot">
      <div className="phantom-factor-controls">
        <CustomDropdown
          className="phantom-factor-dropdown"
          options={optionsWithDesc}
          value={current?.classKey ?? ''}
          placeholder={unequippedLabel}
          onChange={(v) => {
            if (v === '') {
              onSet(groupId, null);
            } else {
              onSet(groupId, { classKey: v, grade });
            }
          }}
        />
        <Stepper
          className="phantom-grade-stepper"
          value={grade}
          min={1}
          max={10}
          formatValue={(v) => `G${v}`}
          onChange={(v) => {
            if (current) {
              onSet(groupId, { ...current, grade: v });
            } else {
              onPendingGradeChange(v);
            }
          }}
        />
      </div>
    </div>
  );
}

export default FactorSlot;
