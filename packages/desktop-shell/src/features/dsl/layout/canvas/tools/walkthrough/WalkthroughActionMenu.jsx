import React, { useState, useRef, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

/**
 * ウォークスルー用のフローティング・メニュー（スピードダイヤル）。
 * FAB をクリックすると、登録されたアクションが「ふわっと」段差付きで展開する。
 * 将来のウォークスルー内ツール（自動レイアウト等）を `actions` に足すだけで増やせる。
 *
 * actions: Array<{
 *   key?: string;
 *   label: string;
 *   icon: ReactNode;        // ボタン左の丸アイコン
 *   onClick?: () => void;   // soon=true の場合は無効
 *   soon?: boolean;         // 「近日」バッジ付き・操作不可
 *   color?: string;         // アクセント色（既定: 青）
 * }>
 * anchor: "top-left" | "top-right" | "bottom-left" | "bottom-right"
 *   - top 系: FAB の下へ展開 / bottom 系: FAB の上へ展開
 *
 * 注: エディタ埋め込みではビューポートが画面下端を超えて伸びることがあり、
 * bottom 固定だと見切れるため既定は top-left。
 */
export default function WalkthroughActionMenu({ actions = [], anchor = "top-left" }) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const items = (actions || []).filter(Boolean);

  const openNow = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setOpen(true); };
  const closeSoon = () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); closeTimerRef.current = setTimeout(() => setOpen(false), 220); };
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  if (!items.length) return null;

  const isRight = anchor.endsWith("right");
  const isTop = anchor.startsWith("top");
  const sideAlign = isRight ? "flex-end" : "flex-start";

  const handleItemClick = (a) => {
    if (a.soon || typeof a.onClick !== "function") return;
    a.onClick();
    // 開閉はホバーで制御（クリックで閉じない＝自動マテリアル等を連続実行できる）
  };

  const ItemList = (
    <Box
      sx={{
        display: "flex",
        // top 展開は上から順（FAB 近い=先頭）、bottom 展開は下から順
        flexDirection: isTop ? "column" : "column-reverse",
        gap: 1,
        [isTop ? "mt" : "mb"]: 0.25,
        alignItems: sideAlign,
      }}
    >
      {items.map((a, i) => {
        // FAB に近い項目から出す
        const delayIndex = isTop ? i : items.length - 1 - i;
        return (
          <Box
            key={a.key || i}
            onClick={() => handleItemClick(a)}
            title={a.label}
            sx={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexDirection: isRight ? "row-reverse" : "row",
              pl: 0.6,
              pr: 1.4,
              py: 0.6,
              borderRadius: 999,
              cursor: a.soon ? "default" : "pointer",
              opacity: a.soon ? 0.6 : 1,
              color: "#fff",
              background: alpha("#0b1020", 0.9),
              border: `1px solid ${alpha(a.color || "#4f8cff", 0.5)}`,
              boxShadow: `0 6px 20px ${alpha("#000", 0.45)}`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "transform 0.12s, filter 0.15s",
              animation: `${isTop ? "wtFanInDown" : "wtFanInUp"} 0.34s cubic-bezier(0.22,1,0.36,1) both`,
              animationDelay: `${delayIndex * 45}ms`,
              "&:hover": a.soon ? {} : { filter: "brightness(1.15)", transform: isRight ? "translateX(-2px)" : "translateX(2px)" },
              "@keyframes wtFanInUp": {
                "0%": { opacity: 0, transform: "translateY(12px) scale(0.9)" },
                "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
              },
              "@keyframes wtFanInDown": {
                "0%": { opacity: 0, transform: "translateY(-12px) scale(0.9)" },
                "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
              },
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: alpha(a.color || "#4f8cff", 0.22),
                color: a.color || "#7eaaff",
                "& svg": { fontSize: 18 },
              }}
            >
              {a.icon}
            </Box>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>{a.label}</Typography>
            {a.soon && (
              <Typography
                sx={{
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  lineHeight: 1.4,
                  color: alpha("#fff", 0.75),
                  border: `1px solid ${alpha("#fff", 0.25)}`,
                  borderRadius: 999,
                  px: 0.6,
                }}
              >
                近日
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );

  const Fab = (
    <Box
      onClick={openNow}
      title={open ? "閉じる" : "メニュー"}
      sx={{
        pointerEvents: "auto",
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "#fff",
        background: open
          ? `linear-gradient(180deg, ${alpha("#33405f", 0.95)} 0%, ${alpha("#1a2540", 0.92)} 100%)`
          : `linear-gradient(180deg, ${alpha("#4f8cff", 0.95)} 0%, ${alpha("#2c5fff", 0.92)} 100%)`,
        border: `1px solid ${alpha("#7eaaff", 0.6)}`,
        boxShadow: `0 8px 24px ${alpha("#2c5fff", open ? 0.25 : 0.45)}`,
        transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), filter 0.15s, background 0.2s",
        "&:hover": { filter: "brightness(1.1)" },
        "&:active": { transform: "scale(0.94)" },
      }}
    >
      {open ? <CloseRoundedIcon sx={{ fontSize: 22 }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 20 }} />}
    </Box>
  );

  return (
    <Box
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      sx={{
        position: "absolute",
        top: isTop ? 92 : "auto",
        bottom: isTop ? "auto" : 16,
        left: isRight ? "auto" : 12,
        right: isRight ? 12 : "auto",
        zIndex: 33,
        display: "flex",
        flexDirection: "column",
        alignItems: sideAlign,
        gap: 1,
        // ホバーで開閉するため、メニュー領域はポインタを受ける（中身も pointerEvents:auto）
        pointerEvents: "auto",
      }}
    >
      {/* top 系は FAB が上・アクションが下／bottom 系は逆 */}
      {isTop ? (
        <>
          {Fab}
          {open && ItemList}
        </>
      ) : (
        <>
          {open && ItemList}
          {Fab}
        </>
      )}
    </Box>
  );
}
