import { useShallow } from 'zustand/react/shallow';
import PresetBar from '../components/preset/PresetBar';
import { useBuildStore } from '../store/useBuildStore';
import {
  MAX_MODULE_PRESET_NAME_LENGTH,
  MAX_MODULE_PRESETS,
  moduleSlotsEqual,
  type ModulePreset,
} from './modulePresets';

// モジュールプリセットの保存・切り替えUI(モジュールパネル最上部)。UI本体は共通の PresetBar。
function ModulePresetBar() {
  const { moduleSlots, modulePresets, loadedModulePresetId } = useBuildStore(
    useShallow((s) => ({
      moduleSlots: s.moduleSlots,
      modulePresets: s.modulePresets,
      loadedModulePresetId: s.loadedModulePresetId,
    })),
  );
  const saveModulePreset = useBuildStore((s) => s.saveModulePreset);
  const overwriteModulePreset = useBuildStore((s) => s.overwriteModulePreset);
  const renameModulePreset = useBuildStore((s) => s.renameModulePreset);
  const deleteModulePreset = useBuildStore((s) => s.deleteModulePreset);
  const loadModulePreset = useBuildStore((s) => s.loadModulePreset);

  const loadedPreset = modulePresets.find((p) => p.id === loadedModulePresetId) ?? null;

  return (
    <PresetBar<ModulePreset>
      className="module-preset-bar"
      presets={modulePresets}
      loadedPresetId={loadedModulePresetId}
      hasChangesFromLoaded={
        loadedPreset ? !moduleSlotsEqual(moduleSlots, loadedPreset.moduleSlots) : true
      }
      onSave={saveModulePreset}
      onOverwrite={overwriteModulePreset}
      onRename={renameModulePreset}
      onDelete={deleteModulePreset}
      onLoad={loadModulePreset}
      maxPresets={MAX_MODULE_PRESETS}
      maxNameLength={MAX_MODULE_PRESET_NAME_LENGTH}
      i18nKey="buildPlanner.modulePreset"
    />
  );
}

export default ModulePresetBar;
