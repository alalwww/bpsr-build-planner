import type { StateCreator } from 'zustand';
import { getItemsBySlot } from '../equipment/equipmentData';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { DEFAULT_PROFESSION_KEY, PROFESSIONS } from '../profession';
import { DEFAULT_COOKING_BUFF } from '../stats/cookingBuff';
import type { AutoSaveState, BuildPlanData, LegacySource } from '../plan/buildPlan';
import { loadBuildPlans, persistBuildPlans } from '../plan/buildPlan';
import { decodePlanCode, encodePlanCode } from '../plan/planCode';
import {
  getDefaultAutoSaveState,
  getDefaultProfessionState,
  STATIC_AUTOSAVE_DEFAULTS,
} from '../plan/planDefaults';
import { hasLegacyPhantomFactor, initPhantomNodeSelections } from '../phantom/phantomData';
import type { CookingBuffState, EquipmentSlotId, EquippedItems } from '../types';
import { getAutoSaveOnMount } from './autoSaveOnMount';
import { normalSkillCount } from './skillSlice';
import type { BuildStore } from './types';

// インポート結果: 'ok'は現行フォーマット、'legacy'は旧フォーマットのコードを読み込めた
// (呼び出し元が「新しい保存形式で更新してよいですか？」を確認する)、'failed'はデコード失敗。
export type ImportPlanCodeResult = 'ok' | 'legacy' | 'failed';

export interface PlanSlice {
  cookingBuff: CookingBuffState;
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
  adventurerLevel: number;
  planName: string;
  buildPlans: BuildPlanData[];

  // 保存プラン一覧・自動保存が旧フォーマットから移行されたものかどうか(移行通知UI用)。
  buildPlansLegacySource: LegacySource;
  autoSaveLegacySource: 'v1' | null;
  // localStorageのデータ破損等でロードに失敗したかどうか(失敗通知UI用)。
  planLoadError: boolean;
  autoSaveLoadError: boolean;
  // ロードしたデータ(自動保存/保存プラン/プランコード)に無効化された過去シーズンの幻影因子が
  // 含まれていたため、心相投影の状態をリセットしたかどうか(通知UI用)。
  phantomLegacyFactorResetNotice: boolean;

  setCookingBuff: (patch: Partial<CookingBuffState>) => void;
  setAdventurerLevel: (level: number) => void;
  setPlanName: (name: string) => void;

  selectProfession: (key: ProfessionKey) => void;
  selectProfessionType: (key: ProfessionTypeKey) => void;

  // 現在の編集状態を AutoSaveState(id を除く BuildPlanData)として構築する。
  // 保存/エクスポート/自動保存で共用。name省略時はプラン名入力欄の現在値を使う。
  buildAutoSaveState: (name?: string) => AutoSaveState;
  // ビルドプラン(保存済みプラン/インポートされたプランコード共通)の状態を
  // 現在の編集状態へ適用する。
  applyPlanState: (plan: AutoSaveState) => void;

  savePlan: (name: string) => void;
  overwritePlan: (id: string, name: string) => void;
  renamePlan: (id: string, newName: string) => void;
  loadPlan: (id: string) => void;
  deletePlan: (id: string) => void;
  resetPlan: () => void;
  exportPlanCode: () => string;
  importPlanCode: (code: string) => ImportPlanCodeResult;

  // 保存プラン一覧を現行フォーマットで書き戻し、旧フォーマット通知を消す
  // (「新しい保存形式で更新してよいですか？」確認ダイアログのOK)。
  resaveBuildPlans: () => void;
  dismissBuildPlansLegacyNotice: () => void;
  dismissAutoSaveLegacyNotice: () => void;
  dismissPlanLoadError: () => void;
  dismissAutoSaveLoadError: () => void;
  dismissPhantomLegacyFactorResetNotice: () => void;
}

export const createPlanSlice: StateCreator<BuildStore, [], [], PlanSlice> = (set, get) => {
  const autoSaveOnMount = getAutoSaveOnMount();
  const buildPlansOnMount = loadBuildPlans();

  return {
    cookingBuff: DEFAULT_COOKING_BUFF,
    professionKey: autoSaveOnMount.state?.professionKey ?? DEFAULT_PROFESSION_KEY,
    professionTypeKey: autoSaveOnMount.state?.professionTypeKey ?? 'type1',
    adventurerLevel:
      autoSaveOnMount.state?.adventurerLevel ?? STATIC_AUTOSAVE_DEFAULTS.adventurerLevel,
    planName: autoSaveOnMount.state?.name ?? '',
    buildPlans: buildPlansOnMount.plans,
    buildPlansLegacySource: buildPlansOnMount.legacySource,
    autoSaveLegacySource: autoSaveOnMount.legacySource,
    planLoadError: buildPlansOnMount.loadError,
    autoSaveLoadError: autoSaveOnMount.loadError,
    phantomLegacyFactorResetNotice: hasLegacyPhantomFactor(
      autoSaveOnMount.state?.phantomFactorSlots,
    ),

    setCookingBuff: (patch) =>
      set((state) => ({ cookingBuff: { ...state.cookingBuff, ...patch } })),
    setAdventurerLevel: (adventurerLevel) => set({ adventurerLevel }),
    setPlanName: (planName) => set({ planName }),

    selectProfession: (key) => {
      const state = get();
      const newProfession = PROFESSIONS[key];
      const currentProfession = PROFESSIONS[state.professionKey];
      const mainStatChanged = newProfession.mainStat !== currentProfession.mainStat;
      state.resetEquipmentForProfessionChange(mainStatChanged);
      set({ professionKey: key, professionTypeKey: 'type1' });
      // マスタリースキル・固定スキルをリセット (バトルイマジンは引き継ぐ)
      state.resetSkillForProfessionChange(key);
      // アビリティツリーをリセット
      state.resetTalentForProfessionChange(newProfession.professionId);
    },

    selectProfessionType: (key) => {
      const state = get();
      set({ professionTypeKey: key });
      const newBdType: 0 | 1 = key === 'type1' ? 0 : 1;
      const profession = PROFESSIONS[state.professionKey];
      state.resetTalentR2ForType(profession.professionId, newBdType);
    },

    buildAutoSaveState: (name) => {
      const state = get();
      return {
        name: name ?? state.planName,
        professionKey: state.professionKey,
        professionTypeKey: state.professionTypeKey,
        equipped: state.equipped,
        refineLevels: state.refineLevels,
        perfectlines: state.perfectlines,
        evolutionStats: state.evolutionStats,
        legendaryAffixState: state.legendaryAffixState,
        legendaryAffixGroupState: state.legendaryAffixGroupState,
        masteryEquipped: state.masteryEquipped,
        masteryLevels: state.masteryLevels,
        masteryRanks: state.masteryRanks,
        fixedLevels: state.fixedLevels,
        fixedRanks: state.fixedRanks,
        battleImagines: state.battleImagines,
        imagineRanks: state.imagineRanks,
        roleSkillSlots: state.roleSkillSlots,
        roleSkillRanks: state.roleSkillRanks,
        talentR1EnabledIds: [...state.talentR1EnabledIds],
        talentR2EnabledIds: [...state.talentR2EnabledIds],
        slotEnchants: { ...state.slotEnchants },
        moduleSlots: [...state.moduleSlots],
        adventurerLevel: state.adventurerLevel,
        phantomEnabled: state.phantomEnabled,
        phantomLevel: state.phantomLevel,
        phantomTemplateId: state.phantomTemplateId,
        phantomBondPoints: state.phantomBondPoints,
        phantomNodeSelections: { ...state.phantomNodeSelections },
        phantomFactorSlots: { ...state.phantomFactorSlots },
      };
    },

    applyPlanState: (plan) => {
      const state = get();
      // 保存済みアイテムを最新データで上書き（スキーマ変更時の旧形式フィールドを更新）
      const refreshedEquipped: EquippedItems = {};
      for (const [slotId, stored] of Object.entries(plan.equipped)) {
        const slot = slotId as EquipmentSlotId;
        const fresh = getItemsBySlot(slot).find((i) => i.id === stored.id);
        refreshedEquipped[slot] = fresh ?? stored;
      }
      state.setEquipped(refreshedEquipped);
      state.setRefineLevels(plan.refineLevels);
      state.setPerfectlines(plan.perfectlines);
      state.setEvolutionStatsState(plan.evolutionStats);
      state.setLegendaryAffixState(plan.legendaryAffixState);
      state.setLegendaryAffixGroupState(
        plan.legendaryAffixGroupState ?? STATIC_AUTOSAVE_DEFAULTS.legendaryAffixGroupState,
      );
      set({ professionKey: plan.professionKey, professionTypeKey: plan.professionTypeKey });
      const count = normalSkillCount(plan.professionKey);
      state.setMasteryEquippedState(plan.masteryEquipped.slice(0, count));
      state.setMasteryLevelsState(plan.masteryLevels.slice(0, count));
      state.setMasteryRanksState(plan.masteryRanks.slice(0, count));
      state.setFixedLevelsState(plan.fixedLevels);
      state.setFixedRanksState(plan.fixedRanks);
      state.setBattleImaginesState(plan.battleImagines ?? STATIC_AUTOSAVE_DEFAULTS.battleImagines);
      state.setImagineRanksState(plan.imagineRanks ?? STATIC_AUTOSAVE_DEFAULTS.imagineRanks);
      const roleSkillDefaults = getDefaultProfessionState(plan.professionKey);
      state.setRoleSkillSlotsState(plan.roleSkillSlots ?? roleSkillDefaults.roleSkillSlots);
      state.setRoleSkillRanksState(plan.roleSkillRanks ?? roleSkillDefaults.roleSkillRanks);
      state.setTalentR1EnabledIds(new Set(plan.talentR1EnabledIds));
      state.setTalentR2EnabledIds(new Set(plan.talentR2EnabledIds));
      state.setSlotEnchants(plan.slotEnchants ?? STATIC_AUTOSAVE_DEFAULTS.slotEnchants);
      state.setModuleSlotsState(plan.moduleSlots ?? STATIC_AUTOSAVE_DEFAULTS.moduleSlots);
      set({ adventurerLevel: plan.adventurerLevel ?? STATIC_AUTOSAVE_DEFAULTS.adventurerLevel });
      state.setPhantomEnabled(plan.phantomEnabled ?? STATIC_AUTOSAVE_DEFAULTS.phantomEnabled);
      const newTid = plan.phantomTemplateId ?? STATIC_AUTOSAVE_DEFAULTS.phantomTemplateId;
      state.setPhantomTemplateIdState(newTid);
      // 過去シーズン(S2)の幻影因子が装着されたままのデータは、潜在Lv/絆レベルポイント/
      // 因子装着/ノード選択状況をリセットし、ユーザーに通知する
      // (テンプレート自体は維持し、ノード選択のみそのテンプレートの初期状態に戻す)。
      if (hasLegacyPhantomFactor(plan.phantomFactorSlots)) {
        state.setPhantomLevel(1);
        state.setPhantomBondPoints(0);
        state.setPhantomNodeSelectionsState(
          newTid != null ? initPhantomNodeSelections(newTid) : {},
        );
        state.setPhantomFactorSlotsState({});
        set({ phantomLegacyFactorResetNotice: true });
        return;
      }
      state.setPhantomLevel(plan.phantomLevel ?? STATIC_AUTOSAVE_DEFAULTS.phantomLevel);
      state.setPhantomBondPoints(
        plan.phantomBondPoints ?? STATIC_AUTOSAVE_DEFAULTS.phantomBondPoints,
      );
      state.setPhantomNodeSelectionsState(
        plan.phantomNodeSelections ??
          (newTid != null
            ? initPhantomNodeSelections(newTid)
            : STATIC_AUTOSAVE_DEFAULTS.phantomNodeSelections),
      );
      state.setPhantomFactorSlotsState(
        plan.phantomFactorSlots ?? STATIC_AUTOSAVE_DEFAULTS.phantomFactorSlots,
      );
    },

    savePlan: (name) => {
      const state = get();
      const plan: BuildPlanData = { id: crypto.randomUUID(), ...state.buildAutoSaveState(name) };
      const next = [plan, ...state.buildPlans];
      persistBuildPlans(next);
      set({ buildPlans: next });
    },

    overwritePlan: (id, name) => {
      const state = get();
      const plan: BuildPlanData = { id, ...state.buildAutoSaveState(name) };
      const next = state.buildPlans.map((p) => (p.id === id ? plan : p));
      persistBuildPlans(next);
      set({ buildPlans: next });
    },

    loadPlan: (id) => {
      const state = get();
      const plan = state.buildPlans.find((p) => p.id === id);
      if (!plan) return;
      set({ planName: plan.name });
      state.applyPlanState(plan);
    },

    exportPlanCode: () => encodePlanCode(get().buildAutoSaveState()),

    importPlanCode: (code) => {
      const decoded = decodePlanCode(code);
      if (!decoded) return 'failed';
      set({ planName: decoded.state.name });
      get().applyPlanState(decoded.state);
      return decoded.isLegacy ? 'legacy' : 'ok';
    },

    renamePlan: (id, newName) => {
      const state = get();
      const target = state.buildPlans.find((p) => p.id === id);
      const next = state.buildPlans.map((p) => (p.id === id ? { ...p, name: newName } : p));
      persistBuildPlans(next);
      set({ buildPlans: next });
      // 現在の入力欄の名前がリネーム対象と一致していれば追従
      if (target && state.planName === target.name) set({ planName: newName });
    },

    deletePlan: (id) => {
      const state = get();
      const next = state.buildPlans.filter((p) => p.id !== id);
      persistBuildPlans(next);
      set({ buildPlans: next });
    },

    resetPlan: () => {
      const state = get();
      const defaults = getDefaultAutoSaveState(DEFAULT_PROFESSION_KEY);
      set({ planName: '' });
      state.setEquipped(defaults.equipped);
      state.setRefineLevels(defaults.refineLevels);
      state.setPerfectlines(defaults.perfectlines);
      state.setEvolutionStatsState(defaults.evolutionStats);
      state.setLegendaryAffixState(defaults.legendaryAffixState);
      state.setLegendaryAffixGroupState(defaults.legendaryAffixGroupState);
      state.setSlotEnchants(defaults.slotEnchants);
      set({ cookingBuff: DEFAULT_COOKING_BUFF });
      set({ professionKey: defaults.professionKey, professionTypeKey: defaults.professionTypeKey });
      state.setTalentR1EnabledIds(new Set(defaults.talentR1EnabledIds));
      state.setTalentR2EnabledIds(new Set(defaults.talentR2EnabledIds));
      state.setMasteryEquippedState(defaults.masteryEquipped);
      state.setMasteryLevelsState(defaults.masteryLevels);
      state.setMasteryRanksState(defaults.masteryRanks);
      state.setFixedLevelsState(defaults.fixedLevels);
      state.setFixedRanksState(defaults.fixedRanks);
      state.setBattleImaginesState(defaults.battleImagines);
      state.setImagineRanksState(defaults.imagineRanks);
      state.setRoleSkillSlotsState(defaults.roleSkillSlots);
      state.setRoleSkillRanksState(defaults.roleSkillRanks);
      state.setModuleSlotsState(defaults.moduleSlots);
      set({ adventurerLevel: defaults.adventurerLevel });
      state.setPhantomEnabled(defaults.phantomEnabled);
      state.setPhantomLevel(defaults.phantomLevel);
      state.setPhantomTemplateIdState(defaults.phantomTemplateId);
      state.setPhantomBondPoints(defaults.phantomBondPoints);
      state.setPhantomNodeSelectionsState(defaults.phantomNodeSelections);
      state.setPhantomFactorSlotsState(defaults.phantomFactorSlots);
    },

    resaveBuildPlans: () => {
      const state = get();
      persistBuildPlans(state.buildPlans);
      set({ buildPlansLegacySource: null });
    },
    dismissBuildPlansLegacyNotice: () => set({ buildPlansLegacySource: null }),
    dismissAutoSaveLegacyNotice: () => set({ autoSaveLegacySource: null }),
    dismissPlanLoadError: () => set({ planLoadError: false }),
    dismissAutoSaveLoadError: () => set({ autoSaveLoadError: false }),
    dismissPhantomLegacyFactorResetNotice: () => set({ phantomLegacyFactorResetNotice: false }),
  };
};
