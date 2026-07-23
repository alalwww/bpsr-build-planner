import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import type { AutoSaveState } from './buildPlan';
import { decodeName, decodePlanCode, encodePlanCode } from './planCode';
import type { EquipmentSlotId, SlotRefineLevels } from '../types';

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
    legendaryAffixGroupState: {},
    masteryEquipped: [true, false, true],
    masteryLevels: [30, 25, 10],
    masteryRanks: [6, 3, 0],
    fixedLevels: [30, 25, 20],
    fixedRanks: [6, 5, 4],
    battleImagines: [3944, null, 3957],
    imagineRanks: [5, 5, 3],
    roleSkillSlots: [3011, 3021, null, 3025],
    roleSkillRanks: [0, 2, 0, 4],
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

// v2コードは "{version}:{encodeURIComponent(name)}:{圧縮された構造データ配列}" の3分割。
// 構造データ配列だけを壊れた値に差し替えた新しいコードを組み立てるためのヘルパー。
function withCorruptedStructuralArray(code: string, mutate: (arr: unknown[]) => void): string {
  const firstColon = code.indexOf(':');
  const secondColon = code.indexOf(':', firstColon + 1);
  const prefix = code.slice(0, secondColon + 1);
  const structuralCode = code.slice(secondColon + 1);
  const arr = JSON.parse(decompressFromEncodedURIComponent(structuralCode)!) as unknown[];
  mutate(arr);
  return prefix + compressToEncodedURIComponent(JSON.stringify(arr));
}

function buildV2Code(version: number, name: string, structuralArr: unknown[]): string {
  const compressed = compressToEncodedURIComponent(JSON.stringify(structuralArr));
  return `${version}:${encodeURIComponent(name)}:${compressed}`;
}

describe('encodePlanCode / decodePlanCode', () => {
  it('round-trips a full AutoSaveState unchanged', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    const decoded = decodePlanCode(code);
    expect(decoded?.state).toEqual(state);
    expect(decoded?.isLegacy).toBe(false);
  });

  it('round-trips minimal optional fields left undefined', () => {
    const state: AutoSaveState = {
      ...fullAutoSaveState(),
      adventurerLevel: undefined,
      phantomEnabled: undefined,
      phantomLevel: undefined,
      phantomBondPoints: undefined,
      roleSkillSlots: undefined,
      roleSkillRanks: undefined,
    };
    const code = encodePlanCode(state);
    expect(decodePlanCode(code)?.state).toEqual(state);
  });

  it('separates the name from the compressed structural payload without decompression', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    const firstColon = code.indexOf(':');
    const secondColon = code.indexOf(':', firstColon + 1);
    expect(firstColon).toBeGreaterThan(-1);
    expect(secondColon).toBeGreaterThan(firstColon);
    const nameFromCode = decodeName(code.slice(firstColon + 1, secondColon));
    expect(nameFromCode).toBe(state.name);
  });

  it('picks whichever of lz-string/base64url encodes the name more compactly', () => {
    // 日本語名はlz-string圧縮、短いASCII名はbase64urlの方が短くなりやすい。
    // どちらを選んでも常に元の名称へ復元できることを確認する。
    for (const name of ['霜歩き氷杖テンプレ', 'weapon build A', '', 'A', '名前:入り']) {
      const code = encodePlanCode({ ...fullAutoSaveState(), name });
      const firstColon = code.indexOf(':');
      const secondColon = code.indexOf(':', firstColon + 1);
      const nameSegment = code.slice(firstColon + 1, secondColon);
      expect(nameSegment.includes(':')).toBe(false);
      expect(decodeName(nameSegment)).toBe(name);
      expect(decodePlanCode(code)?.state.name).toBe(name);
    }
  });

  it('decodes legacy v1 codes with no colon separator (name embedded in the array)', () => {
    const state = fullAutoSaveState();
    const v2Code = encodePlanCode(state);
    const secondColon = v2Code.indexOf(':', v2Code.indexOf(':') + 1);
    const structuralArr = JSON.parse(
      decompressFromEncodedURIComponent(v2Code.slice(secondColon + 1))!,
    ) as unknown[];
    // 旧v1フォーマット: [version, name, ...構造データ] をまるごと圧縮した1本の文字列(区切り文字なし)。
    const legacyArr = [1, state.name, ...structuralArr];
    const legacyCode = compressToEncodedURIComponent(JSON.stringify(legacyArr));
    expect(legacyCode.includes(':')).toBe(false);

    const decoded = decodePlanCode(legacyCode);
    expect(decoded).not.toBeNull();
    expect(decoded!.isLegacy).toBe(true);
    expect(decoded!.state).toEqual(state);
  });

  it('returns null for garbage input', () => {
    expect(decodePlanCode('this is not a valid plan code')).toBeNull();
  });

  it('returns null when the encoded version is newer than this build understands', () => {
    // SAVE_FORMAT_VERSION は現在2。将来バージョン(例: 999)は非互換の可能性があるため拒否する。
    const code = buildV2Code(999, 'x', [0, 0]);
    expect(decodePlanCode(code)).toBeNull();
  });

  it('returns null when the profession index does not resolve', () => {
    // 構造データ配列のindex 0はprofessionKey(nameは分離済みのため含まれない)。
    const code = buildV2Code(2, 'x', [999, 0]);
    expect(decodePlanCode(code)).toBeNull();
  });

  it('falls back to defaults instead of crashing or propagating garbage when array fields hold the wrong type', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    // index 8: masteryLevels, index 18: adventurerLevel (nameを除いたFIELD_SPECSの並び順)
    const corruptedCode = withCorruptedStructuralArray(code, (arr) => {
      arr[8] = 'not-an-array';
      arr[18] = 'not-a-number';
    });
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded).not.toBeNull();
    expect(decoded!.state.masteryLevels).toEqual([]);
    expect(decoded!.state.adventurerLevel).toBeUndefined();
    // unaffected fields still decode normally
    expect(decoded!.state.masteryRanks).toEqual(state.masteryRanks);
  });

  it('decodes roleSkillSlots/roleSkillRanks as undefined when absent from an older code (no null-filled fallback)', () => {
    // 旧バージョン(roleSkillSlots/roleSkillRanks追加前)のコードを模して、構造データ配列の
    // 末尾3要素(roleSkillSlots/roleSkillRanks、およびその後に追加されたlegendaryAffixGroupState)
    // を取り除いた状態でデコードする。
    // ここでplanCode.ts側がnull埋め配列にフォールバックしてしまうと、呼び出し側
    // (applyPlanState)の「クラスのロール専用4種」へのフォールバックが機能しなくなるため、
    // 必ずundefinedのまま返ることを確認する。
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    const truncatedCode = withCorruptedStructuralArray(code, (arr) => {
      arr.length -= 3;
    });
    const decoded = decodePlanCode(truncatedCode);
    expect(decoded).not.toBeNull();
    expect(decoded!.state.roleSkillSlots).toBeUndefined();
    expect(decoded!.state.roleSkillRanks).toBeUndefined();
    expect(decoded!.state.legendaryAffixGroupState).toEqual({});
  });

  it('does not throw when array-shaped fields contain malformed tuples', () => {
    const state = fullAutoSaveState();
    const code = encodePlanCode(state);
    // index 23: phantomNodeSelections (pairs), index 24: phantomFactorSlots
    const corruptedCode = withCorruptedStructuralArray(code, (arr) => {
      arr[23] = [['not-a-tuple'], [1, 2], null, 42];
      arr[24] = [[1], 'garbage', [2, 3]];
    });
    expect(() => decodePlanCode(corruptedCode)).not.toThrow();
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded!.state.phantomNodeSelections).toEqual({ 1: 2 });
    expect(decoded!.state.phantomFactorSlots).toEqual({});
  });
});
