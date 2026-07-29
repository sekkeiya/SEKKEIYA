#!/usr/bin/env node
// ============================================================================
// modelSets: companionModelIds バックフィル（2026-07-29）
//
// 背景: S.Model 詳細画面「セクション3 セット家具」（Task 10, sekkeiya-desktop
// src/features/dss/components/detail/sections/SetSection.tsx）は、あるモデルを
// 含む modelSets を `where('companionModelIds', 'array-contains', <modelId>)` で
// 引く。companionModelIds は companionModels（{id,title,thumbnailUrl}[]）の id を
// フラット化した配列で、SetFurnitureEditor.tsx の保存処理には今回から書き込まれる
// ようになったが、それより前に保存された既存の modelSets ドキュメントには存在しない。
// このスクリプトは、companionModelIds が無い（または companionModels と食い違う）
// 既存ドキュメントへ、companionModels[].id から導出した配列を補完する。
//
// 冪等: 既に companionModelIds が companionModels[].id の集合と一致していれば
// スキップする（何度実行しても安全）。
//
// 使い方:
//   node scripts/2026-07-29_backfill_companion_model_ids.mjs            # dry-run（表示のみ・書き込みなし）
//   node scripts/2026-07-29_backfill_companion_model_ids.mjs --apply    # 実際に merge 書き込み
//   node scripts/2026-07-29_backfill_companion_model_ids.mjs --smoke    # 接続確認のみ（1件読んで終了）
//
// 認証: tools/devbacklog-mcp/server.mjs と同じ接続パターン（サービスアカウント鍵はパス参照のみ）。
//   既定 = sekkeiya/serviceAccountKey.json（.gitignore 済 / project: shapeshare3d）
//   上書き = 環境変数 GOOGLE_APPLICATION_CREDENTIALS
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Firestore 初期化（tools/devbacklog-mcp/server.mjs L28-48 と同じパターン） ──────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.resolve(__dirname, '../serviceAccountKey.json'); // sekkeiya/serviceAccountKey.json
if (!fs.existsSync(keyPath)) {
  console.error(`[backfill_companion_model_ids] service account key not found at: ${keyPath}\n` +
    `Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json at sekkeiya/.`);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── CLI フラグ ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isSmoke = args.includes('--smoke');

/** companionModels[].id から companionModelIds を導出（重複除去・順序保持）。 */
function deriveCompanionModelIds(companionModels) {
  if (!Array.isArray(companionModels)) return null;
  const seen = new Set();
  const ids = [];
  for (const cm of companionModels) {
    const id = cm && typeof cm.id === 'string' ? cm.id : null;
    if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return ids;
}

/** 2つの配列が同じ要素集合か（順序無視）。既に正しければ書き込みをスキップするための冪等チェック。 */
function sameIdSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

async function main() {
  console.log(`\n[backfill_companion_model_ids] mode=${isApply ? 'APPLY（書き込みあり）' : 'DRY-RUN（表示のみ）'}`);
  console.log('==========================================================');

  const snap = await db.collection('modelSets').get();
  console.log(`modelSets 総数: ${snap.size}`);

  if (isSmoke) {
    console.log('[--smoke] 接続確認のみ。最初の1件:');
    const first = snap.docs[0];
    if (first) console.log(`  ${first.id}: title=${first.data().title ?? '(no title)'}`);
    return;
  }

  let toUpdate = 0;
  let alreadyOk = 0;
  let skippedNoCompanions = 0;
  const skippedIds = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const derived = deriveCompanionModelIds(data.companionModels);

    if (derived === null || derived.length === 0) {
      // companionModels フィールドが無い、または空 = 導出元データが無い旧/壊れたドキュメント。
      // 書き込まず、対象外としてログに残す（ユーザーが個別に確認できるように）。
      skippedNoCompanions++;
      skippedIds.push(doc.id);
      continue;
    }

    if (sameIdSet(data.companionModelIds, derived)) {
      alreadyOk++;
      continue;
    }

    toUpdate++;
    const title = data.title ?? '(no title)';
    console.log(`  [${isApply ? 'APPLY' : 'DRY-RUN'}] ${doc.id} "${title}": ` +
      `companionModelIds ${JSON.stringify(data.companionModelIds ?? null)} → ${JSON.stringify(derived)}`);

    if (isApply) {
      await doc.ref.set({ companionModelIds: derived }, { merge: true });
    }
  }

  console.log('==========================================================');
  console.log(`更新${isApply ? '済み' : '対象'}: ${toUpdate} 件`);
  console.log(`既に正しい: ${alreadyOk} 件`);
  console.log(`対象外（companionModels 無し/空）: ${skippedNoCompanions} 件`);
  if (skippedIds.length > 0) {
    console.log(`  対象外 ID: ${skippedIds.join(', ')}`);
  }
  if (!isApply && toUpdate > 0) {
    console.log('\n--apply を付けずに再実行すると内容の確認のみ行われます。書き込むには --apply を付けてください。');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[backfill_companion_model_ids] failed:', e);
    process.exit(1);
  });
