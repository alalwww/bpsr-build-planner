import { useState } from 'react';
import PresetBar from '../components/preset/PresetBar';
import { useBuildStore } from '../store/useBuildStore';
import {
  affixPresetContentOf,
  affixPresetMatches,
  applyAffixPreset,
  MAX_AFFIX_PRESET_NAME_LENGTH,
  MAX_AFFIX_PRESETS,
  type AffixPreset,
} from './affixPresets';
import type { PhantomFactorSlotValue } from './phantomData';

interface AffixPresetBarProps {
  /** 設定中の因子(未装着なら null。保存・ロードはできない)。 */
  current: PhantomFactorSlotValue | null;
  onApply: (factor: PhantomFactorSlotValue) => void;
}

// 映痕プリセットの保存・切り替えUI(因子設定ダイアログの映痕列の上端・右寄せ)。UI本体は共通の PresetBar。
function AffixPresetBar({ current, onApply }: AffixPresetBarProps) {
  const presets = useBuildStore((s) => s.affixPresets);
  const savePreset = useBuildStore((s) => s.saveAffixPreset);
  const overwritePreset = useBuildStore((s) => s.overwriteAffixPreset);
  const renamePreset = useBuildStore((s) => s.renameAffixPreset);
  const deletePreset = useBuildStore((s) => s.deleteAffixPreset);

  // ロード中のプリセット(ダイアログを開いている間だけの表示状態)。開いた時点では、
  // 現在の状態と内容が一致するプリセットがあればそれをロード中として扱う。
  const [loadedId, setLoadedId] = useState<string | null>(() =>
    current ? (presets.find((p) => affixPresetMatches(p, current))?.id ?? null) : null,
  );
  const loadedPreset = presets.find((p) => p.id === loadedId) ?? null;

  return (
    <PresetBar<AffixPreset>
      className="phantom-affix-preset-bar"
      presets={presets}
      loadedPresetId={loadedPreset?.id ?? null}
      hasChangesFromLoaded={
        loadedPreset && current ? !affixPresetMatches(loadedPreset, current) : true
      }
      onSave={(name) => {
        if (current) setLoadedId(savePreset(name, affixPresetContentOf(current)));
      }}
      onOverwrite={(id, name) => {
        if (!current) return;
        overwritePreset(id, name, affixPresetContentOf(current));
        setLoadedId(id);
      }}
      onRename={renamePreset}
      onDelete={(id) => {
        deletePreset(id);
        if (id === loadedId) setLoadedId(null);
      }}
      onLoad={(id) => {
        const preset = presets.find((p) => p.id === id);
        if (!current || !preset) return;
        onApply(applyAffixPreset(current, preset));
        setLoadedId(id);
      }}
      maxPresets={MAX_AFFIX_PRESETS}
      maxNameLength={MAX_AFFIX_PRESET_NAME_LENGTH}
      i18nKey="buildPlanner.affixPreset"
      renderLabel={(preset) => (
        <>
          <span className="phantom-affix-preset-bar__level">G{preset.grade}</span>
          {preset.name}
        </>
      )}
      disabled={!current}
    />
  );
}

export default AffixPresetBar;
