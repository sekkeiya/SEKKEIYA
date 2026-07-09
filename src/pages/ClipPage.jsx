// /clip — S.Library ブックマーク受信ページ。
// ブラウザ拡張がポップアップで `/clip?url=...&title=...` を開く。既存のログイン
// セッションを使って Firestore の bookmarkInbox に1件 create し、Desktop アプリが
// それをローカル S.Library に回収する（ハイブリッド方式の入口）。
// 登録できたら短い確認を出して自動で window.close()（拡張が開いたポップアップ前提）。
import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/shared/config/firebase";

const ACCENT = "#26a69a";

function readParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    url: (q.get("url") || "").trim(),
    title: (q.get("title") || "").trim(),
    ogImage: (q.get("ogImage") || "").trim(),
    selection: (q.get("selection") || "").trim(),
    favicon: (q.get("favicon") || "").trim(),
  };
}

export default function ClipPage() {
  const params = useRef(readParams());
  // 'init' | 'need-login' | 'saving' | 'done' | 'error'
  const [phase, setPhase] = useState("init");
  const [message, setMessage] = useState("");
  const savedRef = useRef(false);

  const save = async (uid) => {
    if (savedRef.current) return;
    savedRef.current = true;
    const p = params.current;
    if (!/^https?:/i.test(p.url)) {
      setPhase("error");
      setMessage("登録できる URL がありません。");
      return;
    }
    setPhase("saving");
    try {
      await addDoc(collection(db, "bookmarkInbox"), {
        ownerId: uid,
        url: p.url,
        title: p.title || p.url,
        ogImage: p.ogImage || "",
        selection: p.selection ? p.selection.slice(0, 2000) : "",
        favicon: p.favicon || "",
        status: "pending",
        source: "extension-web",
        createdAt: serverTimestamp(),
      });
      setPhase("done");
      setMessage(p.title || p.url);
      // 拡張が開いたポップアップなら自動で閉じる（通常タブでは閉じないこともある）。
      setTimeout(() => { try { window.close(); } catch { /* 通常タブでは閉じない */ } }, 1200);
    } catch (e) {
      console.error("[ClipPage] save failed", e);
      savedRef.current = false;
      setPhase("error");
      setMessage(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        save(u.uid);
      } else {
        setPhase("need-login");
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      setPhase("init");
      await signInWithPopup(auth, new GoogleAuthProvider());
      // 成功すると onAuthStateChanged が発火して save() が走る。
    } catch {
      setPhase("need-login");
      setMessage("ログインに失敗しました。");
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brand}>SEKKEIYA · S.Library</div>

        {phase === "init" && <div style={styles.muted}>準備しています…</div>}

        {phase === "saving" && <div style={styles.muted}>S.Library に追加しています…</div>}

        {phase === "done" && (
          <>
            <div style={styles.check}>✓</div>
            <div style={styles.title}>S.Library に追加しました</div>
            <div style={styles.sub} title={message}>{message}</div>
            <div style={styles.hint}>このタブは自動で閉じます。Desktop アプリ起動時にローカルへ取り込まれます。</div>
          </>
        )}

        {phase === "need-login" && (
          <>
            <div style={styles.title}>ログインが必要です</div>
            <div style={styles.sub}>SEKKEIYA にログインすると、見ているページを S.Library に保存できます。</div>
            <button style={styles.btn} onClick={handleLogin}>Google でログインして追加</button>
          </>
        )}

        {phase === "error" && (
          <>
            <div style={styles.title}>追加できませんでした</div>
            <div style={styles.sub}>{message}</div>
            <button style={styles.btnGhost} onClick={() => { savedRef.current = false; save(auth.currentUser?.uid); }}>
              再試行
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1212", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 24 },
  card: { width: "100%", maxWidth: 420, background: "#161a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "28px 24px", textAlign: "center" },
  brand: { fontSize: 12, letterSpacing: 1, color: ACCENT, marginBottom: 16, fontWeight: 700 },
  check: { fontSize: 44, color: ACCENT, lineHeight: 1, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  hint: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
  muted: { fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "12px 0" },
  btn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" },
};
