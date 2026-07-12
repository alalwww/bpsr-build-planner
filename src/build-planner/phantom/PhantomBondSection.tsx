import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import Stepper from '../components/Stepper';
import { renderEffectDesc } from '../components/gameText';
import { stData } from './phantomData';

// 合計絆ポイントの入力 + 絆レベル効果一覧(折り畳み可能)。PhantomPanel から分離。

interface PhantomBondSectionProps {
  phantomTemplateId: number;
  phantomBondPoints: number;
  onBondPointsChange: (value: number) => void;
}

export default function PhantomBondSection({
  phantomTemplateId,
  phantomBondPoints,
  onBondPointsChange,
}: PhantomBondSectionProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const [bondEffectsOpen, setBondEffectsOpen] = useState(false);

  // 現在のテンプレートの絆レベル効果(レベル昇順)
  const bondLevelEffects = useMemo(() => {
    const tmpl = stData.templates[String(phantomTemplateId)];
    if (!tmpl) return [];
    const effectId = tmpl.advancedEffectId;
    return Object.values(stData.advancedEffects)
      .filter((ae) => ae.effectId === effectId)
      .sort((a, b) => a.level - b.level);
  }, [phantomTemplateId]);

  return (
    <div className="phantom-bond-section">
      <div className="phantom-bond-row">
        <span className="phantom-bond-label">{t('buildPlanner.phantom.bondPoints')}</span>
        <Stepper
          className="stepper-inline"
          layout="inline"
          value={phantomBondPoints}
          min={0}
          max={60}
          onChange={onBondPointsChange}
        />
      </div>
      {/* 絆レベル効果（折り畳み可能） */}
      {bondLevelEffects.length > 0 && (
        <div className="phantom-bond-effects">
          <button
            type="button"
            className="phantom-bond-effects-toggle"
            onClick={() => setBondEffectsOpen((v) => !v)}
          >
            <span>{t('buildPlanner.phantom.bondEffects')}</span>
            <Chevron open={bondEffectsOpen} />
          </button>
          {bondEffectsOpen && (
            <div className="phantom-bond-effects-list">
              {bondLevelEffects.map((ae) => {
                const isActive = phantomBondPoints >= ae.unlockFraction;
                const idx = ae.effects.findIndex((e) => e[0] === 3);
                const buffId = idx >= 0 ? ae.effects[idx][1] : null;
                const pars = idx >= 0 ? (ae.buffPars[idx] ?? []) : [];
                const tmplStr = buffId ? tg(`attrDescs.${buffId}`, { defaultValue: '' }) : '';
                const desc = tmplStr ? renderEffectDesc(tmplStr, pars) : '';
                return (
                  <div
                    key={ae.level}
                    className={`phantom-bond-effect${isActive ? ' phantom-bond-effect--active' : ''}`}
                  >
                    <span className="phantom-bond-effect-threshold">{ae.unlockFraction}pt</span>
                    <span className="phantom-bond-effect-desc">{desc || `Lv.${ae.level}`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
