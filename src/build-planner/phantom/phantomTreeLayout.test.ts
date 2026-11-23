import { describe, expect, it } from 'vitest';
import { stData } from './phantomData';
import { computeOathTreeLayout } from './phantomTreeLayout';

const templateIds = Object.keys(stData.templates).map(Number);

describe('computeOathTreeLayout', () => {
  it.each(templateIds)('template %i: places every node inside the SVG without overlap', (tid) => {
    const layout = computeOathTreeLayout(tid);
    expect(layout).not.toBeNull();
    const nodeIds = Object.entries(stData.treeNodes)
      .filter(([, n]) => n.templateId === tid)
      .map(([id]) => Number(id));
    expect([...layout!.positions.keys()].sort()).toEqual(nodeIds.sort());

    const pts = [...layout!.positions.values()];
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(40);
      expect(x).toBeLessThanOrEqual(layout!.width - 40);
      expect(y).toBeGreaterThanOrEqual(40);
      expect(y).toBeLessThanOrEqual(layout!.height - 40);
    }
    // ノード直径64 + 選択枠を考慮した最小間隔
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThan(80);
      }
    }
  });

  it('places trunk nodes clockwise: root center, then BL, TL, TR, BR, bottom center', () => {
    const tid = 9;
    const layout = computeOathTreeLayout(tid)!;
    const p = (id: number) => layout.positions.get(id)!;
    const [rx, ry] = p(1801);
    expect(rx).toBeCloseTo(layout.width / 2);
    const trunk = [250, 251, 1815, 252].map(p);
    expect(trunk[0][0] < rx && trunk[0][1] > ry).toBe(true); // 左下
    expect(trunk[1][0] < rx && trunk[1][1] < ry).toBe(true); // 左上
    expect(trunk[2][0] > rx && trunk[2][1] < ry).toBe(true); // 右上
    expect(trunk[3][0] > rx && trunk[3][1] > ry).toBe(true); // 右下
    const bottom = p(255);
    expect(bottom[0]).toBeCloseTo(rx);
    expect(bottom[1]).toBeGreaterThan(trunk[3][1]);
    // 分岐(1812/1813)は左右に分かれ、終端(1814)で中央に合流する
    expect(p(1812)[0] + p(1813)[0]).toBeCloseTo(rx * 2);
    expect(p(1814)[0]).toBeCloseTo(rx);
    expect(p(1814)[1]).toBeGreaterThan(p(1812)[1]);
  });

  it('returns null for unknown templates', () => {
    expect(computeOathTreeLayout(-1)).toBeNull();
  });
});
