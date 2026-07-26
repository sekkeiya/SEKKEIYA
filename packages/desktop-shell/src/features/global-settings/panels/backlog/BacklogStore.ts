// 開発状況（要求/要件/スプリント）の永続化 seam。
// DevStatusPanel の Firestore/Storage 直呼びをこのインターフェイス背後に集約する。
// 実装は FirestoreBacklogStore.ts。挙動は現行 panel と 1対1（純リファクタ）。
import type { BacklogItem, Sprint, Attachment } from '../DevStatusPanel';

export type Unsubscribe = () => void;

export interface BacklogStore {
  /** /devBacklog を購読。onError は onSnapshot のエラーコールバックに対応。 */
  subscribeItems(cb: (items: BacklogItem[]) => void, onError?: (e: unknown) => void): Unsubscribe;
  /** /devSprints を購読。onError は onSnapshot のエラーコールバックに対応。 */
  subscribeSprints(cb: (sprints: Sprint[]) => void, onError?: (e: unknown) => void): Unsubscribe;
  /** 項目を追加。createdAt/updatedAt=serverTimestamp を付与。返り値は新規 id。 */
  addItem(data: Partial<BacklogItem>): Promise<string>;
  /** 項目を更新。updatedAt=serverTimestamp を付与。 */
  updateItem(id: string, patch: Record<string, unknown>): Promise<void>;
  /** 項目を削除。 */
  removeItem(id: string): Promise<void>;
  /** スプリントを追加。createdAt/updatedAt=serverTimestamp を付与。返り値は新規 id。 */
  addSprint(data: Partial<Sprint>): Promise<string>;
  /** スプリントを更新。updatedAt=serverTimestamp を付与。 */
  updateSprint(id: string, patch: Record<string, unknown>): Promise<void>;
  /** スプリントを削除。 */
  removeSprint(id: string): Promise<void>;
  /** 画像を Storage にアップロードし attachments に arrayUnion で追加。 */
  uploadAttachment(itemId: string, file: File | Blob, name: string): Promise<void>;
  /** Storage の実体を削除し attachments から arrayRemove で除去。 */
  removeAttachment(itemId: string, att: Attachment): Promise<void>;
}
