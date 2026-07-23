import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import type { CookingBuffState, ModuleSlots } from '../types';
import { ELEMENT_IDS } from '../types';
import type { Profession } from '../profession';
import {
  AGILE_VALUES,
  calcLuckyCritBonus,
  calcStatResonanceBonus,
  DMG_STACK_PER_STACK,
  ELITE_DAMAGE_OPTIONS,
  INSPIRATION_VALUES,
  LIFE_WAVE_VALUES,
  POWER_CORE_EFFECT_IDS,
  STAT_RESONANCE_MULTIPLIER_OPTIONS,
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
  const inspirationEffect = INSPIRATION_VALUES[cookingBuff.inspirationVariant];
  const statResonanceBonus = calcStatResonanceBonus(cookingBuff);

  // モジュールパネルで該当モジュールのパワーコア効果Lv5以上を発動しているか(0=未発動)。
  const luckyCritOwnLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.luckyCrit);
  const lifeWaveLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.lifeWave);
  const dmgStackLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.dmgStack);
  const agileLevel = getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.agile);

  const luckyCritBonus = calcLuckyCritBonus(cookingBuff, luckyCritOwnLevel);
  const lifeWaveBonus = lifeWaveLevel !== 0 ? LIFE_WAVE_VALUES[lifeWaveLevel] : 0;
  const dmgStackPercent =
    dmgStackLevel !== 0 ? DMG_STACK_PER_STACK[dmgStackLevel] * cookingBuff.dmgStackCount : 0;
  const agileEffect = agileLevel !== 0 ? AGILE_VALUES[agileLevel] : null;

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
          <select
            className="buff-effect-dialog__select"
            title={t('buildPlanner.buffDialog.eliteDamage')}
            value={cookingBuff.cookingEliteDamagePercent}
            onChange={(e) => onChange({ cookingEliteDamagePercent: Number(e.target.value) })}
          >
            {ELITE_DAMAGE_OPTIONS.map((pct) => (
              <option key={pct} value={pct}>
                {pct === 0 ? '0%' : `+${pct}%`}
              </option>
            ))}
          </select>
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

        {/* イベントバフ: 期間限定イベント等で付与されるメインステータスアップバフの汎用枠
            (旧・海風の宴を汎用化したもの。効果値は入力可能で、既定値のみ500を踏襲)。 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.eventBuffEnabled}
              onChange={(e) => onChange({ eventBuffEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.eventBuff')}</span>
          </label>
          <input
            type="number"
            className="buff-effect-dialog__input"
            disabled={!cookingBuff.eventBuffEnabled}
            {...toNumberInputProps(cookingBuff.eventBuffValue, (v) =>
              onChange({ eventBuffValue: v }),
            )}
          />
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.eventBuffHint', { stat: mainStatLabel })}
          </span>
        </div>

        {/* 鼓舞(Inspiration): 森癒(Lifebind)/威咲(Smite)(排他選択) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.inspirationEnabled}
                onChange={(e) => onChange({ inspirationEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.inspiration')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="inspirationVariant"
                disabled={!cookingBuff.inspirationEnabled}
                checked={cookingBuff.inspirationVariant === 'lifebind'}
                onChange={() => onChange({ inspirationVariant: 'lifebind' })}
              />
              <span>{t('buildPlanner.buffDialog.inspirationLifebind')}</span>
            </label>
            <label className="buff-effect-dialog__radio-label">
              <input
                type="radio"
                name="inspirationVariant"
                disabled={!cookingBuff.inspirationEnabled}
                checked={cookingBuff.inspirationVariant === 'smite'}
                onChange={() => onChange({ inspirationVariant: 'smite' })}
              />
              <span>{t('buildPlanner.buffDialog.inspirationSmite')}</span>
            </label>
          </div>
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.inspirationEffect', {
              mainStat: inspirationEffect.mainStat,
              percent: inspirationEffect.percent,
            })}
          </span>
        </div>

        {/* 能力共鳴(Stat Resonance、響奏/Concerto) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.statResonanceEnabled}
                onChange={(e) => onChange({ statResonanceEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.statResonance')}</span>
            </label>
            <input
              type="number"
              className="buff-effect-dialog__input"
              disabled={!cookingBuff.statResonanceEnabled}
              placeholder={t('buildPlanner.buffDialog.statResonanceBaseValue', {
                stat: mainStatLabel,
              })}
              {...toNumberInputProps(cookingBuff.statResonanceBaseValue, (v) =>
                onChange({ statResonanceBaseValue: Math.max(0, v) }),
              )}
            />{' '}
            x
            <select
              className="buff-effect-dialog__select"
              disabled={!cookingBuff.statResonanceEnabled}
              title={t('buildPlanner.buffDialog.statResonanceMultiplier')}
              value={cookingBuff.statResonanceMultiplierPercent}
              onChange={(e) => onChange({ statResonanceMultiplierPercent: Number(e.target.value) })}
            >
              {STAT_RESONANCE_MULTIPLIER_OPTIONS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </div>
          <span className="buff-effect-dialog__hint">
            {t('buildPlanner.buffDialog.statResonanceResult', {
              stat: mainStatLabel,
              value: statResonanceBonus.toLocaleString(),
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

        {/* 極・HP変動(Life Wave、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.lifeWaveEnabled}
              disabled={lifeWaveLevel === 0}
              onChange={(e) => onChange({ lifeWaveEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.lifeWave')}</span>
          </label>
          <span className="buff-effect-dialog__hint">
            {lifeWaveLevel === 0
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.lifeWaveEffect', { value: lifeWaveBonus })}
          </span>
        </div>

        {/* 極・ダメージ増強(DMG Stack、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効。表示のみ、ステ計算対象外) */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <div className="buff-effect-dialog__row-main">
            <label className="buff-effect-dialog__checkbox-label">
              <input
                type="checkbox"
                checked={cookingBuff.dmgStackEnabled}
                disabled={dmgStackLevel === 0}
                onChange={(e) => onChange({ dmgStackEnabled: e.target.checked })}
              />
              <span>{t('buildPlanner.buffDialog.dmgStack')}</span>
            </label>
            <span className="buff-effect-dialog__stack-label">
              {t('buildPlanner.buffDialog.dmgStackCount')}
            </span>
            <Stepper
              className="stepper-inline"
              modifierClassName={`buff-effect-dialog__stack-stepper${!cookingBuff.dmgStackEnabled || dmgStackLevel === 0 ? ' buff-effect-dialog__stack-stepper--disabled' : ''}`}
              layout="inline"
              disableList
              value={cookingBuff.dmgStackCount}
              min={1}
              max={4}
              onChange={(v) => onChange({ dmgStackCount: v })}
            />
          </div>
          <span className="buff-effect-dialog__hint">
            {dmgStackLevel === 0
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.dmgStackEffect', {
                  value: dmgStackPercent.toFixed(2),
                })}
          </span>
        </div>

        {/* 極・適応力(Agile、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={cookingBuff.agileEnabled}
              disabled={agileLevel === 0}
              onChange={(e) => onChange({ agileEnabled: e.target.checked })}
            />
            <span>{t('buildPlanner.buffDialog.agile')}</span>
          </label>
          <span className="buff-effect-dialog__hint">
            {!agileEffect
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.agileEffect', {
                  moveSpeed: agileEffect.moveSpeed,
                  atk: agileEffect.atkMultPercent,
                })}
          </span>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default BuffEffectDialog;
