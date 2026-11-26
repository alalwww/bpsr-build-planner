import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../Chevron';
import ConfirmDialog from '../ConfirmDialog';
import { useDelayedUnmount } from '../useDelayedUnmount';
import PresetDropdown from './PresetDropdown';
import type { NamedPreset } from './presetStorage';
import saveIconUrl from '../../../assets/ui/weap_save_icon.png';
import './preset.css';

const CLOSE_ANIM_MS = 150;

interface PresetBarProps<P extends NamedPreset> {
  presets: P[];
  /** 現在ロード中のプリセットID(ロードしていなければ null)。 */
  loadedPresetId: string | null;
  /** ロード中のプリセットの保存内容から、現在の状態が変更されているか。 */
  hasChangesFromLoaded: boolean;
  onSave: (name: string) => void;
  onOverwrite: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onLoad: (id: string) => void;
  maxPresets: number;
  maxNameLength: number;
  /** UI文言の i18n キーの接頭辞(例: 'buildPlanner.modulePreset')。配下に placeholder / save /
   * saveTitle / defaultName / noPresets / capReachedMsg / confirmSwitchMsg / nameDuplicate を持つこと。 */
  i18nKey: string;
  /** プリセット1件の表示内容(トリガー・一覧共通)。省略時は名前のみ。 */
  renderLabel?: (preset: P) => ReactNode;
  /** true の間はトリガー・保存ボタンを無効化する(保存対象が無い場合等)。 */
  disabled?: boolean;
  className?: string;
}

// プリセットの保存・切り替えUI(ドロップダウン+保存ボタン)とその関連ダイアログ群。
// character/PlanManager.tsx のビルドプラン管理と同じ構成パターンを、ビルドプランとは独立した
// ローカル保存のプリセット(モジュール/映痕等)向けに共通化したもの。保存先・内容は呼び出し側が
// コールバックで扱う(保存処理の共通部分は presetStorage.ts)。
function PresetBar<P extends NamedPreset>({
  presets,
  loadedPresetId,
  hasChangesFromLoaded,
  onSave,
  onOverwrite,
  onRename,
  onDelete,
  onLoad,
  maxPresets,
  maxNameLength,
  i18nKey,
  renderLabel = (preset) => preset.name,
  disabled = false,
  className,
}: PresetBarProps<P>) {
  const { t } = useTranslation();

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

  const loadedPreset = presets.find((p) => p.id === loadedPresetId) ?? null;
  // プリセットをロードしていない場合は常に保存可(初回保存を妨げない)。
  // ロード済みの場合のみ、保存時から変更が無ければ保存ボタンを無効化する。
  const saveDisabled = disabled || (loadedPreset !== null && !hasChangesFromLoaded);

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

  // 無効化されたらドロップダウンを閉じる
  useEffect(() => {
    if (disabled) setIsListOpen(false);
  }, [disabled]);

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
      : t(`${i18nKey}.defaultName`, { n: presets.length + 1 });
    setSaveNameInput(initialName);
    setSaveDialogOpen(true);
  };

  const handleConfirmSaveDialog = () => {
    const name = saveNameInput.trim();
    if (!name) return;
    const conflict = presets.find((p) => p.name === name);
    if (conflict) {
      setSaveDialogOpen(false);
      setSaveConflictId(conflict.id);
      return;
    }
    if (presets.length >= maxPresets) {
      setSaveDialogOpen(false);
      setCapReachedError(true);
      return;
    }
    onSave(name);
    setSaveDialogOpen(false);
  };

  const handleConfirmOverwrite = () => {
    if (!saveConflictId) return;
    onOverwrite(saveConflictId, saveNameInput.trim());
    setSaveConflictId(null);
  };

  const handleSelectPreset = (id: string) => {
    // ロード中のプリセットを選び直した場合、変更が無ければ何もしない
    // (変更があれば、下の確認を経て保存時の内容へ戻す)。
    if (id === loadedPresetId && !hasChangesFromLoaded) {
      setIsListOpen(false);
      return;
    }
    if (id !== loadedPresetId && loadedPreset && !hasChangesFromLoaded) {
      onLoad(id);
      setIsListOpen(false);
      setDeleteConfirmId(null);
      return;
    }
    setPendingSwitchId(id);
  };

  const handleConfirmSwitch = () => {
    if (!pendingSwitchId) return;
    onLoad(pendingSwitchId);
    setPendingSwitchId(null);
    setIsListOpen(false);
    setDeleteConfirmId(null);
  };

  const openRenameDialog = (preset: P) => {
    setRenameTarget({ id: preset.id, currentName: preset.name });
    setRenameInput(preset.name);
  };

  const renameInputIsValid = () => {
    const newName = renameInput.trim();
    if (!newName) return false;
    return !presets.some((p) => p.id !== renameTarget?.id && p.name === newName);
  };

  const handleRenameConfirm = () => {
    if (!renameTarget || !renameInputIsValid()) return;
    onRename(renameTarget.id, renameInput.trim());
    setRenameTarget(null);
  };

  const pendingSwitchPreset = pendingSwitchId
    ? (presets.find((p) => p.id === pendingSwitchId) ?? null)
    : null;
  const saveConflictPreset = saveConflictId
    ? (presets.find((p) => p.id === saveConflictId) ?? null)
    : null;

  return (
    // ドラッグ可能なダイアログのヘッダー(headerExtra)に置かれた場合に、操作(子の確認ダイアログの
    // 入力欄を含む)がヘッダーのドラッグ開始(mousedownのpreventDefault)に奪われないようにする。
    <div
      className={`preset-bar${className ? ` ${className}` : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="preset-bar__controls" ref={listRef}>
        <div className="preset-bar__dropdown-wrap">
          <button
            type="button"
            className={`preset-bar__trigger${isListOpen ? ' preset-bar__trigger--open' : ''}`}
            disabled={disabled}
            onClick={() => {
              setIsListOpen((v) => !v);
              setDeleteConfirmId(null);
            }}
          >
            <span className="preset-bar__trigger-name">
              {loadedPreset ? renderLabel(loadedPreset) : t(`${i18nKey}.placeholder`)}
            </span>
            <Chevron open={isListOpen} />
          </button>
          {shouldRenderList && (
            <PresetDropdown
              animClassName={`dropdown-panel-anim${isListOpen ? '' : ' dropdown-panel-anim--closing'}`}
              presets={presets}
              loadedPresetId={loadedPresetId}
              deleteConfirmId={deleteConfirmId}
              onSetDeleteConfirmId={setDeleteConfirmId}
              onSelectPreset={handleSelectPreset}
              onOpenRenameDialog={openRenameDialog}
              onDeletePreset={onDelete}
              renderLabel={renderLabel}
              emptyLabel={t(`${i18nKey}.noPresets`)}
            />
          )}
        </div>
        <button
          type="button"
          className="preset-bar__save"
          title={t(`${i18nKey}.save`)}
          disabled={saveDisabled}
          onClick={handleOpenSaveDialog}
        >
          <img src={saveIconUrl} className="preset-bar__save-icon" alt="" />
        </button>
      </div>

      {/* プリセット保存ダイアログ(名前入力) */}
      {saveDialogOpen && (
        <ConfirmDialog
          title={t(`${i18nKey}.saveTitle`)}
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
            maxLength={maxNameLength}
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
          message={t(`${i18nKey}.capReachedMsg`, { max: maxPresets })}
          confirmLabel={t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
          onConfirm={() => setCapReachedError(false)}
        />
      )}

      {/* プリセット切り替え確認(現在の変更が失われる場合のみ表示) */}
      {pendingSwitchId && pendingSwitchPreset && (
        <ConfirmDialog
          message={t(`${i18nKey}.confirmSwitchMsg`, { name: pendingSwitchPreset.name })}
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
            maxLength={maxNameLength}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameInputIsValid()) handleRenameConfirm();
            }}
          />
          {renameInput.trim() && !renameInputIsValid() && (
            <p className="confirm-dialog__error">{t(`${i18nKey}.nameDuplicate`)}</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default PresetBar;
