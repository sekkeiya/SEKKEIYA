// S.Library の「棚」自動分類。
// 知識(RAG向き)＝読んで回答の根拠にする散文 / 商品(索引化向き)＝家具・素材のEC/カタログ。
// RAG選択では知識のみを対象にし、商品ソースは「サイトを商品索引化」(商品インデックス)へ誘導する。
import type { LibraryEntry } from '../types';

export type Shelf = 'knowledge' | 'product';

/** 商品ソースとみなす S.Library カテゴリ（sourceRegistry の furniture/texture/material 由来）。 */
const PRODUCT_CATEGORIES = new Set<string>(['家具・什器', '素材・建材']);

/** 商品ソースを示唆する語（カテゴリが未整備でも拾えるよう補助。タグ・タイトルを走査）。 */
const PRODUCT_RE = /家具|テクスチャ|マテリアル|素材|建材|什器|インテリア|ソファ|チェア|椅子|テーブル|デスク|収納|照明|ライト|ベッド|ラグ|カーペット|カーテン|タイル|フローリング|通販|EC/;

/** 既知の家具・素材EC/カタログのサイト名（その他カテゴリでも商品扱いにする補助）。 */
const PRODUCT_SITE_RE = /flymee|low-?ya|actus|unico|idee|idée|karimoku|cassina|polyhaven|poly\s*haven|sharetextures|textures\.com|ambientcg|cgbookcase/i;

/** エントリを知識/商品のどちらの棚に置くか自動判定する。 */
export function classifyShelf(e: LibraryEntry): Shelf {
  // 文書（書籍/PDF/メモ）は常に知識。
  if (e.kind === 'book' || e.kind === 'pdf' || e.kind === 'note') return 'knowledge';
  // カテゴリが商品系。
  if (PRODUCT_CATEGORIES.has(e.category || '')) return 'product';
  // タグ or タイトルが商品系。
  const text = `${e.title || ''} ${(e.tags || []).join(' ')}`;
  if (PRODUCT_RE.test(text)) return 'product';
  // 既知の家具・素材ECサイト（URL/タイトル）。
  if (PRODUCT_SITE_RE.test(`${e.sourceUrl || ''} ${e.title || ''}`)) return 'product';
  // それ以外（法規/構造/意匠/設備/環境/積算/その他 の url 等）は知識扱い。
  return 'knowledge';
}

/** RAG（外付け脳）に取り込み可能か：知識の棚で、かつ本文 or URL を持つ。 */
export function canIngestRag(e: LibraryEntry): boolean {
  if (classifyShelf(e) !== 'knowledge') return false;
  return (
    e.kind === 'book' || e.kind === 'pdf' || e.kind === 'note' ||
    !!e.filePath || (e.kind === 'url' && !!e.sourceUrl)
  );
}
