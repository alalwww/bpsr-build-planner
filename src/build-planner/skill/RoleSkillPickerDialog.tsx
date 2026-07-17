import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DraggableDialog from '../components/DraggableDialog';
import { useAnchorTooltip } from '../components/useAnchorTooltip';
import SkillCircle from './SkillCircle';
import SkillTooltip from './SkillTooltip';
import { getSkillData } from './skillData';

function RoleSkillPickerDialog({
  candidateIds,
  excludeIds,
  onSelect,
  onClose,
}: {
  candidateIds: number[];
  excludeIds: (number | null)[];
  onSelect: (id: number, rank: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const {
    tooltip: hoverTooltip,
    open: openHover,
    cancelClose: cancelHoverClose,
    scheduleClose: hideHover,
  } = useAnchorTooltip<{ skillId: number; x: number; y: number }>();

  const showHover = (id: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    openHover({ skillId: id, x: rect.right + 10, y: rect.top });
  };

  return (
    <>
      <DraggableDialog
        title={tUi('buildPlanner.skill.selectRoleSkill', { defaultValue: 'ロールスキルを選択' })}
        onClose={onClose}
        className="skill-picker-dialog"
        resizable
        initialSize={{ w: 560, h: 480 }}
        minSize={{ w: 360, h: 300 }}
      >
        <div className="skill-picker-dialog__grid">
          {candidateIds.map((id) => {
            const disabled = excludeIds.includes(id);
            const sd = getSkillData(id);
            const name = t(`skills.${id}.name`, { defaultValue: String(id) });
            const defaultRank = (sd?.maxRank ?? 0) > 0 ? 1 : 0;
            return (
              <button
                key={id}
                type="button"
                className={`skill-picker-dialog__item${disabled ? ' skill-picker-dialog__item--disabled' : ''}`}
                disabled={disabled}
                onClick={() => {
                  onSelect(id, defaultRank);
                  onClose();
                }}
                onMouseEnter={(e) => showHover(id, e)}
                onMouseLeave={hideHover}
              >
                <SkillCircle iconPath={sd?.icon} size="sm" />
                <span className="skill-picker-dialog__item-name">{name}</span>
              </button>
            );
          })}
        </div>
      </DraggableDialog>
      {hoverTooltip &&
        createPortal(
          <SkillTooltip
            state={{
              skillId: hoverTooltip.skillId,
              isImagine: false,
              rank: 0,
              x: hoverTooltip.x,
              y: hoverTooltip.y,
              pinned: false,
            }}
            onMouseEnter={cancelHoverClose}
            onMouseLeave={hideHover}
          />,
          document.body,
        )}
    </>
  );
}

export default RoleSkillPickerDialog;
