import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './character.css';
import ProfessionPicker from './ProfessionPicker';
import PlanManager from './PlanManager';
import AbilityScoreDialog from './AbilityScoreDialog';
import BuffEffectDialog from './BuffEffectDialog';
import DraggableDialog from '../components/DraggableDialog';
import FloatingTooltip from '../components/FloatingTooltip';
import Stepper from '../components/Stepper';
import { getClassIconUrl } from './classIcons';
import type { Profession } from '../profession';
import { PROFESSIONS } from '../profession';
import type { StatDefinition, StatId } from '../types';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import { getClassData } from '../classData';
import { isTauri } from '../../platform';
import { showResidentWindow } from '../../platform/residentWindow';
import { truncate2Str } from './statFormat';

interface CharacterPanelProps {
  onOpenTalentTree?: () => void;
  onOpenStatsDetail?: () => void;
}

function formatStatValue(value: number, isPercent?: boolean): string {
  if (isPercent) {
    return `${truncate2Str(value)}%`;
  }
  return truncate2Str(value);
}

// 選択中クラスに応じて表示するステータス列を返す。
// 攻撃力列(atk/matk)とメインステータス列(strength/agility/intellect)がクラス依存で変わる。
function getStatDefinitions(profession: Profession): StatDefinition[] {
  const atkStat: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  return [
    { id: 'maxHp', column: 'left' },
    { id: atkStat, column: 'left' },
    { id: profession.mainStat, column: 'left' },
    { id: 'endurance', column: 'left' },
    { id: 'illusionPower', column: 'right' },
    { id: 'crit', column: 'right', isPercent: true },
    { id: 'haste', column: 'right', isPercent: true },
    { id: 'luck', column: 'right', isPercent: true },
    { id: 'mastery', column: 'right', isPercent: true },
    { id: 'versatility', column: 'right', isPercent: true },
    { id: 'resist', column: 'right', isPercent: true },
  ];
}

function CharacterPanel({ onOpenTalentTree, onOpenStatsDetail }: CharacterPanelProps) {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');

  const { stats, rawStats, derivedStats, abilityScore } = useBuildStore(
    useShallow(computeStatsBundle),
  );
  const {
    professionKey,
    professionTypeKey,
    adventurerLevel,
    phantomLevel,
    cookingBuff,
    moduleSlots,
  } = useBuildStore(
    useShallow((s) => ({
      professionKey: s.professionKey,
      professionTypeKey: s.professionTypeKey,
      adventurerLevel: s.adventurerLevel,
      phantomLevel: s.phantomLevel,
      cookingBuff: s.cookingBuff,
      moduleSlots: s.moduleSlots,
    })),
  );
  const onSelectProfession = useBuildStore((s) => s.selectProfession);
  const onSelectProfessionType = useBuildStore((s) => s.selectProfessionType);
  const onAdventurerLevelChange = useBuildStore((s) => s.setAdventurerLevel);
  const onCookingBuffChange = useBuildStore((s) => s.setCookingBuff);
  const [isProfessionPickerOpen, setProfessionPickerOpen] = useState(false);
  const [hoveredStatId, setHoveredStatId] = useState<StatId | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [abilityScoreOpen, setAbilityScoreOpen] = useState(false);
  const [buffEffectOpen, setBuffEffectOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const statDefinitions = getStatDefinitions(PROFESSIONS[professionKey]);
  const leftStats = statDefinitions.filter((def) => def.column === 'left');
  const rightStats = statDefinitions.filter((def) => def.column === 'right');

  const professionId = PROFESSIONS[professionKey].professionId;
  const classIconUrl = getClassIconUrl(professionId);
  const clsEntry = getClassData(professionId);
  const showTalentStage = clsEntry?.showTalentStage ?? [];
  const typeStageId = showTalentStage[professionTypeKey === 'type1' ? 0 : 1];
  const roleBg = clsEntry?.talentColor ? `${clsEntry.talentColor}1a` : undefined;

  return (
    <section className="character-panel">
      {/* プラン管理(名称入力・保存・一覧・各種ダイアログ) */}
      <PlanManager />

      {/* Summary */}
      <div className="character-panel__summary">
        <button
          type="button"
          className="character-panel__summary-item character-panel__summary-item--clickable"
          onClick={() =>
            isTauri ? void showResidentWindow('ability-score') : setAbilityScoreOpen(true)
          }
        >
          <span className="character-panel__label">{t('buildPlanner.abilityScore')}</span>
          <span className="character-panel__value">
            {Math.round(abilityScore.total).toLocaleString()}
          </span>
        </button>
        <button
          type="button"
          className="character-panel__summary-item character-panel__summary-item--clickable"
          onClick={() => setLevelPickerOpen(true)}
        >
          <span className="character-panel__label">{t('buildPlanner.adventurerLevel')}</span>
          <span className="character-panel__value">
            {adventurerLevel}(+{phantomLevel})
          </span>
        </button>
      </div>

      {/* Class + Type selectors */}
      <div className="character-panel__selectors">
        <button
          type="button"
          className="character-panel__selector--class"
          style={roleBg ? { backgroundColor: roleBg } : undefined}
          onClick={() => setProfessionPickerOpen(true)}
        >
          {classIconUrl && (
            <span
              className="character-panel__selector-icon-bg"
              style={{ backgroundImage: `url(${classIconUrl})` }}
              aria-hidden="true"
            />
          )}
          <span className="character-panel__selector-name">
            {tGame(`classes.${professionId}.name`, { defaultValue: professionKey })}
          </span>
          <span className="character-panel__selector-label">{t('buildPlanner.classLabel')}</span>
        </button>
        <button
          type="button"
          className="character-panel__selector--type"
          style={roleBg ? { backgroundColor: roleBg } : undefined}
          onClick={onOpenTalentTree}
        >
          <span className="character-panel__selector-name">
            {typeStageId
              ? tGame(`talentStages.${typeStageId}.typeName`, { defaultValue: professionTypeKey })
              : professionTypeKey}
          </span>
          <span className="character-panel__selector-label">{t('buildPlanner.talentLabel')}</span>
        </button>
      </div>

      <div className="character-panel__stats">
        <div className="character-panel__stats-column">
          {leftStats.map((def) => (
            <div className="character-panel__stat-row" key={def.id}>
              <span className="character-panel__stat-label">
                {t(`buildPlanner.stats.${def.id}`)}
              </span>
              <span className="character-panel__stat-value">
                {formatStatValue(stats[def.id], def.isPercent)}
              </span>
            </div>
          ))}
        </div>
        <div className="character-panel__stats-column">
          {rightStats.map((def) => (
            <div className="character-panel__stat-row" key={def.id}>
              <span className="character-panel__stat-label">
                {t(`buildPlanner.stats.${def.id}`)}
              </span>
              <span
                className={`character-panel__stat-value${def.isPercent ? ' character-panel__stat-value--tip' : ''}`}
                onMouseEnter={(e) => {
                  if (def.isPercent) {
                    setHoveredStatId(def.id);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseMove={(e) => {
                  if (def.isPercent) setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setHoveredStatId(null)}
              >
                {formatStatValue(stats[def.id], def.isPercent)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="character-panel__detail-button" onClick={onOpenStatsDetail}>
        {t('buildPlanner.attributes')}
      </button>
      <button
        type="button"
        className="character-panel__detail-button character-panel__detail-button--secondary"
        onClick={() => setBuffEffectOpen(true)}
      >
        {t('buildPlanner.buffDialog.openButton')}
      </button>

      {hoveredStatId !== null && (
        <FloatingTooltip
          x={tooltipPos.x + 10}
          y={tooltipPos.y - 32}
          className="character-panel__stat-tooltip"
        >
          {truncate2Str(
            // ファストは俊敏由来の変換分がrawStatsに含まれない(装備等の生値のみ)ため、
            // %変換に実際に使われた実数値(derivedStats.hasteReal)を表示する。
            hoveredStatId === 'haste' ? derivedStats.hasteReal : rawStats[hoveredStatId],
          )}
        </FloatingTooltip>
      )}

      {isProfessionPickerOpen && (
        <ProfessionPicker
          professionKey={professionKey}
          professionTypeKey={professionTypeKey}
          onSelectProfession={onSelectProfession}
          onSelectProfessionType={onSelectProfessionType}
          onClose={() => setProfessionPickerOpen(false)}
        />
      )}

      {/* 冒険者レベル選択ダイアログ */}
      {levelPickerOpen && (
        <DraggableDialog
          title={t('buildPlanner.adventurerLevel')}
          onClose={() => setLevelPickerOpen(false)}
          className="level-picker-dialog"
        >
          <Stepper
            className="stepper-inline"
            modifierClassName="level-dialog__stepper"
            layout="inline"
            value={adventurerLevel}
            min={1}
            max={60}
            onChange={onAdventurerLevelChange}
          />
        </DraggableDialog>
      )}
      {/* 能力スコア内訳ダイアログ */}
      {abilityScoreOpen && (
        <AbilityScoreDialog
          abilityScore={abilityScore}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onClose={() => setAbilityScoreOpen(false)}
        />
      )}
      {/* バフ効果ダイアログ */}
      {buffEffectOpen && (
        <BuffEffectDialog
          cookingBuff={cookingBuff}
          onChange={onCookingBuffChange}
          profession={PROFESSIONS[professionKey]}
          onClose={() => setBuffEffectOpen(false)}
          moduleSlots={moduleSlots}
        />
      )}
    </section>
  );
}

export default CharacterPanel;
