// src/style/RightSidebar/RightSidebarStyles.js
export const rightSidebarWidth = 320;

export const rightSidebarStyles = {
    // DrawerのPaperに当てる
    paper: {
        width: rightSidebarWidth,
        // 以前より明るいチャコール + 上部に白グローを追加
        background:
            "radial-gradient(800px 320px at 20% -120px, rgba(255,255,255,0.08) 0%, transparent 80%)," +
            "linear-gradient(180deg, rgba(20,24,32,0.65) 0%, rgba(20,24,32,0.55) 60%, rgba(20,24,32,0.45) 100%)",
        color: "#E2E8F0", // Slightly cooler/softer silver typography
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        height: "100vh",
        marginTop: 0,
        boxShadow:
            "inset 1px 0 0 rgba(255,255,255,0.06), -8px 0 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(24px)", // Deep glass blur
    },

    // mini-variantの閉じた状態（中央寄せ。最上部にしたい時は justifyContent を 'flex-start' に）
    mini: {
        width: 64,
        height: "100%",
        marginTop: 0, // ヘッダー分離に伴い 100vh 化
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center", // ← 上部にしたいなら "flex-start"
        gap: 16,
        paddingTop: 8,
    },

    typography: {
        color: "#E6EDF3",
        display: "flex",
        alignItems: "center",
        gap: 1,
        fontWeight: 600,
        fontSize: "0.9rem",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        pb: 1,
        mb: 2,
    },

    // モバイル用トグルボタン
    fab: {
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1300,
        boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
    },
};
