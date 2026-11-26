import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DraggableDialog from '../components/DraggableDialog';
import ToggleChip from '../components/ToggleChip';
import { useAnchorTooltip } from '../components/useAnchorTooltip';
import SkillCircle from './SkillCircle';
import SkillTooltip from './SkillTooltip';
import { getSkillData } from './skillData';

// ロールスキルの候補は、Lvを持たない基本スキル(maxRank 0)と、Lvを持つロールイマジン(maxRank>0)に
// 分けて表示する。ロールイマジンは選択時のLvをバトルイマジン選択ダイアログのランクと同様に選べる。
const isRoleImagine = (id: number) => (getSkillData(id)?.maxRank ?? 0) > 0;

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
  const basicIds = candidateIds.filter((id) => !isRoleImagine(id));
  const imagineIds = candidateIds.filter(isRoleImagine);
  // ロールイマジンのLvの上限(全ロールイマジン共通の想定だが、念のため最大値を採る)。
  const maxLevel = Math.max(1, ...imagineIds.map((id) => getSkillData(id)?.maxRank ?? 1));
  // ロールイマジンを選んだときに設定するLv(バトルイマジンのランクと同じく既定は最大)。
  const [level, setLevel] = useState(maxLevel);
  const {
    tooltip: hoverTooltip,
    open: openHover,
    hold: holdHover,
    scheduleClose: hideHover,
  } = useAnchorTooltip<{ skillId: number; x: number; y: number; align: 'right' | 'left' }>(
    500,
    (a, b) => a.skillId === b.skillId,
    // ツールチップ内のランク/Lv切り替えを操作しやすいよう、閉じるまでの猶予を長めにし、
    // ツールチップへ向かう途中で他の候補の上を横切っても表示中のツールチップを消さない。
    { closeDelay: 400, keepWhileSwitching: true },
  ); // 別スキルへの切り替えは一旦閉じて0.5秒待たせるhover intent

  const showHover = (id: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // 画面の右半分にある候補は、ツールチップを候補の左側に表示する(イマジン選択ダイアログと同じ)。
    const onRightSide = rect.left + rect.width / 2 > window.innerWidth / 2;
    openHover(
      onRightSide
        ? { skillId: id, x: rect.left - 10, y: rect.top, align: 'left' }
        : { skillId: id, x: rect.right + 10, y: rect.top, align: 'right' },
    );
  };

  const renderItem = (id: number) => {
    const disabled = excludeIds.includes(id);
    const sd = getSkillData(id);
    const name = t(`skills.${id}.name`, { defaultValue: String(id) });
    return (
      <button
        key={id}
        type="button"
        className={`skill-picker-dialog__item${disabled ? ' skill-picker-dialog__item--disabled' : ''}`}
        disabled={disabled}
        onClick={() => {
          onSelect(id, isRoleImagine(id) ? level : 1);
          onClose();
        }}
        onMouseEnter={(e) => showHover(id, e)}
        onMouseMove={(e) => showHover(id, e)}
        onMouseLeave={hideHover}
      >
        <SkillCircle iconPath={sd?.icon} size="sm" />
        <span className="skill-picker-dialog__item-name">{name}</span>
      </button>
    );
  };

  const hoveredIsImagine = hoverTooltip ? isRoleImagine(hoverTooltip.skillId) : false;

  return (
    <>
      <DraggableDialog
        title={tUi('buildPlanner.skill.selectRoleSkill', { defaultValue: 'ロールスキルを選択' })}
        onClose={onClose}
        className="skill-picker-dialog"
        resizable
        initialSize={{ w: 560, h: 520 }}
        minSize={{ w: 360, h: 300 }}
      >
        <div className="skill-picker-dialog__grid">
          {basicIds.length > 0 && (
            <>
              <div className="skill-picker-dialog__section-heading">
                {tUi('buildPlanner.skill.roleBasicSkills')}
              </div>
              {basicIds.map(renderItem)}
            </>
          )}
          {imagineIds.length > 0 && (
            <>
              <div className="skill-picker-dialog__section-heading">
                <span>{tUi('buildPlanner.skill.roleImagines')}</span>
                <div className="skill-picker-dialog__rank-radio" role="radiogroup">
                  {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => (
                    <ToggleChip
                      key={lv}
                      selected={level === lv}
                      label={tUi('buildPlanner.skill.levelFormat', { v: lv })}
                      onClick={() => setLevel(lv)}
                    />
                  ))}
                </div>
              </div>
              {imagineIds.map(renderItem)}
            </>
          )}
        </div>
      </DraggableDialog>
      {hoverTooltip &&
        createPortal(
          <SkillTooltip
            state={{
              skillId: hoverTooltip.skillId,
              isImagine: false,
              isRoleSkill: true,
              rank: hoveredIsImagine ? level : 0,
              x: hoverTooltip.x,
              y: hoverTooltip.y,
              align: hoverTooltip.align,
              pinned: false,
            }}
            onMouseEnter={holdHover}
            onMouseLeave={hideHover}
            // ロールイマジンはツールチップ内でもLvを切り替えられ、ダイアログのLvと連動する
            // (Lvを持たない基本スキルでは切り替えを表示しない)。
            onRankChange={hoveredIsImagine ? setLevel : undefined}
          />,
          document.body,
        )}
    </>
  );
}

export default RoleSkillPickerDialog;
