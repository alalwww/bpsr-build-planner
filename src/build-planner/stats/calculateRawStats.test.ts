import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { EquipmentItem, EquipmentSlotId, SlotRefineLevels, StatId } from '../types';
import { BASE_STATS } from './baseStats';
import type { CalculateRawStatsInput } from './calculateRawStats';
import { calculateRawStats } from './calculateRawStats';
import { DEFAULT_COOKING_BUFF } from './cookingBuff';

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

// 全フィールドを空/0/無効にした最小入力。各テストは必要なフィールドだけ上書きする。
function baseInput(): CalculateRawStatsInput {
  return {
    equipped: {},
    legendaryAffixState: {},
    refineLevels: uniformSlotRecord(0),
    perfectlines: uniformSlotRecord(100),
    evolutionStats: {},
    profession: PROFESSIONS.stormBlade,
    professionTypeKey: 'type1',
    talentR1EnabledIds: new Set(),
    talentR2EnabledIds: new Set(),
    talentNodesById: new Map(),
    r1NodeCount: 0,
    battleImaginaries: [null, null],
    imaginaryRanks: [5, 5],
    slotEnchants: {},
    moduleSlots: [null, null, null, null, null],
    adventurerLevel: 0,
    phantomEnabled: false,
    phantomLevel: 0,
    phantomTemplateId: null,
    phantomBondPoints: 0,
    phantomNodeSelections: {},
    phantomFactorSlots: {},
    cookingBuff: DEFAULT_COOKING_BUFF,
  };
}

function makeEquipmentItem(
  overrides: Partial<EquipmentItem> & Pick<EquipmentItem, 'slot' | 'part'>,
): EquipmentItem {
  return {
    id: 1,
    equipGs: 100,
    quality: 1,
    icon: '',
    baseStats: [],
    evo: [],
    reforgeMaxPerfectline: 0,
    reforgeEvoMin: 0,
    reforgeEvoMax: 0,
    reforgeEvoFvMin: 0,
    reforgeEvoFvMax: 0,
    fixedEvolutionStats: {},
    ...overrides,
  };
}

describe('calculateRawStats', () => {
  it('returns BASE_STATS unchanged when nothing is equipped/enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.rawStats).toEqual(BASE_STATS);
    expect(result.phantomFinalPct).toEqual({});
    for (const statId of Object.keys(BASE_STATS) as StatId[]) {
      expect(result.breakdown[statId]).toEqual({
        base: BASE_STATS[statId],
        additive: 0,
        multiplier: 1,
      });
    }
  });

  it('adds equipment baseStats via EQUIP_ATTR_TO_STAT (attrId 11332 -> atk)', () => {
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        weapon: makeEquipmentItem({
          slot: 'weapon',
          part: 200,
          quality: 4, // getMaxPerfectline=100 なので perfectlines.weapon=100 がそのまま使われる
          baseStats: [[11332, 100, 200]],
        }),
      },
    };

    const result = calculateRawStats(input);

    // calcStatValue(100, 200, 100) = floor(100 + 100 * 1) = 200
    expect(result.rawStats.atk).toBe(200);
    expect(result.rawStats.strength).toBe(BASE_STATS.strength);
  });

  it('applies refine cumulative + milestone effects for the equipped slot only', () => {
    // src/data/refine.json: partRefineIds["200"]["1"] = 1001 (weapon, stormBlade)
    // refineById["1001"].cumulative[4] (level5) = [[11412, 20]]
    // refineById["1001"].milestones["5"] = [[11412, 12]]
    // attrId 11412 -> addStat('atk', v) + addStat('refinePhysAtk', v)
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.stormBlade,
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200, quality: 1 }),
      },
      refineLevels: { ...uniformSlotRecord(0), weapon: 5 },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.atk).toBe(32);
    expect(result.rawStats.refinePhysAtk).toBe(32);
  });

  it('sums multiple legendary-affix % bonuses before multiplying once (not compounding)', () => {
    // attrId 11014 (筋力%) は IMAGINARY_PCT_BASE 経由で addPctBonus される。
    // +10% と +5% は 1.10*1.05 ではなく、合算した +15% を一度だけ乗算する。
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        head: makeEquipmentItem({ slot: 'head', part: 210 }),
        chest: makeEquipmentItem({ slot: 'chest', part: 220 }),
      },
      legendaryAffixState: {
        head: { attrId: 11014, value: 1000 },
        chest: { attrId: 11014, value: 500 },
      },
    };

    const result = calculateRawStats(input);

    // BASE_STATS.strength(15) * 1.15 = 17.25
    expect(result.rawStats.strength).toBe(17.25);
  });

  it('adds statResonanceBonus to the main stat AFTER the % bonus multiplier, not before', () => {
    // stormBlade.mainStat === 'agility'. attrId 11034 (敏捷%) は IMAGINARY_PCT_BASE 経由で
    // addPctBonus される。統計共鳴(響奏)のボーナスはこの%乗算の対象に含めない。
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        head: makeEquipmentItem({ slot: 'head', part: 210 }),
      },
      legendaryAffixState: {
        head: { attrId: 11034, value: 1000 }, // +10%
      },
      cookingBuff: {
        ...DEFAULT_COOKING_BUFF,
        statResonanceEnabled: true,
        statResonanceBaseValue: 6300,
        statResonanceMultiplierPercent: 24,
      },
    };

    const result = calculateRawStats(input);

    // (BASE_STATS.agility(15) * 1.10) + (6300 * 24 / 100) = 16.5 + 1512 = 1528.5
    // (誤って%適用前に加算されていた場合は (15 + 1512) * 1.10 = 1679.7 になってしまう)
    expect(result.rawStats.agility).toBe(1528.5);
    expect(result.breakdown.agility.cookingBonus).toBe(1512);
  });

  it('accumulates a type=4 R1 ability effect into conversionRateBonus (galeLancer "筋力変換", talentId 401)', () => {
    // src/data/talent-tree.json: nodes["401"].effects = [[4, 0, 11332, 1250]]
    // attrId 11332 -> atk (TALENT_ATTR_TO_STAT), 1250/10000 = 0.125
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.galeLancer,
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 401,
            stage: 0,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
      ]),
    };

    const result = calculateRawStats(input);

    expect(result.conversionRateBonus.atk).toBe(0.125);
  });
});
