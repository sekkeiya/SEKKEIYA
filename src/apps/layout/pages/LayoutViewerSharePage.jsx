// src/features/layout/pages/LayoutViewerSharePage.jsx
import React from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { fetchLayoutShare } from "@layout/features/layout/utils/layoutShareUtils";

// 既にある Viewer Shell / hooks を使う想定
import LayoutViewerShell from "@layout/features/layout/viewer/LayoutViewerShell.jsx";
import { useViewerSceneState } from "@layout/features/layout/viewer/hooks/useViewerSceneState.js";

/**
 * catalog から選択中 base/plan/option を解決する
 */
function resolveSelectionFromCatalog({ catalogBases, selected }) {
  const baseId = selected?.baseId || "";
  const planId = selected?.planId || "";
  const optionId = selected?.optionId || "";

  const base =
    catalogBases.find((b) => b?.id === baseId) ||
    catalogBases.find((b) => !!b?.glbUrl) ||
    null;

  const plans = Array.isArray(base?.plans) ? base.plans : [];
  const plan = plans.find((p) => p?.id === planId) || plans[0] || null;

  const options = Array.isArray(plan?.options) ? plan.options : [];
  const option = options.find((o) => o?.id === optionId) || options[0] || null;

  return {
    baseId: base?.id || null,
    planId: plan?.id || null,
    optionId: option?.id || null,
    base,
    plan,
    option,
  };
}

export default function LayoutViewerSharePage() {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();

  const [share, setShare] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // scene state（左ツリー選択 / 右インスペクタなど）
  const scene = useViewerSceneState({
    initial: {
      baseId: null,
      planId: null,
      optionId: null,
    },
  });

  // 共有ドキュメント取得
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchLayoutShare(shareId);
        if (!mounted) return;
        setShare(data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [shareId]);

  // catalog bases
  const catalogBases = React.useMemo(() => {
    const bases = share?.catalog?.bases;
    return Array.isArray(bases) ? bases : [];
  }, [share]);

  /**
   * ✅ 初期選択
   * - URL query の base/plan/option があれば優先
   * - なければ share.source の base/plan/option
   * - catalog が入ってきた時点で 1回だけ寄せる
   */
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!share) return;
    if (didInitRef.current) return;

    const qpBase = searchParams.get("base") || "";
    const qpPlan = searchParams.get("plan") || "";
    const qpOption = searchParams.get("option") || "";

    const next = {
      baseId: qpBase || share?.source?.baseId || null,
      planId: qpPlan || share?.source?.planId || null,
      optionId: qpOption || share?.source?.optionId || null,
    };

    // catalog で解決できる形に正規化（存在しないIDなら先頭へフォールバック）
    const resolved = resolveSelectionFromCatalog({
      catalogBases,
      selected: next,
    });

    scene.setSelection?.({
      baseId: resolved.baseId,
      planId: resolved.planId,
      optionId: resolved.optionId,
    });

    didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, !!share, catalogBases.length]);

  /**
   * ✅ 選択に応じて描画データを catalog から導出
   */
  const resolved = React.useMemo(() => {
    return resolveSelectionFromCatalog({
      catalogBases,
      selected: scene?.selected || {},
    });
  }, [catalogBases, scene?.selected]);

  // ViewerShell が欲しがる props
  const boardId = share?.source?.boardId || share?.boardId || "";
  const boardType = share?.source?.boardType || share?.boardType || "my";
  const ownerUid = share?.ownerUid || share?.source?.ownerUid || "";

  // ✅ Canvas に渡す：選択中 base の glbUrl
  const baseGlbUrlResolved = resolved?.base?.glbUrl || "";

  // ✅ Canvas に渡す：選択中 option の layout
  const optionLayout = resolved?.option?.layout || { items: [] };

  const board = React.useMemo(
    () => ({
      name: share?.snapshot?.boardName
        ? `${share.snapshot.boardName} (Shared)`
        : `Shared Layout (${shareId})`,
    }),
    [share, shareId]
  );

  const viewerConfig = share?.viewerConfig || {};

  return (
    <LayoutViewerShell
      // ✅ LinkCopy が「1案URL」を作れるように渡す
      shareId={shareId}
      boardId={boardId}
      boardType={boardType}
      ownerUid={ownerUid}
      board={board}
      bases={catalogBases}
      plansByBase={{}} // 互換
      viewerConfig={viewerConfig}
      scene={scene}
      baseGlbUrlResolved={baseGlbUrlResolved}
      optionDoc={{ layout: optionLayout }}
      optionDocLoading={loading}
    />
  );
}
