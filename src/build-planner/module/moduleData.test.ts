import { describe, expect, it } from 'vitest';
import { formatEffectDesc } from './moduleData';

const tgAttrDesc = (key: string) =>
  ({ '99005': '適応筋力/知力/敏捷+{v}', '99006': '適応物理/魔法攻撃力+{v}' })[key] ??
  `attrDescs.${key}`;
const tgAttr = (key: string) => ({ '11722': '攻撃速度', '11732': '詠唱速度' })[key] ?? key;
// 12512/12742はMOD_ATTR_TO_STATでcritDamageBonus/critRecoveryBonusにマッピング済みのため、
// 実アプリと同様tStat(buildPlanner.stats.*)側の名前が使われる(tgAttrへは落ちない)。
const tStat = (key: string) =>
  ({ critDamageBonus: '会心ダメージ', critRecoveryBonus: '会心回復' })[key] ?? key;

describe('formatEffectDesc', () => {
  it('formats attack-speed/cast-speed final-% and crit damage/recovery attrIds as percent (unit 100=1%)', () => {
    expect(formatEffectDesc([[1, 11722, 360]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '攻撃速度 +3.60%',
    ]);
    expect(formatEffectDesc([[1, 11732, 720]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '詠唱速度 +7.20%',
    ]);
    expect(formatEffectDesc([[1, 12512, 1200]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '会心ダメージ +12.00%',
    ]);
    expect(formatEffectDesc([[1, 12742, 1200]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '会心回復 +12.00%',
    ]);
  });

  it('still formats a normal mapped stat (maxHp) as a raw number, not a percent', () => {
    expect(formatEffectDesc([[1, 11322, 900]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      'maxHp +900',
    ]);
  });

  it('returns one array entry per config row, for the caller to render with line breaks', () => {
    const result = formatEffectDesc(
      [
        [1, 11322, 1500],
        [1, 13002, 60],
        [1, 12512, 710],
        [1, 12742, 710],
      ],
      [],
      tgAttrDesc,
      tgAttr,
      tStat,
    );
    expect(result).toEqual(['maxHp +1500', 'allAttrStr +60', '会心ダメージ +7.10%', '会心回復 +7.10%']);
  });

  it('keeps a template with an internal slash ("適応物理/魔法攻撃力") as a single entry, not split', () => {
    expect(formatEffectDesc([[5, 99006, 40]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '適応物理/魔法攻撃力+40',
    ]);
  });
});
