import { useTranslation } from 'react-i18next';
import { PROFESSIONS } from '../profession';
import type { BuildPlanData } from '../buildPlan';
import { getClassIconUrl } from './classIcons';
import renameIconUrl from '../../assets/ui/camera_icon_function_29.png';
import deleteIconUrl from '../../assets/ui/com_btn_delete.png';

interface PlanListDropdownProps {
  buildPlans: BuildPlanData[];
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onLoadPlan: (id: string) => void;
  onOpenRenameDialog: (plan: BuildPlanData) => void;
  onDeletePlan: (id: string) => void;
  onOpenExportDialog: () => void;
  onOpenImportDialog: () => void;
}

function PlanListDropdown({
  buildPlans,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onLoadPlan,
  onOpenRenameDialog,
  onDeletePlan,
  onOpenExportDialog,
  onOpenImportDialog,
}: PlanListDropdownProps) {
  const { t } = useTranslation();
  return (
    <div className="character-panel__plan-list">
      {buildPlans.length === 0 ? (
        <div className="character-panel__plan-empty">
          {t('buildPlanner.noPlans', { defaultValue: 'No saved plans' })}
        </div>
      ) : (
        buildPlans.map((plan) => {
          const planProfId = PROFESSIONS[plan.professionKey]?.professionId;
          const planIconUrl = planProfId != null ? getClassIconUrl(planProfId) : undefined;
          return (
            <div key={plan.id} className="character-panel__plan-item">
              {deleteConfirmId === plan.id ? (
                <div className="character-panel__plan-confirm">
                  <span className="character-panel__plan-confirm-label">
                    {t('buildPlanner.confirmDelete', { defaultValue: '削除しますか？' })}
                  </span>
                  <button
                    type="button"
                    className="character-panel__plan-confirm-ok"
                    onClick={() => {
                      onDeletePlan(plan.id);
                      onSetDeleteConfirmId(null);
                    }}
                  >
                    {t('buildPlanner.confirmOk', { defaultValue: 'OK' })}
                  </button>
                  <button
                    type="button"
                    className="character-panel__plan-confirm-cancel"
                    onClick={() => onSetDeleteConfirmId(null)}
                  >
                    {t('buildPlanner.confirmCancel', { defaultValue: 'キャンセル' })}
                  </button>
                </div>
              ) : (
                <>
                  {planIconUrl && (
                    <img src={planIconUrl} className="character-panel__plan-class-icon" alt="" />
                  )}
                  <button
                    type="button"
                    className="character-panel__plan-load"
                    onClick={() => onLoadPlan(plan.id)}
                  >
                    {plan.name || t('buildPlanner.buildPlanPlaceholder')}
                  </button>
                  <button
                    type="button"
                    className="character-panel__plan-rename"
                    title={t('buildPlanner.renamePlan', { defaultValue: 'リネーム' })}
                    onClick={() => onOpenRenameDialog(plan)}
                  >
                    <img src={renameIconUrl} className="character-panel__plan-action-icon" alt="" />
                  </button>
                  <button
                    type="button"
                    className="character-panel__plan-delete"
                    title={t('buildPlanner.deletePlan', { defaultValue: 'Delete' })}
                    onClick={() => onSetDeleteConfirmId(plan.id)}
                  >
                    <img src={deleteIconUrl} className="character-panel__plan-action-icon" alt="" />
                  </button>
                </>
              )}
            </div>
          );
        })
      )}
      <div className="character-panel__plan-item character-panel__plan-item--code-actions">
        <button
          type="button"
          className="character-panel__plan-load character-panel__plan-code-action"
          onClick={onOpenExportDialog}
        >
          {t('buildPlanner.exportPlan', { defaultValue: 'エクスポート' })}
        </button>
        <button
          type="button"
          className="character-panel__plan-load character-panel__plan-code-action"
          onClick={onOpenImportDialog}
        >
          {t('buildPlanner.importPlan', { defaultValue: 'インポート' })}
        </button>
      </div>
    </div>
  );
}

export default PlanListDropdown;
