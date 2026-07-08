import { useEffect, useMemo, useState } from 'react';
import { setAtIndex, swapAtIndex, withIndex } from './arrayState';
import {
  DEFAULT_LOADOUT,
  EQUIPMENT_BOTTOM_SLOTS,
  EQUIPMENT_TOP_SLOTS,
  getItemsBySlot,
  getMaxPerfectline,
} from './equipment/equipmentData';
import type { ProfessionKey, ProfessionTypeKey } from './profession';
import { DEFAULT_PROFESSION_KEY, PROFESSIONS } from './profession';
import { deriveStats } from './stats/deriveStats';
import { applyFinalStatModifiers, calculateRawStats } from './stats/calculateRawStats';
import { calculateAbilityScore } from './stats/calculateAbilityScore';
import { useModuleState } from './module/useModuleState';
import {
  AGILE_VALUES,
  applyCookingBuff,
  computeCookingAdjustments,
  DEFAULT_COOKING_BUFF,
  INSPIRATION_VALUES,
  LIFE_WAVE_VALUES,
  POWER_CORE_EFFECT_IDS,
} from './stats/cookingBuff';
import {
  buildTalentNodesById,
  countR1Nodes,
  getClassData,
  getPowerCoreLevel,
  initTalentR1Ids,
  initTalentR2Ids,
  talentTree,
} from './stats/gameData';
import type {
  AbilityScoreBreakdown,
  CookingBuffState,
  EquipmentItem,
  EquipmentSlotId,
  EquippedItems,
  EvolutionStatId,
  LegendaryAffixSelection,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
  StatId,
} from './types';
import type { AutoSaveState, BuildPlanData } from './buildPlan';
import { loadAutoSave, loadBuildPlans, persistAutoSave, persistBuildPlans } from './buildPlan';
import { initPhantomNodeSelections } from './phantom/phantomData';
import { usePhantomState } from './phantom/usePhantomState';
import { decodePlanCode, encodePlanCode } from './planCode';
import { getDefaultAutoSaveState, STATIC_AUTOSAVE_DEFAULTS } from './planDefaults';

// ---- state init helpers ----

function initMasteryEquipped(size: number): boolean[] {
  return Array(size).fill(false);
}

function initMasteryLevels(size: number): number[] {
  return Array(size).fill(30);
}

function initMasteryRanks(size: number): number[] {
  return Array(size).fill(6);
}

function normalSkillCount(profKey: ProfessionKey): number {
  return getClassData(PROFESSIONS[profKey].professionId)?.normalSkill.length ?? 0;
}

// ---- main hook ----

export function useBuildState() {
  // 起動時に自動保存から復元（1回のみ実行される lazy initializer）
  const [autoSaveOnMount] = useState<AutoSaveState | null>(loadAutoSave);

  const [equipped, setEquipped] = useState<EquippedItems>(
    () => autoSaveOnMount?.equipped ?? DEFAULT_LOADOUT,
  );
  const [refineLevels, setRefineLevels] = useState<SlotRefineLevels>(
    () => autoSaveOnMount?.refineLevels ?? STATIC_AUTOSAVE_DEFAULTS.refineLevels,
  );
  const [perfectlines, setPerfectlines] = useState<SlotRefineLevels>(
    () => autoSaveOnMount?.perfectlines ?? STATIC_AUTOSAVE_DEFAULTS.perfectlines,
  );
  const [evolutionStats, setEvolutionStatsState] = useState<SlotEvolutionStats>(
    () => autoSaveOnMount?.evolutionStats ?? STATIC_AUTOSAVE_DEFAULTS.evolutionStats,
  );
  const [legendaryAffixState, setLegendaryAffixState] = useState<SlotLegendaryAffix>(
    () => autoSaveOnMount?.legendaryAffixState ?? STATIC_AUTOSAVE_DEFAULTS.legendaryAffixState,
  );
  const [slotEnchants, setSlotEnchants] = useState<SlotEnchants>(
    () => autoSaveOnMount?.slotEnchants ?? STATIC_AUTOSAVE_DEFAULTS.slotEnchants,
  );
  // ダメージ計算機(作成中)用の一時的な入力値。保存/自動保存/プランコードの対象外
  // (現在のステータス+追加効果を都度計算する用途のため、セッションをまたいで保持しない)。
  const [cookingBuff, setCookingBuffState] = useState<CookingBuffState>(DEFAULT_COOKING_BUFF);
  const [professionKey, setProfessionKey] = useState<ProfessionKey>(
    () => autoSaveOnMount?.professionKey ?? DEFAULT_PROFESSION_KEY,
  );
  const [professionTypeKey, setProfessionTypeKey] = useState<ProfessionTypeKey>(
    () => autoSaveOnMount?.professionTypeKey ?? 'type1',
  );

  // アビリティツリー状態（パネル切り替えでリセットしない）
  const [talentR1EnabledIds, setTalentR1EnabledIds] = useState<Set<number>>(() => {
    if (autoSaveOnMount?.talentR1EnabledIds) return new Set(autoSaveOnMount.talentR1EnabledIds);
    return initTalentR1Ids(PROFESSIONS[DEFAULT_PROFESSION_KEY].professionId);
  });
  const [talentR2EnabledIds, setTalentR2EnabledIds] = useState<Set<number>>(() => {
    if (autoSaveOnMount?.talentR2EnabledIds) return new Set(autoSaveOnMount.talentR2EnabledIds);
    return initTalentR2Ids(PROFESSIONS[DEFAULT_PROFESSION_KEY].professionId, 0);
  });

  // スキルステート
  const defaultCount = normalSkillCount(autoSaveOnMount?.professionKey ?? DEFAULT_PROFESSION_KEY);
  const [masteryEquipped, setMasteryEquipped] = useState<boolean[]>(
    () => autoSaveOnMount?.masteryEquipped ?? initMasteryEquipped(defaultCount),
  );
  const [masteryLevels, setMasteryLevels] = useState<number[]>(
    () => autoSaveOnMount?.masteryLevels ?? initMasteryLevels(defaultCount),
  );
  const [masteryRanks, setMasteryRanks] = useState<number[]>(
    () => autoSaveOnMount?.masteryRanks ?? initMasteryRanks(defaultCount),
  );

  // 固定スキル (normalAttack, special, ultimate) のLv/Rank
  const [fixedLevels, setFixedLevels] = useState<number[]>(
    () => autoSaveOnMount?.fixedLevels ?? STATIC_AUTOSAVE_DEFAULTS.fixedLevels,
  );
  const [fixedRanks, setFixedRanks] = useState<number[]>(
    () => autoSaveOnMount?.fixedRanks ?? STATIC_AUTOSAVE_DEFAULTS.fixedRanks,
  );

  // バトルイマジン: クラス変更時もリセットしない
  const [battleImaginaries, setBattleImaginaries] = useState<(number | null)[]>(
    () => autoSaveOnMount?.battleImaginaries ?? STATIC_AUTOSAVE_DEFAULTS.battleImaginaries,
  );
  const [imaginaryRanks, setImaginaryRanks] = useState<number[]>(
    () => autoSaveOnMount?.imaginaryRanks ?? STATIC_AUTOSAVE_DEFAULTS.imaginaryRanks,
  );

  // モジュールスロット (5スロット)
  const { moduleSlots, setModuleSlotsState, setModuleSlot } = useModuleState(
    autoSaveOnMount?.moduleSlots ?? STATIC_AUTOSAVE_DEFAULTS.moduleSlots,
  );

  // 冒険者レベル (1-60)
  const [adventurerLevel, setAdventurerLevel] = useState<number>(
    () => autoSaveOnMount?.adventurerLevel ?? STATIC_AUTOSAVE_DEFAULTS.adventurerLevel,
  );

  // 潜在心相晶ステート
  const {
    phantomEnabled,
    setPhantomEnabled,
    phantomLevel,
    setPhantomLevel,
    phantomTemplateId,
    setPhantomTemplateId,
    setPhantomTemplateIdState,
    phantomBondPoints,
    setPhantomBondPoints,
    phantomNodeSelections,
    setPhantomNodeSelection,
    setPhantomNodeSelectionsState,
    phantomFactorSlots,
    setPhantomFactorSlot,
    setPhantomFactorSlotsState,
  } = usePhantomState(autoSaveOnMount);

  // ビルドプラン一覧
  const [buildPlans, setBuildPlans] = useState<BuildPlanData[]>(() => loadBuildPlans());

  // プラン名（テキスト入力欄の現在値）
  const [planName, setPlanName] = useState<string>(() => autoSaveOnMount?.name ?? '');

  const profession = PROFESSIONS[professionKey];

  // アビリティ効果の統計用マップ
  const talentNodesById = useMemo(
    () => buildTalentNodesById(profession.professionId),
    [profession],
  );

  const r1NodeCount = useMemo(() => countR1Nodes(talentNodesById), [talentNodesById]);

  // アビリティツリーから計算されたスキル置き換えマップ (fromSkillId → toSkillId)
  const skillReplacements = useMemo(() => {
    const result: Record<number, number> = {};
    const allIds = new Set([...talentR1EnabledIds, ...talentR2EnabledIds]);
    for (const nodeId of allIds) {
      const treeNode = talentNodesById.get(nodeId);
      if (!treeNode) continue;
      const td = talentTree.nodes[String(treeNode.talentId)];
      if (!td) continue;
      for (const eff of td.effects) {
        if (eff[0] === 6) result[eff[1]] = eff[2];
      }
    }
    return result;
  }, [talentR1EnabledIds, talentR2EnabledIds, talentNodesById]);

  const selectProfession = (key: ProfessionKey) => {
    const newProfession = PROFESSIONS[key];
    const mainStatChanged = newProfession.mainStat !== profession.mainStat;
    setEquipped((prev) => {
      const next = { ...prev };
      delete next.weapon;
      if (mainStatChanged) {
        for (const slot of [...EQUIPMENT_TOP_SLOTS, ...EQUIPMENT_BOTTOM_SLOTS]) {
          delete next[slot];
        }
      }
      return next;
    });
    setEvolutionStatsState({});
    setProfessionKey(key);
    setProfessionTypeKey('type1');
    // マスタリースキルをリセット (バトルイマジンは引き継ぎ)
    const newCount = normalSkillCount(key);
    setMasteryEquipped(initMasteryEquipped(newCount));
    setMasteryLevels(initMasteryLevels(newCount));
    setMasteryRanks(initMasteryRanks(newCount));
    setFixedLevels([30, 30, 30]);
    setFixedRanks([6, 6, 6]);
    // アビリティツリーをリセット
    const newWt = newProfession.professionId;
    setTalentR1EnabledIds(initTalentR1Ids(newWt));
    setTalentR2EnabledIds(initTalentR2Ids(newWt, 0));
  };

  const selectProfessionType = (key: ProfessionTypeKey) => {
    setProfessionTypeKey(key);
    const newBdType: 0 | 1 = key === 'type1' ? 0 : 1;
    setTalentR2EnabledIds(initTalentR2Ids(profession.professionId, newBdType));
  };

  const setRefineLevel = (slot: EquipmentSlotId, level: number) => {
    setRefineLevels((prev) => ({ ...prev, [slot]: level }));
  };

  const setPerfectline = (slot: EquipmentSlotId, value: number) => {
    setPerfectlines((prev) => ({ ...prev, [slot]: value }));
  };

  const setEvolutionStat = (
    slot: EquipmentSlotId,
    slotIndex: number,
    statId: EvolutionStatId | undefined,
  ) => {
    setEvolutionStatsState((prev) => {
      const current = [...(prev[slot] ?? [])];
      current[slotIndex] = statId;
      return { ...prev, [slot]: current };
    });
  };

  const equip = (slot: EquipmentSlotId, equipmentItem: EquipmentItem) => {
    setEquipped((prev) => ({ ...prev, [slot]: equipmentItem }));
    setPerfectlines((prev) => ({ ...prev, [slot]: getMaxPerfectline(equipmentItem) }));
    setLegendaryAffixState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const setLegendaryAffix = (
    slot: EquipmentSlotId,
    selection: LegendaryAffixSelection | undefined,
  ) => {
    setLegendaryAffixState((prev) => ({ ...prev, [slot]: selection }));
  };

  const unequip = (slot: EquipmentSlotId) => {
    setEquipped((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setEvolutionStatsState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setLegendaryAffixState((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotEnchants((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  // rawStats算出中に確定するバトルイマジン/潜在因子由来の最終ステータス%ボーナスを
  // 後段のstats算出(applyFinalStatModifiers)に引き渡すための一時受け皿。
  const rawStatsResult = useMemo(
    () =>
      calculateRawStats({
        equipped,
        legendaryAffixState,
        refineLevels,
        perfectlines,
        evolutionStats,
        profession,
        professionTypeKey,
        talentR1EnabledIds,
        talentR2EnabledIds,
        talentNodesById,
        r1NodeCount,
        battleImaginaries,
        imaginaryRanks,
        slotEnchants,
        moduleSlots,
        adventurerLevel,
        phantomEnabled,
        phantomLevel,
        phantomTemplateId,
        phantomBondPoints,
        phantomNodeSelections,
        phantomFactorSlots,
        cookingBuff,
      }),
    [
      equipped,
      legendaryAffixState,
      refineLevels,
      perfectlines,
      evolutionStats,
      profession,
      professionTypeKey,
      talentR1EnabledIds,
      talentR2EnabledIds,
      talentNodesById,
      r1NodeCount,
      battleImaginaries,
      imaginaryRanks,
      slotEnchants,
      moduleSlots,
      adventurerLevel,
      phantomEnabled,
      phantomLevel,
      phantomTemplateId,
      phantomBondPoints,
      phantomNodeSelections,
      phantomFactorSlots,
      cookingBuff,
    ],
  );

  // 料理(cookingAtkValue)による最終atk/matkへの加算量。海風の宴のメインステータス+500は
  // calculateRawStats内で他のメインステータス加算源と同様に処理済みのため、ここでは扱わない。
  const cookingResult = useMemo(() => applyCookingBuff(cookingBuff), [cookingBuff]);
  const rawStats = rawStatsResult.rawStats;

  const derivedStats = useMemo(
    () => deriveStats(rawStats, profession, rawStatsResult.conversionRateBonus),
    [rawStats, profession, rawStatsResult.conversionRateBonus],
  );

  const finalStatsResult = useMemo(
    () =>
      applyFinalStatModifiers(
        rawStats,
        rawStatsResult.breakdown,
        derivedStats,
        legendaryAffixState,
        battleImaginaries,
        imaginaryRanks,
        rawStatsResult.phantomFinalPct,
        rawStatsResult.finalPctAddend,
      ),
    [
      rawStats,
      rawStatsResult.breakdown,
      rawStatsResult.phantomFinalPct,
      rawStatsResult.finalPctAddend,
      derivedStats,
      legendaryAffixState,
      battleImaginaries,
      imaginaryRanks,
    ],
  );

  // 料理(cookingAtkValue)による最終atk/matkへの加算は、伝説刻印・バトルイマジン等の
  // 乗算がすべて終わった後の最終値に対して行う。
  const cookingAtkStatId: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  // 鼓舞(Inspiration、森癒/Lifebind・威咲/Smite): 会心/幸運/ファスト/器用さ/万能の
  // 最終計算結果への直接加算量(%)。
  const inspirationPercentBonus = cookingBuff.inspirationEnabled
    ? INSPIRATION_VALUES[cookingBuff.inspirationVariant].percent
    : 0;
  // 極・HP変動(Life Wave、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効)。
  const lifeWaveLevel = cookingBuff.lifeWaveEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.lifeWave)
    : 0;
  const lifeWaveBonus = lifeWaveLevel !== 0 ? LIFE_WAVE_VALUES[lifeWaveLevel] : 0;
  // 極・適応力(Agile、モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効): atk/matkへの乗算バフ(%)。
  const agileLevel = cookingBuff.agileEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.agile)
    : 0;
  const agileAtkMultPercent = agileLevel !== 0 ? AGILE_VALUES[agileLevel].atkMultPercent : 0;
  // 適応力→料理攻撃力→鼓舞→HP変動の順で最終ステータスに適用する調整リスト。
  // stats(実数値)とrawStatsBreakdown(内訳)の両方がこのリストを共通の入力として使う。
  const cookingAdjustments = useMemo(
    () =>
      computeCookingAdjustments(
        finalStatsResult.stats,
        cookingAtkStatId,
        cookingResult.atkBonus,
        inspirationPercentBonus,
        lifeWaveBonus,
        agileAtkMultPercent,
      ),
    [
      finalStatsResult.stats,
      cookingAtkStatId,
      cookingResult.atkBonus,
      inspirationPercentBonus,
      lifeWaveBonus,
      agileAtkMultPercent,
    ],
  );

  const stats: Record<StatId, number> = useMemo(() => {
    if (cookingAdjustments.length === 0) return finalStatsResult.stats;
    const result = { ...finalStatsResult.stats };
    for (const { statId, multiplier, addend } of cookingAdjustments) {
      if (multiplier !== undefined) result[statId] = result[statId] * multiplier;
      if (addend !== undefined) result[statId] = result[statId] + addend;
    }
    return result;
  }, [finalStatsResult.stats, cookingAdjustments]);

  // ステータス詳細「バフ効果」表示用: 最終ステータス%ボーナス(applyFinalStatModifiers由来)に加え、
  // 料理・鼓舞・HP変動・適応力による最終加算/乗算量を「料理バフ」列として合算する。海風の宴のメインステータス
  // 加算はcalculateRawStats内で他の加算源と同様に扱われ、通常の加算(additive)列に含まれる。能力共鳴は
  // メインステータスへの%ボーナス適用後に加算されるため、calculateRawStats側で既に「料理バフ」
  // (cookingBonus)列にセット済み。
  const rawStatsBreakdown = useMemo(() => {
    if (cookingAdjustments.length === 0) return finalStatsResult.breakdown;
    const merged = { ...finalStatsResult.breakdown };
    for (const { statId, multiplier, addend } of cookingAdjustments) {
      const entry = merged[statId];
      merged[statId] = {
        ...entry,
        ...(multiplier !== undefined ? { multiplier: entry.multiplier * multiplier } : {}),
        ...(addend !== undefined ? { cookingBonus: (entry.cookingBonus ?? 0) + addend } : {}),
      };
    }
    return merged;
  }, [finalStatsResult.breakdown, cookingAdjustments]);

  const roleSkills = useMemo(
    () => getClassData(profession.professionId)?.roleSkill ?? [],
    [profession],
  );

  // ---- 能力スコア計算 ----

  const abilityScore = useMemo(
    (): AbilityScoreBreakdown =>
      calculateAbilityScore({
        equipped,
        perfectlines,
        evolutionStats,
        refineLevels,
        legendaryAffixState,
        slotEnchants,
        profession,
        professionTypeKey,
        fixedLevels,
        fixedRanks,
        masteryEquipped,
        masteryLevels,
        masteryRanks,
        battleImaginaries,
        imaginaryRanks,
        moduleSlots,
        adventurerLevel,
        talentR1EnabledIds,
        talentR2EnabledIds,
        talentNodesById,
        phantomEnabled,
        phantomLevel,
        phantomTemplateId,
        phantomNodeSelections,
        phantomFactorSlots,
        phantomBondPoints,
      }),
    [
      equipped,
      perfectlines,
      evolutionStats,
      refineLevels,
      legendaryAffixState,
      slotEnchants,
      profession,
      professionTypeKey,
      fixedLevels,
      fixedRanks,
      masteryEquipped,
      masteryLevels,
      masteryRanks,
      battleImaginaries,
      imaginaryRanks,
      moduleSlots,
      adventurerLevel,
      talentR1EnabledIds,
      talentR2EnabledIds,
      talentNodesById,
      phantomEnabled,
      phantomLevel,
      phantomTemplateId,
      phantomNodeSelections,
      phantomFactorSlots,
      phantomBondPoints,
    ],
  );

  // ---- ビルドプラン操作 ----

  // name以外のAutoSaveStateフィールドの現在値(生の状態変数への参照)。
  // buildAutoSaveStateとautosaveのuseEffect依存配列の双方がここを単一の定義元として使うことで、
  // 新しいフィールド追加時に片方だけ更新し忘れることを防ぐ(Set型のtalentR1/R2EnabledIdsは
  // ここでは配列化せず生のSetのまま保持し、依存配列の参照安定性を壊さないようにする)。
  const rawAutoSaveFields = {
    professionKey,
    professionTypeKey,
    equipped,
    refineLevels,
    perfectlines,
    evolutionStats,
    legendaryAffixState,
    slotEnchants,
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    fixedLevels,
    fixedRanks,
    battleImaginaries,
    imaginaryRanks,
    talentR1EnabledIds,
    talentR2EnabledIds,
    moduleSlots,
    adventurerLevel,
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomBondPoints,
    phantomNodeSelections,
    phantomFactorSlots,
  };

  // 現在の編集状態を AutoSaveState(id を除く BuildPlanData)として構築する。
  // 保存/エクスポート/自動保存で共用。name省略時はプラン名入力欄の現在値を使う。
  const buildAutoSaveState = (name: string = planName): AutoSaveState => ({
    name,
    ...rawAutoSaveFields,
    slotEnchants: { ...rawAutoSaveFields.slotEnchants },
    talentR1EnabledIds: [...rawAutoSaveFields.talentR1EnabledIds],
    talentR2EnabledIds: [...rawAutoSaveFields.talentR2EnabledIds],
    moduleSlots: [...rawAutoSaveFields.moduleSlots],
    phantomNodeSelections: { ...rawAutoSaveFields.phantomNodeSelections },
    phantomFactorSlots: { ...rawAutoSaveFields.phantomFactorSlots },
  });

  const snapshotPlan = (name: string, existingId?: string): BuildPlanData => ({
    id: existingId ?? crypto.randomUUID(),
    ...buildAutoSaveState(name),
  });

  const savePlan = (name: string) => {
    const plan = snapshotPlan(name);
    setBuildPlans((prev) => {
      const next = [plan, ...prev];
      persistBuildPlans(next);
      return next;
    });
  };

  const overwritePlan = (id: string, name: string) => {
    const plan = snapshotPlan(name, id);
    setBuildPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? plan : p));
      persistBuildPlans(next);
      return next;
    });
  };

  // ビルドプラン(保存済みプラン/インポートされたプランコード共通)の状態を現在の編集状態へ適用する。
  const applyPlanState = (plan: AutoSaveState) => {
    // 保存済みアイテムを最新データで上書き（スキーマ変更時の旧形式フィールドを更新）
    const refreshedEquipped: EquippedItems = {};
    for (const [slotId, stored] of Object.entries(plan.equipped)) {
      const slot = slotId as EquipmentSlotId;
      const fresh = getItemsBySlot(slot).find((i) => i.id === stored.id);
      refreshedEquipped[slot] = fresh ?? stored;
    }
    setEquipped(refreshedEquipped);
    setRefineLevels(plan.refineLevels);
    setPerfectlines(plan.perfectlines);
    setEvolutionStatsState(plan.evolutionStats);
    setLegendaryAffixState(plan.legendaryAffixState);
    setProfessionKey(plan.professionKey);
    setProfessionTypeKey(plan.professionTypeKey);
    const count = normalSkillCount(plan.professionKey);
    setMasteryEquipped(plan.masteryEquipped.slice(0, count));
    setMasteryLevels(plan.masteryLevels.slice(0, count));
    setMasteryRanks(plan.masteryRanks.slice(0, count));
    setFixedLevels(plan.fixedLevels);
    setFixedRanks(plan.fixedRanks);
    setBattleImaginaries(plan.battleImaginaries);
    setImaginaryRanks(plan.imaginaryRanks);
    setTalentR1EnabledIds(new Set(plan.talentR1EnabledIds));
    setTalentR2EnabledIds(new Set(plan.talentR2EnabledIds));
    setSlotEnchants(plan.slotEnchants ?? STATIC_AUTOSAVE_DEFAULTS.slotEnchants);
    setModuleSlotsState(plan.moduleSlots ?? STATIC_AUTOSAVE_DEFAULTS.moduleSlots);
    setAdventurerLevel(plan.adventurerLevel ?? STATIC_AUTOSAVE_DEFAULTS.adventurerLevel);
    setPhantomEnabled(plan.phantomEnabled ?? STATIC_AUTOSAVE_DEFAULTS.phantomEnabled);
    setPhantomLevel(plan.phantomLevel ?? STATIC_AUTOSAVE_DEFAULTS.phantomLevel);
    const newTid = plan.phantomTemplateId ?? STATIC_AUTOSAVE_DEFAULTS.phantomTemplateId;
    setPhantomTemplateIdState(newTid);
    setPhantomBondPoints(plan.phantomBondPoints ?? STATIC_AUTOSAVE_DEFAULTS.phantomBondPoints);
    setPhantomNodeSelectionsState(
      plan.phantomNodeSelections ??
        (newTid != null
          ? initPhantomNodeSelections(newTid)
          : STATIC_AUTOSAVE_DEFAULTS.phantomNodeSelections),
    );
    setPhantomFactorSlotsState(
      plan.phantomFactorSlots ?? STATIC_AUTOSAVE_DEFAULTS.phantomFactorSlots,
    );
  };

  const loadPlan = (id: string) => {
    const plan = buildPlans.find((p) => p.id === id);
    if (!plan) return;
    setPlanName(plan.name);
    applyPlanState(plan);
  };

  const exportPlanCode = (): string => encodePlanCode(buildAutoSaveState());

  const importPlanCode = (code: string): boolean => {
    const plan = decodePlanCode(code);
    if (!plan) return false;
    setPlanName(plan.name);
    applyPlanState(plan);
    return true;
  };

  const renamePlan = (id: string, newName: string) => {
    setBuildPlans((prev) => {
      const target = prev.find((p) => p.id === id);
      const next = prev.map((p) => (p.id === id ? { ...p, name: newName } : p));
      persistBuildPlans(next);
      // 現在の入力欄の名前がリネーム対象と一致していれば追従
      if (target && planName === target.name) setPlanName(newName);
      return next;
    });
  };

  const deletePlan = (id: string) => {
    setBuildPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistBuildPlans(next);
      return next;
    });
  };

  const resetPlan = () => {
    const defaults = getDefaultAutoSaveState(DEFAULT_PROFESSION_KEY);
    setPlanName('');
    setEquipped(defaults.equipped);
    setRefineLevels(defaults.refineLevels);
    setPerfectlines(defaults.perfectlines);
    setEvolutionStatsState(defaults.evolutionStats);
    setLegendaryAffixState(defaults.legendaryAffixState);
    setSlotEnchants(defaults.slotEnchants);
    setCookingBuffState(DEFAULT_COOKING_BUFF);
    setProfessionKey(defaults.professionKey);
    setProfessionTypeKey(defaults.professionTypeKey);
    setTalentR1EnabledIds(new Set(defaults.talentR1EnabledIds));
    setTalentR2EnabledIds(new Set(defaults.talentR2EnabledIds));
    setMasteryEquipped(defaults.masteryEquipped);
    setMasteryLevels(defaults.masteryLevels);
    setMasteryRanks(defaults.masteryRanks);
    setFixedLevels(defaults.fixedLevels);
    setFixedRanks(defaults.fixedRanks);
    setBattleImaginaries(defaults.battleImaginaries);
    setImaginaryRanks(defaults.imaginaryRanks);
    setModuleSlotsState(defaults.moduleSlots);
    setAdventurerLevel(defaults.adventurerLevel);
    setPhantomEnabled(defaults.phantomEnabled);
    setPhantomLevel(defaults.phantomLevel);
    setPhantomTemplateIdState(defaults.phantomTemplateId);
    setPhantomBondPoints(defaults.phantomBondPoints);
    setPhantomNodeSelectionsState(defaults.phantomNodeSelections);
    setPhantomFactorSlotsState(defaults.phantomFactorSlots);
  };

  // ---- 自動保存（状態変更のたびに現在の編集内容をlocalStorageに保持） ----

  useEffect(() => {
    persistAutoSave(buildAutoSaveState());
  }, [planName, ...Object.values(rawAutoSaveFields)]);

  // ---- enchant state ----

  const setSlotEnchant = (slot: EquipmentSlotId, itemId: number | undefined) =>
    setSlotEnchants((prev) => ({ ...prev, [slot]: itemId }));

  // ---- 料理バフ state ----

  const setCookingBuff = (patch: Partial<CookingBuffState>) =>
    setCookingBuffState((prev) => ({ ...prev, ...patch }));

  // ---- skill state handlers ----

  const toggleMasteryEquipped = (index: number) => {
    setMasteryEquipped((prev) => {
      const equippedCount = prev.filter(Boolean).length;
      if (!prev[index] && equippedCount >= 4) return prev;
      return withIndex(prev, index, !prev[index]);
    });
  };

  const setMasteryLevel = (index: number, level: number) =>
    setAtIndex(setMasteryLevels, index, level);

  const setMasteryRank = (index: number, rank: number) => setAtIndex(setMasteryRanks, index, rank);

  const setFixedLevel = (index: number, level: number) => setAtIndex(setFixedLevels, index, level);

  const setFixedRank = (index: number, rank: number) => setAtIndex(setFixedRanks, index, rank);

  const setBattleImaginary = (index: number, id: number | null) =>
    setAtIndex(setBattleImaginaries, index, id);

  const setImaginaryRank = (index: number, rank: number) =>
    setAtIndex(setImaginaryRanks, index, rank);

  const reorderBattleImaginaries = (fromIndex: number, toIndex: number) => {
    setBattleImaginaries((prev) => swapAtIndex(prev, fromIndex, toIndex));
    setImaginaryRanks((prev) => swapAtIndex(prev, fromIndex, toIndex));
  };

  return {
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
    professionKey,
    professionTypeKey,
    profession,
    selectProfession,
    selectProfessionType,
    stats,
    rawStats,
    rawStatsBreakdown,
    derivedStats,
    abilityScore,
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
    setImaginaryRank,
    reorderBattleImaginaries,
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
  };
}
