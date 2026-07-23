import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import Chevron from '../components/Chevron';
import DraggableDialog from '../components/DraggableDialog';
import ToggleButtonGroup from '../components/ToggleButtonGroup';
import ToggleChip from '../components/ToggleChip';
import { useAnchorTooltip } from '../components/useAnchorTooltip';
import { useSessionState } from '../components/useSessionState';
import {
  IMAGINE_QUALITY_FILTERS,
  IMAGINE_SEASON_FILTERS,
  isImagineFilterMatch,
  type ImagineQualityFilter,
  type ImagineSeasonFilter,
} from './imagineFilterData';
import SkillCircle from './SkillCircle';
import SkillTooltip from './SkillTooltip';
import { battleImaginesData } from './skillData';

// G0〜G5の6段階固定(常にいずれか1つを選択、全解除不可のラジオボタン形式)。
const IMAGINE_RANKS = [0, 1, 2, 3, 4, 5];

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
  // 絞り込み折りたたみ領域の開閉状態。2つのバトルイマジンスロットで共通の1状態とし、
  // ダイアログを開き直しても(別スロットのダイアログでも)維持されるようにする
  // (装備選択ダイアログのcandidateFilterExpandedと同じuseSessionState、非永続化)。
  const [filterExpanded, setFilterExpanded] = useSessionState('imagineFilterExpanded', true);
  const [seasonFilter, setSeasonFilter] = useState<ImagineSeasonFilter | null>(null);
  const [qualityFilter, setQualityFilter] = useState<ImagineQualityFilter | null>(null);
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

  // コラボは品質(特殊金/橙/紫)を持たない排他カテゴリのため、コラボ⇔品質フィルターは
  // 互いに一方を選ぶと他方を解除する(同時選択すると0件になってしまうため)。
  const handleSeasonFilterChange = (value: ImagineSeasonFilter | null) => {
    setSeasonFilter(value);
    if (value === 'collab') setQualityFilter(null);
  };

  const handleQualityFilterChange = (value: ImagineQualityFilter | null) => {
    setQualityFilter(value);
    if (value !== null && seasonFilter === 'collab') setSeasonFilter(null);
  };

  const filteredImagines = useMemo(
    () =>
      Object.values(battleImaginesData)
        .filter((bi) => isImagineFilterMatch(bi, seasonFilter, qualityFilter))
        .sort((a, b) => b.rarityType - a.rarityType || a.id - b.id),
    [seasonFilter, qualityFilter],
  );

  return (
    <>
      <DraggableDialog
        title={tUi('buildPlanner.skill.selectImagine')}
        onClose={onClose}
        className="skill-picker-dialog"
        resizable
        initialSize={{ w: 560, h: 560 }}
        minSize={{ w: 360, h: 300 }}
      >
        <div className="skill-picker-dialog__toolbar">
          <div className="skill-picker-dialog__rank-radio" role="radiogroup">
            <span className="skill-picker-dialog__rank-radio-label">
              {tUi('buildPlanner.skill.rank')}
            </span>
            {IMAGINE_RANKS.map((r) => (
              <ToggleChip
                key={r}
                selected={rank === r}
                label={`G${r}`}
                onClick={() => setRank(r)}
              />
            ))}
          </div>
          <div className="skill-picker-dialog__filter-block">
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setFilterExpanded((v) => !v)}
            >
              <span>{tUi('buildPlanner.imagineFilter.toggle')}</span>
              <Chevron open={filterExpanded} />
            </button>
            {filterExpanded && (
              <div className="skill-picker-dialog__filter-groups">
                <div className="skill-picker-dialog__filter-row">
                  <span className="skill-picker-dialog__filter-label">
                    {tUi('buildPlanner.imagineFilter.seasonLabel')}
                  </span>
                  <ToggleButtonGroup
                    options={IMAGINE_SEASON_FILTERS}
                    value={seasonFilter}
                    getLabel={(filter) => tUi(`buildPlanner.imagineFilter.${filter}`)}
                    onChange={handleSeasonFilterChange}
                  />
                </div>
                <div className="skill-picker-dialog__filter-row">
                  <span className="skill-picker-dialog__filter-label">
                    {tUi('buildPlanner.imagineFilter.qualityLabel')}
                  </span>
                  <ToggleButtonGroup
                    options={IMAGINE_QUALITY_FILTERS}
                    value={qualityFilter}
                    getLabel={(filter) => tUi(`buildPlanner.imagineFilter.${filter}`)}
                    onChange={handleQualityFilterChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="skill-picker-dialog__grid">
          {filteredImagines.map((bi) => {
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
            onMouseEnter={cancelHoverClose}
            onMouseLeave={hideHover}
          />,
          document.body,
        )}
    </>
  );
}

export default ImaginePickerDialog;
