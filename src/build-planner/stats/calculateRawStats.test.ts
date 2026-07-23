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
    legendaryAffixGroupState: {},
    refineLevels: uniformSlotRecord(0),
    perfectlines: uniformSlotRecord(100),
    evolutionStats: {},
    profession: PROFESSIONS.stormBlade,
    professionTypeKey: 'type1',
    talentR1EnabledIds: new Set(),
    talentR2EnabledIds: new Set(),
    talentNodesById: new Map(),
    r1NodeCount: 0,
    battleImagines: [null, null],
    imagineRanks: [5, 5],
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

    // calcStatValue(100, 200, 100) = 100 + 100 * 1 = 200
    expect(result.rawStats.atk).toBe(200);
    expect(result.rawStats.strength).toBe(BASE_STATS.strength);
  });

  it('rounds each equipped item’s reforge (改鋳) stat contribution individually before summing (regression: verified against real 滅妄強度 in-game values)', () => {
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      perfectlines: { ...uniformSlotRecord(100), weapon: 50, head: 50 },
      equipped: {
        weapon: makeEquipmentItem({
          slot: 'weapon',
          part: 200,
          quality: 4,
          reforgeEvoMin: 0,
          reforgeEvoMax: 101, // calcStatValue(0, 101, 50) = 50.5 -> round = 51
        }),
        head: makeEquipmentItem({
          slot: 'head',
          part: 201,
          quality: 4,
          reforgeEvoMin: 0,
          reforgeEvoMax: 99, // calcStatValue(0, 99, 50) = 49.5 -> round = 50
        }),
      },
      evolutionStats: {
        weapon: [undefined, undefined, 'crit'],
        head: [undefined, undefined, 'crit'],
      },
    };

    const result = calculateRawStats(input);

    // 51 + 50 = 101 (先に合算してから丸める(floor(50.5+49.5)=100)場合と結果が異なる)。
    expect(result.rawStats.crit).toBe(BASE_STATS.crit + 101);
  });

  it('rounds each equipped item’s baseStats contribution individually before summing (regression: 滅妄強度/illusionPower, attrId 11442, range 45-120)', () => {
    // 実際の装備データ(GS220帯の装備、attrId 11442, min-max=45-120)を模したケース。
    // ユーザー実測: 完成度(perfectline)7 -> 50, 6 -> 49 が装備1つぶんのゲーム内表示値。
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      perfectlines: { ...uniformSlotRecord(100), weapon: 7, head: 6 },
      equipped: {
        weapon: makeEquipmentItem({
          slot: 'weapon',
          part: 200,
          quality: 4,
          baseStats: [[11442, 45, 120]], // calcStatValue(45,120,7) = 50.25 -> round = 50
        }),
        head: makeEquipmentItem({
          slot: 'head',
          part: 201,
          quality: 4,
          baseStats: [[11442, 45, 120]], // calcStatValue(45,120,6) = 49.5 -> round = 50
        }),
      },
    };

    const result = calculateRawStats(input);

    // 50 + 50 = 100 (先に合算してから丸める場合は floor(50.25+49.5)=floor(99.75)=99 になり、
    // 個別丸めの結果(100)と異なる)。
    expect(result.rawStats.illusionPower).toBe(BASE_STATS.illusionPower + 100);
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

  it('routes the 全属性攻撃力 (attrId 11502) enchant effect to allAttrAtk, not atk/matk/refinePhysAtk/refineMagAtk', () => {
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
    expect(result.rawStats.refinePhysAtk).toBe(0);
    expect(result.rawStats.refineMagAtk).toBe(0);
    expect(result.rawStats.allAttrAtk).toBe(40);
    expect(result.rawStats.intellect).toBe(BASE_STATS.intellect + 50);
  });

  it('routes the matk (attrId 11342) enchant effect to matk (荒野カニクモの刻印)', () => {
    // src/data/enchants.json group "3020011" (荒野カニクモの刻印): effects [[11342,38]]
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        earring: makeEquipmentItem({ slot: 'earring', part: 260 }),
      },
      slotEnchants: { earring: 3020011 },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.matk).toBe(38);
  });

  it('routes the adaptive main stat (attrId 99005) enchant effect to profession.mainStat (キラーカニクモの刻印)', () => {
    // src/data/enchants.json group "3020101" (キラーカニクモの刻印, 武器): effects [[11042,235],[99005,70]]
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.frostMage, // mainStat: 'intellect'
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200 }),
      },
      slotEnchants: { weapon: 3020101 },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.endurance).toBe(BASE_STATS.endurance + 235);
    expect(result.rawStats.intellect).toBe(BASE_STATS.intellect + 70);
  });

  it('routes attack-speed/cast-speed-final legendary affixes (attrId 11722/11732) instead of dropping them', () => {
    // src/data/equipment.json part 200 item 2000308 legendaryAffix attrId 11722 (攻撃速度final%):
    // values [250,300,350] use the same 1/10000 unit as matk% (attrId 11344), so /100 -> "+2.5%" etc.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200 }),
        head: makeEquipmentItem({ slot: 'head', part: 210 }),
      },
      legendaryAffixState: {
        weapon: { attrId: 11722, value: 250 },
        head: { attrId: 11732, value: 500 },
      },
    };

    const result = calculateRawStats(input);

    expect(result.atkSpeedFinalPctAddend).toBe(2.5);
    expect(result.castSpeedFinalPctAddend).toBe(5);
  });

  it('sums multiple legendary-affix % bonuses before multiplying once (not compounding)', () => {
    // attrId 11014 (筋力%) は IMAGINE_PCT_BASE 経由で addPctBonus される。
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
    // stormBlade.mainStat === 'agility'. attrId 11034 (敏捷%) は IMAGINE_PCT_BASE 経由で
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

  it('adds a type=3 raw flat stat bonus to rawStats (frostMage R2 "高速詠唱", talentId 267: ファスト+2500)', () => {
    // src/data/talent-tree.json: nodes["267"].effects = [[3, 2204640, 1]]
    // TALENT_RAW_FLAT_TO_STAT[2204640] = { stat: 'haste', value: 2500 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.frostMage,
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 267, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.haste).toBe(BASE_STATS.haste + 2500);
  });

  it('adds a type=3 flat-pct stat bonus to critDamageBonus (stormBlade R2 "爆裂", talentId 152: 会心ダメージ+10%)', () => {
    // src/data/talent-tree.json: nodes["152"].effects = [[3, 2200540, 1]] (stage:1 = R2)
    // TALENT_FLAT_PCT_TO_STAT[2200540] = { stat: 'critDamageBonus', value: 1000 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 152, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    // rawStats.critDamageBonusの単位は100=1%(deriveStatsでraw.critDamageBonus/100として
    // 最終%に変換される)ため、+10%はrawStats上では+1000。
    expect(result.rawStats.critDamageBonus).toBe(BASE_STATS.critDamageBonus + 1000);
  });

  it('adds a type=3 raw flat stat bonus to mastery (heavyGuardian R2 "剛岩精通", talentId 970: 器用さ+6250)', () => {
    // src/data/talent-tree.json: nodes["970"].effects = [[3, 2201720, 1]] (stage:1 = R2)
    // TALENT_RAW_FLAT_TO_STAT[2201720] = { stat: 'mastery', value: 6250 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 970, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.mastery).toBe(BASE_STATS.mastery + 6250);
  });

  it('adds a type=3 final-%-addend stat bonus to mastery (stormBlade R2 talentId 154: 器用さ+6%)', () => {
    // src/data/talent-tree.json: nodes["154"].effects = [[3, 2200560, 1]] (stage:1 = R2)
    // TALENT_FINAL_PCT_ADDEND_TO_STAT[2200560] = { stat: 'mastery', value: 600 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 154, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    expect(result.finalPctAddend.mastery).toBe(600);
  });

  it('adds a type=3 final-%-addend stat bonus to luck (heavyGuardian R2 "幸運の剛岩", talentId 969: 幸運確率+5%)', () => {
    // src/data/talent-tree.json: nodes["969"].effects = [[3, 2201710, 1]] (stage:1 = R2)
    // TALENT_FINAL_PCT_ADDEND_TO_STAT[2201710] = { stat: 'luck', value: 500 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 969, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    expect(result.finalPctAddend.luck).toBe(500);
  });

  it('adds a type=3 base-stat %-mult bonus to intellect (frostMage R2 "知力強化", talentId 271: 知力+5%)', () => {
    // src/data/talent-tree.json: nodes["271"].effects = [[3, 2204680, 1]] (stage:1 = R2)
    // TALENT_BASE_PCT_TO_STAT[2204680] = { stat: 'intellect', value: 500 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.frostMage,
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [1, { id: 1, talentId: 271, stage: 1, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
        [2, { id: 2, talentId: 1, stage: 0, bdType: 0, preNodes: [], nextNodes: [], position: [0, 0] }],
      ]),
    };

    const result = calculateRawStats(input);

    // BASE_STATS.intellect(15) * 1.05 = 15.75
    expect(result.rawStats.intellect).toBe(15.75);
  });

  it('leaves highestStatFinalPctBonus at 0 when the ability is not enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.highestStatFinalPctBonus).toBe(0);
  });

  it('routes a type=1 effect with a "%final" attrId to phantomFinalPct, not a flat addend (heavyGuardian "癒しの砂", talentId 912)', () => {
    // src/data/talent-tree.json: nodes["912"].effects = [[1, 11324, 1000]] (stage:0 = R1)
    // attrId 11324 is maxHp's IMAGINE_PCT_FINAL variant (unit 1/10000) -> +10% final, not +1000 flat.
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

  it('routes a type=1 effect with the attack-speed "%final" attrId to atkSpeedFinalPctAddend (divineArcher "迅射", talentId 1135)', () => {
    // src/data/talent-tree.json: nodes["1135"].effects = [[1, 11722, 300]] (stage:0 = R1)
    // attrId 11722 is attack speed's "%final" variant (unit 1/10000) -> +3%, not a flat 11722-mapped stat.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.divineArcher,
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 1135,
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

    expect(result.atkSpeedFinalPctAddend).toBe(3);
    expect(result.phantomFinalPct.atkSpeedPercent).toBeUndefined();
  });

  it('leaves atkSpeedFinalPctAddend at 0 when no such ability is enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.atkSpeedFinalPctAddend).toBe(0);
  });

  it('routes a type=4 effect targeting the attack-speed attrId to atkSpeedPerHastePercentBonus (stormBlade "迅速", talentId 135)', () => {
    // src/data/talent-tree.json: nodes["135"].effects = [[4, 4, 11722, 10000]] (stage:0 = R1)
    // "ファスト1%につき攻撃速度+1%" -> a bonus to the haste%->atkSpeed% conversion rate itself,
    // not a flat/final addend (that's talentId 1135, tested above) and not a rawStats StatId.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.stormBlade,
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 135,
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

    expect(result.atkSpeedPerHastePercentBonus).toBe(1);
    expect(result.conversionRateBonus.haste).toBeUndefined();
  });

  it('leaves atkSpeedPerHastePercentBonus at 0 when no such ability is enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.atkSpeedPerHastePercentBonus).toBe(0);
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

  it('excludes a legacy (past-season) phantom factor from stat effects entirely', () => {
    // src/data/phantom-factors.json: byClass["201001"].seasonId=2 (< current max seasonId=3),
    // slotted into template 7's groupId=163 (reachable with no node selections needed).
    // src/data/season-talents.json: treeNodes["163"].unlockCondition=[[93,3,10]] -> needs
    // phantomLevel>=10; set to 10 here so the level gate isn't what's excluding the effect.
    // Game design says past-season factors are inert; the effect being an unmapped type=3
    // buffId already yields 0 today, but this asserts the explicit seasonId guard so a future
    // FACTOR_POLARITY_EFFECTS/PHANTOM_ATTR_TO_STAT addition can't silently reactivate it.
    // Compared against a same-phantomLevel baseline (not BASE_STATS.endurance directly) since
    // phantomLevel>0 alone already adds endurance via playerLevelSeasonData (separate mechanism).
    const withoutFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
    });
    const withLegacyFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
      phantomFactorSlots: { 163: { classKey: '201001', grade: 1 } },
    });

    expect(withLegacyFactor.rawStats.endurance).toBe(withoutFactor.rawStats.endurance);
  });

  it("applies a current-season phantom factor slotted into the same groupId, once phantomLevel reaches the node's unlock level", () => {
    // src/data/phantom-factors.json: byClass["202201"].seasonId=3 (current), grade 1
    // effects=[[1,11042,168],[1,11044,100]] -> endurance +168 flat, +100(=1%) pct bonus.
    // treeNodes["163"].unlockCondition=[[93,3,10]] -> needs phantomLevel>=10.
    const withoutFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
    });
    const withFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
      phantomFactorSlots: { 163: { classKey: '202201', grade: 1 } },
    });

    expect(withFactor.rawStats.endurance).toBeCloseTo(
      (withoutFactor.rawStats.endurance + 168) * 1.01,
    );
  });

  it("suppresses a node's effect (fixed or factor) while phantomLevel is below that node's own unlock level, even though tree selection itself isn't restricted", () => {
    // Same setup as above (current-season factor, would normally add endurance+168/+1%),
    // but phantomLevel=9 is 1 below treeNodes["163"].unlockCondition's required 10.
    const withoutFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 9,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
    });
    const withFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 9,
      phantomTemplateId: 7,
      phantomNodeSelections: {},
      phantomFactorSlots: { 163: { classKey: '202201', grade: 1 } },
    });

    expect(withFactor.rawStats.endurance).toBe(withoutFactor.rawStats.endurance);
  });

  it("applies a node's effect once its own unlock level is satisfied, even if the template's own unlock level is still unmet (that combination is now prevented at the store level by auto-disabling phantomEnabled, not here)", () => {
    // src/data/season-talents.json: template 1 (イマジンインパクト) requires phantomLevel>=17,
    // but its node 100 (groupId=100, solo-factor, reachable via selecting choice-group 1002)
    // individually only requires phantomLevel>=5. classKey 202190 is a current-season (S3)
    // factor: grade1 effects=[[1,11012,42],[1,11014,60]] -> strength +42 flat, +60(=0.6%) pct.
    const withoutFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 1,
      phantomNodeSelections: { 1002: 1002 },
    });
    const withFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 1,
      phantomNodeSelections: { 1002: 1002 },
      phantomFactorSlots: { 100: { classKey: '202190', grade: 1 } },
    });

    expect(withFactor.rawStats.strength).toBeCloseTo((withoutFactor.rawStats.strength + 42) * 1.006);
  });

  it('stacks the 5 shared bond-level tiers (illusionPower/endurance) up to the given bond points', () => {
    // src/data/season-talents.json: template 1 (advancedEffectId=100), levels 1-5 are shared
    // across all 8 templates: unlockFraction 2/5/12/20/25 -> buffId 3003610/20/30/40/50.
    // Level 6 (unlockFraction 35) is template-specific and excluded here (bondPoints=25).
    // Per src/locales/*/game-data.json attrDescs: each of 3003610/20/40 grants
    // illusionPower+100/endurance+750; 3003630/50 additionally grant endurance+750 each
    // (their "highest_of" component lands on rawStats.crit here since everything ties at 0).
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      phantomEnabled: true,
      phantomTemplateId: 1,
      phantomBondPoints: 25,
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.illusionPower).toBe(BASE_STATS.illusionPower + 100 * 3);
    expect(result.rawStats.endurance).toBe(BASE_STATS.endurance + 750 * 5);
    expect(result.rawStats.crit).toBe(BASE_STATS.crit + 750 + 1250);
  });

  it("applies template 8's unique level-6 bond reward (main stat +150) once bondPoints reaches 35", () => {
    // src/data/season-talents.json: template 8 (advancedEffectId=107), level 6 -> buffId
    // 3003730 "現在のメインステータス+150". stormBlade's mainStat is 'agility'.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.stormBlade,
      phantomEnabled: true,
      phantomTemplateId: 8,
      phantomBondPoints: 35,
    };

    const result = calculateRawStats(input);

    // +750*5 (shared tiers) 分の endurance と同様、mainStat(agility) には +150 のみ乗る。
    expect(result.rawStats.agility).toBe(BASE_STATS.agility + 150);
  });

  describe('モジュール効果(「集中」系パワーコア効果)', () => {
    // src/data/modules.json: effectId 1409(「集中・会心」)のlv6(enhancementNum=20, totalLink>=20)
    // config = [[1,11322,1800],[1,13002,80],[1,12512,1200],[1,12742,1200]]。
    // 5500303は防御quality3(3穴)のmodId。2スロットに分けてhole0(最大10)を合算しtotalLink=20とする。
    it('routes 会心ダメージ/会心回復 (attrId 12512/12742) to rawStats.critDamageBonus/critRecoveryBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        moduleSlots: [
          {
            modId: 5500303,
            holes: [
              { effectId: 1409, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          {
            modId: 5500303,
            holes: [
              { effectId: 1409, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          null,
          null,
          null,
        ],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.critDamageBonus).toBe(BASE_STATS.critDamageBonus + 1200);
      expect(result.rawStats.critRecoveryBonus).toBe(BASE_STATS.critRecoveryBonus + 1200);
      // maxHp(既存のMOD_ATTR_TO_STATマッピング)も引き続き正しく積まれること。
      expect(result.rawStats.maxHp).toBe(BASE_STATS.maxHp + 1800);
    });

    // effectId 1408(「集中・攻撃速度」)のlv6 config = [[5,99006,50],[1,11722,600]]。
    // attrId 11722はrawStats(StatId)を持たないため、atkSpeedFinalPctAddend(単位100=1%)へ
    // 個別集計される想定(値600 → +6)。
    it('routes 攻撃速度 (attrId 11722) to atkSpeedFinalPctAddend instead of a rawStats entry', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        moduleSlots: [
          {
            modId: 5500303,
            holes: [
              { effectId: 1408, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          {
            modId: 5500303,
            holes: [
              { effectId: 1408, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          null,
          null,
          null,
        ],
      };

      const result = calculateRawStats(input);

      expect(result.atkSpeedFinalPctAddend).toBe(6);
    });

    // effectId 1407(「集中・詠唱」)のlv6 config = [[5,99006,50],[1,11732,1200]]。
    // attrId 11732も同様にrawStatsを持たず、castSpeedFinalPctAddendへ集計される想定
    // (値1200 → +12)。
    it('routes 詠唱速度 (attrId 11732) to castSpeedFinalPctAddend instead of a rawStats entry', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        moduleSlots: [
          {
            modId: 5500303,
            holes: [
              { effectId: 1407, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          {
            modId: 5500303,
            holes: [
              { effectId: 1407, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          null,
          null,
          null,
        ],
      };

      const result = calculateRawStats(input);

      expect(result.castSpeedFinalPctAddend).toBe(12);
    });

    // 2枠のmodIdに同じeffectIdをlinkCount10ずつ振り分け、totalLink=20(lv6)へ到達させる
    // 共通ヘルパー。上のテスト群と同じ組み立て方を関数化しただけ。
    function twoSlotModuleInput(modId: number, effectId: number): CalculateRawStatsInput {
      return {
        ...baseInput(),
        moduleSlots: [
          {
            modId,
            holes: [
              { effectId, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          {
            modId,
            holes: [
              { effectId, linkCount: 10 },
              { effectId: null, linkCount: 10 },
              { effectId: null, linkCount: 5 },
            ],
          },
          null,
          null,
          null,
        ],
      };
    }

    // effectId 1410(「集中・幸運」)のlv6 config includes [1,12532,780]/[1,12722,620]:
    // 幸運の一撃ダメージ率/幸運の一撃回復の倍率(単位100=1%)。5500303=防御quality3(3穴)。
    it('routes 幸運の一撃ダメージ率/回復の倍率 (attrId 12532/12722) to rawStats.luckyHitDamageBonus/luckyHitRecoveryBonus', () => {
      const result = calculateRawStats(twoSlotModuleInput(5500303, 1410));

      expect(result.rawStats.luckyHitDamageBonus).toBe(BASE_STATS.luckyHitDamageBonus + 780);
      expect(result.rawStats.luckyHitRecoveryBonus).toBe(BASE_STATS.luckyHitRecoveryBonus + 620);
    });

    // effectId 1308(「物理耐性」)のlv6 config includes [1,12562,600]: 物理軽減(単位100=1%)。
    // attrId 12562はProfileAttrTable(ZTable)に表示名を持たないが、rawStatsへの反映には影響しない。
    it('routes 物理軽減 (attrId 12562, no ZTable display name) to rawStats.physicalReductionBonus', () => {
      const result = calculateRawStats(twoSlotModuleInput(5500303, 1308));

      expect(result.rawStats.physicalReductionBonus).toBe(
        BASE_STATS.physicalReductionBonus + 600,
      );
    });

    // effectId 1307(「魔法耐性」)のlv6 config includes [1,12582,600]: 魔法軽減(単位100=1%)。
    it('routes 魔法軽減 (attrId 12582) to rawStats.magicalReductionBonus', () => {
      const result = calculateRawStats(twoSlotModuleInput(5500303, 1307));

      expect(result.rawStats.magicalReductionBonus).toBe(BASE_STATS.magicalReductionBonus + 600);
    });

    // effectId 1110(「筋力強化」、攻撃quality3=5500103)のlv6 config includes [1,11392,1880]:
    // 物理防御力無視(単位100=1%)。
    it('routes 物理防御力無視 (attrId 11392) to rawStats.physicalDefIgnoreBonus', () => {
      const result = calculateRawStats(twoSlotModuleInput(5500103, 1110));

      expect(result.rawStats.physicalDefIgnoreBonus).toBe(
        BASE_STATS.physicalDefIgnoreBonus + 1880,
      );
    });
  });
});

function zeroDerivedStats(): DerivedStats {
  return {
    maxHp: 0,
    enduranceMaxHpBonus: 0,
    physicalAtk: 0,
    magicalAtk: 0,
    physicalAtkMainStatBonus: 0,
    magicalAtkMainStatBonus: 0,
    physicalDef: 0,
    physicalDefStrengthBonus: 0,
    magicalDef: 0,
    magicalDefIntellectBonus: 0,
    critPercent: 10,
    critDamageBonusPercent: 50,
    hasteReal: 0,
    hasteAgilityBonus: 0,
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
    physicalReductionPercent: 0,
    magicalReductionPercent: 0,
    luckyHitRecoveryMultiplierPercent: 0,
    physicalDefIgnorePercent: 0,
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
