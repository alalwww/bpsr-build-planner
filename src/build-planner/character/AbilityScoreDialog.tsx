import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import type { AbilityScoreBreakdown } from '../types';

interface AbilityScoreDialogProps {
  abilityScore: AbilityScoreBreakdown;
  expandedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onClose: () => void;
}

function AbilityScoreDialog({
  abilityScore,
  expandedGroups,
  onToggleGroup,
  onClose,
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
      total: bd.skillFixed + bd.skillMastery + bd.skillImaginary,
      children: [
        { key: 'skillFixed', value: bd.skillFixed },
        { key: 'skillMastery', value: bd.skillMastery },
        { key: 'skillImaginary', value: bd.skillImaginary },
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
    >
      <table className="ability-score-dialog__table">
        <thead>
          <tr>
            <th className="ability-score-dialog__th">
              {t('buildPlanner.abilityScoreBreakdown.source')}
            </th>
            <th className="ability-score-dialog__th ability-score-dialog__th--right">
              {t('buildPlanner.abilityScoreBreakdown.value')}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isExpandable = group.children !== null;
            const isExpanded = expandedGroups.has(group.key);
            return (
              <Fragment key={group.key}>
                <tr
                  className={`ability-score-dialog__row${isExpandable ? ' ability-score-dialog__row--group' : ''}`}
                  onClick={isExpandable ? () => onToggleGroup(group.key) : undefined}
                >
                  <td className="ability-score-dialog__td ability-score-dialog__td--group-label">
                    {isExpandable && (
                      <span className="ability-score-dialog__toggle">{isExpanded ? '▼' : '▶'}</span>
                    )}
                    {t(`buildPlanner.abilityScoreBreakdown.${group.key}`)}
                  </td>
                  <td className="ability-score-dialog__td ability-score-dialog__td--right">
                    {group.total.toLocaleString()}
                  </td>
                </tr>
                {isExpanded &&
                  group.children &&
                  group.children.map((child, ci) => {
                    const isLast = ci === group.children!.length - 1;
                    return (
                      <tr
                        key={child.key}
                        className="ability-score-dialog__row ability-score-dialog__row--child"
                      >
                        <td className="ability-score-dialog__td ability-score-dialog__td--child-label">
                          <span className="ability-score-dialog__tree">{isLast ? '└' : '├'}</span>
                          {t(`buildPlanner.abilityScoreBreakdown.${child.key}`)}
                        </td>
                        <td className="ability-score-dialog__td ability-score-dialog__td--right">
                          {child.value.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="ability-score-dialog__row ability-score-dialog__row--total">
            <td className="ability-score-dialog__td">
              {t('buildPlanner.abilityScoreBreakdown.total')}
            </td>
            <td className="ability-score-dialog__td ability-score-dialog__td--right">
              {bd.total.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </DraggableDialog>
  );
}

export default AbilityScoreDialog;
