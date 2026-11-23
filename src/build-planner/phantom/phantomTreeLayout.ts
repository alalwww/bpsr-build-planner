import layoutData from '../../data/season-talent-layout.json';
import { stData } from './phantomData';

// 祈願心相晶ツリーのノード配置。
//
// ZTable(SeasonTalentTreeTable)にはノード座標が無く、ゲームはテンプレートごとのUIプレハブ
// (ui/prefabs/season_talent/season_talent_<シーズン>_<テンプレートID>)内の、ノードと同名の
// GameObject(season_talent_<ノードID>)の RectTransform で配置している。その座標を
// scripts/extract-season-talent-layout.mjs で src/data/season-talent-layout.json に抽出しており、
// ここではそれをSVG座標に変換する。
//
// プレハブ座標は100単位のグリッド(中心原点、上向き+y)。おおよそ次の形になる:
//   ルートが中央やや上、幹ノードが左下→左上→右上→右下→中央下と時計回りに並び、
//   各幹ノードの周囲8マスに行き止まりの枝が付く。中央下からのみ2本に分岐し、合流して終端になる。

export interface TreeLayout {
  /** ノードID → SVG座標(左上原点)。 */
  positions: Map<number, [number, number]>;
  width: number;
  height: number;
}

interface LayoutTemplate {
  nodes: Record<string, number[]>;
}

const templates: Record<string, LayoutTemplate | undefined> = layoutData.templates;

/**
 * プレハブ座標(ゲーム内UI単位)→SVG座標の倍率。ノードの描画サイズ(PhantomTreeSvg.tsx)も
 * 同じ倍率でゲーム内UI単位から換算するため、ノードと間隔の比率はゲーム内表示と一致する。
 */
export const TREE_UNIT_SCALE = 1.2;
/** 上下の余白(因子ノードの選択枠130の半分+α)。 */
const PADDING_Y = 90;
/** 左右の余白。ズーム時に横スクロールで端のノードを中央寄りに寄せられるよう広めに取る。 */
const PADDING_X = 360;

/**
 * テンプレートのノード座標が抽出データにあり、全ノード分そろっていればSVG座標に変換して返す。
 * データが無い/欠けている場合は null(呼び出し側で行レイアウトを使う)。
 */
export function computeOathTreeLayout(templateId: number): TreeLayout | null {
  const tmpl = templates[String(templateId)];
  if (!tmpl) return null;
  const nodeIds = Object.entries(stData.treeNodes)
    .filter(([, n]) => n.templateId === templateId)
    .map(([id]) => id);
  if (nodeIds.length === 0 || nodeIds.some((id) => !tmpl.nodes[id])) return null;

  // 左右対称の幅にして、テンプレート間でルートの横位置がずれないようにする。
  let maxAbsX = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const id of nodeIds) {
    const [x, y] = tmpl.nodes[id];
    maxAbsX = Math.max(maxAbsX, Math.abs(x));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const positions = new Map<number, [number, number]>();
  for (const id of nodeIds) {
    const [x, y] = tmpl.nodes[id];
    positions.set(Number(id), [
      (x + maxAbsX) * TREE_UNIT_SCALE + PADDING_X,
      (maxY - y) * TREE_UNIT_SCALE + PADDING_Y,
    ]);
  }
  return {
    positions,
    width: maxAbsX * 2 * TREE_UNIT_SCALE + PADDING_X * 2,
    height: (maxY - minY) * TREE_UNIT_SCALE + PADDING_Y * 2,
  };
}
