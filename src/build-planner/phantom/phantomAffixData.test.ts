import { describe, expect, it } from 'vitest';
import gameDataJa from '../../locales/ja_JP/game-data.json';
import phantomAffixesRaw from '../../data/phantom-affixes.json';
import {
  affixInputToValue,
  affixFightValue,
  affixValueToInput,
  affixWithQuality,
  aggregateAffixEffects,
  clampAffixValue,
  defaultAffixValue,
  fitAffixesToSlots,
  FLAT_CLASS_AFFIX_BUFF_IDS,
  formatAffixValue,
  getAffixGroup,
  getActiveAffixes,
  getAffixGroupsForSlot,
  getAffixQualityColor,
  getDuplicatedNonStackingGroups,
  withFactorGrade,
} from './phantomAffixData';

const attrDescs = (gameDataJa as unknown as { attrDescs: Record<string, string> }).attrDescs;
const affixes = (
  phantomAffixesRaw as unknown as { affixes: Record<string, { effects: number[][] }> }
).affixes;

// 会心(ステータス・副、group 1): 上級 267〜567 / 卓越 800〜1067 / エピック 1333〜1667 / 不朽 2000
const CRIT = { group: 1, quality: 2, value: 567 };
// ストームブレイド「幸運の一撃」(クラス映痕、group 101、profession 1)
const SB_CLASS = { group: 101, quality: 2, value: 139 };

describe('映痕データ', () => {
  it('品質ごとの値の範囲を group 単位でまとめる', () => {
    expect(getAffixGroup(1)?.qualities).toEqual([
      { quality: 2, min: 267, max: 567 },
      { quality: 3, min: 800, max: 1067 },
      { quality: 4, min: 1333, max: 1667 },
      { quality: 5, min: 2000, max: 2000 },
    ]);
  });

  it('表示単位: 副ステは実数、主ステ・祈りダメージ・極性・クラス映痕の {pN} は%', () => {
    expect(getAffixGroup(1)?.unit).toBe('flat'); // 会心
    expect(getAffixGroup(16)?.unit).toBe('flat'); // 祈り防御力無視
    expect(getAffixGroup(10)?.unit).toBe('percent'); // 筋力%
    expect(getAffixGroup(15)?.unit).toBe('percent'); // 祈りダメージ
    expect(getAffixGroup(6)?.unit).toBe('percent'); // 極性(3058050)
    expect(getAffixGroup(101)?.unit).toBe('percent');
  });

  it('実数表記のクラス映痕の一覧は、説明文の {*Decision.unmarknormal(N)*} と一致する', () => {
    const flat = new Set<number>();
    for (const a of Object.values(affixes)) {
      const [type, id] = a.effects[0];
      if (type === 3 && /unmarknormal/.test(attrDescs[id] ?? '')) flat.add(id);
    }
    expect(flat).toEqual(FLAT_CLASS_AFFIX_BUFF_IDS);
  });

  it('スロットの候補はスロットの AffixType と現在のクラスで絞り込む', () => {
    const stat = getAffixGroupsForSlot([1], 1);
    expect(stat.every((g) => g.affixType === 1)).toBe(true);
    // ステータス・主(102)が先頭
    expect(stat[0].libId).toBe(102);
    const cls = getAffixGroupsForSlot([2], 1);
    expect(cls.length).toBeGreaterThan(0);
    expect(cls.every((g) => g.affixType === 2 && g.profession === 1)).toBe(true);
  });

  it('初期値・品質変更は品質の最大値、効果値は品質の範囲に丸める', () => {
    expect(defaultAffixValue(1)).toEqual({ group: 1, quality: 2, value: 567 });
    expect(affixWithQuality(CRIT, 3)).toEqual({ group: 1, quality: 3, value: 1067 });
    expect(clampAffixValue(CRIT, 100).value).toBe(267);
    expect(clampAffixValue(CRIT, 9999).value).toBe(567);
  });

  it('入力値と内部値の変換・表示', () => {
    expect(affixInputToValue('percent', 2.67)).toBe(267);
    expect(affixValueToInput('percent', 267)).toBe(2.67);
    expect(affixInputToValue('flat', 283)).toBe(283);
    expect(formatAffixValue('percent', 467)).toBe('4.67%');
    expect(formatAffixValue('percent', 300)).toBe('3%');
    expect(formatAffixValue('flat', 283)).toBe('283');
  });
});

describe('グレード変更時の映痕の詰め直し', () => {
  // 因子 4001: G1 [[1],[2]] / G2 [[1],[2],[1,2]] / G3 [[1],[1],[2],[2]]
  it('G2→G3: 種類が合わない位置の映痕は、空いている合うスロットへ移す', () => {
    expect(fitAffixesToSlots([CRIT, SB_CLASS, CRIT], [[1], [1], [2], [2]])).toEqual([
      CRIT,
      CRIT,
      SB_CLASS,
      null,
    ]);
  });

  it('G3→G1: 収まらない映痕は外れる', () => {
    const next = withFactorGrade(
      { classKey: '4001', grade: 3, affixes: [CRIT, CRIT, SB_CLASS, SB_CLASS] },
      1,
    );
    expect(next).toEqual({ classKey: '4001', grade: 1, affixes: [CRIT, SB_CLASS] });
  });

  it('映痕が無くなった場合は affixes を持たない', () => {
    expect(withFactorGrade({ classKey: '4001', grade: 2, affixes: [null, null] }, 3)).toEqual({
      classKey: '4001',
      grade: 3,
    });
  });
});

describe('映痕の効果のまとめ', () => {
  it('同種の映痕は値を合計し、スロット順に並べる', () => {
    expect(
      aggregateAffixEffects([CRIT, SB_CLASS, null, { group: 1, quality: 5, value: 2000 }]),
    ).toEqual([{ group: 1, quality: 2, value: 2567 }, SB_CLASS]);
  });

  it('重複不可の映痕(極性)は値の大きい方だけを採る', () => {
    expect(
      aggregateAffixEffects([
        { group: 6, quality: 2, value: 283 },
        { group: 6, quality: 3, value: 467 },
      ]),
    ).toEqual([{ group: 6, quality: 2, value: 467 }]);
  });
});

describe('重複不可の映痕の警告対象', () => {
  const POL = { group: 6, quality: 2, value: 283 };
  const POL2 = { group: 7, quality: 2, value: 283 };
  it('同じ因子内で重なっている重複不可の映痕', () => {
    expect(
      getDuplicatedNonStackingGroups([{ classKey: '4001', grade: 3, affixes: [POL, POL] }]),
    ).toEqual(new Set([6]));
  });
  it('別々の因子にまたがって重なっている重複不可の映痕', () => {
    expect(
      getDuplicatedNonStackingGroups([
        { classKey: '4001', grade: 3, affixes: [POL, POL2] },
        null,
        { classKey: '4001', grade: 1, affixes: [POL] },
      ]),
    ).toEqual(new Set([6]));
  });
  it('通常の映痕の重複や、開放されていないスロットは対象外', () => {
    expect(
      getDuplicatedNonStackingGroups([{ classKey: '4001', grade: 3, affixes: [CRIT, CRIT] }]),
    ).toEqual(new Set());
    // G1 は2スロットのため、3番目の POL は数えない
    expect(
      getDuplicatedNonStackingGroups([{ classKey: '4001', grade: 1, affixes: [POL, null, POL] }]),
    ).toEqual(new Set());
  });
});

describe('映痕の能力スコア', () => {
  // 会心(group 1)の段階: 467:72 / 567:88 / 800:124 / 2000:311
  it('段階ちょうどの値はデータどおり', () => {
    expect(affixFightValue({ group: 1, quality: 2, value: 567 })).toBe(88);
    expect(affixFightValue({ group: 1, quality: 5, value: 2000 })).toBe(311);
  });
  it('段階の間は前後の段階から線形補間して四捨五入する', () => {
    expect(affixFightValue({ group: 1, quality: 2, value: 517 })).toBe(80);
  });
  it('開放済みスロットの映痕だけを対象にする', () => {
    expect(
      getActiveAffixes({ classKey: '4001', grade: 1, affixes: [CRIT, null, SB_CLASS] }),
    ).toEqual([CRIT]);
  });
});

describe('品質の色', () => {
  it('卓越/エピック/不朽はゲームデータの色、上級は蒼海シリーズの青', () => {
    expect([2, 3, 4, 5].map(getAffixQualityColor)).toEqual([
      '#5599dd',
      '#AB85F6',
      '#EED335',
      '#EF8E60',
    ]);
  });
});
