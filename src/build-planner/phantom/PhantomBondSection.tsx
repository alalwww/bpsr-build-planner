import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import Stepper from '../components/Stepper';
import { renderEffectDesc } from '../components/gameText';
import { getUnlockLevel, stData } from './phantomData';

// 合計絆ポイントの入力 + 絆レベル効果一覧(折り畳み可能)。PhantomPanel から分離。

interface PhantomBondSectionProps {
  phantomTemplateId: number;
  phantomBondPoints: number;
  onBondPointsChange: (value: number) => void;
  /** 絆スロット1〜5の開放Lv表示(活性/非活性の色分け)に使う現在の潜在Lv。 */
  phantomLevel: number;
}

export default function PhantomBondSection({
  phantomTemplateId,
  phantomBondPoints,
  onBondPointsChange,
  phantomLevel,
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

  // 絆スロット1〜5(潜在Lvによる段階開放。実データ確認済み: 1=常時/2=Lv10/3=Lv25/4=Lv40/5=Lv60、
  // 全テンプレート共通)。スロット番号昇順。
  const bondSlots = useMemo(
    () =>
      Object.values(stData.bondSlots)
        .filter((s) => s.templateId === phantomTemplateId)
        .sort((a, b) => a.slotIndex - b.slotIndex),
    [phantomTemplateId],
  );

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
          {bondEffectsOpen && bondSlots.length > 0 && (
            <ul className="phantom-bond-slots-list">
              {bondSlots.map((slot) => {
                const requiredLevel = getUnlockLevel(slot.unlockCondition);
                const isActive = phantomLevel >= requiredLevel;
                return (
                  <li
                    key={slot.slotIndex}
                    className={`phantom-bond-slot${isActive ? ' phantom-bond-slot--active' : ''}`}
                  >
                    {requiredLevel > 0
                      ? t('buildPlanner.phantom.bondSlotLevel', {
                          index: slot.slotIndex,
                          level: requiredLevel,
                          defaultValue: `絆スロット${slot.slotIndex}: Lv.${requiredLevel}`,
                        })
                      : t('buildPlanner.phantom.bondSlotAlways', {
                          index: slot.slotIndex,
                          defaultValue: `絆スロット${slot.slotIndex}: 常時開放`,
                        })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
