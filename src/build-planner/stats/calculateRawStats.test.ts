import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { EquipmentItem, EquipmentSlotId, SlotRefineLevels, StatId } from '../types';
import { BASE_STATS } from './baseStats';
import type { CalculateRawStatsInput, StatBreakdownEntry } from './calculateRawStats';
import { applyFinalStatModifiers, calculateRawStats } from './calculateRawStats';
import { DEFAULT_COOKING_BUFF } from './cookingBuff';
import type { DerivedStats } from './deriveStats';

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
    // attrId 11412 -> addStat('refinePhysAtk', v) のみ(docs/STATUS_CALCULATION.md「精錬物攻・
    // 精錬魔攻」の通り、精錬攻撃力は防御減衰の対象になる物理/魔法攻撃力本体とは別枠のため、
    // atkには加算しない)
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.stormBlade,
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200, quality: 1 }),
      },
      refineLevels: { ...uniformSlotRecord(0), weapon: 5 },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.atk).toBe(0);
    expect(result.rawStats.refinePhysAtk).toBe(32);
  });

  it('routes the 全属性攻撃力 (attrId 11502) enchant effect to refinePhysAtk/refineMagAtk, not atk/matk', () => {
    // src/data/enchants.json group "2001" item 1024761 (幻花の残骸): effects [[11502,40],[11022,50]]
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200 }),
      },
      slotEnchants: { weapon: 1024761 },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.atk).toBe(0);
    expect(result.rawStats.matk).toBe(0);
    expect(result.rawStats.refinePhysAtk).toBe(40);
    expect(result.rawStats.refineMagAtk).toBe(40);
    expect(result.rawStats.intellect).toBe(BASE_STATS.intellect + 50);
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

  it('reports highestStatFinalPctBonus for an active type=3 highest-of ability (frostMage "二段増幅", talentId 237)', () => {
    // src/data/talent-tree.json: nodes["237"].effects = [[3, 2204340, 1]] (stage:0 = R1)
    // TALENT_HIGHEST_OF_FINAL_PCT[2204340] = 3.5 (+3.5%, unconditional on professionTypeKey)
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.frostMage,
      professionTypeKey: 'type2',
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 237,
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

    expect(result.highestStatFinalPctBonus).toBe(3.5);
  });

  it('leaves highestStatFinalPctBonus at 0 when the ability is not enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.highestStatFinalPctBonus).toBe(0);
  });

  it('routes a type=1 effect with a "%final" attrId to phantomFinalPct, not a flat addend (heavyGuardian "癒しの砂", talentId 912)', () => {
    // src/data/talent-tree.json: nodes["912"].effects = [[1, 11324, 1000]] (stage:0 = R1)
    // attrId 11324 is maxHp's IMAGINARY_PCT_FINAL variant (unit 1/10000) -> +10% final, not +1000 flat.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.heavyGuardian,
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 912,
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

    // phantomFinalPctは生の値(単位1/10000)をそのまま持つ(TALENT_TYPE1_ONLY_FINAL_PCTと同じ規約)。
    // ipct()側で1回だけ /PERCENT_BASIS_POINTS されて+10%になる。
    expect(result.phantomFinalPct.maxHp).toBe(1000);
    expect(result.rawStats.maxHp).toBe(BASE_STATS.maxHp);
  });

  it('keeps a flat crit attrId and a %-variant crit attrId separate (蒼海武器 fixed-evo bug report)', () => {
    // src/data/equipment.json: item 8000019 (galeLancer, 乱風型/talentSchoolId 108, isFixedStat)
    // fixedEvolutionStats["108"] includes both 11112(flat, isPercent=false, +1240) and
    // 11712(%-variant of the same "会心", isPercent=true, +600 -> +6%). Before the fix both were
    // added as flat rawStats.crit (1240+600=1840); now only 11112 contributes to rawStats.crit,
    // and 11712 must accumulate into finalPctAddend.crit instead (added directly to the final
    // %-displayed crit value, same mechanism as 鼓舞/HP変動 -- not a multiplier).
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.galeLancer,
      professionTypeKey: 'type2', // talentSchoolIds[1] = 108 (乱風型)
      equipped: {
        weapon: makeEquipmentItem({
          slot: 'weapon',
          part: 200,
          quality: 5,
          baseStats: [[11442, 300, 300, 500, 500]], // isFixedStat: min===max
          fixedEvolutionStats: {
            '108': [
              [1, 12532, 2000, 2000, true, 600, 600],
              [3, 2403260, 600, 600, true, 0, 0],
              [1, 11712, 600, 600, true, 480, 480],
              [1, 11782, 600, 600, true, 0, 0],
              [1, 11112, 1240, 1240, false, 210, 210],
              [1, 11132, 1240, 1240, false, 210, 210],
            ],
          },
        }),
      },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.crit).toBe(1240);
    expect(result.finalPctAddend.crit).toBe(600);
    expect(result.rawStats.luck).toBe(1240);
    expect(result.finalPctAddend.luck).toBe(600);
  });
});

function zeroDerivedStats(): DerivedStats {
  return {
    maxHp: 0,
    physicalAtk: 0,
    magicalAtk: 0,
    physicalDef: 0,
    magicalDef: 0,
    critPercent: 10,
    critDamageBonusPercent: 50,
    hasteReal: 0,
    hastePercent: 20,
    atkSpeedPercent: 0,
    castSpeedPercent: 0,
    luckPercent: 15,
    luckyHitDamageMultiplierPercent: 40,
    luckyHitBoostPercent: 15,
    masteryPercent: 5,
    versatilityPercent: 0,
    versatilityDamageBonusPercent: 0,
    versatilityDamageReductionPercent: 0,
    resistPercent: 0,
    resistDamageReductionPercent: 30,
    physicalBoostPercent: 0,
    magicalBoostPercent: 0,
    critRecoveryPercent: 50,
    staminaRegenPerSecond: 0,
  };
}

function baseBreakdown(): Record<StatId, StatBreakdownEntry> {
  const result = {} as Record<StatId, StatBreakdownEntry>;
  for (const statId of Object.keys(BASE_STATS) as StatId[]) {
    result[statId] = { base: BASE_STATS[statId], additive: 0, multiplier: 1 };
  }
  return result;
}

describe('applyFinalStatModifiers', () => {
  it('adds finalPctAddend directly to crit/luck (蒼海武器等: not a multiplier, same as 鼓舞/HP変動)', () => {
    const derived = zeroDerivedStats();

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      {}, // phantomFinalPct (乗算用) は空
      { crit: 600, luck: 600 }, // +6pt each (単位: 1/100。蒼海武器の11712/11782と同じ値)
    );

    expect(result.stats.crit).toBeCloseTo(derived.critPercent + 6);
    expect(result.stats.luck).toBeCloseTo(derived.luckPercent + 6);
    expect(result.breakdown.crit.multiplier).toBe(1); // 乗算は変化しない
    expect(result.breakdown.crit.cookingBonus).toBeCloseTo(6);
    expect(result.breakdown.luck.cookingBonus).toBeCloseTo(6);
  });

  it('combines the existing haste/mastery % multiplier (phantomFinalPct) with the new additive bonus (finalPctAddend)', () => {
    const derived = zeroDerivedStats();

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      { haste: 1000 }, // +10% multiplier (バトルイマジン等の既存経路)
      { haste: 600 }, // +6pt additive (蒼海武器等の新経路)
    );

    expect(result.stats.haste).toBeCloseTo(derived.hastePercent * 1.1 + 6);
    expect(result.breakdown.haste.multiplier).toBeCloseTo(1.1);
    expect(result.breakdown.haste.cookingBonus).toBeCloseTo(6);
  });

  it('leaves crit/luck/haste unchanged when neither bucket has an entry for them', () => {
    const derived = zeroDerivedStats();

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      {},
      {},
    );

    expect(result.stats.crit).toBe(derived.critPercent);
    expect(result.stats.luck).toBe(derived.luckPercent);
    expect(result.stats.haste).toBe(derived.hastePercent);
  });
});
