import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import {
  buildTalentNodesById,
  countR1Nodes,
  initTalentR1Ids,
  initTalentR2Ids,
  talentTree,
  type TalentTreeNode,
} from '../stats/gameData';
import { TALENT_EFFECT_TYPE_SKILL_REPLACEMENT } from '../stats/attrMaps';

export interface TalentStateResult {
  talentR1EnabledIds: Set<number>;
  setTalentR1EnabledIds: Dispatch<SetStateAction<Set<number>>>;
  talentR2EnabledIds: Set<number>;
  setTalentR2EnabledIds: Dispatch<SetStateAction<Set<number>>>;
  talentNodesById: Map<number, TalentTreeNode>;
  r1NodeCount: number;
  // アビリティツリーから計算されたスキル置き換えマップ (fromSkillId → toSkillId)
  skillReplacements: Record<number, number>;
  // 転職時にR1/R2両方を初期状態へ戻す。
  resetForProfessionChange: (professionId: number) => void;
  // プロフェッションタイプ(type1/type2)切り替え時にR2のみ初期状態へ戻す。
  resetR2ForType: (professionId: number, bdType: 0 | 1) => void;
}

export function useTalentState(
  initialR1Ids: number[] | undefined,
  initialR2Ids: number[] | undefined,
  initialProfessionId: number,
  currentProfessionId: number,
): TalentStateResult {
  const [talentR1EnabledIds, setTalentR1EnabledIds] = useState<Set<number>>(() =>
    initialR1Ids ? new Set(initialR1Ids) : initTalentR1Ids(initialProfessionId),
  );
  const [talentR2EnabledIds, setTalentR2EnabledIds] = useState<Set<number>>(() =>
    initialR2Ids ? new Set(initialR2Ids) : initTalentR2Ids(initialProfessionId, 0),
  );

  const talentNodesById = useMemo(
    () => buildTalentNodesById(currentProfessionId),
    [currentProfessionId],
  );

  const r1NodeCount = useMemo(() => countR1Nodes(talentNodesById), [talentNodesById]);

  const skillReplacements = useMemo(() => {
    const result: Record<number, number> = {};
    const allIds = new Set([...talentR1EnabledIds, ...talentR2EnabledIds]);
    for (const nodeId of allIds) {
      const treeNode = talentNodesById.get(nodeId);
      if (!treeNode) continue;
      const td = talentTree.nodes[String(treeNode.talentId)];
      if (!td) continue;
      for (const eff of td.effects) {
        if (eff[0] === TALENT_EFFECT_TYPE_SKILL_REPLACEMENT) result[eff[1]] = eff[2];
      }
    }
    return result;
  }, [talentR1EnabledIds, talentR2EnabledIds, talentNodesById]);

  const resetForProfessionChange = (professionId: number) => {
    setTalentR1EnabledIds(initTalentR1Ids(professionId));
    setTalentR2EnabledIds(initTalentR2Ids(professionId, 0));
  };

  const resetR2ForType = (professionId: number, bdType: 0 | 1) => {
    setTalentR2EnabledIds(initTalentR2Ids(professionId, bdType));
  };

  return {
    talentR1EnabledIds,
    setTalentR1EnabledIds,
    talentR2EnabledIds,
    setTalentR2EnabledIds,
    talentNodesById,
    r1NodeCount,
    skillReplacements,
    resetForProfessionChange,
    resetR2ForType,
  };
}
