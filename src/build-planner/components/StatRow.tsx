import type { ReactNode } from 'react';

interface StatRowProps {
  name: ReactNode;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

// 装備パネル系(EquipmentSlotPicker/EquipmentItemPopup)で20箇所以上繰り返されている
// 「name/value の2カラム行」を共通化する。className は equip-stat-row への、
// valueClassName は equip-stat-row__value への追加修飾用。
export default function StatRow({ name, value, className, valueClassName }: StatRowProps) {
  return (
    <div className={className ? `equip-stat-row ${className}` : 'equip-stat-row'}>
      <span className="equip-stat-row__name">{name}</span>
      <span
        className={
          valueClassName ? `equip-stat-row__value ${valueClassName}` : 'equip-stat-row__value'
        }
      >
        {value}
      </span>
    </div>
  );
}
