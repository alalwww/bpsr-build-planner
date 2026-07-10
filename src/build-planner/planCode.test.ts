import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import type { AutoSaveState } from './buildPlan';
import { decodePlanCode, encodePlanCode } from './planCode';
import type { EquipmentSlotId, SlotRefineLevels } from './types';

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

// equipped/legendaryAffixState/slotEnchants/evolutionStats は実装備IDへの解決を伴うため、
// ここでは空({})にして実装備データへの結合を避け、それ以外の全フィールドを埋める。
function fullAutoSaveState(): AutoSaveState {
  return {
    name: 'テストビルド',
    professionKey: 'frostMage',
    professionTypeKey: 'type2',
    equipped: {},
    refineLevels: uniformSlotRecord(20),
    perfectlines: uniformSlotRecord(90),
    evolutionStats: {},
    legendaryAffixState: {},
    masteryEquipped: [true, false, true],
    masteryLevels: [30, 25, 10],
    masteryRanks: [6, 3, 0],
    fixedLevels: [30, 25, 20],
    fixedRanks: [6, 5, 4],
    battleImagines: [3944, null, 3957],
    imagineRanks: [5, 5, 3],
    talentR1EnabledIds: [101, 102, 103],
    talentR2EnabledIds: [201, 202],
    slotEnchants: {},
    moduleSlots: [null, null, null, null, null],
    adventurerLevel: 45,
    phantomEnabled: true,
    phantomLevel: 80,
    phantomTemplateId: 1,
    phantomBondPoints: 500,
    phantomNodeSelections: { 1002: 1002, 1005: 1004 },
    phantomFactorSlots: { 100: { classKey: 'foo', grade: 3 } },
  };
}

describe('encodePlanCode / decodePlanCode', () => {
  it('round-trips a full AutoSaveState unchanged', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    expect(decodePlanCode(code)).toEqual(state);
  });

  it('round-trips minimal optional fields left undefined', () => {
    const state: AutoSaveState = {
      ...fullAutoSaveState(),
      adventurerLevel: undefined,
      phantomEnabled: undefined,
      phantomLevel: undefined,
      phantomBondPoints: undefined,
    };
    const code = encodePlanCode(state);
    expect(decodePlanCode(code)).toEqual(state);
  });

  it('returns null for garbage input', () => {
    expect(decodePlanCode('this is not a valid plan code')).toBeNull();
  });

  it('returns null when the encoded version is newer than this build understands', () => {
    // PLAN_CODE_VERSION は現在1。将来バージョン(例: 999)は非互換の可能性があるため拒否する。
    const futureVersionArr = [999, 'x', 0, 0];
    const code = compressToEncodedURIComponent(JSON.stringify(futureVersionArr));
    expect(decodePlanCode(code)).toBeNull();
  });

  it('returns null when the profession index does not resolve', () => {
    const badProfessionArr = [1, 'x', 999, 0];
    const code = compressToEncodedURIComponent(JSON.stringify(badProfessionArr));
    expect(decodePlanCode(code)).toBeNull();
  });

  it('falls back to defaults instead of crashing or propagating garbage when array fields hold the wrong type', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    const json = decompressFromEncodedURIComponent(code);
    expect(json).not.toBeNull();
    const arr = JSON.parse(json!) as unknown[];
    // index 10: masteryLevels, index 20: adventurerLevel (see FIELD_SPECS order in planCode.ts)
    arr[10] = 'not-an-array';
    arr[20] = 'not-a-number';
    const corruptedCode = compressToEncodedURIComponent(JSON.stringify(arr));
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded).not.toBeNull();
    expect(decoded!.masteryLevels).toEqual([]);
    expect(decoded!.adventurerLevel).toBeUndefined();
    // unaffected fields still decode normally
    expect(decoded!.masteryRanks).toEqual(state.masteryRanks);
  });

  it('does not throw when array-shaped fields contain malformed tuples', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    const json = decompressFromEncodedURIComponent(code);
    const arr = JSON.parse(json!) as unknown[];
    // index 25: phantomNodeSelections (pairs), index 26: phantomFactorSlots
    arr[25] = [['not-a-tuple'], [1, 2], null, 42];
    arr[26] = [[1], 'garbage', [2, 3]];
    const corruptedCode = compressToEncodedURIComponent(JSON.stringify(arr));
    expect(() => decodePlanCode(corruptedCode)).not.toThrow();
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded!.phantomNodeSelections).toEqual({ 1: 2 });
    expect(decoded!.phantomFactorSlots).toEqual({});
  });
});
