// クラス(職業)に関わらず適用される共通の変換係数。
// docs/STATUS_CALCULATION.md の「攻撃ステータス」「メインステータス」章を参照。
export const COMMON_STAT_COEFFICIENTS = {
  // 筋力1ptあたりの物理防御力上昇量
  physicalDefPerStrengthPoint: 0.2,
  // 知力1ptあたりの魔法防御力上昇量
  magicalDefPerIntellectPoint: 0.2,
  // 敏捷1ptあたりのファスト(実数値)上昇量。
  // ゲーム内実測(装備・アビリティ・イマジン全て未取得の状態で俊敏315→ファスト実数252、
  // 複数クラス(ストームブレイド/フロストメイジ/ヴァーダントオラクル/シールドファイター/
  // ビートパフォーマー)で同一値であることを確認済み。クラス差はなく、R1アビリティ等による
  // 追加補正はconversionRateBonusとして別途加算される。
  hastePerAgilityPoint: 0.8,
} as const;
