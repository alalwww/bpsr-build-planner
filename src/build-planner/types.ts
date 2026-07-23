export type StatId =
  | 'maxHp'
  | 'atk'
  | 'matk'
  | 'physicalDef'
  | 'magicalDef'
  | 'strength'
  | 'agility'
  | 'intellect'
  | 'endurance'
  | 'illusionPower'
  | 'crit'
  | 'haste'
  | 'luck'
  | 'mastery'
  | 'versatility'
  | 'resist'
  | 'allAttrResist'
  | 'allAttrStr'
  | 'allAttrAtk'
  | 'fireAtk'
  | 'iceAtk'
  | 'forestAtk'
  | 'thunderAtk'
  | 'windAtk'
  | 'rockAtk'
  | 'lightAtk'
  | 'darkAtk'
  | 'fireAttrStr'
  | 'iceAttrStr'
  | 'forestAttrStr'
  | 'thunderAttrStr'
  | 'windAttrStr'
  | 'rockAttrStr'
  | 'lightAttrStr'
  | 'darkAttrStr'
  | 'refinePhysAtk'
  | 'refineMagAtk'
  | 'refineDef'
  | 'receivedRecovery'
  | 'barrierStrength'
  | 'staminaRegen'
  | 'physicalEnhance'
  | 'magicalEnhance'
  | 'critDamageBonus'
  | 'luckyHitDamageBonus'
  | 'critRecoveryBonus'
  | 'physicalReductionBonus'
  | 'magicalReductionBonus'
  | 'luckyHitRecoveryBonus'
  | 'physicalDefIgnoreBonus'
  | 'healingPower'
  | 'breakEfficiency'
  | 'bossDamageBonus'
  | 'bossDamageReduction'
  | 'moveSpeed'
  | 'fireBonus'
  | 'iceBonus'
  | 'forestBonus'
  | 'thunderBonus'
  | 'windBonus'
  | 'rockBonus'
  | 'lightBonus';

export interface StatDefinition {
  id: StatId;
  column: 'left' | 'right';
  isPercent?: boolean;
}

export interface AbilityScoreBreakdown {
  total: number;
  other: number; // 冒険者レベル
  abilityR1: number; // R1アビリティ
  abilityR2: number; // R2アビリティ
  skillFixed: number; // 固定スキル
  skillMastery: number; // マスタリースキル
  skillImagine: number; // バトルイマジン
  equipmentBase: number; // 装備（基礎・進化ステータス・刻印）
  equipmentEnchant: number; // 装着効果
  equipmentRefine: number; // 精錬効果
  equipmentSuit: number; // セット効果
  moduleLink: number; // モジュール リンク効果
  moduleCore: number; // モジュール パワーコア効果
  phantomLevel: number; // 潜在心相晶レベル
  phantom: number; // 有効化中の心相投影
}

// クラス(職業)の定義(ProfessionKey/Profession)は ./profession を参照。
// "class" は言語予約語と紛らわしいため、ここでは扱わない。

export type EquipmentSlotId =
  | 'weapon'
  | 'head'
  | 'chest'
  | 'arms'
  | 'legs'
  | 'earring'
  | 'necklace'
  | 'ring'
  | 'ringLeft'
  | 'ringRight'
  | 'belt';

export interface EquipmentItem {
  id: number;
  slot: EquipmentSlotId;
  part: number;
  equipGs: number;
  quality: number;
  icon: string;
  weaponProfessionId?: number;
  // [[attrId, min, max, fvMin, fvMax], ...] from EquipAttrLibTable.
  // 実際の値 = floor(min + (max - min) * perfectline / 100)
  // 能力スコア寄与値 = floor(fvMin + (fvMax - fvMin) * perfectline / 100)
  baseStats: number[][];
  // AdvancedAttrLibId type=1 の固定 Evo1/Evo2。[[attrId, min, max, fvMin, fvMax], ...]
  // 非空の場合は Evo1/Evo2 を読み取り専用で表示し、改鋳スロットのみ選択可能にする。
  evo: number[][];
  // 改鋳進化ステータスの最大完成度・完成度0時の値・完成度100時の最大値。
  // 完成度pLineでkanseido/maxKanseido進行時の値:
  // round(floor(reforgeEvoMin + (reforgeEvoMax - reforgeEvoMin) * pLine / 100) * kanseido / maxKanseido)
  // 0 の場合は改鋳なし。
  reforgeMaxPerfectline: number;
  reforgeEvoMin: number;
  reforgeEvoMax: number;
  // 改鋳進化スロットの能力スコア寄与値 (perfectline 0/100 時の FightValue)。
  // calcStatValue(reforgeEvoFvMin, reforgeEvoFvMax, pLine) で計算する。
  reforgeEvoFvMin: number;
  reforgeEvoFvMax: number;
  // TalentSchoolId → [[effectType, attrId, min, max, isPercent, fvMin, fvMax], ...]
  // シリーズ武器(isFixedStat)は全 Evo 固定。BT突破防具は Evo1/Evo2 固定 + 改鋳選択可。
  // isPercent=true → min/100 で % 表示、false → calcStatValue(min, max, perfectline) で値計算。
  // シリーズ等の固定値は min===max。fvMin/fvMax は能力スコア寄与値の範囲。
  fixedEvolutionStats: Record<string, [number, number, number, number, boolean, number, number][]>;
  // 突破グループID: EquipBreakThroughTable に基づく突破バリアントを持つ装備に付与。
  // ベース装備も含め同一グループ内の全バリアントが同じ btGroupId を共有する。
  // ベース装備の EquipTable ID と一致する。
  btGroupId?: number;
  // 突破レベル: 0=突破なし(ベース), 1=突破1, 2=突破2, 3=突破3。
  btTime?: number;
  // 伝説刻印: QualityChildAttrLibId(quality=4装備)から抽出した選択可能刻印リスト。
  // effectType=1: 通常属性加算、effectType=3: type=3関数効果(2400001=物理攻撃力ボーナス等)。
  // isPercent=true: 値/100 が %; false: 実数値加算。
  // values: 段階ごとの値を昇順で格納。
  legendaryAffix?: LegendaryAffixEntry[];
  // 蒼海武器等の4枠選択式レアステータス: EquipTransformTable.QualityAttrLibId(tableType=2、
  // EquipAttrSchoolLibTable経由)から抽出。TalentSchoolId(クラス型)ごとに、4枠(重複する枠あり)
  // 分の候補リストを保持する。legendaryAffix(単一選択)とは排他。
  legendaryAffixGroups?: Record<string, LegendaryAffixEntry[][]>;
  // 装着効果グループID: EquipTable.EnchantId から取得。未設定の場合は装着効果なし。
  enchantId?: number;
  // セットID: EquipTable.SuitId。0または未設定の場合はセットなし。
  suitId?: number;
}

export interface LegendaryAffixEntry {
  effectType: number;
  attrId: number;
  isPercent: boolean;
  values: number[];
  fightValues: number[];
}

// 刻印スロット選択状態: スロットごとに選択した { attrId, value } を保持。
// undefined は未設定。
export type SlotLegendaryAffix = Partial<
  Record<EquipmentSlotId, LegendaryAffixSelection | undefined>
>;

// 蒼海武器等、4枠選択式レアステータスの選択状態: スロットごとに枠数分の選択を配列で保持。
// 各要素 undefined は当該枠が未設定。
export type SlotLegendaryAffixGroups = Partial<
  Record<EquipmentSlotId, (LegendaryAffixSelection | undefined)[]>
>;

export interface LegendaryAffixSelection {
  attrId: number;
  value: number;
}

// Refine level (精錬レベル) belongs to the equipment slot itself, not to the
// item placed in it, so it is tracked separately from EquipmentItem.
export type SlotRefineLevels = Record<EquipmentSlotId, number>;

// 進化ステータスとして選択できる5種のステータスID。
export type EvolutionStatId = 'haste' | 'crit' | 'luck' | 'versatility' | 'mastery';

// スロットごとの進化ステータス選択 ([0]/[1]=通常枠、[2]=改鋳枠)。
// undefined は未設定。
export type SlotEvolutionStats = Partial<
  Record<EquipmentSlotId, Array<EvolutionStatId | undefined>>
>;

export type EquippedItems = Partial<Record<EquipmentSlotId, EquipmentItem>>;

// 装着効果選択状態: スロットごとに選択した enchant item ID を保持。
// undefined は未設定。
export type SlotEnchants = Partial<Record<EquipmentSlotId, number | undefined>>;

// 属性ID一覧(「全」を除く8属性)。ステータス詳細の属性セクション・料理バフダイアログの
// シロップ/脊椎試薬プルダウン等で共通利用する。
export const ELEMENT_IDS = [
  'fire',
  'ice',
  'forest',
  'thunder',
  'wind',
  'rock',
  'light',
  'dark',
] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

// 料理・シロップ/脊椎試薬・スターオイル・海風の宴・鼓舞・能力共鳴・モジュールパワーコア系
// (幸運会心/HP変動/ダメージ増強/適応力)によるバフ効果の選択状態。
// 料理は加算・乗算計算後の最終ステータスに加算される(詳細はstats/cookingBuff.tsを参照)。
// シロップとスターオイルは同時装備不可。
export interface CookingBuffState {
  cookingEnabled: boolean;
  // 料理: 物理/魔法攻撃力(クラスの攻撃タイプに応じて選択中の値がatk/matkへ加算される)
  cookingAtkValue: number;
  // 料理: 精鋭ダメージ%(現状未計算のため保持のみ、ステータスには反映しない)
  cookingEliteDamagePercent: number;
  syrupEnabled: boolean;
  syrupElement: ElementId;
  // シロップ/脊椎試薬: 選択属性の属性強度への加算値
  syrupElementStrength: number;
  starOilEnabled: boolean;
  // スターオイル: 物理/魔法ダメージ強化度(physicalEnhance/magicalEnhanceへの加算値)
  starOilValue: number;
  // イベントバフ: 期間限定イベント等で付与される、クラスのメインステータス(筋力/知力/俊敏)への
  // 加算バフの汎用枠(他の加算源と同様に%ボーナス適用前に加算)。元は「海風の宴」専用の固定+500
  // だったが、同種の効果が今後も追加され得るため効果値を入力可能にして汎用化した
  // (eventBuffValueの既定値500は旧・海風の宴の効果量を踏襲)。
  eventBuffEnabled: boolean;
  eventBuffValue: number;
  // 鼓舞(Inspiration): 森癒(+400/+3%)/威咲(+100/+1.5%)のいずれか一方を選択して有効化する(排他)
  inspirationEnabled: boolean;
  inspirationVariant: 'lifebind' | 'smite';
  // 能力共鳴(Stat Resonance、響奏バフ): 平均値×倍率(%)÷100を、クラスのメインステータスへ加算する。
  // 他の加算源と異なり、メインステータスへの%ボーナス適用後に加算する(%ボーナスの対象に含めない)。
  statResonanceEnabled: boolean;
  statResonanceBaseValue: number;
  statResonanceMultiplierPercent: number;
  // 幸運会心(モジュールパワーコア効果): 自分(モジュールパネルでLv5以上発動時のみ選択可・2倍)/
  // 被Lv5/被Lv6(パーティの他メンバーから受ける場合)のいずれかを選択する(排他)。
  luckyCritEnabled: boolean;
  luckyCritVariant: 'self' | 'receivedLv5' | 'receivedLv6';
  // 極・HP変動(Life Wave、モジュールパワーコア効果、自分のみ。モジュールパネルでLv5以上発動時のみ有効)
  lifeWaveEnabled: boolean;
  // 極・ダメージ増強(DMG Stack、モジュールパワーコア効果、自分のみ。モジュールパネルでLv5以上発動時のみ有効。
  // 現時点では表示のみでステータス計算には含めない)
  dmgStackEnabled: boolean;
  dmgStackCount: number;
  // 極・適応力(Agile、モジュールパワーコア効果、自分のみ。モジュールパネルでLv5以上発動時のみ有効)
  agileEnabled: boolean;
}

// モジュールホール: 1 ホールの設定。linkCount=1-10 はリンクスタック数。
export interface ModuleHole {
  effectId: number | null;
  linkCount: number;
}

// モジュールスロットの設定。holesはmod.holesと同長。
export interface ModuleConfig {
  modId: number;
  holes: ModuleHole[];
}

// 5スロット分のモジュール設定 (null = 未設定)
export type ModuleSlots = Array<ModuleConfig | null>;
