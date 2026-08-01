import attrIconFilenames from '../../data/attr-icons.json';
import { createAssetMap } from '../assetMap';
import type { StatId } from '../types';

// ステータス用共通アイコン(src/assets/ui/common_*.png)。talent-tree.jsonの一部ノードも
// 同じファイルを共有しているため、talent/talentTreeData.tsのgetTalentIconUrlはこの関数を
// フォールバックとして再利用する(このファイルが解決の正、talentTreeData.ts側から参照する
// 一方向の依存にして循環参照を避ける)。
export const getCommonIconAsset = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/ui/common_*.png', { eager: true }),
);

// StatId → 代表AttrId。ZTable(FightAttrTable)は同一ステータスでも複数のAttrIdバリアント
// (実数値/%表示違い等)を持つが、同じステータスならいずれも同じIconを指すため、
// 代表値1つを引ければ十分(値はattrMaps.tsの各AttrId→StatIdマップと同じ由来のもの)。
// アイコン自体のファイル名はここではハードコードせず、ビルド時にZTableから生成される
// src/data/attr-icons.json(scripts/extract-ztable.mjsのextractAttrIcons参照)から引く。
const STAT_ID_TO_ATTR_ID: Partial<Record<StatId, number>> = {
  maxHp: 11322,
  atk: 11332,
  matk: 11342,
  strength: 11012,
  intellect: 11022,
  agility: 11032,
  endurance: 11042,
  illusionPower: 11442,
  crit: 11112,
  haste: 11122,
  luck: 11132,
  mastery: 11142,
  versatility: 11152,
  resist: 11172,
  physicalDef: 11352,
  barrierStrength: 11812,
  allAttrResist: 13202,
  healingPower: 11792,
  physicalEnhance: 12552,
  magicalEnhance: 12572,
  luckyHitDamageBonus: 12532,
  bossDamageBonus: 12632,
  // moveSpeedはレジェンダリー刻印専用の仮想AttrId(92000)でFightAttrTableに対応エントリが
  // 無いため、ATTR_ICON_OVERRIDESで手動フォールバックする。
  moveSpeed: 92000,
};

// キャラクターパネル(左右2カラム)のみ対象。元画像は余白比率がまちまち(66x46〜94x97)
// なため、自動フィットだと余白の多いアイコンが目立って小さく見える。長辺を18pxに揃えて
// スケーリングした表示サイズをステータスごとに固定することで、行ごとの見た目の大きさを
// 揃える(装備側のツールチップ/ダイアログは簡易な均一サイズ表示のため対象外、CSS側で
// object-fit:containの固定ボックスに収める)。
export const STAT_ICON_SIZE: Partial<Record<StatId, { width: number; height: number }>> = {
  maxHp: { width: 18, height: 16 },
  atk: { width: 18, height: 17 },
  matk: { width: 16, height: 18 },
  strength: { width: 18, height: 12 },
  intellect: { width: 18, height: 18 },
  agility: { width: 17, height: 18 },
  endurance: { width: 16, height: 18 },
  illusionPower: { width: 18, height: 18 },
  crit: { width: 18, height: 16 },
  haste: { width: 18, height: 17 },
  luck: { width: 18, height: 18 },
  mastery: { width: 18, height: 18 },
  versatility: { width: 18, height: 16 },
  resist: { width: 15, height: 18 },
};

// FightAttrTable/BuffTableいずれにも対応エントリが無いAttrIdの手動フォールバック。
const ATTR_ICON_OVERRIDES: Partial<Record<number, string>> = {
  // 移動速度(レジェンダリー刻印専用ID 92000)。実際の移動速度系AttrId(10202/10212/10222=
  // 歩行/走行/ダッシュ速度)がいずれも common_icon21 であることをZTableで確認済み。
  92000: 'common_icon21',
  // 幻夢強度(無効)。S2以前の装備に残る滅妄強度(11442)の旧称/無効化バリアントで、
  // FightAttrTable/BuffTableいずれにも対応行が無い。滅妄強度と同じアイコンを表示する。
  98982: 'common_icon01',
};

function getIconFilenameForAttrId(attrId: number): string | undefined {
  return (
    (attrIconFilenames as Record<string, string>)[String(attrId)] ?? ATTR_ICON_OVERRIDES[attrId]
  );
}

export function getStatIconUrlForAttrId(attrId: number): string | undefined {
  const filename = getIconFilenameForAttrId(attrId);
  return filename ? getCommonIconAsset(filename) : undefined;
}

export function getStatIconUrl(statId: StatId): string | undefined {
  const attrId = STAT_ID_TO_ATTR_ID[statId];
  return attrId !== undefined ? getStatIconUrlForAttrId(attrId) : undefined;
}
