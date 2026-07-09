import { useState, useEffect } from "react";

/**
 * 認証系フック（Firebase SDK非依存）
 * SEKKEIYA 側 (AuthProvider) が localStorage に書き込む "sekkeiya_auth_state" をリアルタイムで購読する
 */
export function useSharedAuthState() {
  const [isAuthed, setIsAuthed] = useState(
    () => localStorage.getItem("sekkeiya_auth_state") === "1"
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初回マウント時に最新チェック
    setIsAuthed(localStorage.getItem("sekkeiya_auth_state") === "1");
    setIsLoading(false);

    // 他タブ等でのログイン/ログアウトを検知して同期
    const handleStorageChange = (e) => {
      if (e.key === "sekkeiya_auth_state") {
        setIsAuthed(e.newValue === "1");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { isAuthed, isLoading };
}
