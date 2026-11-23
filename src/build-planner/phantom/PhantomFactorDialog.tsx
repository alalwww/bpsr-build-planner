import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import type { PhantomAffixValue, PhantomFactorSlotValue } from './phantomData';
import { MAX_FACTOR_GRADE } from './phantomData';
import {
  AFFIX_FIXED_QUALITY,
  affixEffectText,
  affixInputToValue,
  affixLabel,
  affixQualityName,
  affixValueToInput,
  affixWithQuality,
  clampAffixValue,
  defaultAffixValue,
  formatAffixValue,
  getActiveAffixEffects,
  getAffixGroup,
  getAffixGroupsForSlot,
  getAffixQualityColor,
  getAffixQualityRange,
  getEmbedSlots,
  getMaxEmbedSlotCount,
  getSlotUnlockGrade,
  factorWithAffixes,
  withFactorClass,
  withFactorGrade,
} from './phantomAffixData';
import {
  factorBaseName,
  getFactorBaseOptions,
  getFactorEffectDesc,
  getFactorIcon,
  getNodeIcon,
  type GameDataT,
} from './phantomView';
import '../equipment/equipment.css';

// 因子スロット(ノード)に装着する因子と、その因子に埋め込む映痕を設定するダイアログ。
// 構成は装備選択ダイアログに合わせ、左列に因子(プレビュー/選択/グレード/効果)、
// 中央列に映痕スロット(グレードに応じて開放、2〜4個)を並べる。

interface PhantomFactorDialogProps {
  groupId: number;
  current: PhantomFactorSlotValue | null;
  /** 因子未装着時のグレード(装着時の初期グレード)。 */
  pendingGrade: number;
  onPendingGradeChange: (grade: number) => void;
  professionId: number;
  /** ツリー全体(全因子)で2つ以上選ばれている重複不可の映痕の group。該当スロットに警告を出す。 */
  duplicatedNonStackingGroups: ReadonlySet<number>;
  onSet: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
  onClose: () => void;
}

export default function PhantomFactorDialog({
  groupId,
  current,
  pendingGrade,
  onPendingGradeChange,
  professionId,
  duplicatedNonStackingGroups,
  onSet,
  onClose,
}: PhantomFactorDialogProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const grade = current?.grade ?? pendingGrade;

  const factorOptions = useMemo(
    () =>
      getFactorBaseOptions(tg, groupId, professionId).map((opt) => ({
        ...opt,
        description: getFactorEffectDesc(tg, opt.value, grade),
      })),
    [tg, groupId, professionId, grade],
  );

  const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
  const slotIcon = getNodeIcon(groupId, 2);
  const factorIcon = current ? getFactorIcon(current.classKey) : '';

  const setGrade = (g: number) => {
    if (current) onSet(groupId, withFactorGrade(current, g));
    else onPendingGradeChange(g);
  };

  const setAffix = (index: number, affix: PhantomAffixValue | null) => {
    if (!current) return;
    const affixes = [...(current.affixes ?? [])];
    while (affixes.length <= index) affixes.push(null);
    affixes[index] = affix;
    onSet(groupId, factorWithAffixes(current.classKey, current.grade, affixes));
  };

  const embedSlots = current ? getEmbedSlots(current.classKey, current.grade) : [];
  const maxSlotCount = current ? getMaxEmbedSlotCount(current.classKey) : 0;
  // 映痕の効果(同種は合計、重複不可は最大値)。現在のグレードで開放されているスロットの分のみ。
  const affixEffects = getActiveAffixEffects(current);

  return (
    <DraggableDialog
      title={t('buildPlanner.phantom.factorDialogTitle', { slot: slotName })}
      onClose={onClose}
      className="phantom-factor-dialog"
    >
      <div className="equipment-dialog__columns">
        <div className="equipment-dialog__col-left">
          <div className="phantom-factor-dialog__preview">
            {slotIcon && <img className="phantom-factor-dialog__slot-icon" src={slotIcon} alt="" />}
            {factorIcon && (
              <img className="phantom-factor-dialog__factor-icon" src={factorIcon} alt="" />
            )}
            <div className="phantom-factor-dialog__preview-text">
              <span className="phantom-factor-dialog__slot-name">{slotName}</span>
              <span className="phantom-factor-dialog__factor-name">
                {current
                  ? `${factorBaseName(tg, current.classKey)} G${current.grade}`
                  : t('buildPlanner.phantom.factorUnequipped')}
              </span>
            </div>
          </div>

          <div className="equip-details-section">
            <label className="equipment-dialog__label">
              {t('buildPlanner.phantom.factorSelect')}
            </label>
            <CustomDropdown
              className="phantom-factor-dropdown"
              options={factorOptions}
              value={current?.classKey ?? ''}
              placeholder={t('buildPlanner.phantom.factorUnequipped')}
              onChange={(v) => onSet(groupId, v === '' ? null : withFactorClass(current, v, grade))}
            />
          </div>

          <div className="equip-details-section">
            <label className="equipment-dialog__label">
              {t('buildPlanner.phantom.factorGrade')}
            </label>
            <div className="phantom-factor-dialog__grades" role="radiogroup">
              {Array.from({ length: MAX_FACTOR_GRADE }, (_, i) => i + 1).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={g === grade}
                  className={`phantom-factor-dialog__grade${g === grade ? ' phantom-factor-dialog__grade--active' : ''}`}
                  onClick={() => setGrade(g)}
                >
                  G{g}
                </button>
              ))}
            </div>
          </div>

          <section className="equip-details-section">
            <h3 className="equip-details-section__heading">
              {t('buildPlanner.phantom.factorEffect')}
            </h3>
            <p className="phantom-factor-dialog__desc">
              {current ? getFactorEffectDesc(tg, current.classKey, current.grade) : '---'}
            </p>
          </section>

          <section className="equip-details-section">
            <h3 className="equip-details-section__heading">
              {t('buildPlanner.phantom.affixEffect')}
            </h3>
            {affixEffects.length > 0 ? (
              <ul className="phantom-factor-dialog__affix-effects">
                {affixEffects.map((a) => (
                  <li key={a.group}>{affixEffectText(tg, a)}</li>
                ))}
              </ul>
            ) : (
              <p className="phantom-factor-dialog__placeholder">---</p>
            )}
          </section>
        </div>

        <div className="equipment-dialog__col-center">
          <section className="equip-details-section">
            <h3 className="equip-details-section__heading">
              {t('buildPlanner.phantom.affixHeading')}
            </h3>
            {!current && (
              <p className="phantom-factor-dialog__placeholder">
                {t('buildPlanner.phantom.affixNeedFactor')}
              </p>
            )}
          </section>
          {current &&
            Array.from({ length: maxSlotCount }, (_, i) => {
              // 未開放のスロットに残っている映痕は表示しない(グレード変更時に詰め直し済み)。
              const affix = i < embedSlots.length ? (current.affixes?.[i] ?? null) : null;
              return (
                <AffixSlotEditor
                  key={`${current.classKey}-${current.grade}-${i}`}
                  tg={tg}
                  index={i}
                  slotTypes={embedSlots[i]}
                  unlockGrade={getSlotUnlockGrade(current.classKey, i)}
                  nonStackingDuplicate={
                    affix != null && duplicatedNonStackingGroups.has(affix.group)
                  }
                  affix={affix}
                  professionId={professionId}
                  onChange={(next) => setAffix(i, next)}
                />
              );
            })}
        </div>
      </div>
    </DraggableDialog>
  );
}

interface AffixSlotEditorProps {
  tg: GameDataT;
  index: number;
  /** 埋め込める AffixType。undefined は現在のグレードでは未開放のスロット。 */
  slotTypes: number[] | undefined;
  unlockGrade: number | null;
  /** 重複不可の映痕が、このツリーの他のスロット(他の因子を含む)と重なっている。 */
  nonStackingDuplicate: boolean;
  affix: PhantomAffixValue | null;
  professionId: number;
  onChange: (affix: PhantomAffixValue | null) => void;
}

// 映痕スロット1つ分: 映痕の選択 → 品質の選択 + 効果値の入力(単位は映痕に合わせて%/実数)。
function AffixSlotEditor({
  tg,
  index,
  slotTypes,
  unlockGrade,
  nonStackingDuplicate,
  affix,
  professionId,
  onChange,
}: AffixSlotEditorProps) {
  const { t } = useTranslation();
  const locked = slotTypes === undefined;

  const typeLabel = locked
    ? t('buildPlanner.phantom.affixLocked', { grade: unlockGrade ?? '?' })
    : slotTypes.map((type) => t(`buildPlanner.phantom.affixSlotType.${type}`)).join(' / ');

  const options: DropdownOption[] = useMemo(
    () =>
      locked
        ? []
        : getAffixGroupsForSlot(slotTypes, professionId).map((g) => ({
            value: String(g.group),
            label: affixLabel(tg, g.group),
            group: t(`buildPlanner.phantom.affixLib.${g.libId}`),
          })),
    [locked, slotTypes, professionId, tg, t],
  );

  const group = affix ? getAffixGroup(affix.group) : undefined;
  // 現在のクラス以外のクラス映痕(クラス変更前に設定したもの)も、選択中の表示が消えないよう候補に残す。
  const shownOptions =
    affix && !options.some((o) => o.value === String(affix.group))
      ? [...options, { value: String(affix.group), label: affixLabel(tg, affix.group) }]
      : options;

  return (
    <section
      className={`equip-details-section phantom-affix-slot${locked ? ' phantom-affix-slot--locked' : ''}`}
    >
      <div className="phantom-affix-slot__heading">
        <span className="phantom-affix-slot__num">
          {t('buildPlanner.phantom.affixSlot', { n: index + 1 })}
        </span>
        <span className="phantom-affix-slot__type">{typeLabel}</span>
        {nonStackingDuplicate && (
          <span
            className="phantom-affix-slot__warning"
            title={t('buildPlanner.phantom.affixNonStackingWarning')}
          >
            ⚠ {t('buildPlanner.phantom.affixNonStackingShort')}
          </span>
        )}
      </div>
      {!locked && (
        <>
          <CustomDropdown
            className="phantom-affix-dropdown"
            options={shownOptions}
            value={affix ? String(affix.group) : ''}
            placeholder={t('buildPlanner.phantom.affixNone')}
            selectedColor={affix ? getAffixQualityColor(affix.quality) : undefined}
            onChange={(v) => onChange(v === '' ? null : defaultAffixValue(Number(v)))}
          />
          {affix && group && (
            <div className="phantom-affix-slot__value-row">
              <select
                className="phantom-affix-slot__quality"
                style={{ color: getAffixQualityColor(affix.quality) }}
                value={affix.quality}
                onChange={(e) => onChange(affixWithQuality(affix, Number(e.target.value)))}
              >
                {group.qualities.map((q) => (
                  <option
                    key={q.quality}
                    value={q.quality}
                    style={{ color: getAffixQualityColor(q.quality) }}
                  >
                    {affixQualityName(t, tg, q.quality)}
                  </option>
                ))}
              </select>
              <AffixValueInput affix={affix} onChange={onChange} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

// 効果値の入力欄。入力中は文字列のまま保持し、確定(フォーカスアウト/Enter)時にその品質の
// 範囲へ丸める。最高品質(不朽)は1段階のみのため編集不可。
function AffixValueInput({
  affix,
  onChange,
}: {
  affix: PhantomAffixValue;
  onChange: (affix: PhantomAffixValue) => void;
}) {
  const { t } = useTranslation();
  const group = getAffixGroup(affix.group);
  const unit = group?.unit ?? 'flat';
  const range = getAffixQualityRange(affix.group, affix.quality);
  const committed = String(affixValueToInput(unit, affix.value));
  const [draft, setDraft] = useState<string | null>(null);
  const readOnly = affix.quality === AFFIX_FIXED_QUALITY;

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(n)) return;
    onChange(clampAffixValue(affix, affixInputToValue(unit, n)));
  };

  return (
    <label className="phantom-affix-slot__value">
      <input
        type="number"
        className="phantom-affix-slot__input"
        value={draft ?? committed}
        step={unit === 'percent' ? 0.01 : 1}
        min={range ? affixValueToInput(unit, range.min) : undefined}
        max={range ? affixValueToInput(unit, range.max) : undefined}
        readOnly={readOnly}
        aria-label={t('buildPlanner.phantom.affixValue')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      {unit === 'percent' && <span className="phantom-affix-slot__unit">%</span>}
      {range && (
        <span className="phantom-affix-slot__range">
          {range.min === range.max
            ? formatAffixValue(unit, range.max)
            : `${formatAffixValue(unit, range.min)} 〜 ${formatAffixValue(unit, range.max)}`}
        </span>
      )}
    </label>
  );
}
