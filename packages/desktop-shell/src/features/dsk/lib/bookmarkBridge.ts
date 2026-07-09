// S.Library ブックマーク・ブリッジ（フロント側）。
// Rust の受信サーバー(127.0.0.1:14207)がブラウザ拡張からの POST /add を受理すると
// `library-bookmark-received` イベントを emit する。それをここで購読し、
// 既存の知識追加パイプライン（分類→保存→スナップショット→AI補完）で「一発登録」する。
// ダイアログは出さず、完了をデスクトップ通知で知らせる（ブックマーク感覚）。
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '../../../lib/platform';
import { saveKnowledgeEntry, saveUrlSnapshot } from '../api/knowledgeApi';
import { classifyKnowledge } from './ruleClassify';
import { autoEnrichInBackground } from './autoEnrich';
import { isWeakCategory } from '../types';
import { useDskStore } from '../store/useDskStore';

/** 拡張から届くペイロード（Rust が JSON をそのまま透過 / クラウド受信箱の項目）。 */
export interface IncomingBookmark {
  url: string;
  title?: string;
  ogImage?: string;
  selection?: string;
  favicon?: string;
}

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

/** 完了/失敗をデスクトップ通知で知らせる（best-effort）。 */
function notify(title: string, body: string) {
  invoke('send_rhino_local_notification', { title, body }).catch(() => {
    // 非Windows等は静かに無視（拡張側のバッジでも成否は分かる）
  });
}

/** 受信したブックマーク1件を S.Library に一発登録する（localhost／クラウド受信箱 共通）。 */
export async function processIncomingBookmark(p: IncomingBookmark): Promise<void> {
  const url = (p.url || '').trim();
  if (!url) return;
  const title = (p.title || '').trim() || url;

  // ルールベース即時分類（タイトル＋選択テキストを材料に）。
  const r = classifyKnowledge({ fileName: title, text: p.selection || '' });
  const category = r.matched ? r.category : 'その他';
  const tags = r.matched ? r.tags : [];

  const localId = uuid();
  try {
    const entry = await saveKnowledgeEntry({
      localId,
      kind: 'url',
      title,
      category,
      author: null,
      tags,
      sourceUrl: url,
    });
    useDskStore.getState().upsert(entry);

    // HTML スナップショットを保存（best-effort）→ 反映のため再読込。
    try {
      await saveUrlSnapshot(localId, url);
      await useDskStore.getState().refresh();
    } catch (e) {
      console.warn('[bookmarkBridge] snapshot failed (best-effort)', e);
    }

    // ルールで分類しきれなかったものだけ、AI 後段で補完（fire-and-forget・未デプロイ時は無視）。
    if (isWeakCategory(category)) {
      void autoEnrichInBackground(entry);
    }

    notify('S.Library に追加しました', title);
  } catch (e: any) {
    console.error('[bookmarkBridge] save failed', e);
    notify('S.Library 追加に失敗しました', String(e?.message ?? e));
  }
}

/**
 * ブックマーク・ブリッジを起動する。App でマウント時に1度だけ呼び、
 * 返り値の関数でアンサブスクライブする。Web/非Tauri では何もしない。
 */
export async function installBookmarkBridge(): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  try {
    return await listen<IncomingBookmark>('library-bookmark-received', (event) => {
      void processIncomingBookmark(event.payload);
    });
  } catch (e) {
    console.warn('[bookmarkBridge] listen setup failed', e);
    return () => {};
  }
}
