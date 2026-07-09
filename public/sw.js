/**
 * sw.js — 最小 Service Worker
 *
 * 目的: PWA を「インストール可能」にして beforeinstallprompt を発火させること **のみ**。
 *   （= ランディングの「アプリとして開きますか？」ダイアログを復活させる）
 *
 * 設計方針:
 *   - HTML / アセットを **一切キャッシュしない**。過去の「白画面キャッシュ問題」を再発させない。
 *   - install で skipWaiting、activate で旧キャッシュ全削除 + clients.claim。
 *     → 古い壊れた SW が残っているユーザーも、これに置き換わった瞬間に正常化する。
 *   - fetch ハンドラを持つこと自体が Chrome の「インストール可能」条件。
 *     ナビゲーションのみネットワーク透過にして条件を満たす（キャッシュはしない）。
 */

self.addEventListener("install", () => {
  // 新しい SW を待機させず即時有効化
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 旧 SW が残したキャッシュを全削除（白画面レガシー対策）
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        /* noop */
      }
      // 既存タブも即座に制御下に置く
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // ナビゲーション要求のみネットワーク透過（キャッシュしない）。
  // これにより「fetch ハンドラあり」= インストール可能条件を満たす。
  // それ以外のリクエストはブラウザ既定に委ねる（respondWith しない）。
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
