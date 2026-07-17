import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';

/**
 * ボードのスコープ。プロジェクトの projectId、または個人（アカウントサイト）ボードの 'account'。
 * 'account' は「そのユーザーが目指す方向性・やりたいこと」をAIと組み立てる個人ボードで、
 * users/{uid}/research/{boardId} に保存する（プロジェクトは projects/{id}/research/{boardId}）。
 */
export const ACCOUNT_BOARD_ID = 'account';

// ─── ボードキー（スコープ＋ボードdoc id の複合キー）─────────────────────────────
// 1コンテキスト（プロジェクト or 個人）に複数ボードを持てる。ボードキーは
// `${scope}|${docId}` の形。互換のため区切りが無ければ既定ボード 'canvas' とみなす
// （旧「1コンテキスト=research/canvas 1doc」時代の呼び出しがそのまま動く）。
export const DEFAULT_BOARD_DOC_ID = 'canvas';
const BOARD_KEY_SEP = '|';

export function makeBoardKey(scope: string, docId: string = DEFAULT_BOARD_DOC_ID): string {
  return `${scope}${BOARD_KEY_SEP}${docId}`;
}

export function parseBoardKey(key: string): { scope: string; docId: string } {
  const i = key.indexOf(BOARD_KEY_SEP);
  if (i < 0) return { scope: key, docId: DEFAULT_BOARD_DOC_ID };
  return { scope: key.slice(0, i), docId: key.slice(i + 1) || DEFAULT_BOARD_DOC_ID };
}

/** ボード一覧の1件（切替UI用の軽量メタ）。 */
export interface ResearchBoardMeta {
  id: string;          // doc id（'canvas' は既定ボード）
  title: string;
  updatedAtMs: number; // 並べ替え用（無ければ0）
}

function boardIdGen(): string {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 論証グラフ上のカードの役割（根拠 → 解釈 → 結論 の3階層） */
export type ResearchNodeRole = 'evidence' | 'interpretation' | 'conclusion';

/** カードの辺（接続口＝ポートが付く場所）。 */
export type ResearchPortSide = 'top' | 'right' | 'bottom' | 'left';

/** カードの接続口（ポート）。辺ごとに複数持てる。id はエッジの sourceHandle/targetHandle と対応。 */
export interface ResearchCardPort {
  id: string;
  side: ResearchPortSide;
}

/** Research & Memo タブの無限キャンバスに置くアイテム（1プロジェクト=1キャンバス） */
export interface ResearchCanvasItem {
  id: string;
  kind: 'note' | 'image' | 'link' | 'quote' | 'source';
  x: number;
  y: number;
  /** note の本文 / link の表示タイトル / image のキャプション / quote の引用文 */
  text?: string;
  /** image のダウンロードURL / link の遷移先URL / source の元URL（あれば） */
  url?: string;
  /** note の色キー（yellow / blue / pink / green） */
  color?: string;
  /** 論証グラフ上の役割。quote / source は未設定でも根拠として扱う。 */
  role?: ResearchNodeRole;
  /** quote / source の出典種別（S.Library エントリ or S.Blog 記事） */
  refType?: 'library' | 'article';
  /** 出典の ID（library: LibraryEntry.localId / article: BlogArticle.id） */
  refId?: string;
  /** 出典タイトルのキャッシュ（表示・トレーサビリティ用） */
  refTitle?: string;
  /** 出典の補足メタ（カテゴリ等、表示用） */
  refMeta?: string;
  /** 接続口（ポート）。未設定なら四辺中央に1つずつの既定ポートとして扱う。 */
  ports?: ResearchCardPort[];
  createdAt: string;
  updatedAt: string;
}

/** AI が使う組み込みの関係タイプ（接続詞プリセットの key）。UI ではこれ＋ユーザーのカスタムを扱う。 */
export type ResearchEdgeRelation = 'supports' | 'contradicts' | 'applies' | 'derives';

/**
 * カード間の型付きエッジ。「どの根拠が・どのロジックで・どの結論を支えるか」を
 * 可視化する論証グラフの本体。source（根拠側）→ target（結論側）の向きを持つ。
 */
export interface ResearchCanvasEdge {
  id: string;
  /** 始点カード ID（根拠・素材側） */
  source: string;
  /** 終点カード ID（解釈・結論側） */
  target: string;
  /** 関係ラベル（接続詞プリセットの key）。組み込み or ユーザーのカスタム。 */
  relation: string;
  /** 一行の理由（なぜこの根拠がこの結論を支えるのか）。エッジ上に表示される。 */
  label?: string;
  /** 接続元カードのハンドル辺（top/right/bottom/left）。同じカード間で複数本を重ねず引くため。 */
  sourceHandle?: string;
  /** 接続先カードのハンドル辺（top/right/bottom/left）。 */
  targetHandle?: string;
  /** 手動の編集点（フロー座標）。ワイヤー選択→○をドラッグで曲げた形。未設定なら自動経路。 */
  waypoints?: Array<{ x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
}

// ─── マインドマップ（GitMind風・ボードごとに独立した木構造データ）──────────────

/**
 * マインドマップの1ノード。parentId で木を作る（null はルート＝中心トピック）。
 * キャンバスの items/edges とは独立したデータで、同じボード doc に共存する。
 */
export interface MindMapNode {
  id: string;
  /** 親ノード ID。null は中心トピック（1ボードに1つ）。 */
  parentId: string | null;
  /** 兄弟内の並び順（小さい順）。間に挿すときは中間値を使う。 */
  rank: number;
  text: string;
  /** true なら配下の枝を折りたたんで表示しない。 */
  collapsed?: boolean;
  /** 枝色の上書き（HEX）。未設定は第1階層の並び順から自動パレット、子は親を継承。 */
  color?: string;
  /** ノードに付けたアイコンのキー（mindmap/presets の MIND_ICON_GROUPS）。テキストの前に並ぶ。 */
  icons?: string[];
  /** トピックに貼った画像の URL。テキストの上に出る。 */
  image?: string;
  /**
   * 画像の元サイズ。トピックの寸法は描画前に確定させる必要があるので、
   * 貼るときに読み込んで控えておき、表示幅から高さを比率で出す。
   */
  imageW?: number;
  imageH?: number;
  /** トピックに貼ったリンク（外部URL）。バッジをクリックで開く。 */
  link?: string;
  /** トピックに付けた長めの補足メモ。バッジをクリックで開く。 */
  note?: string;
  /** 出典種別（知識から取り込んだトピック）。 */
  refType?: 'library' | 'article';
  /** 出典の ID（library: LibraryEntry.localId / article: BlogArticle.id）。 */
  refId?: string;
  /** 出典タイトルのキャッシュ（表示・トレーサビリティ用）。 */
  refTitle?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * マインドマップの展開方向。
 * right / left / both は マインドマップ（枝が伸びる形）、
 * logic-right / logic-left / org-down / org-up は ロジック図（深さで列・行を揃える形）。
 */
export type MindLayoutKey =
  | 'right' | 'left' | 'both'
  | 'logic-right' | 'logic-left'
  | 'org-down' | 'org-up';

/** マインドマップ全体のスタイル設定（GitMind の右パネル相当）。 */
export interface MindMapStyle {
  /** ノードの形: 角丸四角 / 四角 / ピル */
  shape?: 'rounded' | 'rect' | 'pill';
  /** 角の半径(px)。shape='rounded' のときだけ効く。 */
  radius?: number;
  /** 枝線: 曲線 / 直線 / エルボー（直角） */
  lineStyle?: 'curve' | 'straight' | 'elbow';
  /** 枝線の太さ(px) */
  lineWidth?: number;
  /** 展開方向 */
  layout?: MindLayoutKey;
  /** ノード間の水平間隔(px) */
  hGap?: number;
  /** ノード間の垂直間隔(px) */
  vGap?: number;
  /** テーマキー（mindmap/presets の MIND_THEMES）。中心色・枝パレットを決める。 */
  theme?: string;
  /** 背景キー（mindmap/presets の MIND_BACKGROUNDS）。 */
  background?: string;
}

/**
 * まとめ（サマリー）。同じ親を持つ兄弟トピックの範囲を波括弧でくくり、
 * その外側に「つまり何なのか」を一言で置く。木構造そのものは変えない注釈。
 */
export interface MindMapSummary {
  id: string;
  /** くくる対象のトピック（同じ親を持つ兄弟）。括弧は対象の部分木の外周に付く。 */
  nodeIds: string[];
  text: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 関係線。木の親子関係とは無関係に、任意の2トピックを結ぶ注釈用の矢印。
 * 「この枝とあの枝は関係している」を、木を組み替えずに書き込むためのもの。
 */
export interface MindMapRelation {
  id: string;
  source: string;
  target: string;
  /** 線の上に出る一言（省略可）。 */
  text?: string;
  createdAt: string;
  updatedAt: string;
}

export function compactMindNode(node: MindMapNode): MindMapNode {
  return Object.fromEntries(
    Object.entries(node).filter(([, v]) => v !== undefined),
  ) as MindMapNode;
}

export function compactMindRelation(rel: MindMapRelation): MindMapRelation {
  return Object.fromEntries(
    Object.entries(rel).filter(([, v]) => v !== undefined),
  ) as MindMapRelation;
}

/** Firestore は undefined を保存できないため、書き込み前に undefined キーを落とす。 */
export function compactCanvasItem(item: ResearchCanvasItem): ResearchCanvasItem {
  return Object.fromEntries(
    Object.entries(item).filter(([, v]) => v !== undefined),
  ) as ResearchCanvasItem;
}

export function compactCanvasEdge(edge: ResearchCanvasEdge): ResearchCanvasEdge {
  return Object.fromEntries(
    Object.entries(edge).filter(([, v]) => v !== undefined),
  ) as ResearchCanvasEdge;
}

export interface ResearchCanvasDoc {
  items: ResearchCanvasItem[];
  edges: ResearchCanvasEdge[];
  /** マインドマップの木（ノード画面とは独立。空配列=未作成）。 */
  mindmap: MindMapNode[];
  mindmapStyle: MindMapStyle;
  /** マインドマップ上の注釈（木構造は変えない）。 */
  mindmapSummaries: MindMapSummary[];
  mindmapRelations: MindMapRelation[];
}

export class ResearchCanvasRepository {
  /** スコープの research コレクション（account=users/{uid}/research, それ以外=projects/{id}/research）。 */
  private static boardsCol(scope: string) {
    if (scope === ACCOUNT_BOARD_ID) {
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) throw new Error('ログインが必要です（個人ボード）');
      return collection(db, 'users', uid, 'research');
    }
    return collection(db, 'projects', scope, 'research');
  }

  /** ボードキー（scope|docId）から対象ドキュメント参照を得る。 */
  private static canvasRef(boardKey: string) {
    const { scope, docId } = parseBoardKey(boardKey);
    if (scope === ACCOUNT_BOARD_ID) {
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) throw new Error('ログインが必要です（個人ボード）');
      return doc(db, 'users', uid, 'research', docId);
    }
    return doc(db, 'projects', scope, 'research', docId);
  }

  static async load(boardKey: string): Promise<ResearchCanvasDoc> {
    const empty: ResearchCanvasDoc = {
      items: [], edges: [], mindmap: [], mindmapStyle: {}, mindmapSummaries: [], mindmapRelations: [],
    };
    const snap = await getDoc(this.canvasRef(boardKey));
    if (!snap.exists()) return empty;
    const data = snap.data() as Partial<ResearchCanvasDoc>;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      mindmap: Array.isArray(data.mindmap) ? data.mindmap : [],
      mindmapStyle: data.mindmapStyle && typeof data.mindmapStyle === 'object' ? data.mindmapStyle : {},
      mindmapSummaries: Array.isArray(data.mindmapSummaries) ? data.mindmapSummaries : [],
      mindmapRelations: Array.isArray(data.mindmapRelations) ? data.mindmapRelations : [],
    };
  }

  /**
   * 渡されたフィールドだけを書き込む（省略したフィールドは温存）。
   * 片方だけ更新するヘッドレス操作で、もう片方を空配列で潰さないための設計。
   */
  static async save(boardKey: string, data: {
    items?: ResearchCanvasItem[];
    edges?: ResearchCanvasEdge[];
    mindmap?: MindMapNode[];
    mindmapStyle?: MindMapStyle;
    mindmapSummaries?: MindMapSummary[];
    mindmapRelations?: MindMapRelation[];
  }): Promise<void> {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (data.items) payload.items = data.items.map(compactCanvasItem);
    if (data.edges) payload.edges = data.edges.map(compactCanvasEdge);
    if (data.mindmap) payload.mindmap = data.mindmap.map(compactMindNode);
    if (data.mindmapStyle) payload.mindmapStyle = data.mindmapStyle;
    if (data.mindmapSummaries) payload.mindmapSummaries = data.mindmapSummaries;
    if (data.mindmapRelations) payload.mindmapRelations = data.mindmapRelations.map(compactMindRelation);
    await setDoc(this.canvasRef(boardKey), payload, { merge: true });
  }

  // ─── ボード管理（複数ボード）─────────────────────────────────────────────────

  /** スコープ内のボード一覧。既定ボード 'canvas' は常に含める（未作成でも一覧の先頭に出す）。 */
  static async listBoards(scope: string): Promise<ResearchBoardMeta[]> {
    const snap = await getDocs(this.boardsCol(scope));
    const metas: ResearchBoardMeta[] = snap.docs.map(d => {
      const data = d.data() as any;
      const ts = data?.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0;
      return {
        id: d.id,
        title: typeof data?.title === 'string' && data.title.trim()
          ? data.title
          : (d.id === DEFAULT_BOARD_DOC_ID ? 'メインボード' : '無題のボード'),
        updatedAtMs: ts,
      };
    });
    // 既定ボードが無ければ仮想的に先頭へ（初回で未保存でも切替UIに出す）
    if (!metas.some(m => m.id === DEFAULT_BOARD_DOC_ID)) {
      metas.unshift({ id: DEFAULT_BOARD_DOC_ID, title: 'メインボード', updatedAtMs: 0 });
    }
    // 既定を先頭、以降は更新の新しい順
    return metas.sort((a, b) =>
      a.id === DEFAULT_BOARD_DOC_ID ? -1 : b.id === DEFAULT_BOARD_DOC_ID ? 1 : b.updatedAtMs - a.updatedAtMs,
    );
  }

  /** 新規ボードを作成して doc id を返す。 */
  static async createBoard(scope: string, title: string): Promise<string> {
    const id = boardIdGen();
    await setDoc(doc(this.boardsCol(scope), id), {
      title: title.trim() || '無題のボード',
      items: [], edges: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return id;
  }

  static async renameBoard(scope: string, docId: string, title: string): Promise<void> {
    await setDoc(doc(this.boardsCol(scope), docId), { title: title.trim() || '無題のボード', updatedAt: serverTimestamp() }, { merge: true });
  }

  static async deleteBoard(scope: string, docId: string): Promise<void> {
    // 既定ボードは中身を空にするだけ（一覧から消すと概念上おかしいので削除不可）
    if (docId === DEFAULT_BOARD_DOC_ID) {
      await setDoc(doc(this.boardsCol(scope), docId), { items: [], edges: [], updatedAt: serverTimestamp() }, { merge: true });
      return;
    }
    await deleteDoc(doc(this.boardsCol(scope), docId));
  }

  /** キャンバス貼り付け画像を Storage にアップロードして公開URLを返す */
  static async uploadImage(boardKey: string, file: File): Promise<string> {
    const { scope } = parseBoardKey(boardKey);
    const ext = file.name.split('.').pop() || 'png';
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    if (scope === ACCOUNT_BOARD_ID) {
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) throw new Error('ログインが必要です（個人ボード）');
      const storageRef = ref(storage, `users/${uid}/research/attachments/research_${uniqueId}.${ext}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    }
    // Storage ルールが journals/attachments で実績があるため同系パスに置く
    const storageRef = ref(storage, `projects/${scope}/journals/attachments/research_${uniqueId}.${ext}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}
