import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { EquipmentSlotId, ModuleSlots, SlotRefineLevels } from '../types';
import {
  calculateAbilityScore,
  calculateModuleAbilityScore,
  calculateSkillAbilityScore,
  type CalculateAbilityScoreInput,
} from './calculateAbilityScore';
import { getClassData } from './gameData';

const ALL_SLOTS: EquipmentSlotId[] = [
  'weapon',
  'head',
  'chest',
  'arms',
  'legs',
  'earring',
  'necklace',
  'ring',
  'ringLeft',
  'ringRight',
  'belt',
];

function uniformSlotRecord(value: number): SlotRefineLevels {
  return Object.fromEntries(ALL_SLOTS.map((slot) => [slot, value])) as SlotRefineLevels;
}

function baseInput(): CalculateAbilityScoreInput {
  return {
    equipped: {},
    perfectlines: uniformSlotRecord(100),
    evolutionStats: {},
    refineLevels: uniformSlotRecord(0),
    legendaryAffixState: {},
    legendaryAffixGroupState: {},
    slotEnchants: {},
    profession: PROFESSIONS.stormBlade,
    professionTypeKey: 'type1',
    fixedLevels: [],
    fixedRanks: [],
    masteryEquipped: [],
    masteryLevels: [],
    masteryRanks: [],
    battleImagines: [null, null],
    imagineRanks: [5, 5],
    moduleSlots: [null, null, null, null, null],
    adventurerLevel: 0,
    talentR1EnabledIds: new Set(),
    talentR2EnabledIds: new Set(),
    talentNodesById: new Map(),
    phantomEnabled: false,
    phantomLevel: 0,
    phantomTemplateId: null,
    phantomNodeSelections: {},
    phantomFactorSlots: {},
    phantomBondPoints: 0,
  };
}

describe('calculateAbilityScore', () => {
  it('only the fixed-skill baseline (level=1, rank=0) contributes when everything else is empty/disabled', () => {
    const input = baseInput();
    const result = calculateAbilityScore(input);

    expect(result.other).toBe(0);
    expect(result.abilityR1).toBe(0);
    expect(result.abilityR2).toBe(0);
    expect(result.skillMastery).toBe(0);
    expect(result.skillImagine).toBe(0);
    expect(result.equipmentBase).toBe(0);
    expect(result.equipmentEnchant).toBe(0);
    expect(result.equipmentRefine).toBe(0);
    expect(result.equipmentSuit).toBe(0);
    expect(result.moduleLink).toBe(0);
    expect(result.moduleCore).toBe(0);
    expect(result.phantomLevel).toBe(0);
    expect(result.phantom).toBe(0);

    // skillFixed: クラスの固定スキル3グループ(通常/特殊/アルティメット)を
    // fixedLevels/fixedRanks未指定時のデフォルト(level=1, rank=0)で評価した値。
    const cls = getClassData(input.profession.professionId);
    let expectedSkillFixed = 0;
    for (const group of [cls!.normalAttackSkill, cls!.specialSkill, cls!.ultimateSkill]) {
      for (const skillId of group) {
        expectedSkillFixed += calculateSkillAbilityScore(skillId, 1, 0, false);
      }
    }
    expect(result.skillFixed).toBe(expectedSkillFixed);
    expect(result.total).toBe(expectedSkillFixed);
  });
});

describe('calculateModuleAbilityScore', () => {
  it('resolves core/link fight values from real modules.json data', () => {
    // src/data/modules.json: effects["1110"].levels[3] = [29, 8, [...]] (fv=29, threshold=8)
    //                         effects["1110"].levels[4] = [44, 12, [...]] (threshold=12, 未達)
    //                         linkEffects[8] = [8, 46, [...]] (globalLink=8のfightValue=46)
    const moduleSlots: ModuleSlots = [
      { modId: 5500101, holes: [{ effectId: 1110, linkCount: 8 }] },
      null,
      null,
      null,
      null,
    ];

    const result = calculateModuleAbilityScore(moduleSlots);

    expect(result).toEqual({ core: 29, link: 46 });
  });

  it('returns zero for both when no module holes have an effect assigned', () => {
    const moduleSlots: ModuleSlots = [null, null, null, null, null];

    expect(calculateModuleAbilityScore(moduleSlots)).toEqual({ core: 0, link: 0 });
  });
});
