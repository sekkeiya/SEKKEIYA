// 統合後: メインsekkeiyaアプリのFirebaseインスタンスを再利用する
// 自前の initializeApp / connectFirestoreEmulator は廃止（重複初期化を回避）
import * as firestore from "firebase/firestore";

export { auth, db, storage, functions } from "@/shared/config/firebase";

// 開発時のブラウザコンソール用に公開（旧config.jsと同等の機能）
if (typeof window !== "undefined" && import.meta.env.DEV && !window.__PID_LOGGED__) {
  import("@/shared/config/firebase").then(({ auth, db }) => {
    window.__auth = auth;
    window.__db = db;
    window.__fs = firestore;
    window.__PID_LOGGED__ = true;
  });
}
