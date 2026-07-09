import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './build-planner.css';
import './components/components.css';
import CharacterPanel from './character/CharacterPanel';
import EquipmentPanel from './equipment/EquipmentPanel';
import ModulePanel from './module/ModulePanel';
import PhantomPanel from './phantom/PhantomPanel';
import SkillPanel from './skill/SkillPanel';
import StatsDetailDialog from './character/StatsDetailDialog';
import TalentTreePanel from './talent/TalentTreePanel';
import { useBuildState } from './useBuildState';

const TABS = ['skill', 'equipment', 'module', 'phantom'] as const;
type Tab = (typeof TABS)[number];

function BuildPlanner() {
  const { t, i18n } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  const changeLanguage = (lang: string) => {
    localStorage.setItem('bpsr-language', lang);
    void i18n.changeLanguage(lang);
    setLangMenuOpen(false);
  };

  const {
    equipped,
    equip,
    unequip,
    refineLevels,
    setRefineLevel,
    perfectlines,
    setPerfectline,
    evolutionStats,
    setEvolutionStat,
    legendaryAffixState,
    setLegendaryAffix,
    slotEnchants,
    setSlotEnchant,
    cookingBuff,
    setCookingBuff,
    stats,
    rawStats,
    rawStatsBreakdown,
    derivedStats,
    abilityScore,
    profession,
    professionKey,
    professionTypeKey,
    selectProfession,
    selectProfessionType,
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    fixedLevels,
    fixedRanks,
    battleImaginaries,
    imaginaryRanks,
    roleSkills,
    skillReplacements,
    talentR1EnabledIds,
    setTalentR1EnabledIds,
    talentR2EnabledIds,
    setTalentR2EnabledIds,
    toggleMasteryEquipped,
    setMasteryLevel,
    setMasteryRank,
    setFixedLevel,
    setFixedRank,
    setBattleImaginary,
    reorderBattleImaginaries,
    setImaginaryRank,
    moduleSlots,
    setModuleSlot,
    adventurerLevel,
    setAdventurerLevel,
    phantomEnabled,
    setPhantomEnabled,
    phantomLevel,
    setPhantomLevel,
    phantomTemplateId,
    setPhantomTemplateId,
    phantomBondPoints,
    setPhantomBondPoints,
    phantomNodeSelections,
    setPhantomNodeSelection,
    phantomFactorSlots,
    setPhantomFactorSlot,
    planName,
    setPlanName,
    buildPlans,
    savePlan,
    overwritePlan,
    renamePlan,
    loadPlan,
    deletePlan,
    resetPlan,
    exportPlanCode,
    importPlanCode,
  } = useBuildState();

  const [activeTab, setActiveTab] = useState<Tab>('skill');
  const [showTalentTree, setShowTalentTree] = useState(false);
  const [showStatsDetail, setShowStatsDetail] = useState(false);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setShowTalentTree(false);
  };

  const isPhantomTab = !showTalentTree && activeTab === 'phantom';

  return (
    <>
      <div className="build-planner">
        <CharacterPanel
          stats={stats}
          rawStats={rawStats}
          derivedStats={derivedStats}
          abilityScore={abilityScore}
          professionKey={professionKey}
          professionTypeKey={professionTypeKey}
          onSelectProfession={selectProfession}
          onSelectProfessionType={selectProfessionType}
          onOpenTalentTree={() => setShowTalentTree(true)}
          adventurerLevel={adventurerLevel}
          onAdventurerLevelChange={setAdventurerLevel}
          phantomLevel={phantomLevel}
          planName={planName}
          onPlanNameChange={setPlanName}
          buildPlans={buildPlans}
          onSavePlan={savePlan}
          onOverwritePlan={overwritePlan}
          onRenamePlan={renamePlan}
          onLoadPlan={loadPlan}
          onDeletePlan={deletePlan}
          onResetPlan={resetPlan}
          onExportPlanCode={exportPlanCode}
          onImportPlanCode={importPlanCode}
          onOpenStatsDetail={() => setShowStatsDetail(true)}
          cookingBuff={cookingBuff}
          onCookingBuffChange={setCookingBuff}
          moduleSlots={moduleSlots}
        />
        <div className="build-planner__right">
          <nav className="build-planner__tabs">
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                className={`build-planner__tab${!showTalentTree && tab === activeTab ? ' build-planner__tab--active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {t(`buildPlanner.tabs.${tab}`)}
              </button>
            ))}
            <div className="nav-lang" ref={langMenuRef}>
              <button
                type="button"
                className="build-planner__nav-lang"
                onClick={() => setLangMenuOpen((v) => !v)}
                title="Language"
              >
                🌐
              </button>
              {langMenuOpen && (
                <div className="nav-lang__dropdown">
                  <button
                    type="button"
                    className={`nav-lang__item${i18n.language === 'ja_JP' ? ' nav-lang__item--active' : ''}`}
                    onClick={() => changeLanguage('ja_JP')}
                  >
                    日本語
                  </button>
                  <button
                    type="button"
                    className={`nav-lang__item${i18n.language === 'en_US' ? ' nav-lang__item--active' : ''}`}
                    onClick={() => changeLanguage('en_US')}
                  >
                    English
                  </button>
                </div>
              )}
            </div>
          </nav>
          <div
            className={`build-planner__content${isPhantomTab ? ' build-planner__content--phantom' : ''}`}
          >
            {showTalentTree ? (
              <TalentTreePanel
                professionKey={professionKey}
                professionTypeKey={professionTypeKey}
                onSelectProfessionType={selectProfessionType}
                r1EnabledIds={talentR1EnabledIds}
                r2EnabledIds={talentR2EnabledIds}
                onR1EnabledIdsChange={setTalentR1EnabledIds}
                onR2EnabledIdsChange={setTalentR2EnabledIds}
              />
            ) : (
              <>
                {activeTab === 'equipment' && (
                  <EquipmentPanel
                    equipped={equipped}
                    profession={profession}
                    professionTypeKey={professionTypeKey}
                    refineLevels={refineLevels}
                    perfectlines={perfectlines}
                    evolutionStats={evolutionStats}
                    legendaryAffixState={legendaryAffixState}
                    slotEnchants={slotEnchants}
                    onEquip={equip}
                    onUnequip={unequip}
                    onRefineLevel={setRefineLevel}
                    onPerfectline={setPerfectline}
                    onSetEvolutionStat={setEvolutionStat}
                    onSetLegendaryAffix={setLegendaryAffix}
                    onSetEnchant={setSlotEnchant}
                  />
                )}
                {activeTab === 'skill' && (
                  <SkillPanel
                    professionKey={professionKey}
                    professionTypeKey={professionTypeKey}
                    masteryEquipped={masteryEquipped}
                    masteryLevels={masteryLevels}
                    masteryRanks={masteryRanks}
                    fixedLevels={fixedLevels}
                    fixedRanks={fixedRanks}
                    battleImaginaries={battleImaginaries}
                    imaginaryRanks={imaginaryRanks}
                    roleSkills={roleSkills}
                    skillReplacements={skillReplacements}
                    onToggleMasteryEquipped={toggleMasteryEquipped}
                    onSetMasteryLevel={setMasteryLevel}
                    onSetMasteryRank={setMasteryRank}
                    onSetFixedLevel={setFixedLevel}
                    onSetFixedRank={setFixedRank}
                    onSetBattleImaginary={setBattleImaginary}
                    onReorderBattleImaginaries={reorderBattleImaginaries}
                    onSetImaginaryRank={setImaginaryRank}
                  />
                )}
                {activeTab === 'module' && (
                  <ModulePanel
                    moduleSlots={moduleSlots}
                    onSetModuleSlot={setModuleSlot}
                    profession={profession}
                    professionTypeKey={professionTypeKey}
                  />
                )}
                {activeTab === 'phantom' && (
                  <PhantomPanel
                    professionKey={professionKey}
                    phantomEnabled={phantomEnabled}
                    onPhantomEnabledChange={setPhantomEnabled}
                    phantomLevel={phantomLevel}
                    onPhantomLevelChange={setPhantomLevel}
                    phantomTemplateId={phantomTemplateId}
                    onPhantomTemplateIdChange={setPhantomTemplateId}
                    phantomBondPoints={phantomBondPoints}
                    onPhantomBondPointsChange={setPhantomBondPoints}
                    phantomNodeSelections={phantomNodeSelections}
                    onPhantomNodeSelection={setPhantomNodeSelection}
                    phantomFactorSlots={phantomFactorSlots}
                    onPhantomFactorSlot={setPhantomFactorSlot}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {showStatsDetail && (
        <StatsDetailDialog
          rawStats={rawStats}
          rawStatsBreakdown={rawStatsBreakdown}
          stats={stats}
          derivedStats={derivedStats}
          cookingBuff={cookingBuff}
          onClose={() => setShowStatsDetail(false)}
        />
      )}
    </>
  );
}

export default BuildPlanner;
