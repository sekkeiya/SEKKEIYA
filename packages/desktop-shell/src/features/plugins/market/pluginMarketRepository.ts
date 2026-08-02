// マーケットプレイスのプラグイン公開・取得（要件73）。
// Firestore `marketplacePlugins/{pluginId}`（読み: 全員 / 書き: 本人）＋
// Storage `pluginPackages/{pluginId}/{version}.zip`。templateRepository.ts と同じ流儀。
import {
  collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/client';
import type { PluginManifest, PluginPermissions } from '../manifest/manifestTypes';

const COLLECTION = 'marketplacePlugins';

export interface MarketplacePlugin {
  /** プラグイン id（逆ドメイン）＝ドキュメント id。 */
  id: string;
  name: string;
  version: string;
  engine: string;
  description: string;
  ownerUid: string;
  ownerName: string;
  downloadUrl: string;
  permissions?: PluginPermissions;
  /** Firestore Timestamp（表示用）。 */
  updatedAt?: { toDate?: () => Date } | null;
}

export interface PublishInput {
  manifest: PluginManifest;
  bytes: Uint8Array;
  ownerUid: string;
  ownerName: string;
  description?: string;
}

export async function publishPlugin(input: PublishInput): Promise<void> {
  const { manifest, bytes, ownerUid, ownerName, description } = input;
  const path = `pluginPackages/${manifest.id}/${manifest.version}.zip`;
  const storageRef = ref(storage, path);
  // ArrayBuffer に正規化してから渡す（Uint8Array が SharedArrayBuffer を指すケースの型対策）。
  const body = new Uint8Array(bytes).buffer as ArrayBuffer;
  await uploadBytes(storageRef, body, { contentType: 'application/zip' });
  const downloadUrl = await getDownloadURL(storageRef);

  const docData: Record<string, unknown> = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    engine: manifest.engine,
    description: description ?? '',
    ownerUid,
    ownerName,
    downloadUrl,
    permissions: manifest.permissions ?? {},
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, COLLECTION, manifest.id), docData, { merge: true });
}

export async function listMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('updatedAt', 'desc')));
  return snap.docs.map(d => ({ ...(d.data() as MarketplacePlugin), id: d.id }));
}

export async function unpublishPlugin(pluginId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, pluginId));
}

/** 公開パッケージ（zip）をダウンロードする。 */
export async function downloadPluginPackage(downloadUrl: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`パッケージをダウンロードできませんでした（HTTP ${res.status}）`);
  return new Uint8Array(await res.arrayBuffer());
}
