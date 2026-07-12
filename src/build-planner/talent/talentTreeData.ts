import talentTreeRaw from '../../data/talent-tree.json';
import { createAssetMap } from '../assetMap';

// ---- Icon map ----

// タレントアイコン(ロール/ジャンル/残滓アイコン等の名前指定にも使う)
export const getTalentAsset = createAssetMap(
  import.meta.glob<{ default: string }>(
    ['../../assets/talents/*.png', '!../../assets/talents/* #*.png'],
    { eager: true },
  ),
);

export function getTalentIconUrl(iconPath: string): string | undefined {
  const filename = iconPath.split('/').pop();
  return filename ? getTalentAsset(filename) : undefined;
}

// ---- 背景画像 ----
const bgAsset = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/talents/talent_bg_*.png', { eager: true }),
);

export function getBgUrl(professionId: number, side: 'left' | 'right'): string | undefined {
  return bgAsset(`talent_bg_${side}_${professionId}`);
}

// ---- JSON types ----
// talent-tree.json の単一の定義元。ステータス計算側(stats/gameData.ts)は
// ここから再エクスポートして参照する(同じJSONを別の型で二重パースしない)。

export interface TalentNodeData {
  weaponGroup: number;
  icon: string;
  type: number;
  effects: number[][];
  buffValueKeys?: number[];
  buffPars?: number[];
  cost: number;
  fightValue: number;
}

export interface TreeNode {
  id: number;
  talentId: number;
  stage: number;
  bdType: number;
  preNodes: number[];
  nextNodes: number[];
  position: [number, number];
  // unlock: [[type, value], ...] — type=3: 総消費ポイント >= value で解放
  unlock?: number[][];
}

export interface StageInfo {
  id: number;
  name: string[];
  stage: number;
  bdType: number;
  rootId: number;
  recommendTalent: number[];
}

export const talentTree = talentTreeRaw as unknown as {
  nodes: Record<string, TalentNodeData>;
  stagesByWeaponType: Record<string, StageInfo[]>;
  treeNodesByWeaponType: Record<string, TreeNode[]>;
};

const ALL_TREE_NODES_BY_ID: Record<number, TreeNode> = {};
for (const nodes of Object.values(talentTree.treeNodesByWeaponType)) {
  for (const node of nodes as TreeNode[]) {
    ALL_TREE_NODES_BY_ID[node.id] = node;
  }
}

// ---- Role theme ----

export interface RoleTheme {
  edgeColor: string;
  fillColor: string;
  bgColor: string;
  bgTint: string;
}

// Role-specific background icon for dedicated-icon nodes (type 4/5)
export const ROLE_ICON_NAMES: Record<number, string> = {
  1: 'talent_icon_red', // attack
  2: 'talent_icon_green', // support
  3: 'talent_icon_blue', // defense
};

export const ROLE_THEMES: Record<number, RoleTheme> = {
  1: {
    edgeColor: '#f87171',
    fillColor: '#6b1d1d',
    bgColor: '#531d19',
    bgTint: 'rgba(100,15,15,0.38)',
  },
  2: {
    edgeColor: '#4ade80',
    fillColor: '#0f3626',
    bgColor: '#0f503a',
    bgTint: 'rgba(15,90,35,0.38)',
  },
  3: {
    edgeColor: '#60a5fa',
    fillColor: '#1e3a8a',
    bgColor: '#1e315e',
    bgTint: 'rgba(15,35,110,0.38)',
  },
};
export const DEFAULT_ROLE_THEME = ROLE_THEMES[1];
