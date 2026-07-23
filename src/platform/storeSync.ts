import { shallow } from 'zustand/shallow';
import type { AutoSaveState } from '../build-planner/plan/buildPlan';
import { useBuildStore } from '../build-planner/store/useBuildStore';
import type { CookingBuffState } from '../build-planner/types';
import { isTauri } from './index';

// StatsDetail/AbilityScore 等の参照専用ダイアログウィンドウは main とは別JSコンテキスト
// (別 useBuildStore インスタンス)を持つため、main の編集内容を単方向で配信して反映する。
// AutoSaveState は既存の保存/共有コードで使われている「idを除くビルドプラン状態」の型で、
// buildAutoSaveState()/applyPlanState() をそのまま流用することで新規シリアライズ設計を省く。
// ただし cookingBuff はセッション限りの一時入力のため buildAutoSaveState() の対象外(localStorage
// 自動保存では意図的に除外)だが、追加バフ効果ダイアログの選択はStatsDetail等の表示に影響するため、
// 同期スナップショットには別途含める。
const SNAPSHOT_EVENT = 'store://snapshot';
const READY_EVENT = 'dialog://ready';

type StoreSnapshot = AutoSaveState & { cookingBuff: CookingBuffState };

function selectSnapshot(state: ReturnType<(typeof useBuildStore)['getState']>): StoreSnapshot {
  return { ...state.buildAutoSaveState(), cookingBuff: state.cookingBuff };
}

/** main側: ストア変更をダイアログウィンドウへ配信する。main のエントリで一度だけ呼ぶ。 */
export function initStoreSyncBroadcaster(): void {
  if (!isTauri) return;
  void (async () => {
    const { emit, listen } = await import('@tauri-apps/api/event');
    const broadcast = () => {
      void emit(SNAPSHOT_EVENT, selectSnapshot(useBuildStore.getState()));
    };
    useBuildStore.subscribe(selectSnapshot, broadcast, { equalityFn: shallow });
    // 新規に開いたダイアログウィンドウは直近の変更を待たず即座に初期値を受け取れるよう要求する
    await listen(READY_EVENT, broadcast);
  })();
}

/** ダイアログウィンドウ側: main発のスナップショットを自ウィンドウのストアへ反映する。
 * 各ダイアログウィンドウのエントリで一度だけ呼ぶ。 */
export function initStoreSyncReceiver(): void {
  if (!isTauri) return;
  void (async () => {
    const { emit, listen } = await import('@tauri-apps/api/event');
    await listen<StoreSnapshot>(SNAPSHOT_EVENT, (event) => {
      const { cookingBuff, ...planState } = event.payload;
      useBuildStore.getState().applyPlanState(planState);
      useBuildStore.getState().setCookingBuff(cookingBuff);
    });
    await emit(READY_EVENT);
  })();
}
