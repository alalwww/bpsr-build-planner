import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Stepper from '../components/Stepper';
import SkillCircle, { type CircleHandlers } from './SkillCircle';
import ImaginaryPickerDialog from './ImaginaryPickerDialog';
import { getBattleImaginaryData } from './skillData';

function BattleImaginarySlot({
  index,
  id,
  rank,
  allIds,
  onSet,
  onSetRank,
  onClear,
  dragHandlers,
  isDragOver,
  circleHandlers,
}: {
  index: number;
  id: number | null;
  rank: number;
  allIds: (number | null)[];
  onSet: (id: number) => void;
  onSetRank: (v: number) => void;
  onClear: () => void;
  dragHandlers: {
    onDragStart: (i: number) => void;
    onDragOver: (e: React.DragEvent, i: number) => void;
    onDrop: (i: number) => void;
    onDragEnd: () => void;
    onDragLeave: () => void;
  };
  isDragOver: boolean;
  circleHandlers?: CircleHandlers;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const bi = id != null ? getBattleImaginaryData(id) : null;
  const name = id != null ? t(`battleImaginaries.${id}.name`, { defaultValue: String(id) }) : null;

  return (
    <>
      <div
        className={`skill-card skill-card--imaginary${isDragOver ? ' skill-card--drag-over' : ''}`}
        draggable={id != null}
        onDragStart={() => dragHandlers.onDragStart(index)}
        onDragOver={(e) => dragHandlers.onDragOver(e, index)}
        onDrop={() => dragHandlers.onDrop(index)}
        onDragEnd={dragHandlers.onDragEnd}
        onDragLeave={dragHandlers.onDragLeave}
      >
        {id != null ? (
          <>
            <div className="skill-circle-zone" {...circleHandlers}>
              <SkillCircle iconPath={bi?.icon} isImagine rarityType={bi?.rarityType} size="md" />
            </div>
            <div className="skill-card__body">
              <div
                className="skill-card__name skill-card__name--clickable"
                onClick={() => setShowPicker(true)}
              >
                {name}
              </div>
              <div className="skill-card__foot">
                <div className="skill-card__steppers">
                  <Stepper
                    className="skill-stepper"
                    label={tUi('buildPlanner.skill.rank')}
                    value={rank}
                    min={0}
                    max={bi?.maxRank ?? 5}
                    formatValue={(v) => `G${v}`}
                    onChange={onSetRank}
                  />
                </div>
              </div>
              <button type="button" className="skill-slot__clear-btn" onClick={onClear}>
                ✕
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="skill-slot__empty-btn"
            onClick={() => setShowPicker(true)}
          >
            ＋ {tUi('buildPlanner.skill.selectImaginary')}
          </button>
        )}
      </div>
      {showPicker && (
        <ImaginaryPickerDialog
          excludeIds={allIds.filter((_, idx) => idx !== index)}
          onSelect={(newId, newRank) => {
            onSet(newId);
            onSetRank(newRank);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

export default BattleImaginarySlot;
