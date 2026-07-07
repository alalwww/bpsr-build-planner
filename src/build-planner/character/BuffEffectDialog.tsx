import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import type { CookingBuffState } from '../types';
import { ELEMENT_IDS } from '../types';
import type { Profession } from '../profession';
import {
  calcResonanceBonus,
  MORALE_BOOST_VALUES,
  RESONANCE_MULTIPLIER_OPTIONS,
} from '../stats/cookingBuff';

interface BuffEffectDialogProps {
  cookingBuff: CookingBuffState;
  onChange: (patch: Partial<CookingBuffState>) => void;
  profession: Profession;
  onClose: () => void;
}

// number入力の共通ヘルパー: 0は空欄表示にし、入力値はNumberでパースする(NaNは0扱い)。
function toNumberInputProps(value: number, onChange: (v: number) => void) {
  return {
    value: value === 0 ? '' : value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(e.target.value);
      onChange(Number.isNaN(parsed) ? 0 : parsed);
    },
  };
}

function BuffEffectDialog({ cookingBuff, onChange, profession, onClose }: BuffEffectDialogProps) {
  const { t } = useTranslation();

  const atkLabel = t(`buildPlanner.stats.${profession.attackType === 'physical' ? 'atk' : 'matk'}`);
  const damageEnhanceLabel = t(
    `buildPlanner.buffDialog.${profession.attackType === 'physical' ? 'physicalDamageEnhance' : 'magicalDamageEnhance'}`,
  );
  const mainStatLabel = t(`buildPlanner.stats.${profession.mainStat}`);
  const moraleBoostEffect = MORALE_BOOST_VALUES[cookingBuff.moraleBoostVariant];
  const resonanceBonus = calcResonanceBonus(cookingBuff);

  return (
    <DraggableDialog
      title={t('buildPlanner.buffDialog.title')}
      onClose={onClose}
      className="buff-effect-dialog"
    >
      <div className="buff-effect-dialog__body">
        {/* 料理 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.cookingEnabled}
              onChange={(e) => onChange({ cookingEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.cooking')}</span>
          </label>
          <input
            type="number"
            className="buff-effect-dialog__input"
            disabled={!cookingBuff.cookingEnabled}
            placeholder={atkLabel}
            {...toNumberInputProps(cookingBuff.cookingAtkValue, (v) =>
              onChange({ cookingAtkValue: v }),
            )}
          />
          <input
            type="number"
            className="buff-effect-dialog__input"
            disabled
            title={t('buildPlanner.buffDialog.eliteDamage')}
            placeholder={`${t('buildPlanner.buffDialog.eliteDamage')}%`}
            {...toNumberInputProps(cookingBuff.cookingEliteDamagePercent, (v) =>
              onChange({ cookingEliteDamagePercent: v }),
            )}
          />
        </div>

        {/* シロップ/脊椎試薬 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.syrupEnabled}
              disabled={cookingBuff.starOilEnabled}
              onChange={(e) => onChange({ syrupEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.syrup')}</span>
          </label>
          <select
            className="buff-effect-dialog__select"
            disabled={!cookingBuff.syrupEnabled}
            value={cookingBuff.syrupElement}
            onChange={(e) =>
              onChange({ syrupElement: e.target.value as CookingBuffState['syrupElement'] })
            }
          >
            {ELEMENT_IDS.map((elem) => (
              <option key={elem} value={elem}>
                {t(`buildPlanner.detailStats.elem.${elem}`)}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="buff-effect-dialog__input"
            disabled={!cookingBuff.syrupEnabled}
            placeholder={t('buildPlanner.buffDialog.elementStrength')}
            {...toNumberInputProps(cookingBuff.syrupElementStrength, (v) =>
              onChange({ syrupElementStrength: v }),
            )}
          />
        </div>

        {/* スターオイル */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.starOilEnabled}
              disabled={cookingBuff.syrupEnabled}
              onChange={(e) => onChange({ starOilEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.starOil')}</span>
          </label>
          <input
            type="number"
            className="buff-effect-dialog__input"
            disabled={!cookingBuff.starOilEnabled}
            placeholder={damageEnhanceLabel}
            {...toNumberInputProps(cookingBuff.starOilValue, (v) => onChange({ starOilValue: v }))}
          />
        </div>

        {/* 海風の宴 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.seaBreezeEnabled}
              onChange={(e) => onChange({ seaBreezeEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.seaBreeze')}</span>
          </label>
        </div>

        {/* 鼓舞: 森癒/威咲(排他選択) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.moraleBoostEnabled}
                onChange={(e) => onChange({ moraleBoostEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.moraleBoost')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="moraleBoostVariant"
                disabled={!cookingBuff.moraleBoostEnabled}
                checked={cookingBuff.moraleBoostVariant === 'forestHeal'}
                onChange={() => onChange({ moraleBoostVariant: 'forestHeal' })}
              />
              <span>{t('buildPlanner.buffDialog.moraleBoostForestHeal')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="moraleBoostVariant"
                disabled={!cookingBuff.moraleBoostEnabled}
                checked={cookingBuff.moraleBoostVariant === 'mightBloom'}
                onChange={() => onChange({ moraleBoostVariant: 'mightBloom' })}
              />
              <span>{t('buildPlanner.buffDialog.moraleBoostMightBloom')}</span>
            </label>
          </div>
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.moraleBoostEffect', {
              mainStat: moraleBoostEffect.mainStat,
              percent: moraleBoostEffect.percent,
            })}
          </span>
        </div>

        {/* 能力共鳴(響奏) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.resonanceEnabled}
                onChange={(e) => onChange({ resonanceEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.resonance')}</span>
            </label>
            <input
              type="number"
              className="buff-effect-dialog__input"
              disabled={!cookingBuff.resonanceEnabled}
              placeholder={t('buildPlanner.buffDialog.resonanceBaseValue', { stat: mainStatLabel })}
              {...toNumberInputProps(cookingBuff.resonanceBaseValue, (v) =>
                onChange({ resonanceBaseValue: Math.max(0, v) }),
              )}
            /> x
            <select
              className="buff-effect-dialog__select"
              disabled={!cookingBuff.resonanceEnabled}
              title={t('buildPlanner.buffDialog.resonanceMultiplier')}
              value={cookingBuff.resonanceMultiplierPercent}
              onChange={(e) => onChange({ resonanceMultiplierPercent: Number(e.target.value) })}
            >
              {RESONANCE_MULTIPLIER_OPTIONS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </div>
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.resonanceResult', {
              stat: mainStatLabel,
              value: resonanceBonus.toLocaleString(),
            })}
          </span>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default BuffEffectDialog;
