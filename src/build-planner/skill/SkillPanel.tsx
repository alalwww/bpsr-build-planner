import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './skill.css';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { PROFESSIONS } from '../profession';
import { classesData, getSkillData } from './skillData';
import { calculateSkillAbilityScore } from '../stats/calculateAbilityScore';
import {
  selectRoleSkills,
  selectSkillReplacements,
  selectTalentNodesById,
} from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import SkillCircle, { type CircleHandlers } from './SkillCircle';
import FixedSkillCard from './FixedSkillCard';
import MasterySkillCard from './MasterySkillCard';
import BattleImaginarySlot from './BattleImaginarySlot';
import SkillTooltip from './SkillTooltip';
import { useDragReorder } from './useDragReorder';
import { useCursorTooltip } from '../components/useCursorTooltip';

interface SkillTooltipKey {
  skillId: number;
  isImagine: boolean;
  rank: number;
  score?: number;
  align: 'right' | 'left';
}

// ---- Props ----

export interface SkillPanelProps {
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
}

// ---- Main ----

export default function SkillPanel({ professionKey }: SkillPanelProps) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();

  const {
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    fixedLevels,
    fixedRanks,
    battleImaginaries,
    imaginaryRanks,
    talentR1EnabledIds,
    talentR2EnabledIds,
  } = useBuildStore(
    useShallow((s) => ({
      masteryEquipped: s.masteryEquipped,
      masteryLevels: s.masteryLevels,
      masteryRanks: s.masteryRanks,
      fixedLevels: s.fixedLevels,
      fixedRanks: s.fixedRanks,
      battleImaginaries: s.battleImaginaries,
      imaginaryRanks: s.imaginaryRanks,
      talentR1EnabledIds: s.talentR1EnabledIds,
      talentR2EnabledIds: s.talentR2EnabledIds,
    })),
  );
  const onToggleMasteryEquipped = useBuildStore((s) => s.toggleMasteryEquipped);
  const onSetMasteryLevel = useBuildStore((s) => s.setMasteryLevel);
  const onSetMasteryRank = useBuildStore((s) => s.setMasteryRank);
  const onSetFixedLevel = useBuildStore((s) => s.setFixedLevel);
  const onSetFixedRank = useBuildStore((s) => s.setFixedRank);
  const onSetBattleImaginary = useBuildStore((s) => s.setBattleImaginary);
  const onReorderBattleImaginaries = useBuildStore((s) => s.reorderBattleImaginaries);
  const onSetImaginaryRank = useBuildStore((s) => s.setImaginaryRank);

  const professionId = PROFESSIONS[professionKey].professionId;
  const roleSkills = selectRoleSkills(professionId);
  const talentNodesById = selectTalentNodesById(professionId);
  const skillReplacements = selectSkillReplacements(
    talentR1EnabledIds,
    talentR2EnabledIds,
    talentNodesById,
  );
  const { tooltip, makeHandlers, cancelClose, scheduleClose, close } =
    useCursorTooltip<SkillTooltipKey>(
      (a, b) => a.skillId === b.skillId && a.isImagine === b.isImagine,
    );

  const makeCircleHandlers = (
    skillId: number,
    isImagine = false,
    rank = 0,
    score?: number,
    align: 'right' | 'left' = 'right',
  ): CircleHandlers => makeHandlers({ skillId, isImagine, rank, score, align }, align);

  const normalSkillLabel = tUi('buildPlanner.skill.masterySkills', {
    defaultValue: 'マスタリースキル',
  });
  const roleSkillLabel = t('uiLabels.roleSkill', { defaultValue: 'ロールスキル' });
  const battleImagineLabel = t('uiLabels.battleImagine', { defaultValue: 'バトルイマジン' });

  const cls = classesData[String(PROFESSIONS[professionKey].professionId)];
  const rawFixedIds = [
    cls?.normalAttackSkill[0],
    cls?.specialSkill[0],
    cls?.ultimateSkill[0],
  ].filter((id): id is number => id != null);
  const displayFixedIds = rawFixedIds.map((id) => skillReplacements[id] ?? id);
  const masteryIds = cls?.normalSkill ?? [];
  const equippedCount = masteryEquipped.filter(Boolean).length;

  // 固定スキルの能力スコアはグループ内の全skillId(突破後の代替IDを含む場合がある)を
  // 同じLv/Rankで合算する。合計能力スコアの算出ロジックと一致させる。
  const fixedGroups = [
    cls?.normalAttackSkill ?? [],
    cls?.specialSkill ?? [],
    cls?.ultimateSkill ?? [],
  ];
  const fixedSkillScore = (i: number): number =>
    fixedGroups[i].reduce(
      (sum, id) =>
        sum + calculateSkillAbilityScore(id, fixedLevels[i] ?? 30, fixedRanks[i] ?? 6, false),
      0,
    );

  const imaginaryDnd = useDragReorder(onReorderBattleImaginaries);

  return (
    <div className="skill-panel">
      {/* 固定スキル */}
      <div className="skill-section">
        <div className="skill-grid skill-grid--3col">
          {displayFixedIds.map((skillId, i) => (
            <FixedSkillCard
              key={i}
              skillId={skillId}
              level={fixedLevels[i] ?? 30}
              rank={fixedRanks[i] ?? 6}
              onSetLevel={(v) => onSetFixedLevel(i, v)}
              onSetRank={(v) => onSetFixedRank(i, v)}
              circleHandlers={makeCircleHandlers(
                skillId,
                false,
                fixedRanks[i] ?? 6,
                fixedSkillScore(i),
                i === 2 ? 'left' : 'right',
              )}
            />
          ))}
        </div>
      </div>

      {/* マスタリースキル */}
      <div className="skill-section">
        <div className="skill-section__separator">
          <span>{normalSkillLabel}</span>
          <span className="skill-section__equipped-count">{equippedCount}/4</span>
        </div>
        <div className="skill-grid skill-grid--3col">
          {masteryIds.map((skillId, i) => (
            <MasterySkillCard
              key={skillId}
              skillId={skillId}
              level={masteryLevels[i] ?? 30}
              rank={masteryRanks[i] ?? 6}
              equipped={masteryEquipped[i] ?? false}
              equipDisabled={equippedCount >= 4}
              onToggleEquipped={() => onToggleMasteryEquipped(i)}
              onSetLevel={(v) => onSetMasteryLevel(i, v)}
              onSetRank={(v) => onSetMasteryRank(i, v)}
              circleHandlers={makeCircleHandlers(
                skillId,
                false,
                masteryRanks[i] ?? 6,
                calculateSkillAbilityScore(
                  skillId,
                  masteryLevels[i] ?? 30,
                  masteryRanks[i] ?? 6,
                  false,
                ),
                i === 2 || i === 5 ? 'left' : 'right',
              )}
            />
          ))}
        </div>
      </div>

      {/* バトルイマジン */}
      <div className="skill-section">
        <div className="skill-section__separator">
          <span>{battleImagineLabel}</span>
        </div>
        <div className="imaginary-row">
          {battleImaginaries.map((id, i) => (
            <BattleImaginarySlot
              key={i}
              index={i}
              id={id}
              rank={imaginaryRanks[i] ?? 5}
              allIds={battleImaginaries}
              onSet={(newId) => onSetBattleImaginary(i, newId)}
              onSetRank={(v) => onSetImaginaryRank(i, v)}
              onClear={() => onSetBattleImaginary(i, null)}
              dragHandlers={imaginaryDnd}
              isDragOver={imaginaryDnd.dragOver === i}
              circleHandlers={
                id != null
                  ? makeCircleHandlers(
                      id,
                      true,
                      imaginaryRanks[i] ?? 5,
                      calculateSkillAbilityScore(id, undefined, imaginaryRanks[i] ?? 5, true),
                    )
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ロールスキル */}
      <div className="skill-section">
        <div className="skill-section__separator">
          <span>{roleSkillLabel}</span>
        </div>
        <div className="role-skill-row">
          {roleSkills.map((skillId, i) => {
            const sd = getSkillData(skillId);
            const name = t(`skills.${skillId}.name`, { defaultValue: String(skillId) });
            const align = i === 2 || i === 3 ? 'left' : 'right';
            return (
              <div key={skillId} className="skill-card skill-card--role">
                <div
                  className="skill-circle-zone"
                  {...makeCircleHandlers(skillId, false, 0, undefined, align)}
                >
                  <SkillCircle iconPath={sd?.icon} size="md" />
                </div>
                <div className="skill-card__body">
                  <div className="skill-card__name">{name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tooltip && (
        <SkillTooltip
          state={{ ...tooltip.key, x: tooltip.x, y: tooltip.y, pinned: tooltip.pinned }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onRequestClose={close}
        />
      )}
    </div>
  );
}
