// 商品サムネ（カタログ/関連リンク）にホバーで出る操作オーバーレイ。
//   ・置換 … その写真に似た S.Model モデルを CLIP 検索（結果はパネルの「置換候補」に表示）
//   ・3D生成 … その商品画像から 3D モデルを生成し、完了後に現在の家具へ自動置換
// カード（position:relative）の中に置く。親カードの hover で表示される。

import { Box } from "@mui/material";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import { useItemReplaceStore } from "../../../store/useItemReplaceStore";
import { useItemInfoRegistryStore } from "../../../store/itemInfoRegistryStore";

export default function WalkthroughProductActions({ itemId, productImage, model, productUrl = null, projectId = null }) {
  const searchSimilar = useItemReplaceStore((s) => s.searchSimilar);
  const generateAndSwap = useItemReplaceStore((s) => s.generateAndSwap);
  const generating = useItemReplaceStore((s) => !!s.generating[String(itemId)]);

  if (!itemId || !productImage) return null;

  const onReplace = (e) => {
    e.stopPropagation();
    // 候補は「似た商品」タブに表示されるので、そのタブへ切り替える。
    useItemInfoRegistryStore.getState().setOpenTab("similar");
    searchSimilar(String(itemId), productImage, {
      mainCategory: model?.mainCategory || null,
      macroCategory: model?.macroCategory || null,
      excludeId: model?.id || null,
    });
  };
  const onGenerate = (e) => {
    e.stopPropagation();
    if (generating) return;
    // productUrl があれば商品ページから実寸を取得して反映する。
    generateAndSwap(String(itemId), productImage, projectId, productUrl);
  };

  const btn = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0.3,
    py: 0.4,
    fontSize: "0.6rem",
    fontWeight: 800,
    color: "#fff",
    cursor: "pointer",
    borderRadius: 1,
    transition: "filter 0.12s",
    "&:hover": { filter: "brightness(1.12)" },
  };

  return (
    <Box
      className="wt-prod-actions"
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: "absolute",
        left: 4,
        right: 4,
        bottom: 4,
        display: "flex",
        gap: 0.5,
        opacity: 0,
        transform: "translateY(4px)",
        transition: "opacity 0.15s, transform 0.15s",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <Box onClick={onReplace} sx={{ ...btn, background: "rgba(124,77,255,0.92)", border: "1px solid rgba(124,77,255,0.6)" }}>
        <SwapHorizRoundedIcon sx={{ fontSize: 13 }} /> 置換
      </Box>
      <Box onClick={onGenerate} sx={{ ...btn, background: generating ? "rgba(120,120,120,0.9)" : "rgba(236,64,122,0.92)", border: "1px solid rgba(236,64,122,0.6)" }}>
        <AutoFixHighRoundedIcon sx={{ fontSize: 13 }} /> {generating ? "生成中…" : "3D生成"}
      </Box>
    </Box>
  );
}
