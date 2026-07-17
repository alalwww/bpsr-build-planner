import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Stepper from '../components/Stepper';
import SkillCircle, { type CircleHandlers } from './SkillCircle';
import RoleSkillPickerDialog from './RoleSkillPickerDialog';
import { getSkillData } from './skillData';

function RoleSkillSlot({
  index,
  id,
  rank,
  candidateIds,
  excludeIds,
  onSet,
  onSetRank,
  onClear,
  circleHandlers,
}: {
  index: number;
  id: number | null;
  rank: number;
  candidateIds: number[];
  excludeIds: (number | null)[];
  onSet: (id: number) => void;
  onSetRank: (v: number) => void;
  onClear: () => void;
  circleHandlers?: CircleHandlers;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const sd = id != null ? getSkillData(id) : null;
  const name = id != null ? t(`skills.${id}.name`, { defaultValue: String(id) }) : null;
  const maxRank = sd?.maxRank ?? 0;

  return (
    <>
      <div className="skill-card skill-card--imagine skill-card--role-slot">
        {id != null ? (
          <>
            <div className="skill-circle-zone" {...circleHandlers}>
              <SkillCircle iconPath={sd?.icon} size="md" />
            </div>
            <div className="skill-card__body">
              <div
                className="skill-card__name skill-card__name--clickable"
                onClick={() => setShowPicker(true)}
              >
                {name}
              </div>
              {maxRank > 0 && (
                <div className="skill-card__foot">
                  <div className="skill-card__steppers">
                    <Stepper
                      className="skill-stepper"
                      label="Lv"
                      value={rank}
                      min={1}
                      max={maxRank}
                      onChange={onSetRank}
                    />
                  </div>
                </div>
              )}
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
            ＋ {tUi('buildPlanner.skill.selectRoleSkill', { defaultValue: 'ロールスキルを選択' })}
          </button>
        )}
      </div>
      {showPicker && (
        <RoleSkillPickerDialog
          candidateIds={candidateIds}
          excludeIds={excludeIds.filter((_, idx) => idx !== index)}
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

export default RoleSkillSlot;
