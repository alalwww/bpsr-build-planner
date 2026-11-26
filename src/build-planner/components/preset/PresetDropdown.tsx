import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NamedPreset } from './presetStorage';
import renameIconUrl from '../../../assets/ui/camera_icon_function_29.png';
import deleteIconUrl from '../../../assets/ui/com_btn_delete.png';

interface PresetDropdownProps<P extends NamedPreset> {
  presets: P[];
  loadedPresetId: string | null;
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onSelectPreset: (id: string) => void;
  onOpenRenameDialog: (preset: P) => void;
  onDeletePreset: (id: string) => void;
  /** プリセット1件の表示内容(省略時は名前のみ)。 */
  renderLabel: (preset: P) => ReactNode;
  /** プリセットが1件も無いときの表示文言。 */
  emptyLabel: string;
  /** dropdown-panel-anim(+開閉に応じ--closing)を渡し、位置決めラッパー側で開閉アニメーションする。 */
  animClassName?: string;
}

// プリセットのドロップダウンパネル。character/PlanListDropdown.tsx と同じ
// UIパターン(一覧・インライン削除確認・リネームボタン)をプリセット向けに用意したもの。
function PresetDropdown<P extends NamedPreset>({
  presets,
  loadedPresetId,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onSelectPreset,
  onOpenRenameDialog,
  onDeletePreset,
  renderLabel,
  emptyLabel,
  animClassName,
}: PresetDropdownProps<P>) {
  const { t } = useTranslation();
  return (
    <div className={`preset-list__anchor${animClassName ? ` ${animClassName}` : ''}`}>
      <div className="dropdown-panel-anim__inner">
        <div className="preset-list">
          {presets.length === 0 ? (
            <div className="preset-list__empty">{emptyLabel}</div>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="preset-list__item">
                {deleteConfirmId === preset.id ? (
                  <div className="preset-list__confirm">
                    <span className="preset-list__confirm-label">
                      {t('buildPlanner.confirmDelete', { defaultValue: '削除しますか？' })}
                    </span>
                    <button
                      type="button"
                      className="preset-list__confirm-ok"
                      onClick={() => {
                        onDeletePreset(preset.id);
                        onSetDeleteConfirmId(null);
                      }}
                    >
                      {t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
                    </button>
                    <button
                      type="button"
                      className="preset-list__confirm-cancel"
                      onClick={() => onSetDeleteConfirmId(null)}
                    >
                      {t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`preset-list__load${preset.id === loadedPresetId ? ' preset-list__load--active' : ''}`}
                      onClick={() => onSelectPreset(preset.id)}
                    >
                      {renderLabel(preset)}
                    </button>
                    <button
                      type="button"
                      className="preset-list__rename"
                      title={t('buildPlanner.renamePlan', { defaultValue: 'リネーム' })}
                      onClick={() => onOpenRenameDialog(preset)}
                    >
                      <img src={renameIconUrl} className="preset-list__action-icon" alt="" />
                    </button>
                    <button
                      type="button"
                      className="preset-list__delete"
                      title={t('buildPlanner.deletePlan', { defaultValue: 'Delete' })}
                      onClick={() => onSetDeleteConfirmId(preset.id)}
                    >
                      <img src={deleteIconUrl} className="preset-list__action-icon" alt="" />
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

export default PresetDropdown;
