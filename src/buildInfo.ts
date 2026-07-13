// ローカルタイムゾーンのオフセットを ISO 形式 (+09:00 など) に変換する
function formatTimezoneOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

// __BUILD_TIME__ (UTC ISO文字列) を閲覧者のタイムゾーンの ISO 風表記に変換する
export function formatBuildTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const offset = formatTimezoneOffset(date.getTimezoneOffset());
  return `${y}-${m}-${d} ${h}:${min}${offset}`;
}
