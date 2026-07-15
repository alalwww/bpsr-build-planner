import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './ability-score-window.css';
import { computeStatsBundle } from '../store/derivedSelectors';
import { useBuildStore } from '../store/useBuildStore';
import AbilityScoreDialog from './AbilityScoreDialog';

// クライアント版限定の Ability Score ウィンドウ(ability-score.html)。
// main の編集内容は storeSync 経由で反映される(自ウィンドウの useBuildStore は読み取り専用ミラー)。
function AbilityScoreApp() {
  const { abilityScore } = useBuildStore(useShallow(computeStatsBundle));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const close = () => {
    void (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    })();
  };

  return (
    <AbilityScoreDialog
      abilityScore={abilityScore}
      expandedGroups={expandedGroups}
      onToggleGroup={toggleGroup}
      onClose={close}
      windowed
    />
  );
}

export default AbilityScoreApp;
