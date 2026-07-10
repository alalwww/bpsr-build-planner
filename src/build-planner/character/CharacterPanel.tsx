import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './character.css';
import ProfessionPicker from './ProfessionPicker';
import PlanListDropdown from './PlanListDropdown';
import AbilityScoreDialog from './AbilityScoreDialog';
import BuffEffectDialog from './BuffEffectDialog';
import Chevron from '../components/Chevron';
import ConfirmDialog from '../components/ConfirmDialog';
import DraggableDialog from '../components/DraggableDialog';
import FloatingTooltip from '../components/FloatingTooltip';
import Stepper from '../components/Stepper';
import { getClassIconUrl } from './classIcons';
import type { Profession } from '../profession';
import { PROFESSIONS } from '../profession';
import type { StatDefinition, StatId } from '../types';
import type { BuildPlanData } from '../buildPlan';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import classesData from '../../data/classes.json';
import saveIconUrl from '../../assets/ui/weap_save_icon.png';
import { truncate2Str } from './statFormat';

interface CharacterPanelProps {
  onOpenTalentTree?: () => void;
  onOpenStatsDetail?: () => void;
}

function formatStatValue(value: number, isPercent?: boolean): string {
  if (isPercent) {
    return `${truncate2Str(value)}%`;
  }
  return truncate2Str(value);
}

// 選択中クラスに応じて表示するステータス列を返す。
// 攻撃力列(atk/matk)とメインステータス列(strength/agility/intellect)がクラス依存で変わる。
function getStatDefinitions(profession: Profession): StatDefinition[] {
  const atkStat: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  return [
    { id: 'maxHp', column: 'left' },
    { id: atkStat, column: 'left' },
    { id: profession.mainStat, column: 'left' },
    { id: 'endurance', column: 'left' },
    { id: 'illusionPower', column: 'right' },
    { id: 'crit', column: 'right', isPercent: true },
    { id: 'haste', column: 'right', isPercent: true },
    { id: 'luck', column: 'right', isPercent: true },
    { id: 'mastery', column: 'right', isPercent: true },
    { id: 'versatility', column: 'right', isPercent: true },
    { id: 'resist', column: 'right', isPercent: true },
  ];
}

interface ClassEntry {
  showTalentStage: number[];
  talentColor?: string;
}

const clsData = classesData as Record<string, ClassEntry>;

function CharacterPanel({ onOpenTalentTree, onOpenStatsDetail }: CharacterPanelProps) {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');

  const { stats, rawStats, derivedStats, abilityScore } = useBuildStore(
    useShallow(computeStatsBundle),
  );
  const {
    professionKey,
    professionTypeKey,
    adventurerLevel,
    phantomLevel,
    planName,
    buildPlans,
    cookingBuff,
    moduleSlots,
    buildPlansLegacySource,
    autoSaveLegacySource,
    planLoadError,
    autoSaveLoadError,
  } = useBuildStore(
    useShallow((s) => ({
      professionKey: s.professionKey,
      professionTypeKey: s.professionTypeKey,
      adventurerLevel: s.adventurerLevel,
      phantomLevel: s.phantomLevel,
      planName: s.planName,
      buildPlans: s.buildPlans,
      cookingBuff: s.cookingBuff,
      moduleSlots: s.moduleSlots,
      buildPlansLegacySource: s.buildPlansLegacySource,
      autoSaveLegacySource: s.autoSaveLegacySource,
      planLoadError: s.planLoadError,
      autoSaveLoadError: s.autoSaveLoadError,
    })),
  );
  const onSelectProfession = useBuildStore((s) => s.selectProfession);
  const onSelectProfessionType = useBuildStore((s) => s.selectProfessionType);
  const onResaveBuildPlans = useBuildStore((s) => s.resaveBuildPlans);
  const onDismissBuildPlansLegacyNotice = useBuildStore((s) => s.dismissBuildPlansLegacyNotice);
  const onDismissAutoSaveLegacyNotice = useBuildStore((s) => s.dismissAutoSaveLegacyNotice);
  const onDismissPlanLoadError = useBuildStore((s) => s.dismissPlanLoadError);
  const onDismissAutoSaveLoadError = useBuildStore((s) => s.dismissAutoSaveLoadError);
  const onAdventurerLevelChange = useBuildStore((s) => s.setAdventurerLevel);
  const onPlanNameChange = useBuildStore((s) => s.setPlanName);
  const onSavePlan = useBuildStore((s) => s.savePlan);
  const onOverwritePlan = useBuildStore((s) => s.overwritePlan);
  const onRenamePlan = useBuildStore((s) => s.renamePlan);
  const onLoadPlan = useBuildStore((s) => s.loadPlan);
  const onDeletePlan = useBuildStore((s) => s.deletePlan);
  const onResetPlan = useBuildStore((s) => s.resetPlan);
  const onExportPlanCode = useBuildStore((s) => s.exportPlanCode);
  const onImportPlanCode = useBuildStore((s) => s.importPlanCode);
  const onCookingBuffChange = useBuildStore((s) => s.setCookingBuff);
  const [isProfessionPickerOpen, setProfessionPickerOpen] = useState(false);
  const [isPlanListOpen, setIsPlanListOpen] = useState(false);
  const [hoveredStatId, setHoveredStatId] = useState<StatId | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saveConflictPlanId, setSaveConflictPlanId] = useState<string | null>(null);
  const [confirmNewSaveName, setConfirmNewSaveName] = useState<string | null>(null);
  const [loadConfirmTarget, setLoadConfirmTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [confirmNewPlan, setConfirmNewPlan] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(
    null,
  );
  const [renameInput, setRenameInput] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportedCode, setExportedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState(false);
  // 保存プランのロード/インポートが旧フォーマット由来だった場合の
  // 「新しい保存形式で更新してよいですか？」確認ダイアログ。
  const [showPlanResaveConfirm, setShowPlanResaveConfirm] = useState(false);
  const [showImportResaveConfirm, setShowImportResaveConfirm] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [abilityScoreOpen, setAbilityScoreOpen] = useState(false);
  const [buffEffectOpen, setBuffEffectOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const planListRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // プランリスト外クリックで閉じる
  useEffect(() => {
    if (!isPlanListOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (planListRef.current && !planListRef.current.contains(e.target as Node)) {
        setIsPlanListOpen(false);
        setDeleteConfirmId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isPlanListOpen]);

  // リネームモーダル open 時に input にフォーカス
  useEffect(() => {
    if (renameTarget) renameInputRef.current?.focus();
  }, [renameTarget]);

  const statDefinitions = getStatDefinitions(PROFESSIONS[professionKey]);
  const leftStats = statDefinitions.filter((def) => def.column === 'left');
  const rightStats = statDefinitions.filter((def) => def.column === 'right');

  const professionId = PROFESSIONS[professionKey].professionId;
  const classIconUrl = getClassIconUrl(professionId);
  const clsEntry = clsData[String(professionId)];
  const showTalentStage = clsEntry?.showTalentStage ?? [];
  const typeStageId = showTalentStage[professionTypeKey === 'type1' ? 0 : 1];
  const roleBg = clsEntry?.talentColor ? `${clsEntry.talentColor}1a` : undefined;

  const getDefaultName = () => {
    const className = tGame(`classes.${professionId}.name`, { defaultValue: professionKey });
    const typeName = typeStageId
      ? tGame(`talentStages.${typeStageId}.typeName`, { defaultValue: professionTypeKey })
      : professionTypeKey;
    return `${className}(${typeName})`;
  };

  const handleSave = () => {
    const name = planName.trim() || getDefaultName();
    if (!planName.trim()) onPlanNameChange(name);
    const conflict = buildPlans.find((p) => p.name === name);
    if (conflict) {
      setSaveConflictPlanId(conflict.id);
    } else {
      setConfirmNewSaveName(name);
    }
  };

  const handleConfirmNewSave = () => {
    if (!confirmNewSaveName) return;
    onSavePlan(confirmNewSaveName);
    setConfirmNewSaveName(null);
  };

  const handleSaveConflictOverwrite = () => {
    if (!saveConflictPlanId) return;
    onOverwritePlan(saveConflictPlanId, planName.trim());
    setSaveConflictPlanId(null);
  };

  const handleLoadPlanConfirmed = (id: string) => {
    onLoadPlan(id);
    setLoadConfirmTarget(null);
    setIsPlanListOpen(false);
    setDeleteConfirmId(null);
    // 保存プラン一覧が旧フォーマットから移行されたものであれば、新形式での再保存を確認する。
    if (buildPlansLegacySource) setShowPlanResaveConfirm(true);
  };

  const handleLoadPlan = (id: string) => {
    const plan = buildPlans.find((p) => p.id === id);
    if (!plan) return;
    setLoadConfirmTarget({ id, name: plan.name });
  };

  const handleNewPlanConfirmed = () => {
    onResetPlan();
    setConfirmNewPlan(false);
    setIsPlanListOpen(false);
    setDeleteConfirmId(null);
  };

  const handleNewPlan = () => {
    setConfirmNewPlan(true);
  };

  const handleOpenExportDialog = () => {
    setExportedCode(onExportPlanCode());
    setCopied(false);
    setExportDialogOpen(true);
    setIsPlanListOpen(false);
  };

  const handleCopyExportedCode = async () => {
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenImportDialog = () => {
    setImportInput('');
    setImportError(false);
    setImportDialogOpen(true);
    setIsPlanListOpen(false);
  };

  const handleConfirmImport = () => {
    const result = onImportPlanCode(importInput);
    if (result !== 'failed') {
      setImportDialogOpen(false);
      setImportInput('');
      setImportError(false);
      // インポートしたコードが旧フォーマットだった場合、新形式での保存を確認する。
      if (result === 'legacy') setShowImportResaveConfirm(true);
    } else {
      setImportError(true);
    }
  };

  const openRenameDialog = (plan: BuildPlanData) => {
    setRenameTarget({ id: plan.id, currentName: plan.name });
    setRenameInput(plan.name);
  };

  const handleRenameConfirm = () => {
    if (!renameTarget) return;
    const newName = renameInput.trim();
    if (!newName) return;
    const isDuplicate = buildPlans.some((p) => p.id !== renameTarget.id && p.name === newName);
    if (isDuplicate) return;
    onRenamePlan(renameTarget.id, newName); // 入力欄の追従は useBuildState.renamePlan 内で行う
    setRenameTarget(null);
  };

  const renameInputIsValid = () => {
    const newName = renameInput.trim();
    if (!newName) return false;
    return !buildPlans.some((p) => p.id !== renameTarget?.id && p.name === newName);
  };

  const saveConflictPlan = saveConflictPlanId
    ? buildPlans.find((p) => p.id === saveConflictPlanId)
    : null;

  return (
    <section className="character-panel">
      {/* Header: plan name + expand + save */}
      <div className="character-panel__header" ref={planListRef}>
        <input
          className="character-panel__name-input"
          value={planName}
          onChange={(e) => onPlanNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder={t('buildPlanner.buildPlanPlaceholder')}
        />
        <button
          type="button"
          className={`character-panel__plan-expand${isPlanListOpen ? ' character-panel__plan-expand--open' : ''}`}
          title={t('buildPlanner.planList', { defaultValue: 'Plan List' })}
          onClick={() => {
            setIsPlanListOpen((v) => !v);
            setDeleteConfirmId(null);
          }}
        >
          <Chevron open={isPlanListOpen} />
        </button>
        <button
          type="button"
          className="character-panel__plan-save"
          title={t('buildPlanner.savePlan', { defaultValue: 'Save Plan' })}
          onClick={handleSave}
        >
          <img src={saveIconUrl} className="character-panel__save-icon" alt="" />
        </button>

        {/* プランドロップダウン */}
        {isPlanListOpen && (
          <PlanListDropdown
            buildPlans={buildPlans}
            deleteConfirmId={deleteConfirmId}
            onSetDeleteConfirmId={setDeleteConfirmId}
            onLoadPlan={handleLoadPlan}
            onOpenRenameDialog={openRenameDialog}
            onDeletePlan={onDeletePlan}
            onNewPlan={handleNewPlan}
            onOpenExportDialog={handleOpenExportDialog}
            onOpenImportDialog={handleOpenImportDialog}
          />
        )}
      </div>

      {/* Summary */}
      <div className="character-panel__summary">
        <button
          type="button"
          className="character-panel__summary-item character-panel__summary-item--clickable"
          onClick={() => setAbilityScoreOpen(true)}
        >
          <span className="character-panel__label">{t('buildPlanner.abilityScore')}</span>
          <span className="character-panel__value">{abilityScore.total.toLocaleString()}</span>
        </button>
        <button
          type="button"
          className="character-panel__summary-item character-panel__summary-item--clickable"
          onClick={() => setLevelPickerOpen(true)}
        >
          <span className="character-panel__label">{t('buildPlanner.adventurerLevel')}</span>
          <span className="character-panel__value">
            {adventurerLevel}(+{phantomLevel})
          </span>
        </button>
      </div>

      {/* Class + Type selectors */}
      <div className="character-panel__selectors">
        <button
          type="button"
          className="character-panel__selector--class"
          style={roleBg ? { backgroundColor: roleBg } : undefined}
          onClick={() => setProfessionPickerOpen(true)}
        >
          {classIconUrl && (
            <span
              className="character-panel__selector-icon-bg"
              style={{ backgroundImage: `url(${classIconUrl})` }}
              aria-hidden="true"
            />
          )}
          <span className="character-panel__selector-name">
            {tGame(`classes.${professionId}.name`, { defaultValue: professionKey })}
          </span>
          <span className="character-panel__selector-label">{t('buildPlanner.classLabel')}</span>
        </button>
        <button
          type="button"
          className="character-panel__selector--type"
          style={roleBg ? { backgroundColor: roleBg } : undefined}
          onClick={onOpenTalentTree}
        >
          <span className="character-panel__selector-name">
            {typeStageId
              ? tGame(`talentStages.${typeStageId}.typeName`, { defaultValue: professionTypeKey })
              : professionTypeKey}
          </span>
          <span className="character-panel__selector-label">{t('buildPlanner.talentLabel')}</span>
        </button>
      </div>

      <div className="character-panel__stats">
        <div className="character-panel__stats-column">
          {leftStats.map((def) => (
            <div className="character-panel__stat-row" key={def.id}>
              <span className="character-panel__stat-label">
                {t(`buildPlanner.stats.${def.id}`)}
              </span>
              <span className="character-panel__stat-value">
                {formatStatValue(stats[def.id], def.isPercent)}
              </span>
            </div>
          ))}
        </div>
        <div className="character-panel__stats-column">
          {rightStats.map((def) => (
            <div className="character-panel__stat-row" key={def.id}>
              <span className="character-panel__stat-label">
                {t(`buildPlanner.stats.${def.id}`)}
              </span>
              <span
                className={`character-panel__stat-value${def.isPercent ? ' character-panel__stat-value--tip' : ''}`}
                onMouseEnter={(e) => {
                  if (def.isPercent) {
                    setHoveredStatId(def.id);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseMove={(e) => {
                  if (def.isPercent) setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setHoveredStatId(null)}
              >
                {formatStatValue(stats[def.id], def.isPercent)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="character-panel__detail-button" onClick={onOpenStatsDetail}>
        {t('buildPlanner.attributes')}
      </button>
      <button
        type="button"
        className="character-panel__detail-button character-panel__detail-button--secondary"
        onClick={() => setBuffEffectOpen(true)}
      >
        {t('buildPlanner.buffDialog.openButton')}
      </button>

      {hoveredStatId !== null && (
        <FloatingTooltip
          x={tooltipPos.x + 10}
          y={tooltipPos.y - 32}
          className="character-panel__stat-tooltip"
        >
          {truncate2Str(
            // ファストは俊敏由来の変換分がrawStatsに含まれない(装備等の生値のみ)ため、
            // %変換に実際に使われた実数値(derivedStats.hasteReal)を表示する。
            hoveredStatId === 'haste' ? derivedStats.hasteReal : rawStats[hoveredStatId],
          )}
        </FloatingTooltip>
      )}

      {isProfessionPickerOpen && (
        <ProfessionPicker
          professionKey={professionKey}
          professionTypeKey={professionTypeKey}
          onSelectProfession={onSelectProfession}
          onSelectProfessionType={onSelectProfessionType}
          onClose={() => setProfessionPickerOpen(false)}
        />
      )}

      {/* プラン読み込み確認モーダル */}
      {loadConfirmTarget && (
        <ConfirmDialog
          message={t('buildPlanner.confirmLoadMsg', {
            defaultValue: `「${loadConfirmTarget.name}」を読み込みます。現在の変更はリセットされます。`,
            name: loadConfirmTarget.name,
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={() => handleLoadPlanConfirmed(loadConfirmTarget.id)}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setLoadConfirmTarget(null)}
        />
      )}

      {/* 保存プランが旧フォーマットから移行された直後の再保存確認モーダル */}
      {showPlanResaveConfirm && (
        <ConfirmDialog
          message={t('buildPlanner.confirmResaveFormatMsg', {
            defaultValue: '新しい保存形式で更新してよいですか？',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={() => {
            onResaveBuildPlans();
            setShowPlanResaveConfirm(false);
          }}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => {
            onDismissBuildPlansLegacyNotice();
            setShowPlanResaveConfirm(false);
          }}
        />
      )}

      {/* インポートしたコードが旧フォーマットだった場合の保存確認モーダル */}
      {showImportResaveConfirm && (
        <ConfirmDialog
          message={t('buildPlanner.confirmResaveFormatMsg', {
            defaultValue: '新しい保存形式で更新してよいですか？',
          })}
          confirmLabel={t('buildPlanner.confirmSave', { defaultValue: '保存' })}
          onConfirm={() => {
            setShowImportResaveConfirm(false);
            handleSave();
          }}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setShowImportResaveConfirm(false)}
        />
      )}

      {/* 自動保存が旧フォーマットから移行されたことの通知(確認不要・単一ボタン) */}
      {autoSaveLegacySource && (
        <ConfirmDialog
          message={t('buildPlanner.autoSaveMigratedMsg', {
            defaultValue: '自動保存データを新しい保存形式に更新しました。',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={onDismissAutoSaveLegacyNotice}
        />
      )}

      {/* 保存プラン一覧のロードに失敗した通知(確認不要・単一ボタン) */}
      {planLoadError && (
        <ConfirmDialog
          message={t('buildPlanner.planLoadErrorMsg', {
            defaultValue:
              '保存プランの読み込みに失敗しました。データが破損している可能性があります。',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={onDismissPlanLoadError}
        />
      )}

      {/* 自動保存のロードに失敗した通知(確認不要・単一ボタン) */}
      {autoSaveLoadError && (
        <ConfirmDialog
          message={t('buildPlanner.autoSaveLoadErrorMsg', {
            defaultValue:
              '自動保存データの読み込みに失敗しました。データが破損している可能性があります。',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={onDismissAutoSaveLoadError}
        />
      )}

      {/* 新規プラン確認モーダル */}
      {confirmNewPlan && (
        <ConfirmDialog
          message={t('buildPlanner.confirmNewPlanMsg', {
            defaultValue: '新しいビルドプランを作成します。現在の変更はリセットされます。',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={handleNewPlanConfirmed}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setConfirmNewPlan(false)}
        />
      )}

      {/* 新規保存確認モーダル */}
      {confirmNewSaveName && (
        <ConfirmDialog
          message={t('buildPlanner.confirmNewSaveMsg', {
            defaultValue: `「${confirmNewSaveName}」で新規保存しますか？`,
            name: confirmNewSaveName,
          })}
          confirmLabel={t('buildPlanner.confirmSave', { defaultValue: '保存' })}
          onConfirm={handleConfirmNewSave}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setConfirmNewSaveName(null)}
        />
      )}

      {/* 同名保存確認モーダル */}
      {saveConflictPlanId && saveConflictPlan && (
        <ConfirmDialog
          message={t('buildPlanner.confirmOverwriteMsg', {
            defaultValue: `「${saveConflictPlan.name}」は既に存在します。上書きしますか？`,
            name: saveConflictPlan.name,
          })}
          confirmLabel={t('buildPlanner.overwrite', { defaultValue: '上書き' })}
          onConfirm={handleSaveConflictOverwrite}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setSaveConflictPlanId(null)}
        />
      )}

      {/* リネームモーダル */}
      {renameTarget && (
        <ConfirmDialog
          title={t('buildPlanner.renamePlan', { defaultValue: 'リネーム' })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={handleRenameConfirm}
          confirmDisabled={!renameInputIsValid()}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setRenameTarget(null)}
        >
          <input
            ref={renameInputRef}
            className="confirm-dialog__input"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameInputIsValid()) handleRenameConfirm();
            }}
          />
          {renameInput.trim() && !renameInputIsValid() && (
            <p className="confirm-dialog__error">
              {t('buildPlanner.nameDuplicate', { defaultValue: '同名のプランが既に存在します' })}
            </p>
          )}
        </ConfirmDialog>
      )}
      {/* プランエクスポートダイアログ */}
      {exportDialogOpen && (
        <ConfirmDialog
          className="confirm-dialog--wide"
          title={t('buildPlanner.exportPlan', { defaultValue: 'エクスポート' })}
          message={t('buildPlanner.exportPlanMsg', {
            defaultValue: '現在編集中のビルドプランをコードとして出力しました。',
          })}
          confirmLabel={t('buildPlanner.close', { defaultValue: '閉じる' })}
          onConfirm={() => setExportDialogOpen(false)}
        >
          <textarea
            className="confirm-dialog__textarea"
            readOnly
            value={exportedCode}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="confirm-dialog__secondary-row">
            <button
              type="button"
              className="confirm-dialog__btn confirm-dialog__btn--cancel"
              onClick={handleCopyExportedCode}
            >
              {copied
                ? t('buildPlanner.copied', { defaultValue: 'コピーしました' })
                : t('buildPlanner.copyCode', { defaultValue: 'コピー' })}
            </button>
          </div>
        </ConfirmDialog>
      )}

      {/* プランインポートダイアログ */}
      {importDialogOpen && (
        <ConfirmDialog
          className="confirm-dialog--wide"
          title={t('buildPlanner.importPlan', { defaultValue: 'インポート' })}
          message={t('buildPlanner.importPlanMsg', {
            defaultValue: 'コードからビルドプランを読み込みます。現在の変更はリセットされます。',
          })}
          confirmLabel={t('buildPlanner.importConfirm', { defaultValue: 'インポート' })}
          onConfirm={handleConfirmImport}
          confirmDisabled={!importInput.trim()}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setImportDialogOpen(false)}
        >
          <textarea
            className="confirm-dialog__textarea"
            value={importInput}
            onChange={(e) => {
              setImportInput(e.target.value);
              setImportError(false);
            }}
            placeholder={t('buildPlanner.importPlaceholder', {
              defaultValue: 'エクスポートしたコードを貼り付け',
            })}
          />
          {importError && (
            <p className="confirm-dialog__error">
              {t('buildPlanner.importErrorMsg', {
                defaultValue: 'コードを読み込めませんでした。正しいコードか確認してください。',
              })}
            </p>
          )}
        </ConfirmDialog>
      )}

      {/* 冒険者レベル選択ダイアログ */}
      {levelPickerOpen && (
        <DraggableDialog
          title={t('buildPlanner.adventurerLevel')}
          onClose={() => setLevelPickerOpen(false)}
          className="level-picker-dialog"
        >
          <Stepper
            className="stepper-inline"
            modifierClassName="level-dialog__stepper"
            layout="inline"
            value={adventurerLevel}
            min={1}
            max={60}
            onChange={onAdventurerLevelChange}
          />
        </DraggableDialog>
      )}
      {/* 能力スコア内訳ダイアログ */}
      {abilityScoreOpen && (
        <AbilityScoreDialog
          abilityScore={abilityScore}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onClose={() => setAbilityScoreOpen(false)}
        />
      )}
      {/* バフ効果ダイアログ */}
      {buffEffectOpen && (
        <BuffEffectDialog
          cookingBuff={cookingBuff}
          onChange={onCookingBuffChange}
          profession={PROFESSIONS[professionKey]}
          onClose={() => setBuffEffectOpen(false)}
          moduleSlots={moduleSlots}
        />
      )}
    </section>
  );
}

export default CharacterPanel;
