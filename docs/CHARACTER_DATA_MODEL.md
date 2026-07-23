# キャラクター/ビルドデータ仕様(検討メモ)

ZTable(`../../BPSRData/ZTable/`)の実データ調査を踏まえた、キャラクタービルドのデータ構造案。
実装済みの箇所は各セクションで実装ファイルを明示している。未実装・保留の項目は
「未確定・要調査事項」章にまとめてある。

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
| `roleSkill`(シーズン3で追加) | ロールスキル選択候補プール(下記参照)。この中から**任意4個**を選択して使用 |

固定スキル3種 + 選択スキル4種(NormalSkillより) + 任意選択のアビリティ(TalentSkillより)
+ 選択ロールスキル4種(roleSkillより)、という構成。

#### ロールスキル(RoleSkill、シーズン3で追加)

`classes.json`の`roleSkill`配列(12候補)は2種類のスキルからなる:

- **ロール固定4種**: `Talent`(1=攻撃/2=支援/3=防御)ごとに固定された4種(`TALENT_ROLE_SKILLS`)。
- **全ロール共通8種**(ID 3021〜3028): `SkillDutyTable`(`Type=[1,2,3]`)に登録され、
  全クラス・全ロールで共通。「幻想図鑑」(`SkillAoyiGuideTable`/`SkillAoyiGuideEffectTable`、
  バトルイマジンの育成度で解放される図鑑システム)と連動し、通常スキルの
  「レベル1〜30 × ランクG0〜G6」とは異なる**幻想図鑑ランク(Level 1〜4)のみの1軸**で強化される。

12候補の中から任意4個を選択してスロットに配置する(`roleSkillSlots`/`roleSkillRanks`、
デフォルトはロール固定4種)。

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

シーズン固有能力(`SeasonTalentFactorItemTable` 等)は「心相投影(潜在)」「幻影因子」として
**実装済み**(当初はスコープ外としていたが方針転換。詳細は後述の「心相投影・幻影因子」章を参照)。

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
- 選択中のロールスキル(roleSkillからの4個、シーズン3で追加) + 各スキルのランク
- 装備(各部位) + 各装備の可変部分の性能(サブステータス・特別オプション等)
- モジュール(シーズン3以降5枠) + 各モジュールの可変部分の性能
- 心相投影(シーズンタレント)のツリー選択状態 + 幻影因子の装着状態

## 未確定・要調査事項

- 装備のサブステータス/特別オプションの選択UI・データ構造(一旦保留)
- 装備のサブステータス/特別オプションの数値解決方法(`EquipAttrLibTable`等の完全な解読)

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
  - 防具部位(頭/胴/腕/脚/腕輪) → `LEGENDARY_ARMOR_PERCENT_ATTR_IDS`(`extract-ztable.mjs`)に
    列挙されたattrIdのみ `true`、それ以外(物理攻撃力+等)は `false`(実数値加算)。
    このリストは筋力(11014)/知力(11024)/俊敏(11034)で開始したが、同じattrIdが武器/
    アクセサリ側では常にisPercent:trueで出現するのに防具側だけ漏れていた4件
    (攻撃速度11722/詠唱速度11732/回復力11792/バリア強度万分率11812)を2026-07-20に追加済み。
    新しいattrIdを防具刻印に追加する際は、武器/アクセサリ側での実際の表示(%かどうか)と
    揃っているか確認しこのリストの更新要否を判断すること。
- UIは `EquipmentSlotPicker.tsx` に実装済み(紫色表示、ティア選択ボタン)

## 心相投影・幻影因子 (Season Talent / Phantom Factor)

「シーズン固有能力」(`SeasonTalentFactorItemTable` 等)は当初スコープ外としていたが、
**実装済み**(`src/build-planner/phantom/` 配下のPhantomPanel)。旧記載で「潜在」と
呼んでいたものが心相投影に相当する。

### 心相投影(シーズンタレント、`src/data/season-talents.json`)

ツリー状のノードを辿って強化を積む、シーズン専用のタレントシステム。

- `templates`: ツリーのルート/アンロック条件
- `treeNodes`: ノード(`nodeType`1=通常効果ノード/2=因子ノード、`groupId`/`sameGroupId`で
  選択分岐を表現)
- `ordinaryEffects` / `advancedEffects`: 通常ノード/上級ノードの効果データ
- `intermediateSlots`: 因子ノードの中間スロット(装着可能な因子タイプ・対応クラスを制約)
- `bondSlots`: 絆(バインド)スロット

UIは `PhantomTreeSvg.tsx`(ツリー描画)・`PhantomNodeConfig.tsx` / `PhantomNodeEffect.tsx`
(ノード選択・効果表示)・`PhantomBondSection.tsx`(絆スロット)。

### 幻影因子(`src/data/phantom-factors.json`)

心相投影の因子ノードに装着する追加ステータス/効果。6種の因子タイプ(`factorTypes`)を持つ:

| typeId | 名称           |
| ------ | -------------- |
| 1      | 極性           |
| 2      | 恒常性         |
| 3      | 第六感         |
| 4      | クラス恒常性   |
| 5      | クラス狂想     |
| 6      | 真実           |

- `byClass`: クラス(`professionIds`)×因子タイプごとのグレード別効果(`grades`、G1〜G10相当)
- 各因子は `seasonId`(`SeasonTalentFactorItemTable.SeasonId[0]`)を持ち、過去シーズンの因子は
  現シーズンでは無効(ゲーム内説明文で明記)。旧セーブデータ互換のためデータ自体は保持しつつ、
  UI側は現行シーズンの最大 `seasonId` との比較で無効表記・並び替えを行う
  (`CURRENT_FACTOR_SEASON_ID`, `phantomView.ts`)。

## 改鋳進化ステータス (Kaitchu)

改鋳後の装備に付与される選択可能な進化ステータス(精錬レベルとは別、`reforgeEvoMin`/
`reforgeEvoMax`/`reforgeMaxPerfectline`)。

- 最小値/最大値は `EquipTable.RecastingAttrLibId` → `EquipAttrLibTable.AttrEffectConfig`
  から**ZTableより直接抽出**する(`extract-ztable.mjs` `extractEquipment()`)。旧実装では
  ZTableに存在しないためと考えて実測値からの近似式で導出していたが、実際には
  `AttrEffectConfig`に格納されておりZTable側で確定できることが判明したため直接参照に変更した。
- 最大完成度(`reforgeMaxPerfectline`)のみ引き続きヒューリスティック
  (`equip.EquipGs <= 80 ? 8 : 100`、実測ベース。ZTableに直接の対応フィールドなし)。
- 完成度(0〜100%)からの実数値解決: `min + (max - min) × 完成度 / 100`
  (`src/build-planner/stats/statValue.ts` `calcStatValue()`。丸めは合算後・表示直前のみ行う)。
- 武器は防具の2倍の値を持つ(min/maxとも)。
- Gs帯: 低GS(≤80)は完成度上限8%の小規模なステータス、Gs120〜170は完成度0〜100%、
  シーズン3で追加されたGs220〜260(Lv190+装備)はさらに大きい数値帯になる。
  部位・GSごとの具体的なmin/maxは`src/data/equipment.json`の`reforgeEvoMin`/`reforgeEvoMax`
  を参照(ZTable由来のため、シーズン更新時は`npm run extract:ztable`で自動追従)。

## データ抽出の出力構成 (`scripts/extract-ztable.mjs`)

- **言語非依存データ** (`src/data/`、以下は現時点の全ファイル):
  - `equipment.json`: EquipPart毎にグループ化。各エントリに `enchantId`/`legendaryAffix`/
    `legendaryAffixGroups`/`reforgeEvoMin`/`reforgeEvoMax`等を含む
  - `enchants.json`: EnchantIdをキーとした装着可能アイテムリスト(宝石/刻印。詳細は
    `docs/EQUIPMENT_ENCHANT.md`)
  - `refine.json`: 精錬効果データ(累積効果/マイルストーン)
  - `skills.json`: クラスから参照されるスキルのみ(NormalSkill/TalentSkill/RoleSkill)
  - `skill-fight-values.json` / `skill-rank-fight-values.json`: 能力スコア算出用の
    スキルレベル別/ランク別戦力値
  - `classes.json`: IsOpen:false も含む全クラス(`roleSkill`含む、上記「アビリティ・スキル」章参照)
  - `talent-tree.json`: R1/R2アビリティのタレントツリー(ノード・効果・type=4のクラス係数
    ボーナス効果を含む)
  - `battle-imagines.json`: バトルイマジンのデータ
  - `modules.json`: モジュールのデータ(効果・パワーコア・リンク等。専用docsは未作成、
    `src/build-planner/module/moduleData.ts` を参照)
  - `suits.json`: セット効果(`suitId`ごとのtier別効果)
  - `season-talents.json`: 心相投影(シーズンタレント)。`season-constants.json`とは無関係の別データ
  - `phantom-factors.json`: 幻影因子
  - `season-constants.json`: `docs/STATUS_CALCULATION.md`のシーズン定数(K値、現行シーズンの
    ものを自動抽出)
  - `player-levels.json`: プレイヤーレベル関連(シーズン経験値上限等)
- **ロケール毎の表示テキスト** (`src/locales/<locale>/game-data.json`): `items`/`skills`/
  `classes`/`parts`/`attributes` の5セクションをIDキーで保持。
  `items` には宝石/刻印アイテム名も含む。
  手書きのUI文言 (`bpsr-bp-ui.json`) とは別ファイル。
