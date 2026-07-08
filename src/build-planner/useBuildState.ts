import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ADAPTABILITY_VALUES,
  applyCookingBuff,
  DEFAULT_COOKING_BUFF,
  HP_SHIFT_VALUES,
  MORALE_BOOST_PERCENT_STAT_IDS,
  MORALE_BOOST_VALUES,
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
  ModuleConfig,
  ModuleSlots,
  SlotEnchants,
  SlotEvolutionStats,
  SlotLegendaryAffix,
  SlotRefineLevels,
  StatId,
} from './types';
import type { AutoSaveState, BuildPlanData } from './buildPlan';
import { loadAutoSave, loadBuildPlans, persistAutoSave, persistBuildPlans } from './buildPlan';
import type { PhantomFactorSlotValue } from './phantom/phantomData';
import { initPhantomNodeSelections } from './phantom/phantomData';
import { decodePlanCode, encodePlanCode } from './planCode';

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

const INITIAL_REFINE_LEVELS: SlotRefineLevels = {
  weapon: 30,
  head: 30,
  chest: 30,
  arms: 30,
  legs: 30,
  earring: 30,
  necklace: 30,
  ring: 30,
  ringLeft: 30,
  ringRight: 30,
  belt: 30,
};

const INITIAL_PERFECTLINES: SlotRefineLevels = {
  weapon: 100,
  head: 100,
  chest: 100,
  arms: 100,
  legs: 100,
  earring: 100,
  necklace: 100,
  ring: 100,
  ringLeft: 100,
  ringRight: 100,
  belt: 100,
};

// ---- main hook ----

export function useBuildState() {
  // 起動時に自動保存から復元（1回のみ実行される lazy initializer）
  const [autoSaveOnMount] = useState<AutoSaveState | null>(loadAutoSave);

  const [equipped, setEquipped] = useState<EquippedItems>(
    () => autoSaveOnMount?.equipped ?? DEFAULT_LOADOUT,
  );
  const [refineLevels, setRefineLevels] = useState<SlotRefineLevels>(
    () => autoSaveOnMount?.refineLevels ?? INITIAL_REFINE_LEVELS,
  );
  const [perfectlines, setPerfectlines] = useState<SlotRefineLevels>(
    () => autoSaveOnMount?.perfectlines ?? INITIAL_PERFECTLINES,
  );
  const [evolutionStats, setEvolutionStatsState] = useState<SlotEvolutionStats>(
    () => autoSaveOnMount?.evolutionStats ?? {},
  );
  const [legendaryAffixState, setLegendaryAffixState] = useState<SlotLegendaryAffix>(
    () => autoSaveOnMount?.legendaryAffixState ?? {},
  );
  const [slotEnchants, setSlotEnchants] = useState<SlotEnchants>(
    () => autoSaveOnMount?.slotEnchants ?? {},
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
    () => autoSaveOnMount?.fixedLevels ?? [30, 30, 30],
  );
  const [fixedRanks, setFixedRanks] = useState<number[]>(
    () => autoSaveOnMount?.fixedRanks ?? [6, 6, 6],
  );

  // バトルイマジン: クラス変更時もリセットしない
  const [battleImaginaries, setBattleImaginaries] = useState<(number | null)[]>(
    () => autoSaveOnMount?.battleImaginaries ?? [null, null],
  );
  const [imaginaryRanks, setImaginaryRanks] = useState<number[]>(
    () => autoSaveOnMount?.imaginaryRanks ?? [5, 5],
  );

  // モジュールスロット (5スロット)
  const [moduleSlots, setModuleSlotsState] = useState<ModuleSlots>(
    () => autoSaveOnMount?.moduleSlots ?? [null, null, null, null, null],
  );

  // 冒険者レベル (1-60)
  const [adventurerLevel, setAdventurerLevel] = useState<number>(
    () => autoSaveOnMount?.adventurerLevel ?? 60,
  );

  // 潜在心相晶ステート
  const [phantomEnabled, setPhantomEnabled] = useState<boolean>(
    () => autoSaveOnMount?.phantomEnabled ?? true,
  );
  const [phantomLevel, setPhantomLevel] = useState<number>(
    () => autoSaveOnMount?.phantomLevel ?? 100,
  );
  const [phantomTemplateId, setPhantomTemplateIdState] = useState<number | null>(
    () => autoSaveOnMount?.phantomTemplateId ?? null,
  );
  const [phantomBondPoints, setPhantomBondPoints] = useState<number>(
    () => autoSaveOnMount?.phantomBondPoints ?? 35,
  );
  const [phantomNodeSelections, setPhantomNodeSelectionsState] = useState<Record<number, number>>(
    () => {
      if (autoSaveOnMount?.phantomNodeSelections) return autoSaveOnMount.phantomNodeSelections;
      const tid = autoSaveOnMount?.phantomTemplateId;
      return tid != null ? initPhantomNodeSelections(tid) : {};
    },
  );
  const [phantomFactorSlots, setPhantomFactorSlotsState] = useState<
    Record<number, PhantomFactorSlotValue | null>
  >(() => autoSaveOnMount?.phantomFactorSlots ?? {});
  // 潜在因子の最終ステータス%ボーナス（maxHp/physicalDef等）。rawStats算出中に設定し、stats算出時に参照する。
  const phantomFinalPctRef = useRef<Partial<Record<string, number>>>({});

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
  phantomFinalPctRef.current = rawStatsResult.phantomFinalPct;

  // 料理(cookingAtkValue)による最終atk/matkへの加算量。海風の宴のメインステータス+500は
  // calculateRawStats内で他のメインステータス加算源と同様に処理済みのため、ここでは扱わない。
  const cookingResult = useMemo(() => applyCookingBuff(cookingBuff), [cookingBuff]);
  const rawStats = rawStatsResult.rawStats;

  const derivedStats = useMemo(() => deriveStats(rawStats, profession), [rawStats, profession]);

  const finalStatsResult = useMemo(
    () =>
      applyFinalStatModifiers(
        rawStats,
        rawStatsResult.breakdown,
        derivedStats,
        legendaryAffixState,
        battleImaginaries,
        imaginaryRanks,
        phantomFinalPctRef.current,
      ),
    [
      rawStats,
      rawStatsResult.breakdown,
      derivedStats,
      legendaryAffixState,
      battleImaginaries,
      imaginaryRanks,
    ],
  );

  // 料理(cookingAtkValue)による最終atk/matkへの加算は、伝説刻印・バトルイマジン等の
  // 乗算がすべて終わった後の最終値に対して行う。
  const cookingAtkStatId: StatId = profession.attackType === 'physical' ? 'atk' : 'matk';
  // 鼓舞(森癒/威咲): 会心/幸運/ファスト/器用さ/万能の最終計算結果への直接加算量(%)。
  const moralePercentBonus = cookingBuff.moraleBoostEnabled
    ? MORALE_BOOST_VALUES[cookingBuff.moraleBoostVariant].percent
    : 0;
  // HP変動(モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効)。
  const hpShiftLevel = cookingBuff.hpShiftEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.hpShift)
    : 0;
  const hpShiftBonus = hpShiftLevel !== 0 ? HP_SHIFT_VALUES[hpShiftLevel] : 0;
  // 適応力(モジュールパワーコア効果、自分のみ。Lv5以上発動時のみ有効): atk/matkへの乗算バフ(%)。
  const adaptabilityLevel = cookingBuff.adaptabilityEnabled
    ? getPowerCoreLevel(moduleSlots, POWER_CORE_EFFECT_IDS.adaptability)
    : 0;
  const adaptabilityAtkMultPercent =
    adaptabilityLevel !== 0 ? ADAPTABILITY_VALUES[adaptabilityLevel].atkMultPercent : 0;
  const stats: Record<StatId, number> = useMemo(() => {
    if (
      cookingResult.atkBonus === 0 &&
      moralePercentBonus === 0 &&
      hpShiftBonus === 0 &&
      adaptabilityAtkMultPercent === 0
    ) {
      return finalStatsResult.stats;
    }
    const result = { ...finalStatsResult.stats };
    // 適応力: atk/matkへの乗算バフは、料理の平坦加算より前に適用する。
    if (adaptabilityAtkMultPercent !== 0) {
      result[cookingAtkStatId] = result[cookingAtkStatId] * (1 + adaptabilityAtkMultPercent / 100);
    }
    if (cookingResult.atkBonus !== 0) {
      result[cookingAtkStatId] = result[cookingAtkStatId] + cookingResult.atkBonus;
    }
    if (moralePercentBonus !== 0) {
      for (const statId of MORALE_BOOST_PERCENT_STAT_IDS) {
        result[statId] = result[statId] + moralePercentBonus;
      }
    }
    // HP変動: 会心/幸運/ファスト/器用さ/万能のうち、この時点の計算結果が最も高い項目に加算する。
    if (hpShiftBonus !== 0) {
      let maxStatId = MORALE_BOOST_PERCENT_STAT_IDS[0];
      for (const statId of MORALE_BOOST_PERCENT_STAT_IDS.slice(1)) {
        if (result[statId] > result[maxStatId]) maxStatId = statId;
      }
      result[maxStatId] = result[maxStatId] + hpShiftBonus;
    }
    return result;
  }, [
    finalStatsResult.stats,
    cookingResult.atkBonus,
    cookingAtkStatId,
    moralePercentBonus,
    hpShiftBonus,
    adaptabilityAtkMultPercent,
  ]);

  // ステータス詳細「バフ効果」表示用: 最終ステータス%ボーナス(applyFinalStatModifiers由来)に加え、
  // 料理・鼓舞・HP変動・適応力による最終加算/乗算量を「料理バフ」列として合算する。海風の宴・能力共鳴の
  // メインステータス加算はcalculateRawStats内で他の加算源と同様に扱われ、通常の加算(additive)列に含まれる。
  const rawStatsBreakdown = useMemo(() => {
    if (
      cookingResult.atkBonus === 0 &&
      moralePercentBonus === 0 &&
      hpShiftBonus === 0 &&
      adaptabilityAtkMultPercent === 0
    ) {
      return finalStatsResult.breakdown;
    }
    const merged = { ...finalStatsResult.breakdown };
    if (adaptabilityAtkMultPercent !== 0) {
      merged[cookingAtkStatId] = {
        ...merged[cookingAtkStatId],
        multiplier: merged[cookingAtkStatId].multiplier * (1 + adaptabilityAtkMultPercent / 100),
      };
    }
    if (cookingResult.atkBonus !== 0) {
      merged[cookingAtkStatId] = {
        ...merged[cookingAtkStatId],
        cookingBonus: (merged[cookingAtkStatId].cookingBonus ?? 0) + cookingResult.atkBonus,
      };
    }
    if (moralePercentBonus !== 0) {
      for (const statId of MORALE_BOOST_PERCENT_STAT_IDS) {
        merged[statId] = {
          ...merged[statId],
          cookingBonus: (merged[statId].cookingBonus ?? 0) + moralePercentBonus,
        };
      }
    }
    if (hpShiftBonus !== 0) {
      let maxStatId = MORALE_BOOST_PERCENT_STAT_IDS[0];
      for (const statId of MORALE_BOOST_PERCENT_STAT_IDS.slice(1)) {
        if (stats[statId] > stats[maxStatId]) maxStatId = statId;
      }
      merged[maxStatId] = {
        ...merged[maxStatId],
        cookingBonus: (merged[maxStatId].cookingBonus ?? 0) + hpShiftBonus,
      };
    }
    return merged;
  }, [
    finalStatsResult.breakdown,
    cookingResult,
    cookingAtkStatId,
    moralePercentBonus,
    hpShiftBonus,
    adaptabilityAtkMultPercent,
    stats,
  ]);

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

  const snapshotPlan = (name: string, existingId?: string): BuildPlanData => ({
    id: existingId ?? crypto.randomUUID(),
    name,
    professionKey,
    professionTypeKey,
    equipped,
    refineLevels,
    perfectlines,
    evolutionStats,
    legendaryAffixState,
    slotEnchants: { ...slotEnchants },
    masteryEquipped,
    masteryLevels,
    masteryRanks,
    fixedLevels,
    fixedRanks,
    battleImaginaries,
    imaginaryRanks,
    talentR1EnabledIds: [...talentR1EnabledIds],
    talentR2EnabledIds: [...talentR2EnabledIds],
    moduleSlots: [...moduleSlots],
    adventurerLevel,
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomBondPoints,
    phantomNodeSelections: { ...phantomNodeSelections },
    phantomFactorSlots: { ...phantomFactorSlots },
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
    setSlotEnchants(plan.slotEnchants ?? {});
    setModuleSlotsState(plan.moduleSlots ?? [null, null, null, null, null]);
    setAdventurerLevel(plan.adventurerLevel ?? 60);
    setPhantomEnabled(plan.phantomEnabled ?? true);
    setPhantomLevel(plan.phantomLevel ?? 100);
    const newTid = plan.phantomTemplateId ?? null;
    setPhantomTemplateIdState(newTid);
    setPhantomBondPoints(plan.phantomBondPoints ?? 35);
    setPhantomNodeSelectionsState(
      plan.phantomNodeSelections ?? (newTid != null ? initPhantomNodeSelections(newTid) : {}),
    );
    setPhantomFactorSlotsState(plan.phantomFactorSlots ?? {});
  };

  const loadPlan = (id: string) => {
    const plan = buildPlans.find((p) => p.id === id);
    if (!plan) return;
    setPlanName(plan.name);
    applyPlanState(plan);
  };

  // 現在の編集状態を BuildPlanData(id を除く)として構築する。エクスポート/自動保存で共用。
  const buildAutoSaveState = (): AutoSaveState => ({
    name: planName,
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
    talentR1EnabledIds: [...talentR1EnabledIds],
    talentR2EnabledIds: [...talentR2EnabledIds],
    moduleSlots: [...moduleSlots],
    adventurerLevel,
    phantomEnabled,
    phantomLevel,
    phantomTemplateId,
    phantomBondPoints,
    phantomNodeSelections: { ...phantomNodeSelections },
    phantomFactorSlots: { ...phantomFactorSlots },
  });

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
    setPlanName('');
    setEquipped(DEFAULT_LOADOUT);
    setRefineLevels(INITIAL_REFINE_LEVELS);
    setPerfectlines(INITIAL_PERFECTLINES);
    setEvolutionStatsState({});
    setLegendaryAffixState({});
    setSlotEnchants({});
    setCookingBuffState(DEFAULT_COOKING_BUFF);
    setProfessionKey(DEFAULT_PROFESSION_KEY);
    setProfessionTypeKey('type1');
    const profId = PROFESSIONS[DEFAULT_PROFESSION_KEY].professionId;
    setTalentR1EnabledIds(initTalentR1Ids(profId));
    setTalentR2EnabledIds(initTalentR2Ids(profId, 0));
    const count = normalSkillCount(DEFAULT_PROFESSION_KEY);
    setMasteryEquipped(initMasteryEquipped(count));
    setMasteryLevels(initMasteryLevels(count));
    setMasteryRanks(initMasteryRanks(count));
    setFixedLevels([30, 30, 30]);
    setFixedRanks([6, 6, 6]);
    setBattleImaginaries([null, null]);
    setImaginaryRanks([5, 5]);
    setModuleSlotsState([null, null, null, null, null]);
    setAdventurerLevel(60);
    setPhantomEnabled(true);
    setPhantomLevel(100);
    setPhantomTemplateIdState(null);
    setPhantomBondPoints(35);
    setPhantomNodeSelectionsState({});
    setPhantomFactorSlotsState({});
  };

  // ---- 自動保存（状態変更のたびに現在の編集内容をlocalStorageに保持） ----

  useEffect(() => {
    persistAutoSave(buildAutoSaveState());
  }, [
    planName,
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
  ]);

  // ---- phantom state handlers ----

  const setPhantomTemplateId = (id: number | null) => {
    setPhantomTemplateIdState(id);
    setPhantomNodeSelectionsState(id != null ? initPhantomNodeSelections(id) : {});
    setPhantomFactorSlotsState({});
  };

  const setPhantomNodeSelection = (sameGroupId: number, nodeId: number) => {
    setPhantomNodeSelectionsState((prev) => ({ ...prev, [sameGroupId]: nodeId }));
  };

  const setPhantomFactorSlot = (groupId: number, factor: PhantomFactorSlotValue | null) => {
    setPhantomFactorSlotsState((prev) => ({ ...prev, [groupId]: factor }));
  };

  // ---- module state handler ----

  const setModuleSlot = (index: number, config: ModuleConfig | null) => {
    setModuleSlotsState((prev) => {
      const next = [...prev] as ModuleSlots;
      next[index] = config;
      return next;
    });
  };

  // ---- enchant state ----

  const setSlotEnchant = (slot: EquipmentSlotId, itemId: number | undefined) =>
    setSlotEnchants((prev) => ({ ...prev, [slot]: itemId }));

  // ---- 料理バフ state ----

  const setCookingBuff = (patch: Partial<CookingBuffState>) =>
    setCookingBuffState((prev) => ({ ...prev, ...patch }));

  // ---- skill state handlers ----

  const toggleMasteryEquipped = (index: number) => {
    setMasteryEquipped((prev) => {
      const next = [...prev];
      const equippedCount = next.filter(Boolean).length;
      if (!next[index] && equippedCount >= 4) return prev;
      next[index] = !next[index];
      return next;
    });
  };

  const setMasteryLevel = (index: number, level: number) => {
    setMasteryLevels((prev) => {
      const n = [...prev];
      n[index] = level;
      return n;
    });
  };

  const setMasteryRank = (index: number, rank: number) => {
    setMasteryRanks((prev) => {
      const n = [...prev];
      n[index] = rank;
      return n;
    });
  };

  const setFixedLevel = (index: number, level: number) => {
    setFixedLevels((prev) => {
      const n = [...prev];
      n[index] = level;
      return n;
    });
  };

  const setFixedRank = (index: number, rank: number) => {
    setFixedRanks((prev) => {
      const n = [...prev];
      n[index] = rank;
      return n;
    });
  };

  const setBattleImaginary = (index: number, id: number | null) => {
    setBattleImaginaries((prev) => {
      const n = [...prev];
      n[index] = id;
      return n;
    });
  };

  const setImaginaryRank = (index: number, rank: number) => {
    setImaginaryRanks((prev) => {
      const n = [...prev];
      n[index] = rank;
      return n;
    });
  };

  const reorderBattleImaginaries = (fromIndex: number, toIndex: number) => {
    setBattleImaginaries((prev) => {
      const n = [...prev];
      [n[fromIndex], n[toIndex]] = [n[toIndex], n[fromIndex]];
      return n;
    });
    setImaginaryRanks((prev) => {
      const n = [...prev];
      [n[fromIndex], n[toIndex]] = [n[toIndex], n[fromIndex]];
      return n;
    });
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
