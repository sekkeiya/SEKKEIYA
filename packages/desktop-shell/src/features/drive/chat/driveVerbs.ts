// SEKKEIYA Drive の verb 定義（Phase 4: Chat から Drive を直接読む・docs/20 方式）。
//
// 「Chat も Drive を直接データソースとして読める」（2026-07-09 合意③）を実現する読み取り verb。
//  - list_drive_assets … 種別/メディアで Drive 資産を一覧（最近作成順）
//  - search_drive       … 名前・タグ・種別のキーワードで Drive 資産を検索
//
// 実行体は driveAccess の集約プール（スコープ非依存）をそのまま使う＝各ピッカーと同じ単一ソース。
// 返す url は https 画像URLなので、そのまま edit_presentation の set_image / add_image 等へ渡せる
// （橋渡し: Drive の資産を Chat 経由で他の子アプリの成果物に流し込む）。
//
// ※ サーバー(agentTurn)側 TOOLS[] にも同名スキーマの登録＋デプロイが必要（別リポ）。
//    モデルはサーバーの TOOLS[] からしかツールを認識しないため、それが無いとこの verb は呼ばれない。
//    スキーマと手順は docs/drive_search_verbs_agentturn_draft.md 参照。
import type { VerbDef } from '../../../store/verb/verbTypes';
import { getDriveAssetsAsync, PICKER_LAYERS, type DriveMedia } from '../driveAccess';
import { assetOutputKind, type AIDriveAsset, type OutputKind } from '../../../store/useAIDriveStore';

const KIND_KEYS: OutputKind[] = [
  'model', 'layout', 'presentation', 'furniture', 'diagram',
  'render', 'video', 'portfolio', 'material', 'texture', 'article',
];
const MEDIA_KEYS: DriveMedia[] = ['image', 'model', 'video'];

/** 1資産をチャット向けにコンパクト化（トークン節約＋モデルが後続 verb で使える最小情報）。 */
function toCompact(a: AIDriveAsset): Record<string, any> {
  const out: Record<string, any> = {
    id: a.id,
    name: a.name,
    kind: assetOutputKind(a) || a.type,
    url: a.storageUrl || a.thumbnailUrl || null,
  };
  if (a.thumbnailUrl && a.thumbnailUrl !== out.url) out.thumbnailUrl = a.thumbnailUrl;
  if (a.projectId && a.projectId !== 'global') out.projectId = a.projectId;
  if (a.tags && a.tags.length) out.tags = a.tags.slice(0, 6);
  return out;
}

/** 名前・タグ・種別に対するスペース区切り AND キーワード一致。 */
function matchQuery(a: AIDriveAsset, tokens: string[]): boolean {
  const hay = `${a.name || ''} ${(a.tags || []).join(' ')} ${a.type || ''} ${assetOutputKind(a) || ''}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

const clampLimit = (v: any): number => Math.min(50, Math.max(1, Number(v) || 20));

export const driveVerbs: VerbDef[] = [
  {
    name: 'list_drive_assets',
    description:
      'SEKKEIYA Drive（ユーザーの再利用資産の保管庫）から資産を一覧する。' +
      '子アプリの成果物（3Dモデル・画像/レンダー・マテリアル・テクスチャ・レイアウト・プレゼン・記事など）が集まる場所。' +
      '種別(kind)やメディア(media)で絞り込め、最近作成順で返る。' +
      '返り値 assets[] は id / name / kind / url / thumbnailUrl / projectId / tags。' +
      'url は https 画像URLなので、edit_presentation の set_image / add_image などにそのまま渡してスライド等へ流し込める。' +
      'キーワードで探したいときは search_drive を使う。',
    input: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KIND_KEYS, description: 'アウトプット種別で絞る（任意）。' },
        media: { type: 'string', enum: MEDIA_KEYS, description: 'メディア種別で絞る（任意。kind より緩い横断フィルタ）。' },
        limit: { type: 'number', description: '最大件数（既定 20・上限 50）。' },
        projectId: { type: 'string', description: '特定プロジェクトの資産に限定（省略時は全体）。' },
      },
    },
    risk: 'low',
    label: 'SEKKEIYA Drive を確認しています…',
    handler: async (ctx) => {
      try {
        const kind = KIND_KEYS.includes(ctx.input?.kind) ? (ctx.input.kind as OutputKind) : undefined;
        const media = MEDIA_KEYS.includes(ctx.input?.media) ? (ctx.input.media as DriveMedia) : undefined;
        const limit = clampLimit(ctx.input?.limit);
        const projectId = ctx.input?.projectId ? ctx.resolveProjectId(ctx.input.projectId) : undefined;
        const assets = await getDriveAssetsAsync({
          layers: PICKER_LAYERS,
          kinds: kind ? [kind] : undefined,
          media,
          projectId,
        });
        return JSON.stringify({
          ok: true,
          count: assets.length,
          assets: assets.slice(0, limit).map(toCompact),
          truncated: assets.length > limit || undefined,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'list_drive_assets failed' });
      }
    },
  },
  {
    name: 'search_drive',
    description:
      'SEKKEIYA Drive の資産を、名前・タグ・種別のキーワードで検索する。' +
      'ユーザーが「Drive にある〇〇の画像／モデルを使って」などと言ったとき、まずこれで該当資産を見つける。' +
      'query はスペース区切りで複数語を指定でき、全て含む(AND)ものが返る。kind / media で併せて絞れる。' +
      '返り値 assets[] は id / name / kind / url / thumbnailUrl / projectId / tags（最近作成順）。' +
      'url は https 画像URLで、edit_presentation の set_image / add_image などにそのまま渡せる。',
    input: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索キーワード（名前/タグ/種別。スペース区切りは全て含む AND）。' },
        kind: { type: 'string', enum: KIND_KEYS, description: 'アウトプット種別で絞る（任意）。' },
        media: { type: 'string', enum: MEDIA_KEYS, description: 'メディア種別で絞る（任意）。' },
        limit: { type: 'number', description: '最大件数（既定 20・上限 50）。' },
        projectId: { type: 'string', description: '特定プロジェクトに限定（省略時は全体）。' },
      },
      required: ['query'],
    },
    risk: 'low',
    label: 'SEKKEIYA Drive を検索しています…',
    handler: async (ctx) => {
      try {
        const query = String(ctx.input?.query || '').trim().toLowerCase();
        if (!query) return JSON.stringify({ ok: false, error: 'query が必要です' });
        const tokens = query.split(/\s+/).filter(Boolean);
        const kind = KIND_KEYS.includes(ctx.input?.kind) ? (ctx.input.kind as OutputKind) : undefined;
        const media = MEDIA_KEYS.includes(ctx.input?.media) ? (ctx.input.media as DriveMedia) : undefined;
        const limit = clampLimit(ctx.input?.limit);
        const projectId = ctx.input?.projectId ? ctx.resolveProjectId(ctx.input.projectId) : undefined;
        const pool = await getDriveAssetsAsync({
          layers: PICKER_LAYERS,
          kinds: kind ? [kind] : undefined,
          media,
          projectId,
        });
        const hits = pool.filter((a) => matchQuery(a, tokens));
        return JSON.stringify({
          ok: true,
          query,
          count: hits.length,
          assets: hits.slice(0, limit).map(toCompact),
          truncated: hits.length > limit || undefined,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'search_drive failed' });
      }
    },
  },
];
