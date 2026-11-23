import {
  hasLegacyPhantomData,
  hasPhantomData,
  stData,
  type PhantomSaveState,
} from '../phantom/phantomData';

// セーブデータ(自動保存/保存プラン/プランコード)に記録する「保存時のシーズン」。
// 現行シーズンは祈願心相晶データ(season-talents.json)の seasonId から決める。
export const CURRENT_SAVE_SEASON_ID = stData.seasonId;

// シーズン番号フィールド(saveSeasonId)はS4で追加した。これを持たないセーブデータは
// すべてS4より前(S3以前)に保存されたものとして扱う。
export const LEGACY_SAVE_SEASON_ID = 3;

// 現行シーズンより前に保存されたデータか。saveSeasonId を持たないメモリ上の状態
// (テスト等で直接組み立てたもの)は現行シーズン扱い。
export function isPreviousSeasonSave(state: { saveSeasonId?: number } | null | undefined): boolean {
  return state?.saveSeasonId != null && state.saveSeasonId < CURRENT_SAVE_SEASON_ID;
}

// ロードしたデータの心相投影の状態(有効化/シーズンLv/テンプレート/ノード選択/因子装着)を
// 初期化すべきか。過去シーズンに保存されたデータ(S4ではS3潜在心相晶のデータ)は内容に関わらず
// すべて初期化する。saveSeasonId導入前から存在する、廃止テンプレート/無効因子の判定も併用する。
export function needsPhantomReset(state: PhantomSaveState): boolean {
  return isPreviousSeasonSave(state) || hasLegacyPhantomData(state);
}

// 初期化によって実際に何かが失われる(=ユーザーに通知すべき)か。
export function shouldNotifyPhantomReset(state: PhantomSaveState): boolean {
  return needsPhantomReset(state) && hasPhantomData(state);
}
