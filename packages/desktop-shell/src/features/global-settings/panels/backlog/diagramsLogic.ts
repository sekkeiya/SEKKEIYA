// 「図」ビューの純ロジック（React / Tauri fs 非依存）。fs 層は LocalFileBacklogStore.ts。
// ローカルの保存形式: <root>/.claude/sekkeiya-code/diagrams/<type>.mmd（Mermaid 本文）
//                  + <root>/.claude/sekkeiya-code/diagrams/meta.json（キュー・更新時刻のみ）
// Mermaid を JSON に埋め込まない: エスケープを避け、.mmd 単体を Claude Code が直接編集できるようにする。

export type DiagramType = 'system' | 'er' | 'screens' | 'flow';

/** UI・store が扱う 1 枚の図。mermaid はソーステキストが正。 */
export interface DiagramDoc {
  type: DiagramType;
  mermaid: string;
  queue: 'generate' | null;   // AI 生成依頼キュー
  queueNote?: string | null;  // 依頼メモ
  updatedAt?: unknown;        // Firestore: Timestamp / ローカル: ISO 文字列
}

export interface DiagramMetaEntry {
  queue: 'generate' | null;
  queueNote?: string | null;
  updatedAt?: string | null;  // ISO
}

export interface DiagramsMetaFile {
  version: 1;
  diagrams: Partial<Record<DiagramType, DiagramMetaEntry>>;
}

/** 4種の定義。sample は未作成時のプレビュー兼 AI 生成の記法ヒント。 */
export const DIAGRAM_TYPES: ReadonlyArray<{ key: DiagramType; label: string; sample: string }> = [
  {
    key: 'system', label: 'システム構成図',
    sample: 'graph TD\n  Client[クライアント] --> API[バックエンド]\n  API --> DB[(データベース)]',
  },
  {
    key: 'er', label: 'ER図',
    sample: 'erDiagram\n  PROJECT ||--o{ WORK_FILE : has\n  PROJECT { string id PK }',
  },
  {
    key: 'screens', label: '画面遷移図',
    sample: 'stateDiagram-v2\n  [*] --> ホーム\n  ホーム --> 詳細画面',
  },
  {
    key: 'flow', label: 'フロー図',
    sample: 'graph LR\n  A[開始] --> B{条件}\n  B -->|はい| C[処理]\n  B -->|いいえ| D[終了]',
  },
];

const TYPE_KEYS = DIAGRAM_TYPES.map(d => d.key) as readonly string[];

export function isDiagramType(v: unknown): v is DiagramType {
  return typeof v === 'string' && TYPE_KEYS.includes(v);
}

export function emptyDiagramsMeta(): DiagramsMetaFile {
  return { version: 1, diagrams: {} };
}

/** meta.json をパース。不正 JSON / 非オブジェクトは throw。未知タイプ・未知 queue 値は落とす。 */
export function parseDiagramsMeta(text: string): DiagramsMetaFile {
  const raw: unknown = JSON.parse(text); // 不正 JSON はここで throw
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('diagrams/meta.json の形式が不正です（オブジェクトではありません）');
  }
  const o = raw as { diagrams?: unknown };
  const out: DiagramsMetaFile = { version: 1, diagrams: {} };
  if (o.diagrams !== null && typeof o.diagrams === 'object' && !Array.isArray(o.diagrams)) {
    for (const [k, v] of Object.entries(o.diagrams as Record<string, unknown>)) {
      if (!isDiagramType(k) || v === null || typeof v !== 'object') continue;
      const e = v as Partial<DiagramMetaEntry>;
      out.diagrams[k] = {
        queue: e.queue === 'generate' ? 'generate' : null,
        queueNote: typeof e.queueNote === 'string' ? e.queueNote : null,
        updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : null,
      };
    }
  }
  return out;
}

/** git diff / Claude Code の可読性のため 2 スペース整形＋末尾改行（backlog.json と同じ流儀）。 */
export function serializeDiagramsMeta(meta: DiagramsMetaFile): string {
  return JSON.stringify(meta, null, 2) + '\n';
}

/** 対象タイプのエントリだけを patch し updatedAt を刻む（非破壊）。 */
export function setMetaEntry(
  meta: DiagramsMetaFile, type: DiagramType, patch: Partial<DiagramMetaEntry>, nowIso: string,
): DiagramsMetaFile {
  const prev: DiagramMetaEntry = meta.diagrams[type] ?? { queue: null };
  return {
    ...meta,
    diagrams: { ...meta.diagrams, [type]: { ...prev, ...patch, updatedAt: nowIso } },
  };
}
