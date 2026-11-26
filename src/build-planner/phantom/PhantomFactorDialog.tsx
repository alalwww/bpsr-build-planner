import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderMarkup } from '../components/renderMarkup';
import ConfirmDialog from '../components/ConfirmDialog';
import DraggableDialog from '../components/DraggableDialog';
import SelectDropdown from '../components/SelectDropdown';
import { PROFESSIONS } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import AffixPresetBar from './AffixPresetBar';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';
import type { PhantomAffixValue, PhantomFactorSlotValue } from './phantomData';
import { MAX_FACTOR_LEVEL } from './phantomData';
import {
  AFFIX_FIXED_QUALITY,
  AFFIX_QUALITIES,
  affixEffectMarkup,
  affixInputToValue,
  affixLabel,
  affixQualityName,
  affixValueToInput,
  affixWithQuality,
  clampAffixValue,
  countAffixesLostByLevelChange,
  defaultAffixValue,
  formatAffixValue,
  getActiveAffixEffects,
  getAffixGroup,
  getAffixGroupsForSlot,
  getAffixQualityColor,
  getAffixQualityRange,
  getFactorProfessionId,
  getEmbedSlots,
  getMaxEmbedSlotCount,
  getSlotUnlockLevel,
  factorWithAffixes,
  withFactorClass,
  withAffixQualities,
  withFactorLevel,
} from './phantomAffixData';
import {
  factorDetailLines,
  factorShortName,
  factorTalentSchool,
  getFactorBaseOptions,
  getFactorEffectDesc,
  getFactorEffectMarkup,
  getFactorIcon,
  getNodeIcon,
  type GameDataT,
} from './phantomView';
import '../equipment/equipment.css';

// 因子スロット(ノード)に装着する因子と、その因子に埋め込む映痕を設定するダイアログ。
// 構成は装備選択ダイアログに合わせ、左列に因子(プレビュー/選択/レベル/効果)、
// 中央列に映痕スロット(レベルに応じて開放、2〜4個)を並べる。

interface PhantomFactorDialogProps {
  groupId: number;
  current: PhantomFactorSlotValue | null;
  /** 因子未装着時のレベル(装着時の初期レベル)。 */
  pendingLevel: number;
  onPendingLevelChange: (level: number) => void;
  professionId: number;
  /** ツリー全体(全因子)で2つ以上選ばれている重複不可の映痕の group。該当スロットに警告を出す。 */
  duplicatedNonStackingGroups: ReadonlySet<number>;
  onSet: (groupId: number, factor: PhantomFactorSlotValue | null) => void;
  onClose: () => void;
  /** ヘッダーの切り替えボタンで直接移動できる因子スロット(ツリーに表示中のもの、ツリー順)。 */
  switchSlots: FactorSwitchSlot[];
  onSwitch: (groupId: number) => void;
}

export interface FactorSwitchSlot {
  groupId: number;
  /** ボタンのツールチップ(ノード番号+スロット名)。 */
  title: string;
  factor: PhantomFactorSlotValue | null;
}

export default function PhantomFactorDialog({
  groupId,
  current,
  pendingLevel,
  onPendingLevelChange,
  professionId,
  duplicatedNonStackingGroups,
  onSet,
  onClose,
  switchSlots,
  onSwitch,
}: PhantomFactorDialogProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const level = current?.grade ?? pendingLevel;

  const factorOptions = useMemo(
    () =>
      getFactorBaseOptions(
        tg,
        groupId,
        professionId,
        t('buildPlanner.phantom.factorClassUnrestricted'),
      ).map((opt) => ({
        ...opt,
        description: getFactorEffectDesc(tg, opt.value, level),
      })),
    [tg, t, groupId, professionId, level],
  );

  const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
  const slotIcon = getNodeIcon(groupId, 2);
  const factorIcon = current ? getFactorIcon(current.classKey) : '';
  // 特異点因子の型の所属と、キャラクターの現在の型(TalentSchoolId)との不一致。
  const factorSchool = current ? factorTalentSchool(tg, current.classKey) : null;
  const professionTypeKey = useBuildStore((s) => s.professionTypeKey);
  const currentProfession = Object.values(PROFESSIONS).find((p) => p.professionId === professionId);
  const currentSchoolId = currentProfession
    ? currentProfession.talentSchoolIds[professionTypeKey === 'type1' ? 0 : 1]
    : undefined;
  const schoolMismatch = factorSchool != null && factorSchool.id !== currentSchoolId;

  // レベルを下げて映痕が外れる場合は確認ダイアログを挟む(確認待ちのレベルと外れる数)。
  const [pendingLevelDown, setPendingLevelDown] = useState<{ level: number; lost: number } | null>(
    null,
  );

  // 映痕のレアリティ(品質)一括変更。選んだ値は全因子共通の「映痕を選んだときの既定の品質」として
  // 覚えておく(store)。品質が変わる映痕がある場合は、効果値がリセットされる旨を確認してから反映する。
  const affixDefaultQuality = useBuildStore((s) => s.affixDefaultQuality);
  const setAffixDefaultQuality = useBuildStore((s) => s.setAffixDefaultQuality);
  const [pendingBulkQuality, setPendingBulkQuality] = useState<{
    quality: number;
    changed: number;
  } | null>(null);
  const handleBulkQualityChange = (quality: number) => {
    const changed = current ? withAffixQualities(current, quality).changed : 0;
    if (changed > 0) setPendingBulkQuality({ quality, changed });
    else setAffixDefaultQuality(quality);
  };

  const setLevel = (g: number) => {
    if (!current) {
      onPendingLevelChange(g);
      return;
    }
    if (g === current.grade) return;
    const lost = countAffixesLostByLevelChange(current, g);
    if (lost > 0) setPendingLevelDown({ level: g, lost });
    else onSet(groupId, withFactorLevel(current, g));
  };

  const setAffix = (index: number, affix: PhantomAffixValue | null) => {
    if (!current) return;
    const affixes = [...(current.affixes ?? [])];
    while (affixes.length <= index) affixes.push(null);
    affixes[index] = affix;
    onSet(groupId, factorWithAffixes(current.classKey, current.grade, affixes));
  };

  const embedSlots = current ? getEmbedSlots(current.classKey, current.grade) : [];
  // クラス映痕の候補で優先する(先頭に並べる)クラス。クラス専用因子ならそのクラス、
  // 共通因子なら現在のクラス。
  const affixProfessionId = (current && getFactorProfessionId(current.classKey)) ?? professionId;
  const maxSlotCount = current ? getMaxEmbedSlotCount(current.classKey) : 0;
  // 映痕の効果(同種は合計、重複不可は最大値)。現在のレベルで開放されているスロットの分のみ。
  const affixEffects = getActiveAffixEffects(current);

  return (
    <>
      <DraggableDialog
        title={t('buildPlanner.phantom.factorDialogTitle', { slot: slotName })}
        onClose={onClose}
        className="phantom-factor-dialog"
        headerExtra={
          // 装備選択ダイアログの部位切り替えと同様、ダイアログを閉じずに別の因子スロットへ移る。
          // アイコンはツリーのノードと同じく、スロットの背景に装着中の因子のアイコンを重ねる。
          <div className="phantom-factor-dialog__slot-switch">
            {switchSlots.map((slot) => {
              const factorIconUrl = slot.factor ? getFactorIcon(slot.factor.classKey) : '';
              return (
                <button
                  key={slot.groupId}
                  type="button"
                  className={`phantom-factor-dialog__slot-switch-btn${slot.groupId === groupId ? ' phantom-factor-dialog__slot-switch-btn--active' : ''}`}
                  title={slot.title}
                  aria-label={slot.title}
                  onClick={() => onSwitch(slot.groupId)}
                >
                  <img
                    className="phantom-factor-dialog__slot-switch-bg"
                    src={getNodeIcon(slot.groupId, 2)}
                    alt=""
                  />
                  {factorIconUrl && (
                    <img
                      className="phantom-factor-dialog__slot-switch-factor"
                      src={factorIconUrl}
                      alt=""
                    />
                  )}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="equipment-dialog__columns">
          <div className="equipment-dialog__col-left">
            {/* 因子の装着中はノードのアイコン・スロット名(ノードの因子タイプ)の代わりに、
                因子名の下へ因子タイプと(特異点因子なら)型の所属を表示する。 */}
            <div className="phantom-factor-dialog__preview">
              {!current && slotIcon && (
                <img className="phantom-factor-dialog__slot-icon" src={slotIcon} alt="" />
              )}
              {factorIcon && (
                <img className="phantom-factor-dialog__factor-icon" src={factorIcon} alt="" />
              )}
              <div className="phantom-factor-dialog__preview-text">
                {!current && <span className="phantom-factor-dialog__slot-name">{slotName}</span>}
                <span className="phantom-factor-dialog__factor-name">
                  {current
                    ? `${factorShortName(tg, current.classKey)} G${current.grade}`
                    : t('buildPlanner.phantom.factorUnequipped')}
                </span>
                {/* 因子タイプ / 省いたクラス名 / 特異点因子なら型の所属 */}
                {current &&
                  factorDetailLines(t, tg, current.classKey).map((line) => (
                    <span key={line} className="phantom-factor-dialog__factor-meta">
                      {line}
                    </span>
                  ))}
              </div>
            </div>

            <div className="equip-details-section">
              <div className="phantom-factor-dialog__factor-label-row">
                <label className="equipment-dialog__label">
                  {t('buildPlanner.phantom.factorSelect')}
                </label>
                {/* 特異点因子は型の所属がキャラクターの型と一致しないと効果が出ない */}
                {schoolMismatch && factorSchool && (
                  <span
                    className="phantom-factor-dialog__school-warning"
                    title={t('buildPlanner.phantom.factorSchoolMismatch', {
                      type: factorSchool.name,
                    })}
                  >
                    ⚠ {t('buildPlanner.phantom.factorSchoolMismatchShort')}
                  </span>
                )}
              </div>
              <CustomDropdown
                className="phantom-factor-dropdown"
                options={factorOptions}
                value={current?.classKey ?? ''}
                placeholder={t('buildPlanner.phantom.factorUnequipped')}
                onChange={(v) =>
                  onSet(groupId, v === '' ? null : withFactorClass(current, v, level))
                }
              />
            </div>

            <div className="equip-details-section">
              <label className="equipment-dialog__label">
                {t('buildPlanner.phantom.factorLevel')}
              </label>
              <div className="phantom-factor-dialog__levels" role="radiogroup">
                {Array.from({ length: MAX_FACTOR_LEVEL }, (_, i) => i + 1).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={g === level}
                    className={`phantom-factor-dialog__level${g === level ? ' phantom-factor-dialog__level--active' : ''}`}
                    onClick={() => setLevel(g)}
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
                {current
                  ? renderMarkup(getFactorEffectMarkup(tg, current.classKey, current.grade))
                  : '---'}
              </p>
            </section>

            <section className="equip-details-section">
              <h3 className="equip-details-section__heading">
                {t('buildPlanner.phantom.affixEffect')}
              </h3>
              {affixEffects.length > 0 ? (
                <ul className="phantom-factor-dialog__affix-effects">
                  {affixEffects.map((a) => (
                    <li key={a.group}>{renderMarkup(affixEffectMarkup(tg, a))}</li>
                  ))}
                </ul>
              ) : (
                <p className="phantom-factor-dialog__placeholder">---</p>
              )}
            </section>
          </div>

          <div className="equipment-dialog__col-center">
            {/* 映痕プリセット(映痕列の上端・右寄せ。左列の因子の選択と上端を揃える) */}
            <div className="phantom-factor-dialog__toolbar">
              {/* 因子スロットを切り替えたらロード中表示等をリセットする */}
              <AffixPresetBar
                key={groupId}
                current={current}
                onApply={(factor) => onSet(groupId, factor)}
              />
            </div>
            <section className="equip-details-section">
              <div className="equip-details-section__heading-row">
                <h3 className="equip-details-section__heading">
                  {t('buildPlanner.phantom.affixHeading')}
                </h3>
                <label className="phantom-factor-dialog__bulk-quality">
                  <span>{t('buildPlanner.phantom.affixBulkQuality')}</span>
                  <SelectDropdown
                    className="phantom-affix-slot__quality"
                    value={affixDefaultQuality}
                    options={AFFIX_QUALITIES.map((q) => ({
                      value: q,
                      label: affixQualityName(t, tg, q),
                      color: getAffixQualityColor(q),
                    }))}
                    onChange={handleBulkQualityChange}
                  />
                </label>
              </div>
              {!current && (
                <p className="phantom-factor-dialog__placeholder">
                  {t('buildPlanner.phantom.affixNeedFactor')}
                </p>
              )}
            </section>
            {current &&
              Array.from({ length: maxSlotCount }, (_, i) => {
                // 未開放のスロットに残っている映痕は表示しない(レベル変更時に詰め直し済み)。
                const affix = i < embedSlots.length ? (current.affixes?.[i] ?? null) : null;
                return (
                  <AffixSlotEditor
                    key={`${current.classKey}-${current.grade}-${i}`}
                    tg={tg}
                    index={i}
                    slotTypes={embedSlots[i]}
                    unlockLevel={getSlotUnlockLevel(current.classKey, i)}
                    nonStackingDuplicate={
                      affix != null && duplicatedNonStackingGroups.has(affix.group)
                    }
                    affix={affix}
                    preferredProfessionId={affixProfessionId}
                    defaultQuality={affixDefaultQuality}
                    onChange={(next) => setAffix(i, next)}
                  />
                );
              })}
          </div>
        </div>
      </DraggableDialog>
      {pendingLevelDown && current && (
        <ConfirmDialog
          message={t('buildPlanner.phantom.affixLossOnLevelDownMsg', {
            level: pendingLevelDown.level,
            count: pendingLevelDown.lost,
          })}
          confirmLabel={t('buildPlanner.phantom.affixLossOnLevelDownConfirm')}
          onConfirm={() => {
            onSet(groupId, withFactorLevel(current, pendingLevelDown.level));
            setPendingLevelDown(null);
          }}
          cancelLabel={t('buildPlanner.confirmCancel')}
          onCancel={() => setPendingLevelDown(null)}
        />
      )}
      {pendingBulkQuality && current && (
        <ConfirmDialog
          message={t('buildPlanner.phantom.affixBulkQualityConfirmMsg', {
            count: pendingBulkQuality.changed,
            quality: affixQualityName(t, tg, pendingBulkQuality.quality),
          })}
          confirmLabel={t('buildPlanner.phantom.affixBulkQualityConfirm')}
          onConfirm={() => {
            onSet(groupId, withAffixQualities(current, pendingBulkQuality.quality).factor);
            setAffixDefaultQuality(pendingBulkQuality.quality);
            setPendingBulkQuality(null);
          }}
          cancelLabel={t('buildPlanner.confirmCancel')}
          onCancel={() => setPendingBulkQuality(null)}
        />
      )}
    </>
  );
}

interface AffixSlotEditorProps {
  tg: GameDataT;
  index: number;
  /** 埋め込める AffixType。undefined は現在のレベルでは未開放のスロット。 */
  slotTypes: number[] | undefined;
  unlockLevel: number | null;
  /** 重複不可の映痕が、このツリーの他のスロット(他の因子を含む)と重なっている。 */
  nonStackingDuplicate: boolean;
  affix: PhantomAffixValue | null;
  /** クラス映痕の候補で先頭に並べるクラス(他クラスの映痕も選べる)。 */
  preferredProfessionId: number;
  /** 映痕を新たに選んだときの既定の品質(レアリティ一括変更で選んだ値)。 */
  defaultQuality: number;
  onChange: (affix: PhantomAffixValue | null) => void;
}

// 映痕スロット1つ分: 映痕の選択 → 品質の選択 + 効果値の入力(単位は映痕に合わせて%/実数)。
function AffixSlotEditor({
  tg,
  index,
  slotTypes,
  unlockLevel,
  nonStackingDuplicate,
  affix,
  preferredProfessionId,
  defaultQuality,
  onChange,
}: AffixSlotEditorProps) {
  const { t } = useTranslation();
  const locked = slotTypes === undefined;

  const typeLabel = locked
    ? t('buildPlanner.phantom.affixLocked', { level: unlockLevel ?? '?' })
    : slotTypes.map((type) => t(`buildPlanner.phantom.affixSlotType.${type}`)).join(' / ');

  const options: DropdownOption[] = useMemo(
    () =>
      locked
        ? []
        : getAffixGroupsForSlot(slotTypes, preferredProfessionId).map((g) => ({
            value: String(g.group),
            label: affixLabel(tg, g.group),
            // クラス映痕はクラスごとに見出しを分ける(因子と異なるクラスの映痕も選べるため)。
            group:
              g.profession === 0
                ? t(`buildPlanner.phantom.affixLib.${g.libId}`)
                : t('buildPlanner.phantom.affixLibClass', {
                    class: tg(`classes.${g.profession}.name`, {
                      defaultValue: String(g.profession),
                    }),
                  }),
          })),
    [locked, slotTypes, preferredProfessionId, tg, t],
  );

  const group = affix ? getAffixGroup(affix.group) : undefined;
  // 候補に無い映痕(手で編集されたプランコード等でスロットの種類に合わないもの)も、選択中の表示が消えないよう候補に残す。
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
            onChange={(v) =>
              onChange(v === '' ? null : defaultAffixValue(Number(v), defaultQuality))
            }
          />
          {affix && group && (
            <div className="phantom-affix-slot__value-row">
              <SelectDropdown
                className="phantom-affix-slot__quality"
                value={affix.quality}
                options={group.qualities.map((q) => ({
                  value: q.quality,
                  label: affixQualityName(t, tg, q.quality),
                  color: getAffixQualityColor(q.quality),
                }))}
                onChange={(quality) => onChange(affixWithQuality(affix, quality))}
              />
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
