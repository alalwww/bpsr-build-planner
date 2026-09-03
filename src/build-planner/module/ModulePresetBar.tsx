import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import Chevron from '../components/Chevron';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDelayedUnmount } from '../components/useDelayedUnmount';
import { useBuildStore } from '../store/useBuildStore';
import ModulePresetDropdown from './ModulePresetDropdown';
import {
  MAX_MODULE_PRESET_NAME_LENGTH,
  MAX_MODULE_PRESETS,
  moduleSlotsEqual,
  type ModulePreset,
} from './modulePresets';
import saveIconUrl from '../../assets/ui/weap_save_icon.png';

const CLOSE_ANIM_MS = 150;

// モジュールプリセットの保存・切り替えUI(ドロップダウン+保存ボタン)とその関連ダイアログ群。
// character/PlanManager.tsx のビルドプラン管理と同じ構成パターンを、モジュール専用の
// ローカル保存機能(ビルドプラン/共有には含めない)向けに用意したもの。
function ModulePresetBar() {
  const { t } = useTranslation();

  const { moduleSlots, modulePresets, loadedModulePresetId } = useBuildStore(
    useShallow((s) => ({
      moduleSlots: s.moduleSlots,
      modulePresets: s.modulePresets,
      loadedModulePresetId: s.loadedModulePresetId,
    })),
  );
  const onSaveModulePreset = useBuildStore((s) => s.saveModulePreset);
  const onOverwriteModulePreset = useBuildStore((s) => s.overwriteModulePreset);
  const onRenameModulePreset = useBuildStore((s) => s.renameModulePreset);
  const onDeleteModulePreset = useBuildStore((s) => s.deleteModulePreset);
  const onLoadModulePreset = useBuildStore((s) => s.loadModulePreset);

  const [isListOpen, setIsListOpen] = useState(false);
  const shouldRenderList = useDelayedUnmount(isListOpen, CLOSE_ANIM_MS);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(
    null,
  );
  const [renameInput, setRenameInput] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [saveConflictId, setSaveConflictId] = useState<string | null>(null);
  const [capReachedError, setCapReachedError] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadedPreset = modulePresets.find((p) => p.id === loadedModulePresetId) ?? null;
  const hasChangesFromLoaded = loadedPreset ? !moduleSlotsEqual(moduleSlots, loadedPreset.moduleSlots) : true;
  // プリセットをロードしていない場合は常に保存可(初回保存を妨げない)。
  // ロード済みの場合のみ、保存時から変更が無ければ保存ボタンを無効化する。
  const saveDisabled = loadedPreset !== null && !hasChangesFromLoaded;

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isListOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setIsListOpen(false);
        setDeleteConfirmId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isListOpen]);

  // リネームモーダル open 時に input にフォーカス
  useEffect(() => {
    if (renameTarget) renameInputRef.current?.focus();
  }, [renameTarget]);

  // 保存モーダル open 時に input にフォーカス+全選択
  useEffect(() => {
    if (saveDialogOpen) saveInputRef.current?.select();
  }, [saveDialogOpen]);

  const handleOpenSaveDialog = () => {
    const initialName = loadedPreset
      ? loadedPreset.name
      : t('buildPlanner.modulePreset.defaultName', {
          defaultValue: 'プリセット {{n}}',
          n: modulePresets.length + 1,
        });
    setSaveNameInput(initialName);
    setSaveDialogOpen(true);
  };

  const handleConfirmSaveDialog = () => {
    const name = saveNameInput.trim();
    if (!name) return;
    const conflict = modulePresets.find((p) => p.name === name);
    if (conflict) {
      setSaveDialogOpen(false);
      setSaveConflictId(conflict.id);
      return;
    }
    if (modulePresets.length >= MAX_MODULE_PRESETS) {
      setSaveDialogOpen(false);
      setCapReachedError(true);
      return;
    }
    onSaveModulePreset(name);
    setSaveDialogOpen(false);
  };

  const handleConfirmOverwrite = () => {
    if (!saveConflictId) return;
    onOverwriteModulePreset(saveConflictId, saveNameInput.trim());
    setSaveConflictId(null);
  };

  const handleSelectPreset = (id: string) => {
    if (id === loadedModulePresetId) {
      setIsListOpen(false);
      return;
    }
    if (loadedPreset && !hasChangesFromLoaded) {
      onLoadModulePreset(id);
      setIsListOpen(false);
      setDeleteConfirmId(null);
      return;
    }
    setPendingSwitchId(id);
  };

  const handleConfirmSwitch = () => {
    if (!pendingSwitchId) return;
    onLoadModulePreset(pendingSwitchId);
    setPendingSwitchId(null);
    setIsListOpen(false);
    setDeleteConfirmId(null);
  };

  const openRenameDialog = (preset: ModulePreset) => {
    setRenameTarget({ id: preset.id, currentName: preset.name });
    setRenameInput(preset.name);
  };

  const renameInputIsValid = () => {
    const newName = renameInput.trim();
    if (!newName) return false;
    return !modulePresets.some((p) => p.id !== renameTarget?.id && p.name === newName);
  };

  const handleRenameConfirm = () => {
    if (!renameTarget || !renameInputIsValid()) return;
    onRenameModulePreset(renameTarget.id, renameInput.trim());
    setRenameTarget(null);
  };

  const pendingSwitchPreset = pendingSwitchId
    ? (modulePresets.find((p) => p.id === pendingSwitchId) ?? null)
    : null;
  const saveConflictPreset = saveConflictId
    ? (modulePresets.find((p) => p.id === saveConflictId) ?? null)
    : null;

  return (
    <div className="module-preset-bar">
      <div className="module-preset-bar__controls" ref={listRef}>
        <div className="module-preset-bar__dropdown-wrap">
          <button
            type="button"
            className={`module-preset-bar__trigger${isListOpen ? ' module-preset-bar__trigger--open' : ''}`}
            onClick={() => {
              setIsListOpen((v) => !v);
              setDeleteConfirmId(null);
            }}
          >
            <span className="module-preset-bar__trigger-name">
              {loadedPreset?.name ??
                t('buildPlanner.modulePreset.placeholder', { defaultValue: 'プリセットを選択' })}
            </span>
            <Chevron open={isListOpen} />
          </button>
          {shouldRenderList && (
            <ModulePresetDropdown
              animClassName={`dropdown-panel-anim${isListOpen ? '' : ' dropdown-panel-anim--closing'}`}
              presets={modulePresets}
              loadedPresetId={loadedModulePresetId}
              deleteConfirmId={deleteConfirmId}
              onSetDeleteConfirmId={setDeleteConfirmId}
              onSelectPreset={handleSelectPreset}
              onOpenRenameDialog={openRenameDialog}
              onDeletePreset={onDeleteModulePreset}
            />
          )}
        </div>
        <button
          type="button"
          className="module-preset-bar__save"
          title={t('buildPlanner.modulePreset.save', { defaultValue: 'プリセットを保存' })}
          disabled={saveDisabled}
          onClick={handleOpenSaveDialog}
        >
          <img src={saveIconUrl} className="module-preset-bar__save-icon" alt="" />
        </button>
      </div>

      {/* プリセット保存ダイアログ(名前入力) */}
      {saveDialogOpen && (
        <ConfirmDialog
          title={t('buildPlanner.modulePreset.saveTitle', { defaultValue: 'プリセットを保存' })}
          confirmLabel={t('buildPlanner.confirmSave', { defaultValue: '保存' })}
          onConfirm={handleConfirmSaveDialog}
          confirmDisabled={!saveNameInput.trim()}
          closeIcon
          onDismiss={() => setSaveDialogOpen(false)}
        >
          <input
            ref={saveInputRef}
            className="confirm-dialog__input"
            value={saveNameInput}
            maxLength={MAX_MODULE_PRESET_NAME_LENGTH}
            onChange={(e) => setSaveNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveNameInput.trim()) handleConfirmSaveDialog();
            }}
          />
        </ConfirmDialog>
      )}

      {/* 同名プリセットの上書き確認 */}
      {saveConflictId && saveConflictPreset && (
        <ConfirmDialog
          message={t('buildPlanner.confirmOverwriteMsg', {
            defaultValue: `「${saveConflictPreset.name}」は既に存在します。上書きしますか？`,
            name: saveConflictPreset.name,
          })}
          confirmLabel={t('buildPlanner.overwrite', { defaultValue: '上書き' })}
          onConfirm={handleConfirmOverwrite}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setSaveConflictId(null)}
        />
      )}

      {/* 保存上限到達エラー(確認不要・単一ボタン) */}
      {capReachedError && (
        <ConfirmDialog
          message={t('buildPlanner.modulePreset.capReachedMsg', {
            defaultValue: `保存上限(${MAX_MODULE_PRESETS}件)に達しています。不要なプリセットを削除してから保存してください。`,
            max: MAX_MODULE_PRESETS,
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={() => setCapReachedError(false)}
        />
      )}

      {/* プリセット切り替え確認(現在の変更が失われる場合のみ表示) */}
      {pendingSwitchId && pendingSwitchPreset && (
        <ConfirmDialog
          message={t('buildPlanner.modulePreset.confirmSwitchMsg', {
            defaultValue: `「${pendingSwitchPreset.name}」に切り替えます。現在の変更は失われます。`,
            name: pendingSwitchPreset.name,
          })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={handleConfirmSwitch}
          cancelLabel={t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
          onCancel={() => setPendingSwitchId(null)}
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
            maxLength={MAX_MODULE_PRESET_NAME_LENGTH}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameInputIsValid()) handleRenameConfirm();
            }}
          />
          {renameInput.trim() && !renameInputIsValid() && (
            <p className="confirm-dialog__error">
              {t('buildPlanner.modulePreset.nameDuplicate', {
                defaultValue: '同名のプリセットが既に存在します',
              })}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default ModulePresetBar;
