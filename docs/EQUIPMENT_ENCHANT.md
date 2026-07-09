# 装着効果・装備タイプフィルタ仕様

ZTable調査に基づく装着効果(宝石/刻印)システムの仕様まとめ。
データ抽出・UIともに実装済み(`EquipmentSlotPicker.tsx`)。

## 1. 装着効果システム概要

装備に「宝石」または「刻印」アイテムを1個装着でき、固定のステータスボーナスが得られる。
装備可能なアイテム種別は装備のGsによって異なる:

| GS帯                             | 装着可能アイテム     | EnchantId |
| -------------------------------- | -------------------- | --------- |
| Gs=10/20 (一部)                  | なし (`EnchantId=0`) | 0         |
| Gs=40                            | 宝石 (グレード1〜5)  | 1001      |
| Gs=60                            | 宝石 (グレード1〜5)  | 1002      |
| Gs=70/80/90                      | 宝石 (グレード1〜5)  | 1003      |
| Gs=100〜170 武器                 | 刻印 (Q3/Q4/Q5)      | 2001      |
| Gs=120〜160 頭/胴/腕/脚          | 刻印 (Q2/Q4)         | 2002      |
| Gs=120〜160 耳飾/首飾/指輪       | 刻印 (Q2/Q4)         | 2003      |
| Gs=120〜160 腕輪-左/腕輪-右/護符 | 刻印 (Q2/Q3/Q4/Q5)   | 2004      |

## 2. 宝石システム (EnchantId=1001/1002/1003)

`EquipEnchantTable` の `RecommendedGem` フィールドで定義された宝石アイテムIDリスト(36件)。
EnchantId=1001/1002/1003 はすべて同一のリスト(グレード1〜5、4色×各グレード)を持つ。
グレード6・7の宝石は `EquipEnchantItemTable` には存在するが、`RecommendedGem` には含まれない。

### 宝石の種類

| 色   | Primary効果 (attrId) | 一例                                  |
| ---- | -------------------- | ------------------------------------- |
| 赤晶 | 会心 (11112)         | 赤晶宝石・威5: 会心+50, 筋力+16       |
| 青晶 | ファスト (11122)     | 青晶宝石・磐5: ファスト+50, 耐久力+50 |
| 翠晶 | 器用さ (11142)       | 翠晶宝石・疾5: 器用さ+50, 敏捷+16     |
| 輝晶 | 幸運 (11132)         | 輝晶宝石・淵5: 幸運+50, 知力+16       |

各色のセカンダリ効果の接尾辞: 威=筋力(11012)、磐=耐久力(11042)、疾=敏捷(11032)、淵=知力(11022)。
グレード1宝石はセカンダリなし(Primary効果のみ)。

### 宝石アイテムのデータ構造

宝石は精/極バリアントを持たない(グレードごとに独立したアイテムID)。
`enchants.json` での表現:

```json
{
  "id": 1024051,
  "quality": 3,
  "effects": [
    [11112, 50],
    [11012, 16]
  ]
}
```

## 3. 刻印システム (EnchantId=2001〜2004)

`EquipEnchantTable` の `EnchantItemList` フィールドで定義されたアイテムIDリスト。
各IDがベースアイテム(通常)で、**+1が「精」、+2が「極」**バリアント。

```
baseId     → 通常 (基本効果)
baseId + 1 → 精  (効果+20〜25%増)
baseId + 2 → 極  (効果+40〜50%増)
```

`enchants.json` での表現:

```json
{
  "id": 1024601,
  "quality": 3,
  "effects": [[11502, 20]],
  "refined": { "id": 1024602, "effects": [[11502, 25]] },
  "perfect": { "id": 1024603, "effects": [[11502, 30]] }
}
```

### EnchantId=2001 (武器) のアイテム例

| アイテム名                     | 効果 (通常→精→極)                    |
| ------------------------------ | ------------------------------------ |
| ブルースパインリザードの刻印   | 全属性攻撃力 +20/25/30               |
| エメラルドホーンの刻印         | 耐久力+80/90/100, 筋力+25/30/35      |
| バジリスクの刻印 (Q=4)         | 全属性攻撃力 +40/45/50               |
| ホーンゴート・花と刃の印 (Q=5) | 全属性攻撃力+40/45/50, 筋力+50/60/70 |

## 4. EnchantType と製精システム

`EquipEnchantTable.EnchantType` フィールドには 1/2/3 の値が存在する:

| Type | 概要                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1    | 装着 (初回取り付け)。`EnchantItemList` / `RecommendedGem` から選択                                       |
| 2    | **製精** (別システム)。`EnchantId=9999` として記録され、装着とは独立したエンチャント強化操作と推測される |
| 3    | Type=1 と同一の `EnchantItemList` を持つ。用途は未確定                                                   |

> **注意**: EnchantId=9999 (Type=2) は初回装着とは別の製精システムであり、
> `enchants.json` の抽出対象からは除外している。UIへの反映は将来の課題。

## 5. 抽出データファイル

### `src/data/enchants.json`

EnchantId をキーとした装着可能アイテムのリスト:

```typescript
// 各エントリの型
interface EnchantItem {
  id: number;
  quality: number;
  effects: [attrId: number, value: number][];
  refined?: { id: number; effects: [number, number][] }; // 精 (刻印のみ)
  perfect?: { id: number; effects: [number, number][] }; // 極 (刻印のみ)
}

// ファイル全体: Record<enchantId: string, EnchantItem[]>
```

- 宝石 (1001/1002/1003): `refined`/`perfect` なし、36件ずつ (同一内容)
- 刻印 (2001〜2004): `refined`/`perfect` あり、各8〜17件

### `src/data/equipment.json` の `enchantId` フィールド

`EnchantId=0` (装着不可) の装備には `enchantId` フィールドが存在しない(undefined)。
それ以外の装備には `enchantId: number` が付与されている(BreakThrough合成品はベース装備から継承)。

### `src/locales/*/game-data.json` の `items` セクション

宝石・刻印アイテムの名前と説明が追加済み(アイテムID 1024001〜1024773)。

## 6. 装備タイプフィルタ (実装済み)

防具・アクセサリは「筋力/知力/俊敏」いずれかのメインステータスを持ち、
クラスのメインステータス (`profession.mainStat`) と一致する装備のみ装着可能。

フィルタロジック (`src/build-planner/equipmentData.ts` `getGearType()`):

- `baseStats` に `attrId=11012` (筋力) が含まれる → `"strength"`
- `baseStats` に `attrId=11022` (知力) が含まれる → `"intellect"`
- `baseStats` に `attrId=11032` (俊敏) が含まれる → `"agility"`
- どれも含まれない → `null` (フィルタ対象外、すべてのクラスで表示)

`EquipmentPanel.tsx` の candidates フィルタ:

```typescript
// 武器はprofessionId一致、防具/アクセはmainStatが一致するgearTypeのみ表示
(item) => {
  if (openSlot === 'weapon') return item.weaponProfessionId === profession.professionId;
  const gearType = getGearType(item);
  return gearType === null || gearType === profession.mainStat;
};
```

## 7. UI実装状況

装着効果ピッカーは `EquipmentSlotPicker.tsx` に実装済み:

- 対象装備の `enchantId` を参照し `enchants.json` の該当セットを表示
- `enchantId` が存在しない装備(Gs=10/20等)はセクション非表示
- 選択状態は `selectedEnchant`(通常/精/極いずれかの実アイテムID)として保持し、
  `sortedEnchants` から `id`/`refined.id`/`perfect.id` を逆引きしてグレード判定する
- ステータス計算への反映は `stats/calculateRawStats.ts` の `rawStats` 合算に組み込み済み
  (呼び出し元は `store/derivedSelectors.ts` の `computeStatsBundle`)
