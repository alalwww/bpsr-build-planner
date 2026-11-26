import { useTranslation } from 'react-i18next';
import type { PhantomFactorSlotValue } from './phantomData';
import { factorShortName, getFactorIcon } from './phantomView';

export interface FactorSlotProps {
  current: PhantomFactorSlotValue | null;
  /** 未装着時に表示するレベル。 */
  pendingLevel: number;
  onOpen: () => void;
}

// 因子スロットの固定枠(アイコン・因子名・レベル)。クリックで因子設定ダイアログを開く。
// 埋め込み済みの映痕の数も添える。
function FactorSlot({ current, pendingLevel, onOpen }: FactorSlotProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const icon = current ? getFactorIcon(current.classKey) : '';
  const affixCount = current?.affixes?.filter((a) => a != null).length ?? 0;

  return (
    <button
      type="button"
      className={`phantom-factor-frame${current ? '' : ' phantom-factor-frame--empty'}`}
      onClick={onOpen}
    >
      {icon ? (
        <img src={icon} className="phantom-factor-frame__icon" alt="" />
      ) : (
        <span className="phantom-factor-frame__icon phantom-factor-frame__icon--empty" />
      )}
      <span className="phantom-factor-frame__name">
        {current
          ? factorShortName(tg, current.classKey)
          : t('buildPlanner.phantom.factorUnequipped')}
      </span>
      {affixCount > 0 && (
        <span className="phantom-factor-frame__affixes">
          {t('buildPlanner.phantom.affixCount', { count: affixCount })}
        </span>
      )}
      <span className="phantom-factor-frame__level">G{current?.grade ?? pendingLevel}</span>
    </button>
  );
}

export default FactorSlot;
