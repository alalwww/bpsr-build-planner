import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import SkillCircle from './SkillCircle';
import SkillTooltip from './SkillTooltip';
import { battleImaginesData } from './skillData';

function ImaginePickerDialog({
  excludeIds,
  onSelect,
  onClose,
}: {
  excludeIds: (number | null)[];
  onSelect: (id: number, rank: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const [rank, setRank] = useState(5);
  const [hoverTooltip, setHoverTooltip] = useState<{
    skillId: number;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHover = (id: number, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverTooltip({ skillId: id, x: rect.right + 10, y: rect.top });
  };
  const hideHover = () => {
    hoverTimerRef.current = setTimeout(() => setHoverTooltip(null), 80);
  };

  return (
    <>
      <DraggableDialog
        title={tUi('buildPlanner.skill.selectImagine')}
        onClose={onClose}
        className="skill-picker-dialog"
        resizable
        initialSize={{ w: 560, h: 560 }}
        minSize={{ w: 360, h: 300 }}
        headerExtra={
          <Stepper
            className="skill-stepper"
            label={tUi('buildPlanner.skill.rank')}
            value={rank}
            min={0}
            max={5}
            formatValue={(v) => `G${v}`}
            onChange={setRank}
          />
        }
      >
        <div className="skill-picker-dialog__grid">
          {Object.values(battleImaginesData)
            .sort((a, b) => b.rarityType - a.rarityType || a.id - b.id)
            .map((bi) => {
              const disabled = excludeIds.includes(bi.id);
              const name = t(`battleImagines.${bi.id}.name`, { defaultValue: String(bi.id) });
              return (
                <button
                  key={bi.id}
                  type="button"
                  className={`skill-picker-dialog__item${disabled ? ' skill-picker-dialog__item--disabled' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    onSelect(bi.id, rank);
                    onClose();
                  }}
                  onMouseEnter={(e) => showHover(bi.id, e)}
                  onMouseLeave={hideHover}
                >
                  <SkillCircle iconPath={bi.icon} isImagine rarityType={bi.rarityType} size="sm" />
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
              isImagine: true,
              rank,
              x: hoverTooltip.x,
              y: hoverTooltip.y,
              pinned: false,
            }}
            onMouseEnter={() => {
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            }}
            onMouseLeave={hideHover}
          />,
          document.body,
        )}
    </>
  );
}

export default ImaginePickerDialog;
