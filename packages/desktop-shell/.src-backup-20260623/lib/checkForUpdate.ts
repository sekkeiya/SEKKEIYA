import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/client';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export interface UpdateInfo {
  latestVersion: string;
  releaseNotes?: string;
}

const STORAGE_KEY = 'sekkeiya_update_notified_version';

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const snap = await getDoc(doc(db, 'appGlobalConfig', 'latestVersion'));
    if (!snap.exists()) return null;

    const data = snap.data() as { version?: string; releaseNotes?: string };
    if (!data.version) return null;

    // すでにこのバージョンの通知を表示済みならスキップ
    const alreadyNotified = localStorage.getItem(STORAGE_KEY);
    if (alreadyNotified === data.version) return null;

    if (compareVersions(data.version, currentVersion) > 0) {
      return { latestVersion: data.version, releaseNotes: data.releaseNotes };
    }
    return null;
  } catch {
    return null;
  }
}

export function markUpdateNotified(version: string) {
  localStorage.setItem(STORAGE_KEY, version);
}
