import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import ToggleButtonGroup from '../components/ToggleButtonGroup';
import ToggleSwitch from '../components/ToggleSwitch';
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
// 負の値は入力させたくないため0未満は0にクランプする。
function toNumberInputProps(value: number, onChange: (v: number) => void) {
  return {
    min: 0,
    value: value === 0 ? '' : value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(e.target.value);
      onChange(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
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

  // ダメージ増強のON/OFFラベルは、スタック数Stepperの表示有無に関わらず共通のため切り出す。
  const dmgStackToggleLabel = (
    <label className="buff-effect-dialog__checkbox-label">
      <ToggleSwitch
        checked={cookingBuff.dmgStackEnabled}
        disabled={dmgStackLevel === 0}
        onChange={(checked) => onChange({ dmgStackEnabled: checked })}
      />
      <span>{t('buildPlanner.buffDialog.dmgStack')}</span>
    </label>
  );

  return (
    <DraggableDialog
      title={t('buildPlanner.buffDialog.title')}
      onClose={onClose}
      className="buff-effect-dialog"
    >
      <p className="buff-effect-dialog__save-notice">
        {t('buildPlanner.buffDialog.saveNotice')}
      </p>
      <div className="buff-effect-dialog__body">
        {/* 料理 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.cookingEnabled}
              onChange={(checked) => onChange({ cookingEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.cooking')}</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            className="buff-effect-dialog__input buff-effect-dialog__input--narrow"
            disabled={!cookingBuff.cookingEnabled}
            placeholder={atkLabel}
            {...toNumberInputProps(cookingBuff.cookingAtkValue, (v) =>
              onChange({ cookingAtkValue: v }),
            )}
          />
          <select
            className="buff-effect-dialog__select"
            disabled={!cookingBuff.cookingEnabled}
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
            <ToggleSwitch
              checked={cookingBuff.syrupEnabled}
              disabled={cookingBuff.starOilEnabled}
              onChange={(checked) => onChange({ syrupEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.syrup')}</span>
          </label>
          <select
            className="buff-effect-dialog__select buff-effect-dialog__select--narrow"
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
            inputMode="numeric"
            className="buff-effect-dialog__input buff-effect-dialog__input--narrow"
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
            <ToggleSwitch
              checked={cookingBuff.starOilEnabled}
              disabled={cookingBuff.syrupEnabled}
              onChange={(checked) => onChange({ starOilEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.starOil')}</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            className="buff-effect-dialog__input buff-effect-dialog__input--narrow"
            disabled={!cookingBuff.starOilEnabled}
            placeholder={damageEnhanceLabel}
            {...toNumberInputProps(cookingBuff.starOilValue, (v) => onChange({ starOilValue: v }))}
          />
        </div>

        {/* イベントバフ: 期間限定イベント等で付与されるメインステータスアップバフの汎用枠
            (旧・海風の宴を汎用化したもの。効果値は入力可能で、既定値のみ500を踏襲)。 */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.eventBuffEnabled}
              onChange={(checked) => onChange({ eventBuffEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.eventBuff')}</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            className="buff-effect-dialog__input buff-effect-dialog__input--narrow"
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
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.inspirationEnabled}
              onChange={(checked) => onChange({ inspirationEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.inspiration')}</span>
          </label>
          <div className="buff-effect-dialog__row-main">
            <ToggleButtonGroup
              options={['lifebind', 'smite'] as const}
              value={cookingBuff.inspirationVariant}
              getLabel={(v) =>
                t(
                  `buildPlanner.buffDialog.inspiration${v === 'lifebind' ? 'Lifebind' : 'Smite'}`,
                )
              }
              getDisabled={() => !cookingBuff.inspirationEnabled}
              onChange={(v) => v !== null && onChange({ inspirationVariant: v })}
            />
            <span className="buff-effect-dialog__hint buff-effect-dialog__hint--multiline">
              {t('buildPlanner.buffDialog.inspirationEffect', {
                mainStat: inspirationEffect.mainStat,
                percent: inspirationEffect.percent,
                physDef: inspirationEffect.physDef,
              })}
            </span>
          </div>
        </div>

        {/* 能力共鳴(Stat Resonance、響奏/Concerto) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.statResonanceEnabled}
              onChange={(checked) => onChange({ statResonanceEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.statResonance')}</span>
          </label>
          <div className="buff-effect-dialog__row-main">
            <input
              type="number"
              inputMode="numeric"
              className="buff-effect-dialog__input buff-effect-dialog__input--narrow"
              disabled={!cookingBuff.statResonanceEnabled}
              placeholder={t('buildPlanner.buffDialog.statResonanceBaseValue', {
                stat: mainStatLabel,
              })}
              {...toNumberInputProps(cookingBuff.statResonanceBaseValue, (v) =>
                onChange({ statResonanceBaseValue: v }),
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
            <span className="buff-effect-dialog__hint">
              {t('buildPlanner.buffDialog.statResonanceResult', {
                stat: mainStatLabel,
                value: statResonanceBonus.toLocaleString(),
              })}
            </span>
          </div>
        </div>

        {/* 幸運会心(モジュールパワーコア効果): 自分(2倍・Lv5以上発動時のみ)/被Lv5/被Lv6 */}
        <div className="buff-effect-dialog__row buff-effect-dialog__row--wrap">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.luckyCritEnabled}
              onChange={(checked) => onChange({ luckyCritEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.luckyCrit')}</span>
          </label>
          <div className="buff-effect-dialog__row-right">
            <ToggleButtonGroup
              options={['self', 'receivedLv5', 'receivedLv6'] as const}
              value={cookingBuff.luckyCritVariant}
              getLabel={(v) =>
                t(
                  `buildPlanner.buffDialog.luckyCrit${v === 'self' ? 'Self' : v === 'receivedLv5' ? 'ReceivedLv5' : 'ReceivedLv6'}`,
                )
              }
              getDisabled={(v) =>
                !cookingBuff.luckyCritEnabled || (v === 'self' && luckyCritOwnLevel === 0)
              }
              onChange={(v) => v !== null && onChange({ luckyCritVariant: v })}
            />
            <span className="buff-effect-dialog__hint">
              {t('buildPlanner.buffDialog.luckyCritEffect', {
                critDamage: luckyCritBonus.critDamage / 100,
                luckyDamage: luckyCritBonus.luckyDamage / 100,
              })}
            </span>
          </div>
        </div>

        {/* 極・HP変動(Life Wave、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.lifeWaveEnabled}
              disabled={lifeWaveLevel === 0}
              onChange={(checked) => onChange({ lifeWaveEnabled: checked })}
            />
            <span>{t('buildPlanner.buffDialog.lifeWave')}</span>
          </label>
          <span className="buff-effect-dialog__hint">
            {lifeWaveLevel === 0
              ? t('buildPlanner.buffDialog.powerCoreLocked')
              : t('buildPlanner.buffDialog.lifeWaveEffect', { value: lifeWaveBonus })}
          </span>
        </div>

        {/* 極・ダメージ増強(DMG Stack、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効。表示のみ、ステ計算対象外)
            モジュール未装備でスイッチが無効化されている間は、操作できないスタック数Stepperを
            非表示にし、他のパワーコア効果行(適応力等)と同じ「スイッチ+ヒントのみ」の
            表示に揃える。 */}
        {dmgStackLevel === 0 ? (
          <div className="buff-effect-dialog__row">
            {dmgStackToggleLabel}
            <span className="buff-effect-dialog__hint">
              {t('buildPlanner.buffDialog.powerCoreLocked')}
            </span>
          </div>
        ) : (
          <div className="buff-effect-dialog__row">
            <div className="buff-effect-dialog__row-main">
              {dmgStackToggleLabel}
              <span className="buff-effect-dialog__stack-label">
                {t('buildPlanner.buffDialog.dmgStackCount')}
              </span>
              <Stepper
                className="stepper-inline"
                modifierClassName={`buff-effect-dialog__stack-stepper${!cookingBuff.dmgStackEnabled ? ' buff-effect-dialog__stack-stepper--disabled' : ''}`}
                layout="inline"
                disableList
                value={cookingBuff.dmgStackCount}
                min={1}
                max={4}
                onChange={(v) => onChange({ dmgStackCount: v })}
              />
            </div>
            <span className="buff-effect-dialog__hint">
              {t('buildPlanner.buffDialog.dmgStackEffect', {
                value: dmgStackPercent.toFixed(2),
              })}
            </span>
          </div>
        )}

        {/* 極・適応力(Agile、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効) */}
        <div className="buff-effect-dialog__row">
          <label className="buff-effect-dialog__checkbox-label">
            <ToggleSwitch
              checked={cookingBuff.agileEnabled}
              disabled={agileLevel === 0}
              onChange={(checked) => onChange({ agileEnabled: checked })}
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
