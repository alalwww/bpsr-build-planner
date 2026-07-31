import { useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './character.css';
import ProfessionPicker from './ProfessionPicker';
import PlanManager from './PlanManager';
import AbilityScoreDialog from './AbilityScoreDialog';
import BuffEffectDialog from './BuffEffectDialog';
import DraggableDialog from '../components/DraggableDialog';
import Stepper from '../components/Stepper';
import { getClassIconUrl } from './classIcons';
import StatTooltip, { type StatTooltipState } from './StatTooltip';
import type { Profession } from '../profession';
import { PROFESSIONS } from '../profession';
import { getTalentAsset } from '../talent/talentTreeData';
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

// 左カラム(最大HP/攻撃力/主要ステータス/耐久力)は収益逓減カーブを経由しない素の値のため、
// rawStatsとstatsで差が出ない…はずだが、最大HP/攻撃力はバトルイマジン等由来の最終%ボーナス
// (ipct)が乗った後の値がキャラクターパネルの行に表示されているため、ポップアップの「現在値」も
// それに揃える(rawStatsだと行の表示値と食い違ってしまう)。
const LEFT_COLUMN_STAT_IDS = new Set<StatId>([
  'maxHp',
  'atk',
  'matk',
  'strength',
  'intellect',
  'agility',
  'endurance',
]);

// ステータスラベルの前に表示するアイコン(src/assets/talents/、ファイル名は拡張子なし)。
const STAT_ICON_FILENAME: Partial<Record<StatId, string>> = {
  maxHp: 'common_attrmaxhp',
  atk: 'common_attrattack',
  matk: 'common_attrmattack',
  strength: 'common_icon05',
  intellect: 'common_icon06',
  agility: 'common_attrdexterity',
  endurance: 'common_icon08',
  illusionPower: 'common_icon01',
  crit: 'common_icon12',
  haste: 'common_attrhaste',
  luck: 'common_attrluck',
  mastery: 'common_attrmastery',
  versatility: 'common_attrversatility',
  resist: 'common_attrblock',
};

// 元画像は余白比率がまちまち(66x46〜94x97)なため、自動フィットだと余白の多いアイコンが
// 目立って小さく見える。長辺を18pxに揃えてスケーリングした表示サイズをステータスごとに
// 固定することで、行ごとの見た目の大きさを揃える。
const STAT_ICON_SIZE: Partial<Record<StatId, { width: number; height: number }>> = {
  maxHp: { width: 18, height: 16 },
  atk: { width: 18, height: 17 },
  matk: { width: 16, height: 18 },
  strength: { width: 18, height: 12 },
  intellect: { width: 18, height: 18 },
  agility: { width: 17, height: 18 },
  endurance: { width: 16, height: 18 },
  illusionPower: { width: 18, height: 18 },
  crit: { width: 18, height: 16 },
  haste: { width: 18, height: 17 },
  luck: { width: 18, height: 18 },
  mastery: { width: 18, height: 18 },
  versatility: { width: 18, height: 16 },
  resist: { width: 15, height: 18 },
};

function getStatIconUrl(id: StatId): string | undefined {
  const filename = STAT_ICON_FILENAME[id];
  return filename ? getTalentAsset(filename) : undefined;
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

  const { stats, rawStats, rawStatsBreakdown, derivedStats, abilityScore } = useBuildStore(
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
  const [statPopup, setStatPopup] = useState<StatTooltipState | null>(null);
  // ポップアップの表示位置をクリック位置ではなく固定位置(パネル右端・滅妄強度行の高さ)に
  // 揃えるための参照。どのステータスをクリックしても同じ場所に表示され、右隣のタブ
  // パネル(スキル/装備等)側に重ねて表示される。
  const panelRef = useRef<HTMLElement>(null);
  const illusionPowerRowRef = useRef<HTMLDivElement>(null);
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

  // ステータスラベルクリック時の共通ハンドラ。表示位置はクリック位置に依存させず、常に
  // パネル右端・滅妄強度行の高さに固定する(スキルパネル側に重ねて表示するため。左右
  // どちらのカラムをクリックしても同じ場所に表示する)。
  const openStatPopup = (statId: StatId, e: MouseEvent) => {
    e.stopPropagation();
    setStatPopup((prev) => {
      if (prev?.statId === statId) return null;
      const panelRect = panelRef.current?.getBoundingClientRect();
      const rowRect = illusionPowerRowRef.current?.getBoundingClientRect();
      return {
        statId,
        x: (panelRect?.right ?? e.clientX) + 12,
        y: rowRect?.top ?? e.clientY,
      };
    });
  };

  const professionId = PROFESSIONS[professionKey].professionId;
  const classIconUrl = getClassIconUrl(professionId);
  const clsEntry = getClassData(professionId);
  const showTalentStage = clsEntry?.showTalentStage ?? [];
  const typeStageId = showTalentStage[professionTypeKey === 'type1' ? 0 : 1];
  const roleBg = clsEntry?.talentColor ? `${clsEntry.talentColor}1a` : undefined;

  return (
    <section className="character-panel" ref={panelRef}>
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
              <button
                type="button"
                className="character-panel__stat-label character-panel__stat-label--clickable"
                onClick={(e) => openStatPopup(def.id, e)}
              >
                {getStatIconUrl(def.id) && (
                  <img
                    src={getStatIconUrl(def.id)}
                    alt=""
                    className="character-panel__stat-icon"
                    style={STAT_ICON_SIZE[def.id]}
                  />
                )}
                <span className="character-panel__stat-label-text">
                  {t(`buildPlanner.stats.${def.id}`)}
                </span>
              </button>
              <span className="character-panel__stat-value">
                {formatStatValue(stats[def.id], def.isPercent)}
              </span>
            </div>
          ))}
        </div>
        <div className="character-panel__stats-column">
          {rightStats.map((def) => (
            <div
              className="character-panel__stat-row"
              key={def.id}
              ref={def.id === 'illusionPower' ? illusionPowerRowRef : undefined}
            >
              <button
                type="button"
                className="character-panel__stat-label character-panel__stat-label--clickable"
                onClick={(e) => openStatPopup(def.id, e)}
              >
                {getStatIconUrl(def.id) && (
                  <img
                    src={getStatIconUrl(def.id)}
                    alt=""
                    className="character-panel__stat-icon"
                    style={STAT_ICON_SIZE[def.id]}
                  />
                )}
                <span className="character-panel__stat-label-text">
                  {t(`buildPlanner.stats.${def.id}`)}
                </span>
              </button>
              <span className="character-panel__stat-value">
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

      {statPopup !== null && (
        <StatTooltip
          state={statPopup}
          rawValue={
            // ファストは俊敏由来の変換分がrawStatsに含まれない(装備等の生値のみ)ため、
            // %変換に実際に使われた実数値(derivedStats.hasteReal)を表示する。
            // 左カラムは行にすでに表示されている最終値(stats)と一致させる(最大HP/攻撃力は
            // バトルイマジン等の最終%ボーナスがrawStatsには乗っていないため)。
            statPopup.statId === 'haste'
              ? derivedStats.hasteReal
              : LEFT_COLUMN_STAT_IDS.has(statPopup.statId)
                ? stats[statPopup.statId]
                : rawStats[statPopup.statId]
          }
          currentPercent={stats[statPopup.statId]}
          professionId={professionId}
          professionTypeKey={professionTypeKey}
          derivedStats={derivedStats}
          breakdown={rawStatsBreakdown}
          rawStats={rawStats}
          mainStatId={PROFESSIONS[professionKey].mainStat}
          onRequestClose={() => setStatPopup(null)}
        />
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
