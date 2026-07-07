import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import type { CookingBuffState, ModuleSlots } from '../types';
import { ELEMENT_IDS } from '../types';
import type { Profession } from '../profession';
import {
  ADAPTABILITY_VALUES,
  calcLuckyCritBonus,
  calcResonanceBonus,
  DAMAGE_BOOST_PER_STACK,
  HP_SHIFT_VALUES,
  MORALE_BOOST_VALUES,
  POWER_CORE_EFFECT_IDS,
  RESONANCE_MULTIPLIER_OPTIONS,
} from '../stats/cookingBuff';
import { getPowerCoreLevel } from '../stats/gameData';

interface BuffEffectDialogProps {
  cookingBuff: CookingBuffState;
  onChange: (patch: Partial<CookingBuffState>) => void;
  profession: Profession;
  onClose: () => void;
  moduleSlots: ModuleSlots;
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

function BuffEffectDialog({
  cookingBuff,
  onChange,
  profession,
  onClose,
  moduleSlots,
}: BuffEffectDialogProps) {
  const { t } = useTranslation();

  const atkLabel = t(`buildPlanner.stats.${profession.attackType === 'physical' ? 'atk' : 'matk'}`);
  const damageEnhanceLabel = t(
    `buildPlanner.buffDialog.${profession.attackType === 'physical' ? 'physicalDamageEnhance' : 'magicalDamageEnhance'}`,
  );
  const mainStatLabel = t(`buildPlanner.stats.${profession.mainStat}`);
  const moraleBoostEffect = MORALE_BOOST_VALUES[cookingBuff.moraleBoostVariant];
  const resonanceBonus = calcResonanceBonus(cookingBuff);

  // モジュールパネルで該当モジュールのパワーコア効果Lv5以上を発動しているか(0=未発動)。
  const luckyCritOwnLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.luckyCrit);
  const hpShiftLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.hpShift);
  const damageBoostLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.damageBoost);
  const adaptabilityLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.adaptability);

  const luckyCritBonus = calcLuckyCritBonus(cookingBuff, luckyCritOwnLevel);
  const hpShiftBonus = hpShiftLevel !== 0 ? HP_SHIFT_VALUES[hpShiftLevel] : 0;
  const damageBoostPercent =
    damageBoostLevel !== 0
      ? DAMAGE_BOOST_PER_STACK[damageBoostLevel] * cookingBuff.damageBoostStacks
      : 0;
  const adaptabilityEffect = adaptabilityLevel !== 0 ? ADAPTABILITY_VALUES[adaptabilityLevel] : null;

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

        {/* 幸運会心(モジュールパワーコア効果): 自分(2倍・Lv5以上発動時のみ)/被Lv5/被Lv6 */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.luckyCritEnabled}
                onChange={(e) => onChange({ luckyCritEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.luckyCrit')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="luckyCritVariant"
                disabled={!cookingBuff.luckyCritEnabled || luckyCritOwnLevel === 0}
                checked={cookingBuff.luckyCritVariant === 'self'}
                onChange={() => onChange({ luckyCritVariant: 'self' })}
              />
              <span>{t('buildPlanner.buffDialog.luckyCritSelf')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="luckyCritVariant"
                disabled={!cookingBuff.luckyCritEnabled}
                checked={cookingBuff.luckyCritVariant === 'receivedLv5'}
                onChange={() => onChange({ luckyCritVariant: 'receivedLv5' })}
              />
              <span>{t('buildPlanner.buffDialog.luckyCritReceivedLv5')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="luckyCritVariant"
                disabled={!cookingBuff.luckyCritEnabled}
                checked={cookingBuff.luckyCritVariant === 'receivedLv6'}
                onChange={() => onChange({ luckyCritVariant: 'receivedLv6' })}
              />
              <span>{t('buildPlanner.buffDialog.luckyCritReceivedLv6')}</span>
            </label>
          </div>
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.luckyCritEffect', {
              critDamage: luckyCritBonus.critDamage / 100,
              luckyDamage: luckyCritBonus.luckyDamage / 100,
            })}
          </span>
        </div>

        {/* HP変動(モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.hpShiftEnabled}
              disabled={hpShiftLevel === 0}
              onChange={(e) => onChange({ hpShiftEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.hpShift')}</span>
          </label>
          <span className="buff-effect-dialog__hint">
            {hpShiftLevel === 0
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.hpShiftEffect', { value: hpShiftBonus })}
          </span>
        </div>

        {/* ダメージ増強(モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効。表示のみ、ステ計算対象外) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.damageBoostEnabled}
                disabled={damageBoostLevel === 0}
                onChange={(e) => onChange({ damageBoostEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.damageBoost')}</span>
            </label>
            <span className="buff-effect-dialog__stack-label">
              {t('buildPlanner.buffDialog.damageBoostStacks')}
            </span>
            <Stepper
              className="phantom-stepper"
              modifierClassName={`buff-effect-dialog__stack-stepper${!cookingBuff.damageBoostEnabled || damageBoostLevel === 0 ? ' buff-effect-dialog__stack-stepper--disabled' : ''}`}
              layout="inline"
              disableList
              value={cookingBuff.damageBoostStacks}
              min={1}
              max={4}
              onChange={(v) => onChange({ damageBoostStacks: v })}
            />
          </div>
          <span className="buff-effect-dialog__hint">
            {damageBoostLevel === 0
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.damageBoostEffect', {
                  value: damageBoostPercent.toFixed(2),
                })}
          </span>
        </div>

        {/* 適応力(モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.adaptabilityEnabled}
              disabled={adaptabilityLevel === 0}
              onChange={(e) => onChange({ adaptabilityEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.adaptability')}</span>
          </label>
          <span className="buff-effect-dialog__hint">
            {!adaptabilityEffect
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.adaptabilityEffect', {
                  moveSpeed: adaptabilityEffect.moveSpeed,
                  atk: adaptabilityEffect.atkMultPercent,
                })}
          </span>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default BuffEffectDialog;
