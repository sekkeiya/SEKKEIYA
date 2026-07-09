// src/features/dsl/layout/viewer/PublicPresentationShare.jsx
//
// 公開ルート /layout/share/:shareId 用の「本番プレビュー」ビューワ。
// 認証ゲートの外側でマウントされる前提（未ログインでも閲覧可）。
// viewerShares/{shareId} を読み、snapshot から PresentationViewer を起動する。
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, CircularProgress } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";
import PresentationViewer from "../presentation/PresentationViewer.jsx";

function FullscreenMessage({ children, spinner }) {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "radial-gradient(120% 120% at 50% 0%, #10151f 0%, #060810 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      {spinner ? <CircularProgress size={28} sx={{ color: "#34d399" }} /> : null}
      <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>{children}</Typography>
    </Box>
  );
}

export default function PublicPresentationShare() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    (async () => {
      if (!shareId) {
        setError("共有IDがありません");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "viewerShares", shareId));
        if (!alive) return;
        if (!snap.exists()) {
          setError("この共有リンクは存在しないか、削除されています");
          return;
        }
        const d = snap.data() || {};
        if (d.visibility === "private") {
          setError("この共有は非公開です");
          return;
        }
        setData(d);
      } catch (e) {
        if (!alive) return;
        setError("読み込みに失敗しました");
      }
    })();
    return () => {
      alive = false;
    };
  }, [shareId]);

  if (error) return <FullscreenMessage>{error}</FullscreenMessage>;
  if (!data) return <FullscreenMessage spinner>読み込み中…</FullscreenMessage>;

  const snapshot = data.snapshot || {};
  const pres = data.viewerConfig?.presentation || {};
  const baseGlbUrl = pres.baseGlbUrl || snapshot.baseGlbUrl || "";
  const roomSpec = pres.roomSpec || snapshot.roomSpec || null;
  const layout = snapshot.layout || null;
  const title = snapshot.boardName || snapshot.baseName || "Layout";

  return (
    <PresentationViewer
      open
      onClose={() => {
        // 公開ビューワでは閉じる先が無いので、ウィンドウを閉じられる場合のみ閉じる。
        try {
          window.close();
        } catch {}
      }}
      baseGlbUrl={baseGlbUrl}
      roomSpec={roomSpec}
      layout={layout}
      title={title}
    />
  );
}
