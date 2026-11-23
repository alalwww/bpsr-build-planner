// ゲーム内のシーズン進行スケジュール(JST)。ZTable等から機械的に導出できる値ではないため、
// 判明時点でここに手書きしている。装備のGS帯フィルター初期値・祈願Lvの初期値など、
// 「クライアントの現在日時に応じて既定値を切り替えたい」複数箇所から共通で参照する。

// ---- 装備GS帯 ----
// シーズン4: 装備はGS320台/340台/360台(+380)が追加された(S3の220/240/260台と同じ構成)。
const LV340_SINCE = Date.parse('2026-12-14T05:00:00+09:00');
const LV360_SINCE = Date.parse('2027-01-25T05:00:00+09:00');

export type GsScheduleTier = 'lv320' | 'lv340' | 'lv360';

export function getGsScheduleTier(now: Date = new Date()): GsScheduleTier {
  const t = now.getTime();
  if (t >= LV360_SINCE) return 'lv360';
  if (t >= LV340_SINCE) return 'lv340';
  return 'lv320';
}

// ---- 祈願Lv(シーズンLv)の初期値 ----
// 自動保存/プランに値が無い場合(初回起動・リセット・旧シーズンデータの初期化等)の既定値。
// シーズンLvの上限開放に合わせて段階的に引き上げる(日時の昇順)。
const PHANTOM_LEVEL_SCHEDULE: { since: number; level: number }[] = [
  { since: Date.parse('2026-12-07T05:00:00+09:00'), level: 65 },
  { since: Date.parse('2026-12-28T05:00:00+09:00'), level: 80 },
  { since: Date.parse('2027-01-11T05:00:00+09:00'), level: 90 },
  { since: Date.parse('2027-02-01T05:00:00+09:00'), level: 100 },
];
/** スケジュールの最初の日時より前の既定値。 */
const PHANTOM_LEVEL_INITIAL = 30;

export function getDefaultPhantomLevel(now: Date = new Date()): number {
  const t = now.getTime();
  let level = PHANTOM_LEVEL_INITIAL;
  for (const step of PHANTOM_LEVEL_SCHEDULE) {
    if (t >= step.since) level = step.level;
  }
  return level;
}
