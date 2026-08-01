import type { ReactNode } from 'react';

interface StatRowProps {
  name: ReactNode;
  value: ReactNode;
  /** 指定時、nameの前にステータスアイコンを表示する(呼び出し側でstatIcons.tsのgetStatIconUrl/getStatIconUrlForAttrIdから解決したURLを渡す)。 */
  iconUrl?: string;
  className?: string;
  valueClassName?: string;
}

// 装備パネル系(EquipmentSlotPicker/EquipmentItemPopup)で20箇所以上繰り返されている
// 「name/value の2カラム行」を共通化する。className は equip-stat-row への、
// valueClassName は equip-stat-row__value への追加修飾用。
export default function StatRow({ name, value, iconUrl, className, valueClassName }: StatRowProps) {
  return (
    <div className={className ? `equip-stat-row ${className}` : 'equip-stat-row'}>
      <span className="equip-stat-row__name">
        {iconUrl && <img src={iconUrl} alt="" className="equip-stat-row__icon" />}
        {name}
      </span>
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
