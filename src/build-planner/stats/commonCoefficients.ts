// クラス(職業)に関わらず適用される共通の変換係数。
// docs/STATUS_CALCULATION.md の「攻撃ステータス」「メインステータス」章を参照。
export const COMMON_STAT_COEFFICIENTS = {
  // 筋力1ptあたりの物理防御力上昇量
  physicalDefPerStrengthPoint: 0.2,
  // 知力1ptあたりの魔法防御力上昇量(2026-08-09不具合報告: 知力6435→Mdef3217,
  // 知力6959→Mdef3475, 知力7465→Mdef3732の3点から傾き0.5/ptを実測で確認。旧値0.2は
  // physicalDefPerStrengthPointとの対称性からの未検証の推測値だった)
  magicalDefPerIntellectPoint: 0.5,
  // 敏捷1ptあたりのファスト(実数値)上昇量。
  // ゲーム内実測(装備・アビリティ・イマジン全て未取得の状態で俊敏315→ファスト実数252、
  // 複数クラス(ストームブレイド/フロストメイジ/ヴァーダントオラクル/シールドファイター/
  // ビートパフォーマー)で同一値であることを確認済み。クラス差はなく、R1アビリティ等による
  // 追加補正はconversionRateBonusとして別途加算される。
  hastePerAgilityPoint: 0.8,
} as const;
