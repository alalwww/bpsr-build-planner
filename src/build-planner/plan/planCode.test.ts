import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import type { AutoSaveState } from './buildPlan';
import { decodeName, decodePlanCode, encodePlanCode } from './planCode';
import { CURRENT_SAVE_SEASON_ID, LEGACY_SAVE_SEASON_ID } from './saveSeason';
import type { EquipmentSlotId, SlotRefineLevels } from '../types';
import { DEFAULT_REFINE_LEVELS } from './planDefaults';

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
    phantomNodeSelections: { 1002: 1002, 1005: 1004 },
    phantomFactorSlots: { 100: { classKey: 'foo', grade: 3 } },
    saveSeasonId: CURRENT_SAVE_SEASON_ID,
  };
}

// v2/v3コードは "{version}:{エンコードされたname}:{圧縮された構造データ配列}" の3分割。
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

  it('returns null for garbage input', () => {
    expect(decodePlanCode('this is not a valid plan code')).toBeNull();
  });

  it('returns null when the encoded version is newer than this build understands', () => {
    // SAVE_FORMAT_VERSION は現在3。将来バージョン(例: 999)は非互換の可能性があるため拒否する。
    const code = buildV2Code(999, 'x', [0, 0]);
    expect(decodePlanCode(code)).toBeNull();
  });

  it('writes v3 codes', () => {
    expect(encodePlanCode(fullAutoSaveState()).startsWith('3:')).toBe(true);
  });

  it('returns null when the profession index does not resolve', () => {
    // v3 の index 1 はクラス。
    expect(decodePlanCode(buildV2Code(3, 'x', [60, 999, 0]))).toBeNull();
  });

  it('falls back to defaults instead of crashing or propagating garbage when fields hold the wrong type', () => {
    const state = fullAutoSaveState();
    const corruptedCode = withCorruptedStructuralArray(encodePlanCode(state), (arr) => {
      arr[0] = 'not-a-number'; // 冒険者Lv
      (arr[5] as unknown[])[1] = 'not-an-array'; // マスタリースキルのLv
      arr[8] = 'not-an-array'; // 部位毎の精錬Lv
    });
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded).not.toBeNull();
    expect(decoded!.state.adventurerLevel).toBeUndefined();
    expect(decoded!.state.masteryLevels).toEqual([]);
    expect(decoded!.state.refineLevels).toEqual(DEFAULT_REFINE_LEVELS);
    // unaffected fields still decode normally
    expect(decoded!.state.masteryRanks).toEqual(state.masteryRanks);
    expect(decoded!.state.perfectlines).toEqual(state.perfectlines);
  });

  it('decodes roleSkillSlots/roleSkillRanks as undefined when absent (no null-filled fallback)', () => {
    // ここでplanCode.ts側がnull埋め配列にフォールバックしてしまうと、呼び出し側
    // (applyPlanState)の「クラスのロール専用4種」へのフォールバックが機能しなくなるため、
    // 必ずundefinedのまま返ることを確認する。
    const state = { ...fullAutoSaveState(), roleSkillSlots: undefined, roleSkillRanks: undefined };
    const decoded = decodePlanCode(encodePlanCode(state));
    expect(decoded!.state.roleSkillSlots).toBeUndefined();
    expect(decoded!.state.roleSkillRanks).toBeUndefined();
  });

  it('does not throw when array-shaped fields contain malformed tuples', () => {
    const corruptedCode = withCorruptedStructuralArray(
      encodePlanCode(fullAutoSaveState()),
      (arr) => {
        const season = arr[11] as unknown[];
        season[4] = [['not-a-tuple'], [1, 2], null, 42]; // ノード選択
        season[5] = [[1], 'garbage', [2, 3]]; // 因子
        arr[9] = [null, 'garbage', [1], [null, 'x', 'y', 'z']]; // 部位毎の装備
      },
    );
    expect(() => decodePlanCode(corruptedCode)).not.toThrow();
    const decoded = decodePlanCode(corruptedCode);
    expect(decoded!.state.phantomNodeSelections).toEqual({ 1: 2 });
    expect(decoded!.state.phantomFactorSlots).toEqual({});
    expect(decoded!.state.equipped).toEqual({});
  });
});

describe('v3 シーズン固有要素', () => {
  it('先頭にシーズン番号を持つ1要素として末尾(index 11)に書き出す', () => {
    let season: unknown;
    withCorruptedStructuralArray(encodePlanCode(fullAutoSaveState()), (arr) => {
      season = arr[11];
    });
    expect(season).toEqual([
      CURRENT_SAVE_SEASON_ID,
      1,
      80,
      1,
      [
        [1002, 1002],
        [1005, 1004],
      ],
      [[100, 'foo', 3]],
    ]);
  });

  it('現行シーズン以外のブロックは中身を読まず、シーズン番号だけを返す(装備等は維持)', () => {
    const code = withCorruptedStructuralArray(encodePlanCode(fullAutoSaveState()), (arr) => {
      (arr[11] as unknown[])[0] = LEGACY_SAVE_SEASON_ID;
    });
    const decoded = decodePlanCode(code)!.state;
    expect(decoded.saveSeasonId).toBe(LEGACY_SAVE_SEASON_ID);
    expect(decoded.phantomTemplateId).toBeNull();
    expect(decoded.phantomFactorSlots).toEqual({});
    expect(decoded.phantomLevel).toBeUndefined();
    expect(decoded.talentR1EnabledIds).toEqual(fullAutoSaveState().talentR1EnabledIds);
  });

  it('過去シーズンのまま再保存するデータは、シーズン番号だけを残して中身を書き出さない', () => {
    const state = { ...fullAutoSaveState(), saveSeasonId: LEGACY_SAVE_SEASON_ID };
    let season: unknown;
    withCorruptedStructuralArray(encodePlanCode(state), (arr) => {
      season = arr[11];
    });
    expect(season).toEqual([LEGACY_SAVE_SEASON_ID]);
  });

  it('映痕は因子エントリの4番目に [スロット位置, group, quality, value] で書き出し、往復できる', () => {
    const state: AutoSaveState = {
      ...fullAutoSaveState(),
      phantomFactorSlots: {
        100: {
          classKey: 'foo',
          grade: 3,
          affixes: [
            null,
            { group: 3, quality: 2, value: 467 },
            null,
            { group: 101, quality: 5, value: 490 },
          ],
        },
        101: { classKey: 'bar', grade: 1 },
      },
    };
    let factors: unknown;
    withCorruptedStructuralArray(encodePlanCode(state), (arr) => {
      factors = (arr[11] as unknown[])[5];
    });
    expect(factors).toEqual([
      [
        100,
        'foo',
        3,
        [
          [1, 3, 2, 467],
          [3, 101, 5, 490],
        ],
      ],
      [101, 'bar', 1],
    ]);
    expect(decodePlanCode(encodePlanCode(state))!.state.phantomFactorSlots).toEqual(
      state.phantomFactorSlots,
    );
  });

  it('saveSeasonId 未設定の状態は現行シーズンとして書き出す', () => {
    const code = encodePlanCode({ ...fullAutoSaveState(), saveSeasonId: undefined });
    expect(decodePlanCode(code)?.state.saveSeasonId).toBe(CURRENT_SAVE_SEASON_ID);
  });
});

// v2(S3まで)の構造データ配列。書き出しはv3のみのため、fullAutoSaveState() 相当をテストで手組みする。
function fullV2StructuralArray(): unknown[] {
  const nulls = ALL_SLOTS.map(() => null);
  return [
    5, // professionKey: frostMage
    1, // professionTypeKey: type2
    nulls, // equipped
    ALL_SLOTS.map(() => 20), // refineLevels
    ALL_SLOTS.map(() => 90), // perfectlines
    nulls, // evolutionStats
    nulls, // legendaryAffixState
    [1, 0, 1], // masteryEquipped
    [30, 25, 10],
    [6, 3, 0],
    [30, 25, 20],
    [6, 5, 4],
    [3944, null, 3957],
    [5, 5, 3],
    [101, 102, 103],
    [201, 202],
    nulls, // slotEnchants
    [null, null, null, null, null], // moduleSlots
    45, // adventurerLevel
    1, // phantomEnabled
    80, // phantomLevel
    1, // phantomTemplateId
    500, // phantomBondPoints(S4で廃止、読み捨てる)
    [
      [1002, 1002],
      [1005, 1004],
    ],
    [[100, 'foo', 3]],
    [3011, 3021, null, 3025],
    [0, 2, 0, 4],
    nulls, // legendaryAffixGroupState
  ];
}

// 名称セグメントは本物のエンコード(encodeName)を流用し、版数と構造データだけをv2に差し替える。
function fullV2Code(): string {
  const v3 = encodePlanCode(fullAutoSaveState());
  const nameSegment = v3.slice(v3.indexOf(':') + 1, v3.indexOf(':', v3.indexOf(':') + 1));
  return `2:${nameSegment}:${compressToEncodedURIComponent(JSON.stringify(fullV2StructuralArray()))}`;
}

describe('v2(S3まで)のコードの読み込み', () => {
  const expected = (): AutoSaveState => ({
    ...fullAutoSaveState(),
    saveSeasonId: LEGACY_SAVE_SEASON_ID,
  });

  it('装備・スキル等はそのまま読み、S3のデータとして扱う(絆ポイントは読み捨てる)', () => {
    const state = decodePlanCode(fullV2Code())?.state;
    expect(state).toEqual(expected());
    expect(state).not.toHaveProperty('phantomBondPoints');
  });

  it('decodes legacy v1 codes with no colon separator (name embedded in the array)', () => {
    // 旧v1フォーマット: [version, name, ...構造データ] をまるごと圧縮した1本の文字列(区切り文字なし)。
    const legacyArr = [1, 'テストビルド', ...fullV2StructuralArray()];
    const legacyCode = compressToEncodedURIComponent(JSON.stringify(legacyArr));
    expect(legacyCode.includes(':')).toBe(false);

    const decoded = decodePlanCode(legacyCode);
    expect(decoded!.isLegacy).toBe(true);
    expect(decoded!.state).toEqual(expected());
  });

  it('decodes roleSkillSlots/roleSkillRanks as undefined when absent from an older v2 code', () => {
    const arr = fullV2StructuralArray();
    arr.length -= 3; // roleSkillSlots/roleSkillRanks/legendaryAffixGroupState 追加前
    const decoded = decodePlanCode(buildV2Code(2, 'x', arr))!.state;
    expect(decoded.roleSkillSlots).toBeUndefined();
    expect(decoded.roleSkillRanks).toBeUndefined();
    expect(decoded.legendaryAffixGroupState).toEqual({});
  });

  it('v2 → v3 に再保存しても装備・スキル等は変わらない', () => {
    const fromV2 = decodePlanCode(fullV2Code())!.state;
    const resaved = decodePlanCode(encodePlanCode({ ...fromV2, saveSeasonId: undefined }))!.state;
    expect(resaved).toEqual(fullAutoSaveState());
  });
});
