import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import '../components/components.css';
import './character.css';
import { CollapsibleBody } from '../components/CollapsibleSection';
import DraggableDialog from '../components/DraggableDialog';
import type { AbilityScoreBreakdown } from '../types';

interface AbilityScoreDialogProps {
  abilityScore: AbilityScoreBreakdown;
  expandedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onClose: () => void;
  /** OSネイティブウィンドウ(ability-score.html)内での表示か。既定 false。 */
  windowed?: boolean;
}

function AbilityScoreDialog({
  abilityScore,
  expandedGroups,
  onToggleGroup,
  onClose,
  windowed = false,
}: AbilityScoreDialogProps) {
  const { t } = useTranslation();
  const bd = abilityScore;
  const groups: Array<
    | {
        key: string;
        total: number;
        children: Array<{ key: string; value: number }>;
      }
    | { key: string; total: number; children: null }
  > = [
    { key: 'other', total: bd.other, children: null },
    {
      key: 'abilityGroup',
      total: bd.abilityR1 + bd.abilityR2,
      children: [
        { key: 'abilityR1', value: bd.abilityR1 },
        { key: 'abilityR2', value: bd.abilityR2 },
      ],
    },
    {
      key: 'skillGroup',
      total: bd.skillFixed + bd.skillMastery + bd.skillImagine,
      children: [
        { key: 'skillFixed', value: bd.skillFixed },
        { key: 'skillMastery', value: bd.skillMastery },
        { key: 'skillImagine', value: bd.skillImagine },
      ],
    },
    {
      key: 'equipmentGroup',
      total: bd.equipmentBase + bd.equipmentEnchant + bd.equipmentRefine + bd.equipmentSuit,
      children: [
        { key: 'equipmentBase', value: bd.equipmentBase },
        { key: 'equipmentEnchant', value: bd.equipmentEnchant },
        { key: 'equipmentRefine', value: bd.equipmentRefine },
        { key: 'equipmentSuit', value: bd.equipmentSuit },
      ],
    },
    {
      key: 'moduleGroup',
      total: bd.moduleLink + bd.moduleCore,
      children: [
        { key: 'moduleLink', value: bd.moduleLink },
        { key: 'moduleCore', value: bd.moduleCore },
      ],
    },
    {
      key: 'phantomGroup',
      total: bd.phantomLevel + bd.phantom,
      children: [
        { key: 'phantomLevel', value: bd.phantomLevel },
        { key: 'phantom', value: bd.phantom },
      ],
    },
  ];

  return (
    <DraggableDialog
      title={t('buildPlanner.abilityScore')}
      onClose={onClose}
      className="ability-score-dialog"
      windowed={windowed}
    >
      {/* 折り畳み(グループ内訳)をアニメーションさせるため、<table>ではなくCSS Gridの
          2列レイアウトで組む(display:contentsの行ラッパーで<table>同様の列揃えを維持
          しつつ、子要素一覧をCollapsibleBodyで高さアニメーションできるようにする)。 */}
      <div className="ability-score-dialog__grid">
        <div className="ability-score-dialog__row ability-score-dialog__row--header">
          <div className="ability-score-dialog__cell">
            {t('buildPlanner.abilityScoreBreakdown.source')}
          </div>
          <div className="ability-score-dialog__cell ability-score-dialog__cell--right">
            {t('buildPlanner.abilityScoreBreakdown.value')}
          </div>
        </div>
        {groups.map((group) => {
          const isExpandable = group.children !== null;
          const isExpanded = expandedGroups.has(group.key);
          return (
            <Fragment key={group.key}>
              <div
                className={`ability-score-dialog__row${isExpandable ? ' ability-score-dialog__row--group' : ''}`}
                onClick={isExpandable ? () => onToggleGroup(group.key) : undefined}
              >
                <div className="ability-score-dialog__cell ability-score-dialog__cell--group-label">
                  {isExpandable && (
                    <span className="ability-score-dialog__toggle">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                  {t(`buildPlanner.abilityScoreBreakdown.${group.key}`)}
                </div>
                <div className="ability-score-dialog__cell ability-score-dialog__cell--right">
                  {Math.round(group.total).toLocaleString()}
                </div>
              </div>
              {group.children && (
                <div className="ability-score-dialog__child-span">
                  <CollapsibleBody open={isExpanded}>
                    <div className="ability-score-dialog__child-grid">
                      {group.children.map((child, ci) => {
                        const isLast = ci === group.children!.length - 1;
                        return (
                          <div key={child.key} className="ability-score-dialog__child-row">
                            <div className="ability-score-dialog__cell ability-score-dialog__cell--child-label">
                              <span className="ability-score-dialog__tree">
                                {isLast ? '└' : '├'}
                              </span>
                              {t(`buildPlanner.abilityScoreBreakdown.${child.key}`)}
                            </div>
                            <div className="ability-score-dialog__cell ability-score-dialog__cell--right">
                              {Math.round(child.value).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleBody>
                </div>
              )}
            </Fragment>
          );
        })}
        <div className="ability-score-dialog__row ability-score-dialog__row--total">
          <div className="ability-score-dialog__cell">
            {t('buildPlanner.abilityScoreBreakdown.total')}
          </div>
          <div className="ability-score-dialog__cell ability-score-dialog__cell--right">
            {Math.round(bd.total).toLocaleString()}
          </div>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default AbilityScoreDialog;
