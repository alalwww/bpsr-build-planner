import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { EquipmentItem, EquipmentSlotId, SlotRefineLevels, StatId } from '../types';
import { BASE_STATS } from './baseStats';
import type { CalculateRawStatsInput, StatBreakdownEntry } from './calculateRawStats';
import { applyFinalStatModifiers, calculateRawStats } from './calculateRawStats';
import { DEFAULT_COOKING_BUFF } from './cookingBuff';
import type { DerivedStats } from './deriveStats';
import { REFINE_STAT_FLOOR } from './seasonConstants';

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
  it('returns BASE_STATS (plus the refine stat floors) when nothing is equipped/enabled', () => {
    const result = calculateRawStats(baseInput());
    const expected: Record<StatId, number> = { ...BASE_STATS, ...REFINE_STAT_FLOOR };

    expect(result.rawStats).toEqual(expected);
    expect(result.phantomFinalPct).toEqual({});
    for (const statId of Object.keys(BASE_STATS) as StatId[]) {
      const floor = (REFINE_STAT_FLOOR as Partial<Record<StatId, number>>)[statId];
      expect(result.breakdown[statId]).toEqual({
        base: BASE_STATS[statId],
        additive: 0,
        multiplier: 1,
        // 精錬ステータスの下限値は初期値(levelBonus)列に入る。
        ...(floor ? { levelBonus: floor } : {}),
      });
    }
  });

  it('adds a flat +2 maxHp bonus once 6 or more slots are equipped (2026-08-06 user report; cause unconfirmed, threshold applied as a stopgap)', () => {
    const makeEquippedCount = (count: number) => {
      const equipped: Partial<Record<EquipmentSlotId, EquipmentItem>> = {};
      for (const slot of ALL_SLOTS.slice(0, count)) {
        equipped[slot] = makeEquipmentItem({ slot, part: 100 });
      }
      return equipped;
    };

    const with5 = calculateRawStats({ ...baseInput(), equipped: makeEquippedCount(5) });
    const with6 = calculateRawStats({ ...baseInput(), equipped: makeEquippedCount(6) });
    const with11 = calculateRawStats({ ...baseInput(), equipped: makeEquippedCount(11) });

    expect(with5.rawStats.maxHp).toBe(BASE_STATS.maxHp);
    expect(with6.rawStats.maxHp).toBe(BASE_STATS.maxHp + 2);
    expect(with11.rawStats.maxHp).toBe(BASE_STATS.maxHp + 2);
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
    // 精錬分32は加算列に入り、下限(290)に満たない分は初期値として補われる。
    expect(result.breakdown.refinePhysAtk.additive).toBe(32);
    expect(result.rawStats.refinePhysAtk).toBe(REFINE_STAT_FLOOR.refinePhysAtk);
  });

  it('精錬防御力は部位の合計が下限(1920)に満たない間は下限値、超えたら合計値(2026-11-23実測)', () => {
    // ビートパフォーマー・精錬Lv30: 頭/胴/腕/脚(part 201-204)は各560。3部位=1680<1920、4部位=2240。
    const armor = (slots: EquipmentSlotId[], parts: number[]) =>
      Object.fromEntries(
        slots.map((slot, i) => [slot, makeEquipmentItem({ slot, part: parts[i], quality: 1 })]),
      );
    const run = (count: number) =>
      calculateRawStats({
        ...baseInput(),
        profession: PROFESSIONS.beatPerformer,
        equipped: armor(
          (['head', 'chest', 'arms', 'legs'] as EquipmentSlotId[]).slice(0, count),
          [201, 202, 203, 204],
        ),
        refineLevels: uniformSlotRecord(30),
      }).rawStats.refineDef;
    expect(run(0)).toBe(1920);
    expect(run(3)).toBe(1920);
    expect(run(4)).toBe(2240);
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
    expect(result.rawStats.refinePhysAtk).toBe(REFINE_STAT_FLOOR.refinePhysAtk);
    expect(result.rawStats.refineMagAtk).toBe(REFINE_STAT_FLOOR.refineMagAtk);
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

  it('routes 回復力/バリア強度/ブレイク効率/対ボスダメージボーナス/移動速度 legendary affixes (single-select) via LEGENDARY_AFFIX_FLAT_STAT', () => {
    // src/data/equipment.json legendaryAffix: 11792(healingPower)/11812(barrierStrength)/
    // 11832(breakEfficiency)/12632(bossDamageBonus) are isPercent=true, "100=1%" rawStats
    // convention (same as barrierStrength's pre-existing evo/phantom handling); 92000(moveSpeed)
    // is isPercent=false and stored as a plain raw number.
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      equipped: {
        weapon: makeEquipmentItem({ slot: 'weapon', part: 200 }),
        head: makeEquipmentItem({ slot: 'head', part: 210 }),
        chest: makeEquipmentItem({ slot: 'chest', part: 220 }),
        arms: makeEquipmentItem({ slot: 'arms', part: 230 }),
        legs: makeEquipmentItem({ slot: 'legs', part: 240 }),
      },
      legendaryAffixState: {
        weapon: { attrId: 11792, value: 300 },
        head: { attrId: 11812, value: 250 },
        chest: { attrId: 11832, value: 1200 },
        arms: { attrId: 12632, value: 250 },
        legs: { attrId: 92000, value: 400 },
      },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.healingPower).toBe(300);
    expect(result.rawStats.barrierStrength).toBe(250);
    expect(result.rawStats.breakEfficiency).toBe(1200);
    expect(result.rawStats.bossDamageBonus).toBe(250);
    expect(result.rawStats.moveSpeed).toBe(400);
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

    // BASE_STATS.strength(15) * 1.15 = 17.25 → strengthはINTEGER_TRUNCATED_STAT_IDS対象のため
    // 整数へ切り捨てて17(2026-08-06不具合報告: メインステータスはゲーム内で常に整数)。
    expect(result.rawStats.strength).toBe(17);
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

    // (BASE_STATS.agility(15) * 1.10) + (6300 * 24 / 100) = floor(16.5) + 1512 = 16 + 1512 = 1528
    // (誤って%適用前に加算されていた場合は (15 + 1512) * 1.10 = 1679.7 になってしまう)。
    // agilityはINTEGER_TRUNCATED_STAT_IDS対象のため%適用直後に整数へ切り捨てる
    // (2026-08-06不具合報告)。statResonanceBonusはその後の加算のため影響を受けない。
    expect(result.rawStats.agility).toBe(1528);
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

  it('adds a type=3 raw flat stat bonus to rawStats (frostMage R2 "高速詠唱", talentId 267: ファスト+10000)', () => {
    // src/data/talent-tree.json: nodes["267"].effects = [[3, 2204640, 1]]
    // TALENT_RAW_FLAT_TO_STAT[2204640] = { stat: 'haste', value: 10000 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.frostMage,
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 267,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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

    expect(result.rawStats.haste).toBe(BASE_STATS.haste + 10000);
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
        [
          1,
          {
            id: 1,
            talentId: 152,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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

    // rawStats.critDamageBonusの単位は100=1%(deriveStatsでraw.critDamageBonus/100として
    // 最終%に変換される)ため、+10%はrawStats上では+1000。
    expect(result.rawStats.critDamageBonus).toBe(BASE_STATS.critDamageBonus + 1000);
  });

  it('adds a type=3 raw flat stat bonus to mastery (heavyGuardian R2 "剛岩精通", talentId 970: 器用さ+25000)', () => {
    // src/data/talent-tree.json: nodes["970"].effects = [[3, 2201720, 1]] (stage:1 = R2)
    // TALENT_RAW_FLAT_TO_STAT[2201720] = { stat: 'mastery', value: 25000 }
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 970,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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

    expect(result.rawStats.mastery).toBe(BASE_STATS.mastery + 25000);
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
        [
          1,
          {
            id: 1,
            talentId: 154,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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
        [
          1,
          {
            id: 1,
            talentId: 969,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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
        [
          1,
          {
            id: 1,
            talentId: 271,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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

    // BASE_STATS.intellect(15) * 1.05 = 15.75 → intellectはINTEGER_TRUNCATED_STAT_IDS対象のため
    // 整数へ切り捨てて15(2026-08-06不具合報告)。
    expect(result.rawStats.intellect).toBe(15);
  });

  it('leaves highestStatFinalPctBonus at 0 when the ability is not enabled', () => {
    const result = calculateRawStats(baseInput());

    expect(result.highestStatFinalPctBonus).toBe(0);
  });

  it('adds a type=1 flat effect to healingPower (common node "回復効果", talentId 47: 回復力+300)', () => {
    // src/data/talent-tree.json: nodes["47"].effects = [[1, 11792, 300]] (common node, weaponGroup 0)
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR1EnabledIds: new Set([1]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 47,
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

    expect(result.rawStats.healingPower).toBe(BASE_STATS.healingPower + 300);
  });

  it('adds a type=1 flat effect to bossDamageReduction (heavyGuardian R2 "精鋭の牙", talentId 924: 対ボスダメージ軽減+800)', () => {
    // src/data/talent-tree.json: nodes["924"].effects = [[1, 12642, 800]] (stage:1 = R2)
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      talentR2EnabledIds: new Set([1]),
      r1NodeCount: 1,
      talentR1EnabledIds: new Set([2]),
      talentNodesById: new Map([
        [
          1,
          {
            id: 1,
            talentId: 924,
            stage: 1,
            bdType: 0,
            preNodes: [],
            nextNodes: [],
            position: [0, 0],
          },
        ],
        [
          2,
          {
            id: 2,
            talentId: 1,
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

    expect(result.rawStats.bossDamageReduction).toBe(BASE_STATS.bossDamageReduction + 800);
  });

  it('routes a fixedEvo direct element-bonus %addend (attrId 13142 -> thunderBonus)', () => {
    // src/data/equipment.json: galeLancer 乱風型(talentSchoolId 108)items include
    // fixedEvolutionStats["108"] entries with attrId 13142 (雷属性ボーナス, isPercent=true).
    // Routes through EVO_PCT_ATTR_TO_STAT like barrierStrength/healingPower, not through the
    // diminishing curve (that's a separate, StatsDetailDialog-side addend to elemBonusPercent).
    const input: CalculateRawStatsInput = {
      ...baseInput(),
      profession: PROFESSIONS.galeLancer,
      professionTypeKey: 'type2', // talentSchoolIds[1] = 108 (乱風型)
      equipped: {
        weapon: makeEquipmentItem({
          slot: 'weapon',
          part: 200,
          fixedEvolutionStats: {
            '108': [[1, 13142, 800, 800, true, 400, 400]],
          },
        }),
      },
    };

    const result = calculateRawStats(input);

    expect(result.rawStats.thunderBonus).toBe(800);
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
    // '202201' is an S3 factor class (endurance +168/+1% at G1). S4 data (phantom-factors.json)
    // only contains current-season (S4) factors, so it must contribute nothing even if a stale
    // save still has it slotted. Slot 250 is template 9's first factor node
    // (unlockCondition=[[93,4,5]], reachable with no selections).
    // Compared against a same-phantomLevel baseline (not BASE_STATS.endurance directly) since
    // phantomLevel>0 alone already adds endurance via playerLevelSeasonData (separate mechanism).
    const withoutFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 9,
      phantomNodeSelections: {},
    });
    const withLegacyFactor = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 10,
      phantomTemplateId: 9,
      phantomNodeSelections: {},
      phantomFactorSlots: { 250: { classKey: '202201', grade: 1 } },
    });

    expect(withLegacyFactor.rawStats.endurance).toBe(withoutFactor.rawStats.endurance);
  });

  // src/data/season-talents.json: template 9 (幻滅の崩界) node 1815「幻滅・精錬」
  // (fixed-ordinary on the main path 1801 -> 250 -> 251 -> 1815, unlockCondition=[[93,4,30]])
  // has effects=[[1,11414,1500],[1,11434,1500],[1,11424,1500]] -> 精錬物攻/魔攻/防御力 +15%
  // via PHANTOM_ORDINARY_PCT_ATTR_TO_STAT (addPctBonus bucket, unit 1/10000).
  it('applies the S4 「〇〇・精錬」 ordinary node as a +15% multiplier on refine atk/matk/def once its unlock level is reached', () => {
    const result = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 30,
      phantomTemplateId: 9,
      phantomNodeSelections: {},
    });

    expect(result.breakdown.refinePhysAtk.multiplier).toBeCloseTo(1.15);
    expect(result.breakdown.refineMagAtk.multiplier).toBeCloseTo(1.15);
    expect(result.breakdown.refineDef.multiplier).toBeCloseTo(1.15);
  });

  it("suppresses a node's effect while phantomLevel is below that node's own unlock level, even though tree selection itself isn't restricted", () => {
    // Same setup as above, but phantomLevel=29 is 1 below node 1815's required 30.
    const result = calculateRawStats({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel: 29,
      phantomTemplateId: 9,
      phantomNodeSelections: {},
    });

    expect(result.breakdown.refinePhysAtk.multiplier).toBe(1);
  });

  describe('映痕(S4祈願因子の映痕)', () => {
    // template 9: 因子ノード 250(lv5、因子 4001 = ストームブレイド専用)と 251(lv15、因子 4127)は
    // ノード選択なしで有効。phantomLevel 20 は精錬ノード 1815(lv30)の手前。
    // 因子 4001/4127 の G1/G3 の効果自体は BuffId 参照のスキル効果で、ステータスには影響しない。
    const phantomInput = (
      slots: CalculateRawStatsInput['phantomFactorSlots'],
      phantomLevel = 20,
    ): CalculateRawStatsInput => ({
      ...baseInput(),
      phantomEnabled: true,
      phantomLevel,
      phantomTemplateId: 9,
      phantomNodeSelections: {},
      phantomFactorSlots: slots,
    });
    const baseline = calculateRawStats(
      phantomInput({
        250: { classKey: '4001', grade: 3 },
        251: { classKey: '4127', grade: 1 },
      }),
    );

    it('ステータス系の映痕を実数/%/祈り系へ加算し、クラス映痕は対象外', () => {
      const result = calculateRawStats(
        phantomInput({
          250: {
            classKey: '4001',
            grade: 3,
            affixes: [
              { group: 1, quality: 2, value: 567 }, // 会心 +567
              { group: 12, quality: 2, value: 43 }, // 敏捷 +0.43%
              { group: 101, quality: 2, value: 139 }, // クラス映痕(対象外)
            ],
          },
          251: {
            classKey: '4127',
            grade: 1,
            affixes: [{ group: 22, quality: 2, value: 227 }], // 魔法防御力 +227
          },
        }),
      );
      expect(result.rawStats.crit - baseline.rawStats.crit).toBe(567);
      expect(result.breakdown.agility.multiplier).toBeCloseTo(
        baseline.breakdown.agility.multiplier + 0.0043,
      );
      expect(result.rawStats.magicalDef - baseline.rawStats.magicalDef).toBe(227);
    });

    it('祈りダメージ/祈り防御力無視/祈りダメージ軽減は新しいステータスへ加算する', () => {
      const result = calculateRawStats(
        phantomInput({
          250: {
            classKey: '4001',
            grade: 3,
            affixes: [
              { group: 15, quality: 2, value: 85 }, // 祈りダメージ +0.85%
              { group: 16, quality: 2, value: 28 }, // 祈り防御力無視 +28
            ],
          },
          251: {
            classKey: '4127',
            grade: 1,
            affixes: [{ group: 24, quality: 2, value: 57 }], // 祈りダメージ軽減 +0.57%
          },
        }),
      );
      expect(result.rawStats.oathDamageBonus).toBe(85);
      expect(result.rawStats.oathDefIgnore).toBe(28);
      expect(result.rawStats.oathDamageReduction).toBe(57);
    });

    it('重複不可の極性の映痕は、全因子を通じて最大値の1つだけ(減少側 -6% も1回だけ)反映する', () => {
      const result = calculateRawStats(
        phantomInput({
          250: { classKey: '4001', grade: 3, affixes: [{ group: 6, quality: 2, value: 283 }] },
          251: { classKey: '4127', grade: 1, affixes: [{ group: 6, quality: 3, value: 467 }] },
        }),
      );
      // 3058050: 会心値 +p1%、器用さ -6%
      expect(result.breakdown.crit.multiplier).toBeCloseTo(
        baseline.breakdown.crit.multiplier + 0.0467,
      );
      expect(result.breakdown.mastery.multiplier).toBeCloseTo(
        baseline.breakdown.mastery.multiplier - 0.06,
      );
    });

    it('グレードで開放されていないスロットの映痕や、開放Lv未満のノードの映痕は反映しない', () => {
      const lockedSlot = calculateRawStats(
        phantomInput({
          // G1 は2スロットのため、3番目の会心は反映しない
          250: {
            classKey: '4001',
            grade: 1,
            affixes: [null, null, { group: 1, quality: 2, value: 567 }],
          },
        }),
      );
      expect(lockedSlot.rawStats.crit).toBe(baseline.rawStats.crit);
      const lowLevel = calculateRawStats(
        phantomInput(
          { 251: { classKey: '4127', grade: 1, affixes: [{ group: 1, quality: 2, value: 567 }] } },
          10,
        ),
      );
      const lowLevelBaseline = calculateRawStats(phantomInput({}, 10));
      expect(lowLevel.rawStats.crit).toBe(lowLevelBaseline.rawStats.crit);
    });
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

      expect(result.rawStats.physicalReductionBonus).toBe(BASE_STATS.physicalReductionBonus + 600);
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

      expect(result.rawStats.physicalDefIgnoreBonus).toBe(BASE_STATS.physicalDefIgnoreBonus + 1880);
    });
  });

  describe('バトルイマジン パッシブ', () => {
    // イマジン「ムークボス」(id 3923)のpassiveEffects: [[12512, 1000,1300,1600,1900,2200,2500]]。
    // rank2 → eff[2+1]=1600(会心ダメージ+16%)。2026-08-09不具合報告でIMAGINE_FLAT_STATに
    // 12512(会心ダメージ)が漏れていたことが判明し追加。2026-08-12不具合報告(会心ダメージが
    // "実数値レーティング"用のIMAGINE_FLAT_STATに混在していたため、ツールチップが%表記されない
    // 別バグの原因になっていた)を機に、"raw/100=%"系のIMAGINE_RAW_PERCENT_STATへ切り出した
    // (バリア強度/ブレイク効率等と同じ経路に統合。計算結果自体は変わらない)。
    it('routes 会心ダメージ (attrId 12512, passiveEffects) to rawStats.critDamageBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3923, null],
        imagineRanks: [2, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.critDamageBonus).toBe(BASE_STATS.critDamageBonus + 1600);
    });

    // イマジン「イゴレウス」(id 3969)のbufPassiveEffects: [[3210180, [560,166],[728,216],...]]。
    // 「会心ダメージ+{p1}(常時)。会心ダメージを与えるたび一定確率で+{p2}(0.1秒毎最大1回、
    // 5スタックまで、持続2秒)」のうち、p1(paramIndex 0)のみ無条件で常時有効なため対応する
    // (p2はスタック式の条件付き効果のため対象外)。rank1 → eff[1+1]=[728,216]、p1=728(+7.28%)。
    it('routes 会心ダメージ (buffId 3210180 p1, bufPassiveEffects) to rawStats.critDamageBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3969, null],
        imagineRanks: [1, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.critDamageBonus).toBe(BASE_STATS.critDamageBonus + 728);
    });

    // 2026-08-12不具合報告: 会心ダメージ以外の"raw/100=%"系パッシブ(バリア強度/ブレイク効率/
    // 属性ボーナス/回復力/被回復量増加)がIMAGINE_PCT_BASE・IMAGINE_FLAT_STATのいずれにも
    // マッチせず、rawStatsへ全く反映されていなかった(ツールチップ上の表示だけは正しかったため
    // 発見が遅れた)。IMAGINE_RAW_PERCENT_STAT追加により解消。

    // イマジン「烈影」(id 3908)のpassiveEffects: [[11792, 800,1040,1280,1520,1760,2000]]。
    // rank3 → eff[3+1]=1520(回復力+15.2%)。
    it('routes 回復力 (attrId 11792, passiveEffects) to rawStats.healingPower', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3908, null],
        imagineRanks: [3, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.healingPower).toBe(BASE_STATS.healingPower + 1520);
    });

    // イマジン(id 3901)のpassiveEffects: [[11802, 800,1040,1280,1520,1760,2000]]。
    // rank2 → eff[2+1]=1280(被回復量増加+12.8%)。
    it('routes 被回復量増加 (attrId 11802, passiveEffects) to rawStats.receivedRecovery', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3901, null],
        imagineRanks: [2, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.receivedRecovery).toBe(BASE_STATS.receivedRecovery + 1280);
    });

    // イマジン(id 3935)のpassiveEffects: [[11812, 800,1040,1280,1520,1760,2000]]。
    // rank1 → eff[1+1]=1040(バリア強度+10.4%)。
    it('routes バリア強度 (attrId 11812, passiveEffects) to rawStats.barrierStrength', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3935, null],
        imagineRanks: [1, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.barrierStrength).toBe(BASE_STATS.barrierStrength + 1040);
    });

    // イマジン(id 3906)のpassiveEffects: [[11832, 2000,2600,3200,3800,4400,5000]]。
    // rank4 → eff[4+1]=4400(ブレイク効率+44%)。
    it('routes ブレイク効率 (attrId 11832, passiveEffects) to rawStats.breakEfficiency', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3906, null],
        imagineRanks: [4, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.breakEfficiency).toBe(BASE_STATS.breakEfficiency + 4400);
    });

    // イマジン(id 3979)のpassiveEffects: [[13112, 300,390,480,570,660,750]]。
    // rank5(G5) → eff[5+1]=750(火属性ボーナス+7.5%)。
    it('routes 火属性ボーナス (attrId 13112, passiveEffects) to rawStats.fireBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3979, null],
        imagineRanks: [5, 5],
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.fireBonus).toBe(BASE_STATS.fireBonus + 750);
    });

    // イマジン「ゴブリンセージ」(id 3899)のbufPassiveEffects: [[3210340, [200,400],[260,520],...]]。
    // 「詠唱速度+{p1} 攻撃速度+{p2}」は無条件。rank1 → [260,520] = 詠唱速度+2.6% / 攻撃速度+5.2%。
    it('adds ゴブリンセージ (buffId 3210340) to cast/attack speed addends', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        battleImagines: [3899, null],
        imagineRanks: [1, 5],
      };

      const result = calculateRawStats(input);

      expect(result.castSpeedFinalPctAddend).toBeCloseTo(2.6);
      expect(result.atkSpeedFinalPctAddend).toBeCloseTo(5.2);
    });

    // イマジン「幻花の残骸」(id 3990)/「蝕花の残影」(id 3991)のbufPassiveEffects:
    // [[3210270/3210280, [10000,40,600],[10000,52,780],...]]。「ファスト/器用さ{p1}ptにつき
    // 追加で+{p2}、最大{p3}」。実数値確定後の値から加算量を求める。
    describe('「N ptにつき追加で+M(最大X)」型(幻花の残骸/蝕花の残影)', () => {
      const withCorrections = (
        corrections: Partial<
          Record<StatId, { add: number; multPercent: number; finalValue: number }>
        >,
      ): CalculateRawStatsInput => ({
        ...baseInput(),
        cookingBuff: {
          ...DEFAULT_COOKING_BUFF,
          statCorrectionEnabled: true,
          statCorrections: corrections,
        },
      });

      it('adds +40 haste per 10000 haste (rank0), based on the final haste rating', () => {
        const base = withCorrections({ haste: { add: 35000, multPercent: 0, finalValue: 0 } });
        const without = calculateRawStats(base);
        const withImagine = calculateRawStats({
          ...base,
          battleImagines: [3990, null],
          imagineRanks: [0, 5],
        });

        const expected = Math.min(600, Math.floor(without.hasteRealAdjusted / 10000) * 40);
        expect(expected).toBeGreaterThan(0);
        expect(withImagine.hasteRealAdjusted).toBe(without.hasteRealAdjusted + expected);
        expect(withImagine.rawStats.haste).toBe(without.rawStats.haste + expected);
      });

      it('caps the mastery bonus at p3 (rank0: 600)', () => {
        const base = withCorrections({ mastery: { add: 500000, multPercent: 0, finalValue: 0 } });
        const without = calculateRawStats(base);
        const withImagine = calculateRawStats({
          ...base,
          battleImagines: [3991, null],
          imagineRanks: [0, 5],
        });

        expect(withImagine.rawStats.mastery).toBe(without.rawStats.mastery + 600);
      });

      it('adds nothing below p1 pt', () => {
        const withImagine = calculateRawStats({
          ...baseInput(),
          battleImagines: [3991, null],
          imagineRanks: [5, 5],
        });

        expect(withImagine.rawStats.mastery).toBe(calculateRawStats(baseInput()).rawStats.mastery);
      });
    });
  });

  describe('breakdown.levelBonus(冒険者レベル/潜在レベルによる加算)', () => {
    // ステータス詳細の「初期値/Lv加算値/ステ変換値」列に表示するため、冒険者レベル/潜在レベル
    // による加算はaddStat(breakdown.additive)ではなくlevelBonusへ積む(2026-08-13 UI改善)。
    it('routes adventurer-level stat bonuses to breakdown.levelBonus, not breakdown.additive', () => {
      const zeroLevel = calculateRawStats({ ...baseInput(), adventurerLevel: 0 });
      const leveled = calculateRawStats({ ...baseInput(), adventurerLevel: 60 });

      const zeroBonus = zeroLevel.breakdown.strength.levelBonus ?? 0;
      const levelBonus = leveled.breakdown.strength.levelBonus ?? 0;
      expect(levelBonus).toBeGreaterThan(zeroBonus);
      expect(leveled.rawStats.strength).toBe(
        zeroLevel.rawStats.strength + (levelBonus - zeroBonus),
      );
      expect(leveled.breakdown.strength.additive).toBe(zeroLevel.breakdown.strength.additive);
    });

    // PHANTOM_LEVEL_ATTR_TO_STAT(attrMaps.ts): 11442→illusionPower, 11042→endurance。
    it('routes phantom-level stat bonuses to breakdown.levelBonus, not breakdown.additive', () => {
      const zeroLevel = calculateRawStats({ ...baseInput(), phantomLevel: 0 });
      const leveled = calculateRawStats({ ...baseInput(), phantomLevel: 10 });

      const levelBonus = leveled.breakdown.illusionPower.levelBonus ?? 0;
      expect(levelBonus).toBeGreaterThan(0);
      expect(leveled.rawStats.illusionPower).toBe(zeroLevel.rawStats.illusionPower + levelBonus);
      expect(leveled.breakdown.illusionPower.additive).toBe(
        zeroLevel.breakdown.illusionPower.additive ?? 0,
      );
    });
  });

  describe('幸運の一撃ダメージ倍率の変換率ボーナス(luckyHitDamageRatioBonus)', () => {
    // ビートパフォーマーR2アビリティ「幸運相乗」(talentId 1338, buffId 2207390):
    // 「幸運1%につき幸運の一撃ダメージ倍率+0.5%」(deriveStats.tsの基礎係数0.25に加算する)。
    // 「ブレイブメロディー発動後は変換効率2倍」は戦闘状態依存の条件付き効果のため対象外
    // (2026-08-09不具合報告で未対応と判明)。
    it('routes 幸運相乗 (talentId 1338) to luckyHitDamageRatioBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        profession: PROFESSIONS.beatPerformer,
        r1NodeCount: 1,
        talentR1EnabledIds: new Set([2]),
        talentR2EnabledIds: new Set([1]),
        talentNodesById: new Map([
          [
            1,
            {
              id: 1,
              talentId: 1338,
              stage: 1,
              bdType: 0,
              preNodes: [],
              nextNodes: [],
              position: [0, 0],
            },
          ],
          [
            2,
            {
              id: 2,
              talentId: 1,
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

      expect(result.luckyHitDamageRatioBonus).toBe(0.5);
    });

    // フロストメイジR2アビリティ(talentId 255, buffId 2204520): 「幸運の一撃ダメージ倍率+15%。
    // 幸運2%につき幸運の一撃ダメージ倍率+1%」。全クラス監査(2026-08-09)で発見した同型の
    // 未対応効果。平坦加算(luckyHitDamageBonus)と変換率ボーナス(luckyHitDamageRatioBonus)の
    // 両方を同時に持つパターン。
    it('routes a frostMage R2 ability (talentId 255) to both rawStats.luckyHitDamageBonus and luckyHitDamageRatioBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        profession: PROFESSIONS.frostMage,
        r1NodeCount: 1,
        talentR1EnabledIds: new Set([2]),
        talentR2EnabledIds: new Set([1]),
        talentNodesById: new Map([
          [
            1,
            {
              id: 1,
              talentId: 255,
              stage: 1,
              bdType: 0,
              preNodes: [],
              nextNodes: [],
              position: [0, 0],
            },
          ],
          [
            2,
            {
              id: 2,
              talentId: 1,
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

      expect(result.rawStats.luckyHitDamageBonus).toBe(BASE_STATS.luckyHitDamageBonus + 1500);
      expect(result.luckyHitDamageRatioBonus).toBe(0.5);
    });

    // ヴァーダントオラクルR2アビリティ(talentId 510, buffId 2202110): 複数効果を併記する長文の
    // 一部に無条件の「幸運の一撃が与える最終ダメージ+50%」を含む(他は共生の印等の条件付き効果
    // のため対象外)。全クラス監査(2026-08-09)で発見。
    it('routes a verdantOracle R2 ability (talentId 510) flat bonus to rawStats.luckyHitDamageBonus', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        profession: PROFESSIONS.verdantOracle,
        r1NodeCount: 1,
        talentR1EnabledIds: new Set([2]),
        talentR2EnabledIds: new Set([1]),
        talentNodesById: new Map([
          [
            1,
            {
              id: 1,
              talentId: 510,
              stage: 1,
              bdType: 0,
              preNodes: [],
              nextNodes: [],
              position: [0, 0],
            },
          ],
          [
            2,
            {
              id: 2,
              talentId: 1,
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

      expect(result.rawStats.luckyHitDamageBonus).toBe(BASE_STATS.luckyHitDamageBonus + 5000);
    });
  });

  describe('statCorrections (ステータス補正・仮)', () => {
    it('applies add directly to rawStats and multPercent as a raw pctBonus for a plain stat (crit)', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        cookingBuff: {
          ...DEFAULT_COOKING_BUFF,
          statCorrectionEnabled: true,
          statCorrections: {
            crit: { add: 1000, multPercent: 10, finalValue: 0 },
          },
        },
      };

      const result = calculateRawStats(input);

      // (BASE_STATS.crit + 1000) * 1.10 -- crit has no other-stat-derived portion, so the
      // plain rawStats pctBonus bucket is correct here (unlike maxHp/atk/matk below).
      expect(result.rawStats.crit).toBe((BASE_STATS.crit + 1000) * 1.1);
      expect(result.phantomFinalPct.crit).toBeUndefined();
    });

    // maxHp(耐久力由来)/atk・matk(メインステータス由来)はderiveStats.ts側で他のrawStatから
    // 変換加算される"derived"な値のため、multPercentはrawStats自体への%ボーナス
    // (addPctBonus)ではなくFinalPctバケツ(phantomFinalPct)へ積む必要がある(2026-09-17
    // 不具合報告: beatPerformer X4と同じ原因で、この設定パネルのmaxHp/atk/matkの%補正も
    // 変換後の加算分(耐久力由来のmaxHp/メインステータス由来のatk・matk)に未反映だった)。
    it('routes maxHp/atk/matk multPercent to phantomFinalPct instead of the raw pctBonus bucket', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        cookingBuff: {
          ...DEFAULT_COOKING_BUFF,
          statCorrectionEnabled: true,
          statCorrections: {
            maxHp: { add: 1000, multPercent: 10, finalValue: 0 },
            matk: { add: 0, multPercent: 5, finalValue: 0 },
          },
        },
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.maxHp).toBe(BASE_STATS.maxHp + 1000); // add only, no *1.1 here
      expect(result.phantomFinalPct.maxHp).toBe(1000); // 10% -> 1000/10000
      expect(result.phantomFinalPct.matk).toBe(500); // 5% -> 500/10000
      expect(result.breakdown.matk.multiplier).toBe(1); // raw pctBonus bucket untouched
    });

    it('ignores every statCorrections entry when statCorrectionEnabled is false', () => {
      const input: CalculateRawStatsInput = {
        ...baseInput(),
        cookingBuff: {
          ...DEFAULT_COOKING_BUFF,
          statCorrectionEnabled: false,
          statCorrections: {
            maxHp: { add: 1000, multPercent: 10, finalValue: 500 },
          },
        },
      };

      const result = calculateRawStats(input);

      expect(result.rawStats.maxHp).toBe(BASE_STATS.maxHp);
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

  it('rounds maxHp to the nearest integer rather than truncating (2026-08-06 user report: 52113.6 in-game displays as 52114, not 52113)', () => {
    const derived = { ...zeroDerivedStats(), maxHp: 43428 };

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      { maxHp: 2000 }, // +20% (フロストメイジ「変奏」相当): 43428*1.2=52113.6
      {},
    );

    expect(result.stats.maxHp).toBe(52114);
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

  it('applies phantomFinalPct.matk to the full magicalAtk, including the intellect-derived portion (2026-09-17 bug report: beatPerformer X4 G7)', () => {
    // In-game measurement: magicalAtk 4532 (=4281 intellect-derived + 251 other) with G7's
    // matk+6.64% equipped -> 4532*1.0664=4832.9248, and the game truncates to 4832. The
    // regression was that the fix routed the bonus through rawStats.matk's own pctBonus
    // (applied before deriveStats' intellect->matk conversion), so only the 251 "other" part
    // was scaled (251*0.0664=~16.7), giving 4548 instead of 4832.
    const derived = { ...zeroDerivedStats(), magicalAtkMainStatBonus: 4281, magicalAtk: 4532 };

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      { matk: 664 }, // G7: pars[1]=664 -> +6.64%
      {},
    );

    expect(result.stats.matk).toBe(4832);
  });

  it('adds finalPctAddend directly to versatility (220以降蒼海武器の万能+8%等)', () => {
    const derived = zeroDerivedStats();

    const result = applyFinalStatModifiers(
      BASE_STATS,
      baseBreakdown(),
      derived,
      {},
      [null, null],
      [5, 5],
      {}, // phantomFinalPct (乗算用) は空
      { versatility: 800 }, // +8pt (単位: 1/100。蒼海武器の11952と同じ値)
    );

    expect(result.stats.versatility).toBeCloseTo(derived.versatilityPercent + 8);
    expect(result.breakdown.versatility.cookingBonus).toBeCloseTo(8);
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
