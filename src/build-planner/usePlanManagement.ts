import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { AutoSaveState, BuildPlanData } from './buildPlan';
import { loadBuildPlans, persistBuildPlans } from './buildPlan';
import { decodePlanCode, encodePlanCode } from './planCode';

export interface PlanManagementResult {
  planName: string;
  setPlanName: Dispatch<SetStateAction<string>>;
  buildPlans: BuildPlanData[];
  savePlan: (name: string) => void;
  overwritePlan: (id: string, name: string) => void;
  renamePlan: (id: string, newName: string) => void;
  loadPlan: (id: string) => void;
  deletePlan: (id: string) => void;
  exportPlanCode: () => string;
  importPlanCode: (code: string) => boolean;
}

// 保存済みプラン一覧のCRUD・プランコードのエクスポート/インポートを担当する。
// 現在の編集状態のスナップショット取得(buildAutoSaveState)と、読み込んだプランの
// 各ドメインステートへの適用(applyPlanState)は全ドメインを横断するため、
// useBuildState.ts側からコールバックとして受け取る。
export function usePlanManagement(
  initialName: string,
  buildAutoSaveState: (name?: string) => AutoSaveState,
  applyPlanState: (plan: AutoSaveState) => void,
): PlanManagementResult {
  const [buildPlans, setBuildPlans] = useState<BuildPlanData[]>(() => loadBuildPlans());
  const [planName, setPlanName] = useState<string>(initialName);

  const snapshotPlan = (name: string, existingId?: string): BuildPlanData => ({
    id: existingId ?? crypto.randomUUID(),
    ...buildAutoSaveState(name),
  });

  const savePlan = (name: string) => {
    const plan = snapshotPlan(name);
    setBuildPlans((prev) => {
      const next = [plan, ...prev];
      persistBuildPlans(next);
      return next;
    });
  };

  const overwritePlan = (id: string, name: string) => {
    const plan = snapshotPlan(name, id);
    setBuildPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? plan : p));
      persistBuildPlans(next);
      return next;
    });
  };

  const loadPlan = (id: string) => {
    const plan = buildPlans.find((p) => p.id === id);
    if (!plan) return;
    setPlanName(plan.name);
    applyPlanState(plan);
  };

  const exportPlanCode = (): string => encodePlanCode(buildAutoSaveState());

  const importPlanCode = (code: string): boolean => {
    const plan = decodePlanCode(code);
    if (!plan) return false;
    setPlanName(plan.name);
    applyPlanState(plan);
    return true;
  };

  const renamePlan = (id: string, newName: string) => {
    setBuildPlans((prev) => {
      const target = prev.find((p) => p.id === id);
      const next = prev.map((p) => (p.id === id ? { ...p, name: newName } : p));
      persistBuildPlans(next);
      // 現在の入力欄の名前がリネーム対象と一致していれば追従
      if (target && planName === target.name) setPlanName(newName);
      return next;
    });
  };

  const deletePlan = (id: string) => {
    setBuildPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persistBuildPlans(next);
      return next;
    });
  };

  return {
    planName,
    setPlanName,
    buildPlans,
    savePlan,
    overwritePlan,
    renamePlan,
    loadPlan,
    deletePlan,
    exportPlanCode,
    importPlanCode,
  };
}
