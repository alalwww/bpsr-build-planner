import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModuleSlots } from '../types';
import { calcGlobalLink, MOD_ATTR_TO_STAT, modulesData } from './moduleData';

// 全体リンク数ボーナス(左=大きなリンク数値、右=ステータス一覧の2カラム表示)
function LinkBonusSection({ moduleSlots }: { moduleSlots: ModuleSlots }) {
  const { t } = useTranslation();

  const globalLink = useMemo(() => calcGlobalLink(moduleSlots), [moduleSlots]);

  const currentRow = useMemo(() => {
    if (globalLink === 0) return null;
    return [...modulesData.linkEffects].reverse().find(([lt]) => lt <= globalLink) ?? null;
  }, [globalLink]);

  if (!currentRow || currentRow[0] === 0) return null;

  const [, , currentStats] = currentRow;
  const statRows = currentStats.filter(([et]) => et === 1);

  return (
    <div className="module-link-bonus">
      <div className="module-link-bonus__left">
        <div className="module-link-bonus__title">{t('buildPlanner.module.linkEffectTitle')}</div>
        <div className="module-link-bonus__value">{globalLink}</div>
      </div>
      <div className="module-link-bonus__right">
        {statRows.map(([, attrId, val], i) => {
          const sid = MOD_ATTR_TO_STAT[attrId];
          if (!sid) return null;
          return (
            <div key={i} className="module-link-bonus__row">
              <span className="module-link-bonus__stat-name">{t(`buildPlanner.stats.${sid}`)}</span>
              <span className="module-link-bonus__stat-value">+{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LinkBonusSection;
