import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, browserSessionPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyB1q5bTAaBIJb1Ug0Tqqb_hSNH7Vo2B2CY",
    authDomain: "shapeshare3d.firebaseapp.com",
    projectId: "shapeshare3d",
    storageBucket: "shapeshare3d.firebasestorage.app",
    messagingSenderId: "1064599680534",
    appId: "1:1064599680534:web:671460066e66a01e64a737",
    measurementId: "G-PG93WX1R56"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const isIosPlatform = /iPad|iPhone|iPod/.test(navigator.userAgent);

// On iOS WKWebView, IndexedDB-based persistence hangs → use inMemoryPersistence
export const auth = (() => {
  if (getApps().length > 1) return getAuth(app); // already initialized (Fast Refresh)
  try {
    if (isIosPlatform) {
      return initializeAuth(app, { persistence: inMemoryPersistence });
    }
  } catch (_) {}
  return getAuth(app);
})();

// Use persistentLocalCache on desktop only
// persistentMultipleTabManager uses BroadcastChannel which hangs on iOS WKWebView
let dbInstance;
try {
  if (isIosPlatform) {
    dbInstance = getFirestore(app);
  } else {
    dbInstance = initializeFirestore(app, {
      // ★ INTERNAL ASSERTION FAILED (ca9/b815) 対策の本丸。
      // persistentLocalCache() は IndexedDB にウォッチターゲットのキャッシュを永続化するが、
      // StrictMode の二重 effect（subscribe→unsubscribe→subscribe）や大量 onSnapshot の
      // 高速な張り替えでこの永続ターゲット状態が壊れ、WatchChangeAggregator が想定外の
      // ターゲットを受け取って assertion を投げる。いったん壊れると共有 db クライアントが
      // 汚染され、以降は getDoc など単発読み取りまで巻き添えで落ちる。
      // 永続キャッシュを捨てて memoryLocalCache() にすると壊れる状態自体が無くなり回避できる。
      // （セッション内キャッシュは維持。リロードを跨いだオフラインキャッシュのみ失う）
      localCache: memoryLocalCache(),
      ignoreUndefinedProperties: true,
      // WebView2 では WebChannel ストリーミングが不安定なことがあり、autoDetect は通信中に
      // トランスポートを切り替えて WatchChangeAggregator のターゲット状態を壊す（ca9 の一因）。
      // long polling を明示指定して transport を固定する。
      experimentalForceLongPolling: true,
    });
  }
} catch (e) {
  // Fallback to getFirestore if already initialized (e.g., during React Fast Refresh)
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export const storage = getStorage(app);
export const functions = getFunctions(app);
