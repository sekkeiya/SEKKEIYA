import {
  collection, doc, addDoc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../../lib/firebase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DsdSerializableState {
  currentTemplate: string;
  diagramTitle: string;
  style: string;
  // Building shape
  presetShape: string;
  customPolygon: [number, number][];
  buildingWidth: number;
  buildingDepth: number;
  buildingHeight: number;
  northAngle: number;
  // Sun / time
  month: number;
  timeHour: number;
  latitude: number;
  // Layout
  layoutMode: string;
  zones: any[];
  flows: any[];
  // Site
  siteBoundaryW: number;
  siteBoundaryH: number;
  siteNorthAngle: number;
  siteElements: any[];
  siteAccesses: any[];
  // Environment
  windDirection: number;
  windSpeed: number;
  envLayer: string;
  noiseSources: any[];
  thermalSeason: string;
  windViewCx: number;
  windViewCy: number;
  windViewW: number;
  windViewH: number;
  // Annotations
  annotations: any[];
  // Thumbnail
  thumbnailUrl?: string;
}

// ─── Save (create or update) ──────────────────────────────────────────────────

export async function saveDsdDiagramState(
  projectId: string,
  state: DsdSerializableState,
  existingId?: string | null,
): Promise<string> {
  const userId = auth.currentUser?.uid ?? 'anonymous';

  const docData = {
    appScope: '3dsd',
    type: 'diagram-state',
    ...state,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  if (existingId) {
    const ref = doc(db, `projects/${projectId}/workFiles`, existingId);
    await setDoc(ref, docData, { merge: true });
    return existingId;
  }

  const ref = await addDoc(collection(db, `projects/${projectId}/workFiles`), {
    ...docData,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return ref.id;
}

// ─── Thumbnail upload ─────────────────────────────────────────────────────────

export async function uploadDsdThumbnail(
  dataUrl: string,
  projectId: string,
  diagramKey: string,
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `projects/${projectId}/dsd-thumbnails/${diagramKey}.png`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, blob, { contentType: 'image/png' });
  return getDownloadURL(sRef);
}

/**
 * Upload a PNG thumbnail and persist thumbnailUrl to Firestore.
 * Call this after saveDsdDiagramState resolves with the final diagramId.
 * Errors are non-fatal — the caller should catch and warn.
 */
export async function updateDsdThumbnail(
  dataUrl: string,
  projectId: string,
  diagramId: string,
): Promise<void> {
  const url = await uploadDsdThumbnail(dataUrl, projectId, diagramId);
  const ref = doc(db, `projects/${projectId}/workFiles`, diagramId);
  await setDoc(ref, { thumbnailUrl: url }, { merge: true });
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadDsdDiagramState(
  projectId: string,
  diagramId: string,
): Promise<DsdSerializableState | null> {
  const ref = doc(db, `projects/${projectId}/workFiles`, diagramId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DsdSerializableState;
}
