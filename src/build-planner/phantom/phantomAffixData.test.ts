import { describe, expect, it } from 'vitest';
import gameDataJa from '../../locales/ja_JP/game-data.json';
import phantomAffixesRaw from '../../data/phantom-affixes.json';
import {
  affixInputToValue,
  affixFightValue,
  affixValueToInput,
  affixWithQuality,
  affixEffectMarkup,
  affixEffectText,
  aggregateAffixEffects,
  withAffixQualities,
  clampAffixValue,
  countAffixesLostByLevelChange,
  defaultAffixValue,
  fitAffixesToSlots,
  FLAT_CLASS_AFFIX_BUFF_IDS,
  formatAffixValue,
  getAffixGroup,
  getActiveAffixes,
  getAffixGroupsForSlot,
  getAffixQualityColor,
  getFactorProfessionId,
  getDuplicatedNonStackingGroups,
  withFactorLevel,
} from './phantomAffixData';
import { pfData } from './phantomData';

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

  it('スロットの候補はスロットの AffixType で絞り込み、クラス映痕は優先クラスを先頭に全クラス分並べる', () => {
    const stat = getAffixGroupsForSlot([1], 1);
    expect(stat.every((g) => g.affixType === 1)).toBe(true);
    // ステータス・主(102)が先頭
    expect(stat[0].libId).toBe(102);

    const cls = getAffixGroupsForSlot([2], 4);
    expect(cls.every((g) => g.affixType === 2)).toBe(true);
    const professions = [...new Set(cls.map((g) => g.profession))];
    // 優先クラス(4)が先頭、残りはクラスID順
    expect(professions[0]).toBe(4);
    expect(professions.slice(1)).toEqual([...professions.slice(1)].sort((a, b) => a - b));
    expect(professions.length).toBeGreaterThan(1);

    // 兼用スロットでもステータス映痕が先、クラス映痕が後
    const both = getAffixGroupsForSlot([1, 2], 1);
    const firstClass = both.findIndex((g) => g.affixType === 2);
    expect(both.slice(firstClass).every((g) => g.affixType === 2)).toBe(true);
  });

  it('因子のクラスはクラス専用因子ならそのクラス、共通因子なら null', () => {
    expect(getFactorProfessionId('4001')).toBe(1);
    const common = Object.entries(pfData.byClass).find(
      ([, fc]) => fc.seasonId === 4 && fc.professionIds.length === 0,
    );
    expect(common).toBeDefined();
    expect(getFactorProfessionId(common![0])).toBeNull();
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

describe('レベル変更時の映痕の詰め直し', () => {
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
    const next = withFactorLevel(
      { classKey: '4001', grade: 3, affixes: [CRIT, CRIT, SB_CLASS, SB_CLASS] },
      1,
    );
    expect(next).toEqual({ classKey: '4001', grade: 1, affixes: [CRIT, SB_CLASS] });
  });

  it('G3→G2: スロット番号の若い映痕から順に、移行先の若いスロットへ詰める', () => {
    const CRIT2 = { ...CRIT, value: 300 };
    const SB_CLASS2 = { ...SB_CLASS, value: 200 };
    const next = withFactorLevel(
      { classKey: '4001', grade: 3, affixes: [CRIT, CRIT2, SB_CLASS, SB_CLASS2] },
      2,
    );
    // G2: [ステータス, クラス, ステータス/クラス]。スロット2(ステータス)はスロット3(兼用)へ移り、
    // スロット4(クラス)が外れる。
    expect(next).toEqual({ classKey: '4001', grade: 2, affixes: [CRIT, SB_CLASS, CRIT2] });
    expect(
      countAffixesLostByLevelChange(
        { classKey: '4001', grade: 3, affixes: [CRIT, CRIT2, SB_CLASS, SB_CLASS2] },
        2,
      ),
    ).toBe(1);
  });

  it('G3→G2: 若いスロットが空なら後ろのスロットの映痕を繰り上げる', () => {
    expect(
      withFactorLevel({ classKey: '4001', grade: 3, affixes: [null, CRIT, null, SB_CLASS] }, 2),
    ).toEqual({ classKey: '4001', grade: 2, affixes: [CRIT, SB_CLASS] });
  });

  it('G2→G1: 兼用スロットの映痕は空いている合うスロットへ移る', () => {
    expect(
      withFactorLevel({ classKey: '4001', grade: 2, affixes: [null, SB_CLASS, CRIT] }, 1),
    ).toEqual({ classKey: '4001', grade: 1, affixes: [CRIT, SB_CLASS] });
  });

  it('レベルを上げる場合や収まる場合は外れる映痕の数は0', () => {
    const factor = { classKey: '4001', grade: 2, affixes: [CRIT, SB_CLASS] };
    expect(countAffixesLostByLevelChange(factor, 3)).toBe(0);
    expect(countAffixesLostByLevelChange(factor, 1)).toBe(0);
    expect(countAffixesLostByLevelChange(null, 1)).toBe(0);
  });

  it('映痕が無くなった場合は affixes を持たない', () => {
    expect(withFactorLevel({ classKey: '4001', grade: 2, affixes: [null, null] }, 3)).toEqual({
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

describe('映痕の効果説明のハイライト', () => {
  const tg = ((key: string, opts?: { defaultValue?: string }) => {
    const [ns, id] = key.split('.');
    if (ns === 'attrDescs') return attrDescs[id] ?? opts?.defaultValue ?? '';
    return ns === 'attributes' && id ? '会心' : (opts?.defaultValue ?? key);
  }) as unknown as Parameters<typeof affixEffectMarkup>[0];

  it('wraps only the value of a stat affix in the accent markup', () => {
    expect(affixEffectMarkup(tg, CRIT)).toBe('会心 <style="accent-gn">+567</style>');
    expect(affixEffectText(tg, CRIT)).toBe('会心 +567');
  });

  it('keeps the game accent markup of a buff affix description', () => {
    const markup = affixEffectMarkup(tg, { group: 101, quality: 2, value: 267 });
    expect(markup).toContain('<style="accent-gn">+2.67%</style>');
    expect(affixEffectText(tg, { group: 101, quality: 2, value: 267 })).not.toContain('<');
  });
});

describe('映痕のレアリティ一括変更', () => {
  it('uses the preferred quality for a newly selected imprint', () => {
    expect(defaultAffixValue(1, 3)).toEqual({ group: 1, quality: 3, value: 1067 });
    expect(defaultAffixValue(1)).toEqual({ group: 1, quality: 2, value: 567 });
  });

  it('changes the quality of embedded imprints and resets their values', () => {
    const factor = {
      classKey: '4001',
      grade: 2,
      affixes: [CRIT, { ...SB_CLASS, quality: 3, value: 200 }],
    };
    const { factor: next, changed } = withAffixQualities(factor, 3);
    expect(changed).toBe(1);
    expect(next.affixes?.[0]).toEqual({ group: 1, quality: 3, value: 1067 });
    expect(next.affixes?.[1]).toEqual(factor.affixes[1]);
    expect(withAffixQualities(next, 3).changed).toBe(0);
  });
});
