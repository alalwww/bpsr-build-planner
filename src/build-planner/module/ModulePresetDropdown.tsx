import { useTranslation } from 'react-i18next';
import type { ModulePreset } from './modulePresets';
import renameIconUrl from '../../assets/ui/camera_icon_function_29.png';
import deleteIconUrl from '../../assets/ui/com_btn_delete.png';

interface ModulePresetDropdownProps {
  presets: ModulePreset[];
  loadedPresetId: string | null;
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onSelectPreset: (id: string) => void;
  onOpenRenameDialog: (preset: ModulePreset) => void;
  onDeletePreset: (id: string) => void;
  /** dropdown-panel-anim(+開閉に応じ--closing)を渡し、位置決めラッパー側で開閉アニメーションする。 */
  animClassName?: string;
}

// モジュールプリセットのドロップダウンパネル。character/PlanListDropdown.tsx と同じ
// UIパターン(一覧・インライン削除確認・リネームボタン)をモジュールプリセット向けに用意したもの。
function ModulePresetDropdown({
  presets,
  loadedPresetId,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onSelectPreset,
  onOpenRenameDialog,
  onDeletePreset,
  animClassName,
}: ModulePresetDropdownProps) {
  const { t } = useTranslation();
  return (
    <div className={`module-preset__list-anchor${animClassName ? ` ${animClassName}` : ''}`}>
      <div className="dropdown-panel-anim__inner">
        <div className="module-preset__list">
          {presets.length === 0 ? (
            <div className="module-preset__empty">
              {t('buildPlanner.modulePreset.noPresets', { defaultValue: '保存されたプリセットはありません' })}
            </div>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="module-preset__item">
                {deleteConfirmId === preset.id ? (
                  <div className="module-preset__confirm">
                    <span className="module-preset__confirm-label">
                      {t('buildPlanner.confirmDelete', { defaultValue: '削除しますか？' })}
                    </span>
                    <button
                      type="button"
                      className="module-preset__confirm-ok"
                      onClick={() => {
                        onDeletePreset(preset.id);
                        onSetDeleteConfirmId(null);
                      }}
                    >
                      {t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
                    </button>
                    <button
                      type="button"
                      className="module-preset__confirm-cancel"
                      onClick={() => onSetDeleteConfirmId(null)}
                    >
                      {t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`module-preset__load${preset.id === loadedPresetId ? ' module-preset__load--active' : ''}`}
                      onClick={() => onSelectPreset(preset.id)}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      className="module-preset__rename"
                      title={t('buildPlanner.renamePlan', { defaultValue: 'リネーム' })}
                      onClick={() => onOpenRenameDialog(preset)}
                    >
                      <img src={renameIconUrl} className="module-preset__action-icon" alt="" />
                    </button>
                    <button
                      type="button"
                      className="module-preset__delete"
                      title={t('buildPlanner.deletePlan', { defaultValue: 'Delete' })}
                      onClick={() => onSetDeleteConfirmId(preset.id)}
                    >
                      <img src={deleteIconUrl} className="module-preset__action-icon" alt="" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ModulePresetDropdown;
