import { describe, expect, it } from 'vitest';
import { formatPercentParam, renderEffectDesc } from './gameText';

describe('formatPercentParam', () => {
  it('整数%は小数を付けない', () => {
    expect(formatPercentParam(800)).toBe('8%');
  });

  it('小数%は既定で第1位まで', () => {
    expect(formatPercentParam(750)).toBe('7.5%');
  });

  it('桁数を指定できる(因子の極性表示は第2位まで)', () => {
    expect(formatPercentParam(755, 2)).toBe('7.55%');
  });
});

describe('renderEffectDesc', () => {
  it('unmarknormal を実数値に置換する', () => {
    expect(renderEffectDesc('攻撃力+{*Decision.unmarknormal(1)*}', [120])).toBe('攻撃力+120');
  });

  it('unmarkpercent を%表示に置換する(単位1/100)', () => {
    expect(renderEffectDesc('会心+{*Decision.unmarkpercent(2)*}', [0, 500])).toBe('会心+5%');
  });

  it('unmarktime を秒表示に置換する(単位ms)', () => {
    expect(renderEffectDesc('{*Decision.unmarktime(1)*}持続', [10500])).toBe('10.5秒持続');
  });

  it('{pn} は既定で実数値、pAsPercent=true で%表示', () => {
    expect(renderEffectDesc('+{p1}', [300])).toBe('+300');
    expect(renderEffectDesc('+{p1}', [300], true)).toBe('+3%');
    expect(renderEffectDesc('+{p1}', [350], true)).toBe('+3.5%');
  });

  it('参照先の par が無い場合は ? を出す', () => {
    expect(renderEffectDesc('+{p3}', [1])).toBe('+?');
    expect(renderEffectDesc('+{*Decision.unmarknormal(9)*}', [])).toBe('+?');
  });

  it('style/linktext タグは中身を残して除去、その他タグは削除する', () => {
    expect(
      renderEffectDesc(
        '<style="accent-gn">攻撃力+{*Decision.unmarknormal(1)*}</style><br><linktext=abc>詳細</linktext>',
        [40],
      ),
    ).toBe('攻撃力+40詳細');
  });
});
