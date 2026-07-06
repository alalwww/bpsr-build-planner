import { useTranslation } from 'react-i18next';
import Stepper from '../components/Stepper';
import SkillCircle, { type CircleHandlers } from './SkillCircle';
import { getSkillData } from './skillData';

function MasterySkillCard({
  skillId,
  level,
  rank,
  equipped,
  equipDisabled,
  onToggleEquipped,
  onSetLevel,
  onSetRank,
  circleHandlers,
}: {
  skillId: number;
  level: number;
  rank: number;
  equipped: boolean;
  equipDisabled: boolean;
  onToggleEquipped: () => void;
  onSetLevel: (v: number) => void;
  onSetRank: (v: number) => void;
  circleHandlers?: CircleHandlers;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const sd = getSkillData(skillId);
  const name = t(`skills.${skillId}.name`, { defaultValue: String(skillId) });
  const isDisabledOff = equipDisabled && !equipped;
  return (
    <div className={`skill-card skill-card--mastery${equipped ? ' skill-card--mastery-on' : ''}`}>
      <div className="skill-circle-zone" {...circleHandlers}>
        <SkillCircle iconPath={sd?.icon} size="md" />
      </div>
      <div className="skill-card__body">
        <div className="skill-card__name">{name}</div>
        <div className="skill-card__foot">
          <div className="skill-card__steppers">
            <Stepper
              className="skill-stepper"
              label="Lv"
              value={level}
              min={1}
              max={30}
              onChange={onSetLevel}
            />
            <span className="skill-card__sep">|</span>
            <Stepper
              className="skill-stepper"
              value={rank}
              min={0}
              max={6}
              formatValue={(v) => `G${v}`}
              onChange={onSetRank}
            />
          </div>
          <button
            type="button"
            className={`skill-equipped-btn${equipped ? ' skill-equipped-btn--on' : ''}${isDisabledOff ? ' skill-equipped-btn--disabled' : ''}`}
            onClick={onToggleEquipped}
            disabled={isDisabledOff}
            title={tUi('buildPlanner.skill.equip')}
          />
        </div>
      </div>
    </div>
  );
}

export default MasterySkillCard;
