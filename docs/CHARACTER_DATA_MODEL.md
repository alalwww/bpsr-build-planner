# キャラクター/ビルドデータ仕様(検討メモ)

ZTable(`../../BPSRData/ZTable/`)の実データ調査を踏まえた、キャラクタービルドのデータ構造案。
実装前の仕様整理であり、Rust/TS側のデータモデルはこれを元に別途設計する。

## クラス (Profession)

- ZTable内部名は `Profession`。一覧は `ProfessionSystemTable.json`(`ProfessionId`, `Name`, `Element`, `Talent`, `IsOpen` 等)。
- `IsOpen: false` のクラスは未実装/特殊条件付きのため、クラス選択肢からは除外する。
- クラスごとに固定の `Element`(属性)を持つ。
- 攻撃種別表示は `AttackShow` フィールドで決定: 物理攻撃力(AttrId `11330`)か魔法攻撃力(`11340`)のどちらを表示するかをクラスごとに指定。
  非表示側のステータス値自体は内部的に保持される(0ではなく実値を持つ)。
- メインステータス表示も同様に `StrOrIntOrDexShow` フィールドで決定: 筋力(`11010`)/知力(`11020`)/俊敏(`11030`)のいずれを表示するか。
  こちらも非表示側のステータスは内部的に保持される。

### ロール (Talent / Tag)

- `ProfessionSystemTable.Talent` がロールIdを指す(1=攻撃、2=支援、3=防御)。
- ロール名・説明・イメージカラーは `TalentTagTable.json` で定義:
  - `TagName`: ロール名(攻撃/支援/防御)
  - `TalentColor`(`ProfessionSystemTable`側のフィールド): ロールのイメージカラー(カラーコード)
- 実データで確認済み: `Id:1 TagName:"攻撃"`, `Id:2 TagName:"支援"`, `Id:3 TagName:"防御"`。

### アビリティ(Talent)・スキル(Skill)

クラスごとに以下のスキル関連フィールドを持つ(`ProfessionSystemTable`):

| フィールド          | 内容                                                      |
| ------------------- | --------------------------------------------------------- |
| `NormalAttackSkill` | 通常攻撃スキル(固定)                                      |
| `SpecialSkill`      | 特殊スキル(固定)                                          |
| `UltimateSkill`     | アルティメットスキル(固定)                                |
| `NormalSkill`       | スキル選択候補プール。この中から**任意4個**を選択して使用 |
| `TalentSkill`       | アビリティ(talent)選択候補プール。**任意に複数選択可能**  |

固定スキル3種 + 選択スキル4種(NormalSkillより) + 任意選択のアビリティ(TalentSkillより)、という構成。

- スキルレベル: 1〜最大30
- スキルランク: 0〜最大6

> **調査結果**: `TalentSkill`が参照するIDは`NormalSkill`等と同じ`SkillTable`のエントリである
> (例: ID 1715は`SkillTable`に存在する通常のスキルエントリ)。つまり「アビリティ(Talent)」と
> 「スキル(Skill)」はデータ上は同一テーブルを共有し、クラス側のどの参照配列に載っているかで
> 区別される。したがって抽出処理上は`skills.json`(SkillTable由来、クラスの参照配列に登場する
> IDのみ)と`classes.json`内の参照配列があれば十分で、アビリティ専用の抽出テーブルは不要。
>
> なお`TalentTable`/`TalentPoolTable`/`TalentTreeTable`という別クラスタも存在するが、
> フィールド構成(`WeaponGroup`/`WeaponType`等)から見て武器熟練ツリーのような別システムと
> 判断し、ここでの「アビリティ」とは区別してスコープ外とした。

## 装備 (Equipment)

### 装備部位 (EquipPart)

UIのスロット配置と一致する連番ID(`EquipPartTable.json`、`extract-ztable.mjs`で
`src/locales/<locale>/game-data.json`の`parts`セクションとして抽出済み):

| Part ID | 部位    |
| ------- | ------- |
| 200     | 武器    |
| 201     | 頭部    |
| 202     | 胴部    |
| 203     | 腕部    |
| 204     | 脚部    |
| 205     | 耳飾り  |
| 206     | 首飾り  |
| 207     | 指輪    |
| 208     | 腕輪-左 |
| 209     | 腕輪-右 |
| 210     | 護符    |

- 武器(Part 200)はクラス専用。`EquipWeaponTable.ProfessionId` で対応するクラスと紐づく。

### 装備のステータス構成

装備品は以下の要素を持つ(EquipTable / EquipAttrLibTable 等を参照、※詳細な数値解決ロジックは別途調査が必要):

- **固定**: 筋力/知力/俊敏のいずれか1つ(メインステータス) + 耐久力 + シーズン固有能力
- **追加(可変)**: ランダムな2種類のサブステータス(会心/幸運/万能など)
- **特別オプション**: 物理攻撃力+2%、攻撃速度+1% 等の特殊効果、またはセット効果

サブステータス・特別オプションはビルドプランナー上で**ユーザーが選択できる**ようにする方針。
ただし選択UI・データ構造の詳細は一旦保留。

> `EquipAttrLibTable.json` の `AttrEffect`/`AllowPart` 等が個々のロール内容を保持していると見られるが、
> 数値ロジックの完全な解読は未着手。装備の性能計算を実装する際に別途詳細調査が必要。

シーズン固有能力(`SeasonTalentFactorItemTable` 等)について、その計画を立てる機能は**現段階ではスコープ外**とする。

## モジュール (Module)

- 装備とは別枠の装備品。装備とは異なる効果を持つ。
- 最大装備数はシーズンにより変化する: **シーズン2まで4個、シーズン3以降5個**。

## キャラクタービルドの保存データ単位

1キャラクター(1ビルドプラン)ごとに保存する項目:

- キャラ名(保存名)
- 精錬レベル(装備枠ごと)
- クラス
- 選択中のアビリティ(Talent)
- 選択中のスキル(NormalSkillからの4個 + 固定3スキル) + 各スキルのレベル・ランク
- 装備(各部位) + 各装備の可変部分の性能(サブステータス・特別オプション等)
- モジュール + 各モジュールの可変部分の性能

## 未確定・要調査事項

- 装備のサブステータス/特別オプションの選択UI・データ構造(一旦保留)
- 装備のサブステータス/特別オプションの数値解決方法(`EquipAttrLibTable`等の完全な解読)

## 現段階のスコープ外

- シーズン固有能力(`SeasonTalentFactorItemTable` 等)の計画機能

## 装着効果 (Enchant)

装備に宝石または刻印アイテムを1個装着できるシステム。詳細は `docs/EQUIPMENT_ENCHANT.md` を参照。

- 装着可能アイテム種別は装備の `EnchantId` フィールド(EquipTable)で決定
- Gs≤100: 宝石(赤/青/翠/輝晶宝石、グレード1〜5)
- Gs≥120: 刻印アイテム(通常/精/極の3段階)
- 抽出済み: `src/data/enchants.json`(EnchantIdごとのアイテムリスト)、
  `equipment.json` の各装備エントリに `enchantId` フィールドを追加
- UIは `EquipmentSlotPicker.tsx` に実装済み(装着効果ピッカー)

## 伝説刻印 (Legendary Affix)

高Gs装備(Gs100以上)に付与可能な追加ステータス選択機能。1装備につき1種類を選択。

- データ元: `EquipTable.QualityChildAttrLibId` → `EquipAttrLibTable`
- 各選択肢は `{ effectType, attrId, isPercent, values: number[] }` の形式
  (`src/build-planner/types.ts` `LegendaryAffixEntry`)
- `isPercent` の判定ルール:
  - 武器/アクセサリ部位 → 常に `true`(全効果が%表示)
  - 防具部位(頭/胴/腕/脚/腕輪) → 筋力(11014)/知力(11024)/俊敏(11034) は `true`、
    それ以外(物理攻撃力+等)は `false`(実数値加算)
- UIは `EquipmentSlotPicker.tsx` に実装済み(紫色表示、ティア選択ボタン)

## 改鋳進化ステータス (Kaitchu)

改鋳後の装備に付与される選択可能な進化ステータス(精錬レベルとは別)。

- ステータスの最小値/最大値/最大完成度はZTableに存在しないため、実測値から逆算した近似式で導出
  (`extract-ztable.mjs` `getKaitchuEvoParams()`)
- 計算式: `floor(min + (max - min) × 完成度% / 100)` (完成度0〜100%)

| GS帯   | 最大完成度 | 防具 min | 防具 max |
| ------ | ---------- | -------- | -------- |
| Gs≤80  | 8          | 26       | 37       |
| Gs≤150 | 100        | 159      | 226      |
| Gs160+ | 100        | 202      | 286      |

武器は防具の2倍の値を適用。実測値(Gs=160防具): 完成度5→206, 8→208, 11→211, 14→213, 100→286。

## データ抽出の出力構成 (`scripts/extract-ztable.mjs`)

- **言語非依存データ** (`src/data/`):
  - `equipment.json`: EquipPart毎にグループ化。各エントリに `enchantId`/`legendaryAffix` を含む
  - `enchants.json`: EnchantIdをキーとした装着可能アイテムリスト(宝石36件/刻印8〜17件)
  - `refine.json`: 精錬効果データ(累積効果/マイルストーン)
  - `skills.json`: クラスから参照されるスキルのみ
  - `classes.json`: IsOpen:false も含む全クラス
- **ロケール毎の表示テキスト** (`src/locales/<locale>/game-data.json`): `items`/`skills`/
  `classes`/`parts`/`attributes` の5セクションをIDキーで保持。
  `items` には宝石/刻印アイテム名も含む(ID 1024001〜1024773)。
  手書きのUI文言 (`bpsr-bp-ui.json`) とは別ファイル。
