import { PROFESSIONS } from './profession';
import { computeStatsBundle } from './store/derivedSelectors';
import { useBuildStore } from './store/useBuildStore';

// Zustandストア(store/useBuildStore.ts)への薄いラッパー。移行前の呼び出し側
// (BuildPlanner.tsxほか)を無変更のまま動作させるため、旧useBuildStateと同一の
// 返り値形状を維持する。全パネルがストアを直接参照するようになった段階(Phase 4)で削除する。
//
// 注意: このフックはストア全体を購読する(=どのフィールドが変わっても再レンダリングされる)。
// これは移行前の挙動(単一コンポーネントが全状態を保持していた)と同じであり、意図的な
// 例外。新規に書くコンポーネントはselector経由でストアを直接購読すること(全体購読は禁止)。
export function useBuildState() {
  const state = useBuildStore();
  const profession = PROFESSIONS[state.professionKey];
  const {
    stats,
    rawStats,
    rawStatsBreakdown,
    derivedStats,
    abilityScore,
    roleSkills,
    skillReplacements,
  } = computeStatsBundle(state);

  return {
    equipped: state.equipped,
    equip: state.equip,
    unequip: state.unequip,
    refineLevels: state.refineLevels,
    setRefineLevel: state.setRefineLevel,
    perfectlines: state.perfectlines,
    setPerfectline: state.setPerfectline,
    evolutionStats: state.evolutionStats,
    setEvolutionStat: state.setEvolutionStat,
    legendaryAffixState: state.legendaryAffixState,
    setLegendaryAffix: state.setLegendaryAffix,
    slotEnchants: state.slotEnchants,
    setSlotEnchant: state.setSlotEnchant,
    cookingBuff: state.cookingBuff,
    setCookingBuff: state.setCookingBuff,
    professionKey: state.professionKey,
    professionTypeKey: state.professionTypeKey,
    profession,
    selectProfession: state.selectProfession,
    selectProfessionType: state.selectProfessionType,
    stats,
    rawStats,
    rawStatsBreakdown,
    derivedStats,
    abilityScore,
    masteryEquipped: state.masteryEquipped,
    masteryLevels: state.masteryLevels,
    masteryRanks: state.masteryRanks,
    fixedLevels: state.fixedLevels,
    fixedRanks: state.fixedRanks,
    battleImaginaries: state.battleImaginaries,
    imaginaryRanks: state.imaginaryRanks,
    roleSkills,
    skillReplacements,
    talentR1EnabledIds: state.talentR1EnabledIds,
    setTalentR1EnabledIds: state.setTalentR1EnabledIds,
    talentR2EnabledIds: state.talentR2EnabledIds,
    setTalentR2EnabledIds: state.setTalentR2EnabledIds,
    toggleMasteryEquipped: state.toggleMasteryEquipped,
    setMasteryLevel: state.setMasteryLevel,
    setMasteryRank: state.setMasteryRank,
    setFixedLevel: state.setFixedLevel,
    setFixedRank: state.setFixedRank,
    setBattleImaginary: state.setBattleImaginary,
    setImaginaryRank: state.setImaginaryRank,
    reorderBattleImaginaries: state.reorderBattleImaginaries,
    moduleSlots: state.moduleSlots,
    setModuleSlot: state.setModuleSlot,
    adventurerLevel: state.adventurerLevel,
    setAdventurerLevel: state.setAdventurerLevel,
    phantomEnabled: state.phantomEnabled,
    setPhantomEnabled: state.setPhantomEnabled,
    phantomLevel: state.phantomLevel,
    setPhantomLevel: state.setPhantomLevel,
    phantomTemplateId: state.phantomTemplateId,
    setPhantomTemplateId: state.setPhantomTemplateId,
    phantomBondPoints: state.phantomBondPoints,
    setPhantomBondPoints: state.setPhantomBondPoints,
    phantomNodeSelections: state.phantomNodeSelections,
    setPhantomNodeSelection: state.setPhantomNodeSelection,
    phantomFactorSlots: state.phantomFactorSlots,
    setPhantomFactorSlot: state.setPhantomFactorSlot,
    planName: state.planName,
    setPlanName: state.setPlanName,
    buildPlans: state.buildPlans,
    savePlan: state.savePlan,
    overwritePlan: state.overwritePlan,
    renamePlan: state.renamePlan,
    loadPlan: state.loadPlan,
    deletePlan: state.deletePlan,
    resetPlan: state.resetPlan,
    exportPlanCode: state.exportPlanCode,
    importPlanCode: state.importPlanCode,
  };
}
