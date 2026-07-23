import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import PlanListDropdown from './PlanListDropdown';
import Chevron from '../components/Chevron';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatProfessionLabel } from '../profession';
import type { BuildPlanData } from '../plan/buildPlan';
import ShareBuildButton from '../plan/ShareBuildButton';
import { useBuildStore } from '../store/useBuildStore';
import saveIconUrl from '../../assets/ui/weap_save_icon.png';
import resetIconUrl from '../../assets/ui/com_btn_delete.png';

// プラン管理(名称入力・保存・一覧・読込/リネーム/削除・コードのインポート/エクスポート・
// 旧フォーマット移行/読込エラー通知)のヘッダー行とダイアログ群。
// CharacterPanel(ステータス表示)から分離し、プラン管理の関心をこの1ファイルに閉じる。
function PlanManager() {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');

  const {
    professionKey,
    professionTypeKey,
    planName,
    buildPlans,
    buildPlansLegacySource,
    autoSaveLegacySource,
    planLoadError,
    autoSaveLoadError,
    phantomLegacyFactorResetNotice,
  } = useBuildStore(
    useShallow((s) => ({
      professionKey: s.professionKey,
      professionTypeKey: s.professionTypeKey,
      planName: s.planName,
      buildPlans: s.buildPlans,
      buildPlansLegacySource: s.buildPlansLegacySource,
      autoSaveLegacySource: s.autoSaveLegacySource,
      planLoadError: s.planLoadError,
      autoSaveLoadError: s.autoSaveLoadError,
      phantomLegacyFactorResetNotice: s.phantomLegacyFactorResetNotice,
    })),
  );
  const onResaveBuildPlans = useBuildStore((s) => s.resaveBuildPlans);
  const onDismissBuildPlansLegacyNotice = useBuildStore((s) => s.dismissBuildPlansLegacyNotice);
  const onDismissAutoSaveLegacyNotice = useBuildStore((s) => s.dismissAutoSaveLegacyNotice);
  const onDismissPlanLoadError = useBuildStore((s) => s.dismissPlanLoadError);
  const onDismissAutoSaveLoadError = useBuildStore((s) => s.dismissAutoSaveLoadError);
  const onDismissPhantomLegacyFactorResetNotice = useBuildStore(
    (s) => s.dismissPhantomLegacyFactorResetNotice,
  );
  const onPlanNameChange = useBuildStore((s) => s.setPlanName);
  const onSavePlan = useBuildStore((s) => s.savePlan);
  const onOverwritePlan = useBuildStore((s) => s.overwritePlan);
  const onRenamePlan = useBuildStore((s) => s.renamePlan);
  const onLoadPlan = useBuildStore((s) => s.loadPlan);
  const onDeletePlan = useBuildStore((s) => s.deletePlan);
  const onResetPlan = useBuildStore((s) => s.resetPlan);
  const onExportPlanCode = useBuildStore((s) => s.exportPlanCode);
  const onImportPlanCode = useBuildStore((s) => s.importPlanCode);

  const [isPlanListOpen, setIsPlanListOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saveConflictPlanId, setSaveConflictPlanId] = useState<string | null>(null);
  const [confirmNewSaveName, setConfirmNewSaveName] = useState<string | null>(null);
  const [loadConfirmTarget, setLoadConfirmTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [confirmResetPlan, setConfirmResetPlan] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(
    null,
  );
  const [renameInput, setRenameInput] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportedCode, setExportedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState(false);
  // 保存プランのロード/インポートが旧フォーマット由来だった場合の
  // 「新しい保存形式で更新してよいですか？」確認ダイアログ。
  const [showPlanResaveConfirm, setShowPlanResaveConfirm] = useState(false);
  const [showImportResaveConfirm, setShowImportResaveConfirm] = useState(false);
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

  const getDefaultName = () => formatProfessionLabel(professionKey, professionTypeKey, tGame);

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

  const handleResetPlanConfirmed = () => {
    onResetPlan();
    setConfirmResetPlan(false);
    setIsPlanListOpen(false);
    setDeleteConfirmId(null);
  };

  const handleResetPlanClick = () => {
    setConfirmResetPlan(true);
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
    <>
      {/* Header: plan name + expand */}
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

        {/* プランドロップダウン */}
        {isPlanListOpen && (
          <PlanListDropdown
            buildPlans={buildPlans}
            deleteConfirmId={deleteConfirmId}
            onSetDeleteConfirmId={setDeleteConfirmId}
            onLoadPlan={handleLoadPlan}
            onOpenRenameDialog={openRenameDialog}
            onDeletePlan={onDeletePlan}
            onOpenExportDialog={handleOpenExportDialog}
            onOpenImportDialog={handleOpenImportDialog}
          />
        )}
      </div>

      {/* リセット(左端)・保存・共有(右端)の行 */}
      <div className="character-panel__reset-row">
        <button
          type="button"
          className="character-panel__reset-btn"
          title={t('buildPlanner.resetPlan', { defaultValue: 'Reset current build' })}
          onClick={handleResetPlanClick}
        >
          <span
            className="character-panel__reset-icon"
            style={{ WebkitMaskImage: `url(${resetIconUrl})`, maskImage: `url(${resetIconUrl})` }}
          />
        </button>
        <div className="character-panel__action-group">
          <ShareBuildButton
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            onSwitchToExport={handleOpenExportDialog}
          />
          <button
            type="button"
            className="character-panel__plan-save"
            title={t('buildPlanner.savePlan', { defaultValue: 'Save Plan' })}
            onClick={handleSave}
          >
            <img src={saveIconUrl} className="character-panel__save-icon" alt="" />
          </button>
        </div>
      </div>

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

      {/* ロードしたデータに無効化されたS2幻影因子が含まれていたため心相投影をリセットした通知
          (確認不要・単一ボタン) */}
      {phantomLegacyFactorResetNotice && (
        <ConfirmDialog
          message={t('buildPlanner.phantomLegacyFactorResetMsg', {
            defaultValue: 'シーズン２の潜在心相晶は無効化されたため、リセットします。',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={onDismissPhantomLegacyFactorResetNotice}
        />
      )}

      {/* 現在のビルドのリセット確認モーダル */}
      {confirmResetPlan && (
        <ConfirmDialog
          message={t('buildPlanner.confirmResetPlanMsg', {
            defaultValue:
              '現在のビルドを初期値にリセットします（保存済みビルドプランは削除されません）',
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={handleResetPlanConfirmed}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setConfirmResetPlan(false)}
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
          cancelLabel={t('buildPlanner.switchToShare', { defaultValue: 'シェアへ切り替え' })}
          onCancel={() => {
            setExportDialogOpen(false);
            setShareDialogOpen(true);
          }}
          onDismiss={() => setExportDialogOpen(false)}
          closeOnOverlayClick={false}
          closeIcon
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
    </>
  );
}

export default PlanManager;
