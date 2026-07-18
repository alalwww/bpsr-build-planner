// ゲーム内の装備GS帯追加スケジュール(JST)。ZTable等から機械的に導出できる値ではないため、
// 判明時点でここに手書きしている。装備のGS帯フィルター初期値・潜在因子の初期選択ランクなど、
// 「クライアントの現在日時に応じて既定値を切り替えたい」複数箇所から共通で参照する。
const LV240_SINCE = new Date('2026-08-10T05:00:00+09:00').getTime();
const LV260_SINCE = new Date('2026-09-21T05:00:00+09:00').getTime();

export type GsScheduleTier = 'lv220' | 'lv240' | 'lv260';

export function getGsScheduleTier(now: Date = new Date()): GsScheduleTier {
  const t = now.getTime();
  if (t >= LV260_SINCE) return 'lv260';
  if (t >= LV240_SINCE) return 'lv240';
  return 'lv220';
}
