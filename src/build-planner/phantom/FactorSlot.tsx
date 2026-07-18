import { useMemo, useState } from 'react';
import Stepper from '../components/Stepper';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import { getDefaultFactorGrade, type PhantomFactorSlotValue } from './phantomData';

export interface FactorSlotProps {
  groupId: number;
  current: PhantomFactorSlotValue | null;
  options: DropdownOption[];
  getDesc: (classKey: string, grade: number) => string;
  unequippedLabel: string;
  onSet: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
}

// FactorSlot: 保留中(未装着時)のグレード状態を自前で保持するコンポーネント
function FactorSlot({
  groupId,
  current,
  options,
  getDesc,
  unequippedLabel,
  onSet,
}: FactorSlotProps) {
  const [pendingGrade, setPendingGrade] = useState(getDefaultFactorGrade);
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
              setPendingGrade(v);
            }
          }}
        />
      </div>
    </div>
  );
}

export default FactorSlot;
