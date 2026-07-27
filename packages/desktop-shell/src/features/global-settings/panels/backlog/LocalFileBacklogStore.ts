// ローカルモードの BacklogStore 実装。
// データ: <root>/.claude/sekkeiya-code/backlog.json（1ファイル・整形JSON）
// 添付:   <root>/.claude/sekkeiya-code/attachments/<itemId>/<uuid>.<ext>
// 方針: 書き込みは「最新を読み直す→純ロジックで適用→全体書き戻し」。
//       同時 commit は 1 本の Promise チェーンで直列化する（read-modify-write のロストアップデート防止）。
//       watch で外部変更（Claude Code の編集）をリロード。自己書き込みは isSelfWrite で無視。
//       ロード成功まで write 禁止（壊れたファイルを上書きで潰さない）。
//       読み直しに失敗（= 外部編集の途中 / 破損）したら書き込みを中止する（同上の不変条件）。
import { readTextFile, writeTextFile, writeFile, readFile, mkdir, exists, remove, watch } from '@tauri-apps/plugin-fs';
import type { BacklogStore, Unsubscribe } from './BacklogStore';
import type { BacklogItem, Sprint, Attachment } from '../DevStatusPanel';
import type { LocalBacklogFile } from './localBacklogLogic';
import {
  emptyBacklogFile, parseBacklogFile, serializeBacklogFile,
  addEntry, patchEntry, removeEntry, isSelfWrite,
} from './localBacklogLogic';

const DIR = '.claude/sekkeiya-code';

// blob URL は MIME 未設定だと <img> で描画されないため、拡張子から補う。
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
};
const guessMime = (path: string): string => MIME_BY_EXT[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

export class LocalFileBacklogStore implements BacklogStore {
  private readonly root: string;
  private readonly filePath: string;
  private file: LocalBacklogFile | null = null;      // ロード成功後のみ非 null
  private lastWritten: string | null = null;
  private itemSubs = new Set<(items: BacklogItem[]) => void>();
  private sprintSubs = new Set<(sprints: Sprint[]) => void>();
  private errSubs = new Set<(e: unknown) => void>();
  private unwatch: (() => void) | null = null;
  private watching = false;                          // startWatch の同期ガード（await 前に立てる）
  private loading: Promise<void> | null = null;      // 初回ロードの多重実行防止（in-flight を共有）
  private q: Promise<void> = Promise.resolve();      // commit 直列化キュー
  private blobCache = new Map<string, Promise<string>>(); // 添付 path → blob URL の Promise

  constructor(rootPath: string) {
    this.root = rootPath.replace(/[\\/]+$/, '');
    this.filePath = `${this.root}/${DIR}/backlog.json`;
  }

  // ---- ロード・通知 ----
  private notify() {
    const f = this.file;
    if (!f) return;
    this.itemSubs.forEach(cb => cb(f.items));
    this.sprintSubs.forEach(cb => cb(f.sprints));
  }
  private fail(e: unknown) { this.errSubs.forEach(cb => cb(e)); }

  /** 初回ロード。無ければフォルダ名を projectKey に自動初期化して作成（spec §5）。
   *  subscribeItems / subscribeSprints が同一 effect 内で連続して呼ばれるため、
   *  in-flight の Promise を共有して二重ロードを防ぐ。 */
  private load(): Promise<void> {
    if (this.loading) return this.loading;
    const p = this.doLoad().finally(() => {
      // 失敗（file が入らなかった）ときだけ解除し、次の購読で再試行できるようにする。
      if (!this.file && this.loading === p) this.loading = null;
    });
    this.loading = p;
    return p;
  }

  private async doLoad(): Promise<void> {
    try {
      if (!(await exists(this.filePath))) {
        await mkdir(`${this.root}/${DIR}`, { recursive: true });
        const initial = serializeBacklogFile(emptyBacklogFile(this.root.split(/[\\/]/).pop() || 'project'));
        await writeTextFile(this.filePath, initial);
        this.lastWritten = initial;
      }
      const text = await readTextFile(this.filePath);
      this.file = parseBacklogFile(text);
      this.notify();
    } catch (e) { this.fail(e); }
  }

  private async startWatch(): Promise<void> {
    if (this.watching) return;
    this.watching = true;   // await の前に立てないと watcher が二重登録され、片方のハンドルが漏れる
    try {
      this.unwatch = await watch(this.filePath, () => {
        void (async () => {
          try {
            const text = await readTextFile(this.filePath);
            if (isSelfWrite(this.lastWritten, text)) return;
            this.file = parseBacklogFile(text);   // 読めたら差し替え（冪等）
            this.lastWritten = null;              // 外部の内容を採用した以上、自己書き込み判定は無効化する
            this.notify();
          } catch { /* 途中書き込み等は次のイベントで拾う */ }
        })();
      }, { delayMs: 300 });
    } catch (e) {
      this.watching = false;
      this.unwatch = null;
      this.fail(e);
    }
  }

  /** 後始末: watcher を解放し、キャッシュした blob URL を revoke する。
   *  （store を作り直す側から呼ぶ想定。呼ばないと OS の watcher が残る。） */
  dispose(): void {
    const un = this.unwatch;
    this.unwatch = null;
    this.watching = false;
    if (un) { try { un(); } catch { /* 解放済みなら無視 */ } }
    const cached = [...this.blobCache.values()];
    this.blobCache.clear();
    for (const p of cached) void p.then(u => URL.revokeObjectURL(u), () => { /* 生成に失敗していた分は不要 */ });
  }

  private subscribe<T>(subs: Set<(v: T) => void>, cb: (v: T) => void, onError?: (e: unknown) => void): Unsubscribe {
    subs.add(cb);
    if (onError) this.errSubs.add(onError);
    if (!this.file) void this.load().then(() => this.startWatch());
    else this.notify();
    return () => { subs.delete(cb); if (onError) this.errSubs.delete(onError); };
  }
  subscribeItems(cb: (items: BacklogItem[]) => void, onError?: (e: unknown) => void) { return this.subscribe(this.itemSubs, cb, onError); }
  subscribeSprints(cb: (sprints: Sprint[]) => void, onError?: (e: unknown) => void) { return this.subscribe(this.sprintSubs, cb, onError); }

  // ---- 書き込み（読み直し→適用→書き戻し）----
  /** commit を 1 本のチェーンに並べて直列化する。
   *  パネルは fire-and-forget で updateItem を forEach するため（キュー一括投入・並べ替え保存）、
   *  直列化しないと N 本が同じディスク状態を読み、最後の 1 本以外が黙って消える。 */
  private commit(mutate: (f: LocalBacklogFile) => LocalBacklogFile): Promise<void> {
    const run = () => this.doCommit(mutate);
    const next = this.q.then(run, run);   // 前が失敗しても次は実行（エラーは各呼び出しの Promise に伝播させる）
    this.q = next.catch(() => {});        // チェーン自体は絶対に落とさない
    return next;
  }

  private async doCommit(mutate: (f: LocalBacklogFile) => LocalBacklogFile): Promise<void> {
    if (!this.file) throw new Error('backlog.json が未ロードのため書き込めません');
    // 書き込み前に必ず最新を読み直す。読めない＝外部編集の途中/破損の可能性があるため、
    // 上書きして他人の内容を潰さないよう中止する（ファイルが無い場合だけは再生成できるので続行）。
    try {
      this.file = parseBacklogFile(await readTextFile(this.filePath));
    } catch (e) {
      let missing = false;
      try { missing = !(await exists(this.filePath)); } catch { missing = false; }
      if (!missing) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`backlog.json が読めないため書き込みを中止しました（外部編集の途中の可能性）: ${msg}`);
      }
      // ファイルが消えている場合のみ、手元の状態から作り直す。
    }
    this.file = mutate(this.file);
    const text = serializeBacklogFile(this.file);
    this.lastWritten = text;
    await writeTextFile(this.filePath, text);
    this.notify();
  }

  now(): unknown { return new Date().toISOString(); }
  private nowIso(): string { return new Date().toISOString(); }

  async addItem(data: Partial<BacklogItem>): Promise<string> {
    const id = crypto.randomUUID();
    await this.commit(f => ({ ...f, items: addEntry(f.items, data, id, this.nowIso()) }));
    return id;
  }
  async updateItem(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.commit(f => ({ ...f, items: patchEntry(f.items, id, patch, this.nowIso()) }));
  }
  async removeItem(id: string): Promise<void> {
    await this.commit(f => ({ ...f, items: removeEntry(f.items, id) }));
  }
  async addSprint(data: Partial<Sprint>): Promise<string> {
    const id = crypto.randomUUID();
    await this.commit(f => ({ ...f, sprints: addEntry(f.sprints, data, id, this.nowIso()) }));
    return id;
  }
  async updateSprint(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.commit(f => ({ ...f, sprints: patchEntry(f.sprints, id, patch, this.nowIso()) }));
  }
  async removeSprint(id: string): Promise<void> {
    await this.commit(f => ({ ...f, sprints: removeEntry(f.sprints, id) }));
  }

  // ---- 添付 ----
  async uploadAttachment(itemId: string, file: File | Blob, name: string): Promise<void> {
    // 拡張子なしの名前で split('.').pop() が名前全体を返してしまうのを防ぐ。
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : 'png';
    const rel = `attachments/${itemId}/${crypto.randomUUID()}.${ext}`;
    await mkdir(`${this.root}/${DIR}/attachments/${itemId}`, { recursive: true });
    await writeFile(`${this.root}/${DIR}/${rel}`, new Uint8Array(await file.arrayBuffer()));
    const att: Attachment = { path: rel, name };
    await this.commit(f => ({
      ...f,
      items: patchEntry(f.items, itemId, {
        attachments: [...((f.items.find(i => i.id === itemId)?.attachments) ?? []), att],
      }, this.nowIso()),
    }));
  }
  async removeAttachment(itemId: string, att: Attachment): Promise<void> {
    try { await remove(`${this.root}/${DIR}/${att.path}`); } catch { /* 既に無ければ無視 */ }
    const pending = this.blobCache.get(att.path);
    if (pending) {
      this.blobCache.delete(att.path);
      try { URL.revokeObjectURL(await pending); } catch { /* 生成に失敗していた場合は revoke 不要 */ }
    }
    await this.commit(f => ({
      ...f,
      items: patchEntry(f.items, itemId, {
        attachments: ((f.items.find(i => i.id === itemId)?.attachments) ?? []).filter(a => a.path !== att.path),
      }, this.nowIso()),
    }));
  }
  /** 解決済み URL ではなく Promise をキャッシュする。
   *  同時に複数回呼ばれても blob URL を 1 本しか作らない（重複生成＝リーク防止）。 */
  getAttachmentUrl(att: Attachment): Promise<string> {
    const hit = this.blobCache.get(att.path);
    if (hit) return hit;
    const pending = (async () => {
      const bytes = await readFile(`${this.root}/${DIR}/${att.path}`);
      return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: guessMime(att.path) }));
    })();
    this.blobCache.set(att.path, pending);
    // 失敗した Promise を残すと以後ずっと同じエラーを返すため、失敗時はキャッシュから外す。
    pending.catch(() => { if (this.blobCache.get(att.path) === pending) this.blobCache.delete(att.path); });
    return pending;
  }
}
