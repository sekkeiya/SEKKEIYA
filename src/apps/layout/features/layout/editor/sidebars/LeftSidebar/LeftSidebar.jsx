// src/features/layout/components/LeftSidebar/LeftSidebar.jsx
import React, { useMemo } from "react";
import { Box, Divider } from "@mui/material";

import ModelLibraryPanel from "./components/ModelLibraryPanel";

/**
 * LeftSidebar（Twinmotion寄せの左ライブラリ）
 * - leftPanels が全てOFFのときは Sidebar 自体を閉じる（return null）
 * - 将来「Materials / UserLibrary / Filters」など増やしても崩れない器
 */
export default function LeftSidebar({
  // context
  uid,
  boardType,
  boardId,
  baseId,
  planId,

  // optional: 左パネルの表示ON/OFF（将来拡張用）
  leftPanels = { library: true },

  // optional: 幅を変えたい場合（LayoutShell の grid と合わせる）
  width = 300,
}) {
  const visibleSections = useMemo(() => {
    const arr = [];
    if (leftPanels?.library) arr.push("library");
    return arr;
  }, [leftPanels]);

  // ============================================================
  // ✅ CLOSED: どれも表示していないなら左サイドバー自体を閉じる
  // ============================================================
  if (visibleSections.length === 0) return null;

  return (
    <Box
      sx={{
        width,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",

        // Twinmotion-ish
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        bgcolor: "rgba(20, 20, 24, 0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      {visibleSections.map((key, i) => {
        const isLast = i === visibleSections.length - 1;

        if (key === "library") {
          return (
            <React.Fragment key={key}>
              {/* ✅ パネル本体（中でsticky header / scrollを完結） */}
              <Box sx={{ minHeight: 0, flex: "1 1 auto", overflow: "hidden" }}>
                <ModelLibraryPanel
                  uid={uid}
                  boardType={boardType}
                  boardId={boardId}
                  baseId={baseId}
                  planId={planId}
                />
              </Box>

              {!isLast && <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}
            </React.Fragment>
          );
        }

        return null;
      })}
    </Box>
  );
}
