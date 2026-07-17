// Research & Memo マインドマップの verb 定義（docs/20 方式）。
// マインドマップは Research & Memo の既定の思考面。AI が対話しながら言語化した内容を
// トピックとして生やし（親子=構造化）、横断的な気づきは関係線で結ぶ。
// handler は mindmapBridge に委譲（マインドマップ表示中はライブ反映、非表示時はヘッドレス）。

import type { VerbDef } from '../../../store/verb/verbTypes';

/** モデルに返す前にテキストを丸める（全景の取得でトークンを浪費しない）。 */
function trim(text: string | undefined, max = 200): string | undefined {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const mindmapVerbs: VerbDef[] = [
  {
    name: 'mindmap_get',
    description:
      'Research & Memo のマインドマップ（既定の思考面）の現在のトピック一覧を取得する。' +
      'トピックを足す前・整理する前に必ず呼んで現状を把握すること。' +
      '返り値: topics[]（id / parentId: null=中心トピック / text / note=補足メモ / link / refTitle=出典 / hasImage / collapsed）と ' +
      'relations[]（id / source→target / text: 木構造とは別の横断関係の注釈矢印）と summaries[]（id / nodeIds / text: 兄弟をくくる波括弧の要約）。' +
      '木構造そのものが思考の構造（親=上位の論点・子=それを支える具体）。' +
      '深い階層のトピックは collapsed の中に隠れていることがある（レイアウト上は非表示でもデータには全部入っている）。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
      },
    },
    risk: 'low',
    label: 'マインドマップを確認しています…',
    handler: async (ctx) => {
      const { getActiveMindMapBoardId } = await import('./mindmapBridge');
      const boardKey = getActiveMindMapBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!boardKey) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      try {
        const { getMindMapState } = await import('./mindmapBridge');
        const { nodes, relations, summaries } = await getMindMapState(boardKey);
        return JSON.stringify({
          ok: true,
          count: nodes.length,
          topics: nodes.map(n => ({
            id: n.id, parentId: n.parentId,
            text: trim(n.text),
            note: trim(n.note, 120),
            link: n.link,
            refType: n.refType, refId: n.refId, refTitle: n.refTitle,
            hasImage: n.image ? true : undefined,
            collapsed: n.collapsed || undefined,
          })),
          relations: relations.map(r => ({ id: r.id, source: r.source, target: r.target, text: trim(r.text, 120) })),
          summaries: summaries.map(s => ({ id: s.id, nodeIds: s.nodeIds, text: trim(s.text, 120) })),
        });
      } catch (e) {
        return JSON.stringify({ ok: false, error: (e instanceof Error && e.message) || 'mindmap_get failed' });
      }
    },
  },

  {
    name: 'mindmap_add_topics',
    description:
      'マインドマップにトピックを複数まとめて生やす（必要なら関係線も同時に張れる）。' +
      '対話で言語化した論点・気づき・選択肢をトピック化していくのが基本動作。' +
      'parent に既存トピックの id を渡すとその子に、"#0" 形式（topics 配列の添字）で今回追加分の子にでき、1回の呼び出しで部分木を組める。parent 省略は中心トピック直下。' +
      '長い補足は text に詰めず note に入れる（トピックは短い見出し、note が本文）。' +
      'S.Library/S.Blog 由来の内容は refType/refId/refTitle を付けて出典に遡れる状態を保つこと。' +
      'image には https の実URL（blog_get の coverUrl 等）を使う（data: URL は不可）。' +
      'relations の source/target には既存トピック id または "#N" を使える。' +
      '置いたら一言で報告し、対話を続けること（マップが成果物、チャットは対話）。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        topics: {
          type: 'array',
          description: '生やすトピックの配列。',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'トピック名（短い見出し。長文は note へ）。' },
              parent: { type: 'string', description: '親トピックの id、または "#N"（topics 配列の添字）。省略時は中心トピック直下。' },
              note: { type: 'string', description: '補足メモ（根拠・背景・詳細）。' },
              link: { type: 'string', description: '関連 URL。' },
              image: { type: 'string', description: 'トピックに載せる画像の https URL。' },
              refType: { type: 'string', enum: ['library', 'article'], description: '出典種別（library=S.Library / article=S.Blog）。' },
              refId: { type: 'string', description: '出典 ID（library: localId / article: 記事ID）。' },
              refTitle: { type: 'string', description: '出典タイトル。' },
            },
            required: ['text'],
          },
        },
        relations: {
          type: 'array',
          description: '同時に張る関係線（省略可）。木の親子とは別の横断関係。',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: '始点トピック。既存 id または "#N"。' },
              target: { type: 'string', description: '終点トピック。既存 id または "#N"。' },
              text: { type: 'string', description: '関係の一言（例: トレードオフ / 同じ根拠）。' },
            },
            required: ['source', 'target'],
          },
        },
      },
      required: ['topics'],
    },
    risk: 'low',
    label: 'マインドマップにトピックを生やしています…',
    handler: async (ctx) => {
      const { getActiveMindMapBoardId } = await import('./mindmapBridge');
      const boardKey = getActiveMindMapBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!boardKey) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const raw: Array<Record<string, unknown>> = Array.isArray(ctx.input.topics) ? ctx.input.topics : [];
      if (raw.length === 0) return JSON.stringify({ ok: false, error: 'topics が空です' });

      const errors: string[] = [];
      const partials = raw.flatMap((t, idx: number) => {
        const text = typeof t?.text === 'string' ? t.text.trim() : '';
        if (!text) { errors.push(`topics[${idx}]: text が必要です`); return []; }
        if (typeof t.image === 'string' && /^data:/i.test(t.image)) {
          errors.push(`topics[${idx}]: data: URL は使えません。https の実URLを使ってください`);
          return [];
        }
        return [{
          text,
          parent: typeof t.parent === 'string' && t.parent ? t.parent : undefined,
          note: typeof t.note === 'string' && t.note.trim() ? t.note.trim() : undefined,
          link: typeof t.link === 'string' && t.link ? t.link : undefined,
          image: typeof t.image === 'string' && t.image ? t.image : undefined,
          refType: t.refType === 'library' || t.refType === 'article' ? (t.refType as 'library' | 'article') : undefined,
          refId: typeof t.refId === 'string' ? t.refId : undefined,
          refTitle: typeof t.refTitle === 'string' ? t.refTitle : undefined,
        }];
      });
      if (partials.length === 0) return JSON.stringify({ ok: false, error: errors.join(' / ') || 'topics が不正です' });

      try {
        const { addMindTopics, addMindRelations } = await import('./mindmapBridge');
        const res = await addMindTopics(boardKey, partials);
        errors.push(...res.skipped);

        // 関係線の "#N" 参照を解決して張る。addMindTopics は不正な topics を飛ばすため、
        // 添字→id は「元の添字」で引く必要がある。partials は raw と添字がずれ得るので、
        // created の並び（root 自動作成分を除く）と partials の並びが一致することを利用する。
        let connected: Array<{ id: string; source: string; target: string }> = [];
        const rawRels: Array<Record<string, unknown>> = Array.isArray(ctx.input.relations) ? ctx.input.relations : [];
        if (rawRels.length > 0) {
          const createdTopics = res.created.filter(c => c.id !== res.createdRootId);
          // raw 添字 → created の対応（validation を通った raw だけが partials に入っている）
          const rawIdxToId = new Map<number, string>();
          let ci = 0;
          raw.forEach((t, idx: number) => {
            const text = typeof t?.text === 'string' ? t.text.trim() : '';
            const badImage = typeof t?.image === 'string' && /^data:/i.test(t.image);
            if (!text || badImage) return; // partials から弾かれた分
            const c = createdTopics[ci++];
            if (c) rawIdxToId.set(idx, c.id);
          });
          const resolveRef = (ref: unknown): string | null => {
            const s = String(ref ?? '');
            const m = s.match(/^#(\d+)$/);
            if (m) return rawIdxToId.get(Number(m[1])) ?? null;
            return s || null;
          };
          const relPartials = rawRels.flatMap((r, i: number) => {
            const source = resolveRef(r?.source);
            const target = resolveRef(r?.target);
            if (!source || !target) { errors.push(`relations[${i}]: source/target を解決できません（"#N" は topics の添字）`); return []; }
            return [{ source, target, text: typeof r.text === 'string' ? r.text : undefined }];
          });
          if (relPartials.length > 0) {
            const relRes = await addMindRelations(boardKey, relPartials);
            connected = relRes.created.map(r => ({ id: r.id, source: r.source, target: r.target }));
            errors.push(...relRes.skipped);
          }
        }

        return JSON.stringify({
          ok: true,
          added: res.created.map(c => ({ id: c.id, parentId: c.parentId, text: trim(c.text, 80) })),
          connected: connected.length ? connected : undefined,
          skipped: errors.length ? errors : undefined,
        });
      } catch (e) {
        return JSON.stringify({ ok: false, error: (e instanceof Error && e.message) || 'mindmap_add_topics failed' });
      }
    },
  },

  {
    name: 'mindmap_update_topic',
    description:
      'マインドマップの既存トピック1つを更新する（見出しの推敲・note の追記・リンク付与・親の付け替え=構造の整理）。' +
      'id は mindmap_get で取得する。ユーザーが書いたトピックの text を書き換えるときは事前に合意を取ること。' +
      'parent を渡すとそのトピックの子へ移動する（部分木ごと・末尾に付く）。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        id: { type: 'string', description: '対象トピックの ID。' },
        text: { type: 'string', description: '新しいトピック名。' },
        note: { type: 'string', description: '新しい補足メモ（空文字で削除）。' },
        link: { type: 'string', description: '新しいリンク（空文字で削除）。' },
        parent: { type: 'string', description: '移動先の親トピック ID。' },
        collapsed: { type: 'boolean', description: '枝の折りたたみ状態。' },
      },
      required: ['id'],
    },
    risk: 'low',
    label: 'トピックを更新しています…',
    handler: async (ctx) => {
      const { getActiveMindMapBoardId } = await import('./mindmapBridge');
      const boardKey = getActiveMindMapBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!boardKey) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const id = String(ctx.input.id || '');
      if (!id) return JSON.stringify({ ok: false, error: 'id が必要です' });

      try {
        const { getMindMapState, updateMindTopic } = await import('./mindmapBridge');
        const patch: Record<string, unknown> = {};
        if (typeof ctx.input.text === 'string' && ctx.input.text.trim()) patch.text = ctx.input.text.trim();
        if (typeof ctx.input.note === 'string') patch.note = ctx.input.note.trim() || undefined;
        if (typeof ctx.input.link === 'string') patch.link = ctx.input.link.trim() || undefined;
        if (typeof ctx.input.collapsed === 'boolean') patch.collapsed = ctx.input.collapsed || undefined;

        if (typeof ctx.input.parent === 'string' && ctx.input.parent) {
          const { nodes } = await getMindMapState(boardKey);
          const target = nodes.find(n => n.id === id);
          const parent = nodes.find(n => n.id === ctx.input.parent);
          if (!target) return JSON.stringify({ ok: false, error: '対象トピックが見つかりません' });
          if (target.parentId == null) return JSON.stringify({ ok: false, error: '中心トピックは移動できません' });
          if (!parent) return JSON.stringify({ ok: false, error: '移動先の親トピックが見つかりません' });
          // 自分の部分木の中へは移動できない（木が壊れる）
          const sub = new Set([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const n of nodes) {
              if (n.parentId != null && sub.has(n.parentId) && !sub.has(n.id)) { sub.add(n.id); grew = true; }
            }
          }
          if (sub.has(parent.id)) return JSON.stringify({ ok: false, error: '自分の配下へは移動できません' });
          const siblings = nodes.filter(n => n.parentId === parent.id && n.id !== id);
          patch.parentId = parent.id;
          patch.rank = siblings.length ? Math.max(...siblings.map(s => s.rank)) + 1 : 0;
        }

        if (Object.keys(patch).length === 0) {
          return JSON.stringify({ ok: false, error: '更新内容（text/note/link/parent/collapsed）が必要です' });
        }
        const found = await updateMindTopic(boardKey, id, patch);
        return JSON.stringify(found ? { ok: true } : { ok: false, error: '対象トピックが見つかりません（mindmap_get で確認してください）' });
      } catch (e) {
        return JSON.stringify({ ok: false, error: (e instanceof Error && e.message) || 'mindmap_update_topic failed' });
      }
    },
  },

  {
    name: 'mindmap_remove_topics',
    description:
      'マインドマップからトピックを枝ごと削除する（配下の子トピック・関係線・まとめへの参照も一緒に消える）。' +
      'ユーザーの思考の痕跡を消す操作なので、ユーザーが明確に削除を求めたときだけ使うこと' +
      '（整理は削除ではなく mindmap_update_topic の parent 移動を優先）。中心トピックは削除できない。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        ids: { type: 'array', items: { type: 'string' }, description: '削除するトピック ID の配列（部分木ごと消える）。' },
      },
      required: ['ids'],
    },
    risk: 'medium',
    label: 'トピックを削除しています…',
    handler: async (ctx) => {
      const { getActiveMindMapBoardId } = await import('./mindmapBridge');
      const boardKey = getActiveMindMapBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!boardKey) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const ids = Array.isArray(ctx.input.ids) ? ctx.input.ids.map(String) : [];
      if (ids.length === 0) return JSON.stringify({ ok: false, error: 'ids が空です' });
      try {
        const { removeMindTopics } = await import('./mindmapBridge');
        const res = await removeMindTopics(boardKey, ids);
        return JSON.stringify({ ok: true, removed: res.removed, skipped: res.skipped.length ? res.skipped : undefined });
      } catch (e) {
        return JSON.stringify({ ok: false, error: (e instanceof Error && e.message) || 'mindmap_remove_topics failed' });
      }
    },
  },

  {
    name: 'mindmap_connect_topics',
    description:
      'マインドマップの既存トピック同士を関係線（木構造とは別の横断的な注釈矢印）で結ぶ。' +
      '別の枝どうしの「トレードオフ」「同じ根拠を共有」「これが前提」のような関係を残すのに使う。' +
      'text には関係の一言を入れること。トピック id は mindmap_get で取得。removeRelationIds で不要な関係線を外せる。' +
      '構造の変更（親の付け替え）は mindmap_update_topic の parent を使う（関係線は構造を変えない注釈）。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        relations: {
          type: 'array',
          description: '張る関係線の配列。',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: '始点トピック ID。' },
              target: { type: 'string', description: '終点トピック ID。' },
              text: { type: 'string', description: '関係の一言（例: トレードオフ / 同じ根拠 / これが前提）。' },
            },
            required: ['source', 'target'],
          },
        },
        removeRelationIds: { type: 'array', items: { type: 'string' }, description: '削除する関係線 ID の配列。' },
      },
    },
    risk: 'low',
    label: 'トピックを関係線で結んでいます…',
    handler: async (ctx) => {
      const { getActiveMindMapBoardId } = await import('./mindmapBridge');
      const boardKey = getActiveMindMapBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!boardKey) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const rawRels: Array<Record<string, unknown>> = Array.isArray(ctx.input.relations) ? ctx.input.relations : [];
      const removeIds = Array.isArray(ctx.input.removeRelationIds) ? ctx.input.removeRelationIds.map(String) : [];
      if (rawRels.length === 0 && removeIds.length === 0) {
        return JSON.stringify({ ok: false, error: 'relations または removeRelationIds が必要です' });
      }
      const errors: string[] = [];
      const partials = rawRels.flatMap((r, i: number) => {
        if (!r?.source || !r?.target) { errors.push(`relations[${i}]: source と target が必要です`); return []; }
        return [{ source: String(r.source), target: String(r.target), text: typeof r.text === 'string' ? r.text : undefined }];
      });
      try {
        const { addMindRelations, removeMindRelations } = await import('./mindmapBridge');
        const added = partials.length > 0
          ? await addMindRelations(boardKey, partials)
          : { created: [], skipped: [] as string[] };
        const removed = removeIds.length > 0 ? await removeMindRelations(boardKey, removeIds) : 0;
        return JSON.stringify({
          ok: true,
          connected: added.created.map(r => ({ id: r.id, source: r.source, target: r.target })),
          removed: removeIds.length > 0 ? removed : undefined,
          skipped: [...errors, ...added.skipped].length ? [...errors, ...added.skipped] : undefined,
        });
      } catch (e) {
        return JSON.stringify({ ok: false, error: (e instanceof Error && e.message) || 'mindmap_connect_topics failed' });
      }
    },
  },
];
