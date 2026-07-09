// useWalkthroughCharacters.js
//
// S.Model（assets コレクション）に登録された「キャラクター」カテゴリのモデルを
// ウォークスルー用の記述子へ正規化して返す。公開モデル + 自分のプロジェクトモデルを統合。

import { useMemo } from "react";
import { usePublicModels } from "../../../hooks/usePublicModels";
import { useProjectDssModels } from "../../../hooks/useProjectDssModels";
import { modelDescriptor } from "./walkthroughCharacters";

const CHARACTER_MACRO = "キャラクター";

function isCharacter(asset) {
  const hay = [
    asset?.macroCategory,
    asset?.mainCategory,
    asset?.category,
    asset?.raw?.macroCategory,
    asset?.raw?.category,
    asset?.extendedMetadata?.macroCategory,
  ]
    .filter(Boolean)
    .join(" ");
  return hay.includes(CHARACTER_MACRO) || hay.toLowerCase().includes("character");
}

export function useWalkthroughCharacters({ enabled = true } = {}) {
  const { models: publicModels, loading: loadingPublic } = usePublicModels({ enabled, limit: 120 });
  const { models: projectModels, loading: loadingProject } = useProjectDssModels({ enabled, limit: 240 });

  const characters = useMemo(() => {
    const byId = new Map();
    [...(projectModels || []), ...(publicModels || [])].forEach((m) => {
      if (!m || byId.has(m.id)) return;
      if (!isCharacter(m)) return;
      const desc = modelDescriptor(m);
      if (!desc.glbUrl) return; // GLB が解決できないものは除外
      byId.set(m.id, desc);
    });
    return Array.from(byId.values());
  }, [publicModels, projectModels]);

  return { characters, loading: loadingPublic || loadingProject };
}
