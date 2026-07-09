// Research & Memo リサーチボードの verb 定義（docs/20 方式）。
// ボード＝「根拠→ロジック→コンセプト」を編み上げる思考面。AI が対話しながら
// 言語化した内容をカードとして置き、S.Library/S.Blog の根拠を出典付きで紐づける。
// handler は researchBoardBridge に委譲（キャンバス表示中はライブ反映、非表示時はヘッドレス）。

import type { VerbDef } from '../../../store/verb/verbTypes';

const NOTE_COLORS = ['yellow', 'blue', 'pink', 'green'];
const KINDS = ['note', 'quote', 'link', 'source', 'image'];
const ROLES = ['evidence', 'interpretation', 'conclusion'];
const RELATIONS = ['supports', 'contradicts', 'applies', 'derives'];

/** モデルに返す前にテキストを丸める（ボード全景の取得でトークンを浪費しない）。 */
function trim(text: string | undefined, max = 200): string | undefined {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const researchVerbs: VerbDef[] = [
  {
    name: 'research_board_get',
    description:
      'プロジェクトのリサーチボード（Research & Memo の無限キャンバス）の現在のカードとエッジ（接続）の一覧を取得する。' +
      'ボードに何か置く前・整理する前に必ず呼んで現状を把握すること。' +
      '返り値: items[]（id / kind: note=付箋・quote=出典付き引用・link・source=S.Library/S.Blog参照・image / role: evidence=根拠・interpretation=解釈・conclusion=結論 / text / refTitle / x,y）と ' +
      'edges[]（id / source→target / relation: supports=支持・contradicts=反証・applies=適用・derives=導出 / label=接続理由）と ' +
      'hints（地図を整えるための診断: rolelessIds=役割未設定 / unconnectedIds=未接続で宙に浮いたカード / rootlessConclusionIds=根拠に着地していない結論 / brokenInterpretationIds=筋が途切れた解釈 / danglingEvidenceIds=どこにも効いていない根拠）。' +
      'ボードは「根拠→解釈→結論」の論証グラフ。hints は放置せず、役割付与や接続で解消していくこと。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
      },
    },
    risk: 'low',
    label: 'リサーチボードを確認しています…',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      try {
        const { listBoardItems, listBoardEdges } = await import('./researchBoardBridge');
        const [items, edges] = await Promise.all([listBoardItems(projectId), listBoardEdges(projectId)]);

        // ── 論証グラフの診断（AIが「地図を整える」ための手掛かり）─────────────
        // 役割未設定・宙に浮いたカード・根拠のない結論を洗い出して返す。
        const idSet = new Set(items.map(i => i.id));
        const hasIn = new Set<string>();   // 入エッジ（自分が target）＝根拠に支えられている
        const hasOut = new Set<string>();  // 出エッジ（自分が source）＝どこかに効いている
        edges.forEach(e => {
          if (idSet.has(e.source)) hasOut.add(e.source);
          if (idSet.has(e.target)) hasIn.add(e.target);
        });
        // note/quote/source のみ論証の対象（link/image は素材扱いで診断から除く）
        const isArg = (k: string) => k === 'note' || k === 'quote' || k === 'source';
        const argItems = items.filter(i => isArg(i.kind));
        const hints = {
          // 役割が未設定のカード（interpretation/conclusion を中心に推定して付けたい）
          rolelessIds: argItems.filter(i => !i.role).map(i => i.id),
          // エッジが1本も無い＝まだ論証に組み込まれていない（地図では未配置トレイ行き）
          unconnectedIds: argItems.filter(i => !hasIn.has(i.id) && !hasOut.has(i.id)).map(i => i.id),
          // 結論なのに入エッジが無い＝根拠に着地していない主張（支える根拠/解釈を繋ぎたい）
          rootlessConclusionIds: items.filter(i => i.role === 'conclusion' && !hasIn.has(i.id)).map(i => i.id),
          // 解釈なのに根拠(入)か結論(出)のどちらかが欠けている＝筋が途切れている
          brokenInterpretationIds: items.filter(i => i.role === 'interpretation' && (!hasIn.has(i.id) || !hasOut.has(i.id))).map(i => i.id),
          // 根拠なのにどこにも効いていない（出エッジが無い）
          danglingEvidenceIds: items.filter(i => i.role === 'evidence' && !hasOut.has(i.id)).map(i => i.id),
        };

        return JSON.stringify({
          ok: true,
          count: items.length,
          items: items.map(i => ({
            id: i.id, kind: i.kind, role: i.role,
            text: trim(i.text), url: i.url, color: i.color,
            refType: i.refType, refId: i.refId, refTitle: i.refTitle,
            x: Math.round(i.x), y: Math.round(i.y),
          })),
          edges: edges.map(e => ({
            id: e.id, source: e.source, target: e.target, relation: e.relation, label: trim(e.label, 120),
          })),
          hints,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_get failed' });
      }
    },
  },

  {
    name: 'research_board_create',
    description:
      '新しいリサーチボードを作成して、そのボードへ切り替える（1つのプロジェクト/個人スコープに複数のボードを持てる）。' +
      'テーマが大きく変わるとき（例: 「意匠の論拠」と「事業性の論拠」を分ける、個人ボードで「キャリアの方向性」と「新規事業アイデア」を分ける）に使う。' +
      "projectId に 'account' を指定するとアカウントサイト（マイページ）の個人スコープに作成できる（アカウントサイトのチャットからの作成は既定でこれ）。" +
      '作成後は以降の add_items / connect_items が新しいボードに置かれる。安易に増やさず、ユーザーの意図が別テーマだと明確なときだけ作る。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: "対象スコープ（省略時は現在表示中のボードのスコープ）。'account' でアカウント個人スコープ（マイページ）に作成できる。" },
        title: { type: 'string', description: 'ボード名（例: 事業性の論拠 / 事業アイデア）。' },
      },
      required: ['title'],
    },
    risk: 'low',
    label: '新しいボードを作成しています…',
    handler: async (ctx) => {
      const title = String(ctx.input.title || '').trim();
      if (!title) return JSON.stringify({ ok: false, error: 'title が必要です' });
      try {
        const { getActiveBoardManager, getActiveBoardId, setHeadlessActiveBoard } = await import('./researchBoardBridge');
        const mgr = getActiveBoardManager();
        if (mgr) {
          const key = await mgr.createBoard(title);
          return JSON.stringify({ ok: true, boardKey: key, note: `新しいボード「${title}」を作成して切り替えました。以降のカードはこのボードに置かれます。` });
        }
        // ヘッドレス（ボード未表示）: スコープを解決して作成のみ（画面切替はできない）。
        // 明示 projectId を最優先し、無ければ直近アクティブボードのスコープを使う。
        const { ResearchCanvasRepository, makeBoardKey, parseBoardKey } = await import('../repositories/ResearchCanvasRepository');
        const activeId = getActiveBoardId();
        const scopeId = ctx.resolveProjectId(ctx.input.projectId)
          ?? (activeId ? parseBoardKey(activeId).scope : undefined);
        if (!scopeId) return JSON.stringify({ ok: false, error: '対象スコープが不明です' });
        const id = await ResearchCanvasRepository.createBoard(scopeId, title);
        const boardKey = makeBoardKey(scopeId, id);
        // 以降のヘッドレス add/connect/get がこの新ボードを対象にするよう記録する
        // （素のスコープだと既定ボード'canvas'＝メインボードに逸れて、作成したボードが空のままになる）。
        setHeadlessActiveBoard(boardKey);
        return JSON.stringify({ ok: true, boardKey, note: '新しいボードを作成しました。以降のカードはこのボードに置かれます。' });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_create failed' });
      }
    },
  },

  {
    name: 'research_board_add_items',
    description:
      'リサーチボードにカードを複数まとめて置く（必要ならエッジも同時に張れる）。対話で言語化した気づき・論点は note、' +
      'S.Library/S.Blog から得た根拠の一節は quote（refTitle 必須・refId が分かれば付与）で置き、' +
      '出典に遡れる状態を保つこと。search_knowledge / library_list / blog_get の結果を quote 化するのが根拠づけの基本フロー。' +
      '論証グラフ上の役割が明確なカードには role を付ける（note の解釈=interpretation・結論=conclusion、quote は evidence）。' +
      'image の url には gallery_query の thumbnailUrl や blog_get の coverUrl・本文中の画像URLなど https の実URLを使う（data: URL は不可）。' +
      'x/y を省略すると既存カードに重ならない位置へ自動配置される。関連カードは近い座標を明示して群（クラスタ）にできる。' +
      'edges の source/target には既存カードの id、または今回 items で追加するカードを "#0"（items 配列の添字）で参照できる。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        items: {
          type: 'array',
          description: '置くカードの配列。',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: KINDS, description: 'note=付箋（言語化した論点・気づき）/ quote=出典付き引用（根拠）/ link=URL / source=S.Library・S.Blogの参照カード / image=画像URL。' },
              text: { type: 'string', description: 'note の本文 / quote の引用文 / link・image のタイトル。' },
              color: { type: 'string', enum: NOTE_COLORS, description: 'note の色。テーマごとに色を揃えると視認性が上がる。' },
              role: { type: 'string', enum: ROLES, description: '論証グラフ上の役割。evidence=根拠 / interpretation=解釈（根拠が本PJで何を意味するか）/ conclusion=結論（コンセプト・設計方針）。' },
              url: { type: 'string', description: 'link・image の URL。' },
              refType: { type: 'string', enum: ['library', 'article'], description: 'quote・source の出典種別（library=S.Library / article=S.Blog）。' },
              refId: { type: 'string', description: '出典 ID（library: localId / article: 記事ID）。library_list 等で分かる場合は必ず付ける。' },
              refTitle: { type: 'string', description: '出典タイトル。quote・source では必須。' },
              refMeta: { type: 'string', description: '出典の補足（カテゴリ等）。' },
              x: { type: 'number', description: 'X 座標（省略時は自動配置）。' },
              y: { type: 'number', description: 'Y 座標（省略時は自動配置）。' },
            },
            required: ['kind'],
          },
        },
        edges: {
          type: 'array',
          description: '同時に張るエッジ（省略可）。source=根拠側 → target=結論側 の向き。',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: '始点（根拠・素材側）。既存カード id または "#0" 形式で今回の items を添字参照。' },
              target: { type: 'string', description: '終点（解釈・結論側）。既存カード id または "#0" 形式。' },
              relation: { type: 'string', enum: RELATIONS, description: 'supports=支持 / contradicts=反証 / applies=適用（一般論を本PJへ）/ derives=導出（解釈から結論へ）。' },
              label: { type: 'string', description: '接続理由の一行（なぜこの根拠がこの結論を支えるのか）。付けると論証が提案書級になる。' },
            },
            required: ['source', 'target', 'relation'],
          },
        },
      },
      required: ['items'],
    },
    risk: 'low',
    label: 'リサーチボードにカードを置いています…',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const raw = Array.isArray(ctx.input.items) ? ctx.input.items : [];
      if (raw.length === 0) return JSON.stringify({ ok: false, error: 'items が空です' });

      const errors: string[] = [];
      const partials = raw.flatMap((it: any, idx: number) => {
        const kind = String(it?.kind || '');
        if (!KINDS.includes(kind)) { errors.push(`items[${idx}]: kind が不正です（${kind}）`); return []; }
        if ((kind === 'note' || kind === 'quote') && !it.text) { errors.push(`items[${idx}]: ${kind} には text が必要です`); return []; }
        if ((kind === 'link' || kind === 'image') && !it.url) { errors.push(`items[${idx}]: ${kind} には url が必要です`); return []; }
        // data: URL はボードdoc（Firestore 1MB上限）を破裂させるため拒否。https の実URLのみ。
        if (typeof it.url === 'string' && /^data:/i.test(it.url)) { errors.push(`items[${idx}]: data: URL は使えません。gallery_query や blog_get で得た https URL を使ってください`); return []; }
        if ((kind === 'quote' || kind === 'source') && !it.refTitle) { errors.push(`items[${idx}]: ${kind} には refTitle（出典タイトル）が必要です`); return []; }
        return [{
          kind: kind as any,
          text: typeof it.text === 'string' ? it.text : undefined,
          color: NOTE_COLORS.includes(it.color) ? it.color : undefined,
          role: ROLES.includes(it.role) ? it.role : undefined,
          url: typeof it.url === 'string' ? it.url : undefined,
          refType: it.refType === 'library' || it.refType === 'article' ? it.refType : undefined,
          refId: typeof it.refId === 'string' ? it.refId : undefined,
          refTitle: typeof it.refTitle === 'string' ? it.refTitle : undefined,
          refMeta: typeof it.refMeta === 'string' ? it.refMeta : undefined,
          x: typeof it.x === 'number' ? it.x : undefined,
          y: typeof it.y === 'number' ? it.y : undefined,
          // "#N" 参照の解決用に元の添字を覚えておく（bridge へは渡さない）
          __srcIndex: idx,
        }];
      });
      if (partials.length === 0) return JSON.stringify({ ok: false, error: errors.join(' / ') || 'items が不正です' });

      try {
        const { addBoardItems, addBoardEdges } = await import('./researchBoardBridge');
        const srcIndexes = partials.map(p => p.__srcIndex as number);
        const created = await addBoardItems(projectId, partials.map(({ __srcIndex, ...p }) => p));

        // エッジの "#N" 参照（今回追加した items の添字）を実IDに解決して張る
        let addedEdges: Array<{ id: string; source: string; target: string; relation: string }> = [];
        const rawEdges = Array.isArray(ctx.input.edges) ? ctx.input.edges : [];
        if (rawEdges.length > 0) {
          const idxToId = new Map<number, string>();
          created.forEach((c, i) => idxToId.set(srcIndexes[i], c.id));
          const resolveRef = (ref: any): string | null => {
            const s = String(ref ?? '');
            const m = s.match(/^#(\d+)$/);
            if (m) return idxToId.get(Number(m[1])) ?? null;
            return s || null;
          };
          const edgePartials = rawEdges.flatMap((e: any, i: number) => {
            const source = resolveRef(e?.source);
            const target = resolveRef(e?.target);
            if (!source || !target) { errors.push(`edges[${i}]: source/target を解決できません（"#N" は items の添字）`); return []; }
            if (!RELATIONS.includes(e?.relation)) { errors.push(`edges[${i}]: relation が不正です（${e?.relation}）`); return []; }
            return [{
              source, target, relation: e.relation,
              label: typeof e.label === 'string' && e.label.trim() ? e.label.trim() : undefined,
            }];
          });
          if (edgePartials.length > 0) {
            const res = await addBoardEdges(projectId, edgePartials);
            addedEdges = res.created.map(e => ({ id: e.id, source: e.source, target: e.target, relation: e.relation }));
            errors.push(...res.skipped);
          }
        }

        return JSON.stringify({
          ok: true,
          added: created.map(c => ({ id: c.id, kind: c.kind, role: c.role, x: Math.round(c.x), y: Math.round(c.y) })),
          addedEdges: addedEdges.length ? addedEdges : undefined,
          skipped: errors.length ? errors : undefined,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_add_items failed' });
      }
    },
  },

  {
    name: 'research_board_connect_items',
    description:
      'リサーチボードの既存カード同士を型付きエッジで接続し、「根拠→解釈→結論」の論証の筋道を可視化する。' +
      'source=根拠側 → target=結論側 の向き。relation は supports=支持 / contradicts=反証（採らなかった案・反対根拠も残すと提案の説得力が上がる）/ ' +
      'applies=適用（一般論・記事の知見を本PJへ）/ derives=導出（解釈から結論を導く）。' +
      'label には「なぜ繋がるのか」の一行を必ず入れること——このラベルの積み重ねがそのまま設計根拠の説明になる。' +
      'カード id は research_board_get で取得。removeEdgeIds で不要になったエッジを外せる。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        edges: {
          type: 'array',
          description: '張るエッジの配列。',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: '始点カード ID（根拠・素材側）。' },
              target: { type: 'string', description: '終点カード ID（解釈・結論側）。' },
              relation: { type: 'string', enum: RELATIONS, description: 'supports=支持 / contradicts=反証 / applies=適用 / derives=導出。' },
              label: { type: 'string', description: '接続理由の一行（なぜこの根拠がこの結論を支えるのか）。' },
            },
            required: ['source', 'target', 'relation'],
          },
        },
        removeEdgeIds: { type: 'array', items: { type: 'string' }, description: '削除するエッジ ID の配列（張り替え・整理用）。' },
      },
    },
    risk: 'low',
    label: 'カードを接続しています…',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const rawEdges = Array.isArray(ctx.input.edges) ? ctx.input.edges : [];
      const removeIds = Array.isArray(ctx.input.removeEdgeIds) ? ctx.input.removeEdgeIds.map(String) : [];
      if (rawEdges.length === 0 && removeIds.length === 0) {
        return JSON.stringify({ ok: false, error: 'edges または removeEdgeIds が必要です' });
      }

      const errors: string[] = [];
      const partials = rawEdges.flatMap((e: any, i: number) => {
        if (!e?.source || !e?.target) { errors.push(`edges[${i}]: source と target が必要です`); return []; }
        if (!RELATIONS.includes(e?.relation)) { errors.push(`edges[${i}]: relation が不正です（${e?.relation}）`); return []; }
        return [{
          source: String(e.source), target: String(e.target), relation: e.relation,
          label: typeof e.label === 'string' && e.label.trim() ? e.label.trim() : undefined,
        }];
      });

      try {
        const { addBoardEdges, removeBoardEdges } = await import('./researchBoardBridge');
        const added = partials.length > 0
          ? await addBoardEdges(projectId, partials)
          : { created: [], skipped: [] as string[] };
        const removed = removeIds.length > 0 ? await removeBoardEdges(projectId, removeIds) : 0;
        return JSON.stringify({
          ok: true,
          connected: added.created.map(e => ({ id: e.id, source: e.source, target: e.target, relation: e.relation })),
          removed: removeIds.length > 0 ? removed : undefined,
          skipped: [...errors, ...added.skipped].length ? [...errors, ...added.skipped] : undefined,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_connect_items failed' });
      }
    },
  },

  {
    name: 'research_board_generate_image',
    description:
      'コンセプトイメージ・ムードイメージを AI（AI Render）で生成し、完成したらリサーチボードに画像カードとして自動配置する。' +
      '言葉で伝わりにくい空気感・素材感・光はこれで見せて、ユーザーの反応からさらに深掘りする。' +
      'プロンプトには空間の用途・素材・光・時間帯・アングルを具体的に含めること。' +
      '複数案を出すときは prompts[] に**1回の呼び出しでまとめる**（最大4枚・並列生成）。同じ呼び出しを連発しない。' +
      '呼び出しは即時返却され（started が返る）、完成し次第ボードに自動配置される（目安: 約1分）。生成完了を待たずに対話を続けること。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        prompt: { type: 'string', description: '1枚だけ生成する場合のプロンプト（複数枚は prompts を使う）。' },
        caption: { type: 'string', description: 'prompt 用のキャプション（省略時はプロンプト冒頭）。' },
        prompts: {
          type: 'array',
          description: '複数案の一括生成（最大4件・並列）。案出し・比較にはこちらを使う。',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: '生成プロンプト。空間の用途・素材・光・雰囲気を具体的に（日本語可）。' },
              caption: { type: 'string', description: '画像カードのキャプション（例:「案A｜余白を設計する住宅」。省略時はプロンプト冒頭）。' },
            },
            required: ['prompt'],
          },
        },
        x: { type: 'number', description: 'X 座標（1枚生成のときのみ。省略時は自動配置）。' },
        y: { type: 'number', description: 'Y 座標（1枚生成のときのみ。省略時は自動配置）。' },
      },
    },
    risk: 'medium',
    label: 'コンセプトイメージを生成しています…（完成次第ボードに配置）',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });

      // 単発 prompt / 複数 prompts[] を正規化（最大4件）
      const MAX_BATCH = 4;
      const rawSpecs: Array<{ prompt: string; caption?: string }> = Array.isArray(ctx.input.prompts) && ctx.input.prompts.length > 0
        ? ctx.input.prompts
        : (ctx.input.prompt ? [{ prompt: ctx.input.prompt, caption: ctx.input.caption }] : []);
      const specs = rawSpecs
        .map(s => ({ prompt: String(s?.prompt || '').trim(), caption: String(s?.caption || '').trim() }))
        .filter(s => s.prompt)
        .slice(0, MAX_BATCH);
      if (specs.length === 0) return JSON.stringify({ ok: false, error: 'prompt または prompts が必要です' });
      const truncated = rawSpecs.length > MAX_BATCH ? rawSpecs.length - MAX_BATCH : 0;

      const { useAuthStore } = await import('../../../store/useAuthStore');
      const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
      if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });

      try {
        const [{ httpsCallable }, { functions, db }, { doc, onSnapshot }, { getActiveImageProvider }] = await Promise.all([
          import('firebase/functions'),
          import('../../../lib/firebase/client'),
          import('firebase/firestore'),
          import('../../../store/useAiSettingsStore'),
        ]);
        const requestAiRender = httpsCallable(functions, 'requestAiRender');
        const provider = getActiveImageProvider();

        // 座標指定は1枚生成のときだけ尊重（バッチは完成時の自動配置に任せる）
        const singleX = specs.length === 1 && typeof ctx.input.x === 'number' ? ctx.input.x : undefined;
        const singleY = specs.length === 1 && typeof ctx.input.y === 'number' ? ctx.input.y : undefined;

        const HARD_UNSUB_MS = 10 * 60_000;
        const placeOnBoard = async (url: string, caption: string) => {
          const { addBoardItems } = await import('./researchBoardBridge');
          return addBoardItems(projectId, [{ kind: 'image', url, text: caption, x: singleX, y: singleY }]);
        };

        /** 1ジョブ開始 + 完成監視（完成し次第ボードに配置）。開始の成否だけを返す。 */
        const startJob = async (spec: { prompt: string; caption: string }) => {
          const res = await requestAiRender({
            provider,
            prompt: spec.prompt,
            inputImageUrl: null,
            projectId,
            workspaceId: null,
          });
          const data = res.data as any;
          if (!data?.success || !data?.jobId) {
            throw new Error(data?.message || '生成ジョブの開始に失敗しました');
          }
          const caption = spec.caption
            || (spec.prompt.length > 40 ? `${spec.prompt.slice(0, 40)}…` : spec.prompt);
          const jobRef = doc(db, 'users', uid, 'aiJobs', data.jobId);
          const unsub = onSnapshot(jobRef, snap => {
            const d = snap.data() as any;
            if (!d) return;
            if (d.status === 'completed' && d.resultStorageUrl) {
              unsub();
              placeOnBoard(d.resultStorageUrl, caption).catch(e => console.error('[research] 生成画像の配置に失敗:', e));
            } else if (d.status === 'failed') {
              unsub();
              console.error('[research] 画像生成に失敗:', d.errorMessage || caption);
            }
          }, e => console.error('[research] 生成ジョブの監視に失敗:', e));
          setTimeout(() => unsub(), HARD_UNSUB_MS); // 取りこぼし時のリスナー解放（unsubは冪等）
          return caption;
        };

        // 全ジョブを並列に開始し、完成は待たずに即時返却する（チャットをブロックしない）
        const settled = await Promise.allSettled(specs.map(s => startJob(s as { prompt: string; caption: string })));
        const started = settled.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
        const failed = settled.flatMap(r => (r.status === 'rejected' ? [String((r.reason as any)?.message || r.reason)] : []));

        if (started.length === 0) {
          return JSON.stringify({ ok: false, error: failed.join(' / ') || '生成ジョブの開始に失敗しました' });
        }
        return JSON.stringify({
          ok: true,
          pending: true,
          started: started.length,
          captions: started,
          failed: failed.length ? failed : undefined,
          skipped: truncated ? `${truncated}件は上限（${MAX_BATCH}枚/回）を超えたため未実行` : undefined,
          note: `${started.length}枚の生成をバックグラウンドで開始しました。完成し次第ボードに自動配置されます（目安: 約1分）。生成を待たずに、その旨をユーザーに伝えて対話を続けてください。`,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_generate_image failed' });
      }
    },
  },

  {
    name: 'research_board_update_item',
    description:
      'リサーチボードの既存カード1枚を更新する（本文の推敲・色分け・役割付け・位置の移動＝グルーピング）。' +
      'id は research_board_get で取得する。ユーザーが書いたカードの本文を書き換えるときは事前に合意を取ること。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        id: { type: 'string', description: '対象カードの ID。' },
        text: { type: 'string', description: '新しい本文。' },
        color: { type: 'string', enum: NOTE_COLORS, description: 'note の新しい色。' },
        role: { type: 'string', enum: ROLES, description: '論証グラフ上の役割（evidence=根拠 / interpretation=解釈 / conclusion=結論）。' },
        x: { type: 'number', description: '新しい X 座標。' },
        y: { type: 'number', description: '新しい Y 座標。' },
      },
      required: ['id'],
    },
    risk: 'low',
    label: 'カードを更新しています…',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      if (!ctx.input.id) return JSON.stringify({ ok: false, error: 'id が必要です' });
      const patch: Record<string, any> = {};
      if (typeof ctx.input.text === 'string') patch.text = ctx.input.text;
      if (NOTE_COLORS.includes(ctx.input.color)) patch.color = ctx.input.color;
      if (ROLES.includes(ctx.input.role)) patch.role = ctx.input.role;
      if (typeof ctx.input.x === 'number') patch.x = ctx.input.x;
      if (typeof ctx.input.y === 'number') patch.y = ctx.input.y;
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, error: '更新内容（text/color/role/x/y）が必要です' });
      try {
        const { updateBoardItem } = await import('./researchBoardBridge');
        const found = await updateBoardItem(projectId, String(ctx.input.id), patch);
        return JSON.stringify(found ? { ok: true } : { ok: false, error: '対象カードが見つかりません（research_board_get で確認してください）' });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_update_item failed' });
      }
    },
  },

  {
    name: 'research_board_remove_items',
    description:
      'リサーチボードからカードを削除する（接続されたエッジも一緒に消える）。ユーザーの思考の痕跡を消す操作なので、' +
      'ユーザーが明確に削除を求めたときだけ使うこと（整理は削除ではなく移動＝update を優先）。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        ids: { type: 'array', items: { type: 'string' }, description: '削除するカード ID の配列。' },
      },
      required: ['ids'],
    },
    risk: 'medium',
    label: 'カードを削除しています…',
    handler: async (ctx) => {
      // 画面に出ているボードを最優先で対象にする（個人ボード'account'は projectId から解決できない）
      const { getActiveBoardId } = await import('./researchBoardBridge');
      const projectId = getActiveBoardId() ?? ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const ids = Array.isArray(ctx.input.ids) ? ctx.input.ids.map(String) : [];
      if (ids.length === 0) return JSON.stringify({ ok: false, error: 'ids が空です' });
      try {
        const { removeBoardItems } = await import('./researchBoardBridge');
        const removed = await removeBoardItems(projectId, ids);
        return JSON.stringify({ ok: true, removed });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'research_board_remove_items failed' });
      }
    },
  },
];
