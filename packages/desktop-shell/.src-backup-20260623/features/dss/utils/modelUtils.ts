import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";

const STORAGE_BUCKET = "shapeshare3d.appspot.com";

export function buildStorageUrl(storagePath: string): string {
  const encoded = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encoded}?alt=media`;
}

export function getCanonicalModelId(model: any): string | null {
  const refId = model?.assetRef || model?.entityId || model?.modelRef?.id;
  const refPath = typeof model?.modelRef === "string" ? model.modelRef : null;
  const refPathId = refPath?.includes("/") ? refPath.split("/").pop() : null;

  return (
    refId ||
    refPathId ||
    model?.originalModelId ||
    model?.sourceModelId ||
    model?.metadata?.sourceModelId ||
    model?.modelId ||
    model?.id ||
    null
  );
}

export function findUrlByExtensionDeep(root: any, ext: string): string | null {
  try {
    if (!root) return null;

    const targetExt = String(ext || "")
      .toLowerCase()
      .replace(/^\./, "");
    if (!targetExt) return null;

    const stack = [root];
    const visited = new Set();

    while (stack.length) {
      const cur = stack.pop();
      if (!cur) continue;

      if (typeof cur === "string") {
        const lower = cur.toLowerCase();
        if (
          lower.includes("firebasestorage.googleapis.com") &&
          lower.includes(`.${targetExt}`)
        ) {
          return cur;
        }
        continue;
      }

      if (typeof cur !== "object") continue;

      if (visited.has(cur)) continue;
      visited.add(cur);

      if (Array.isArray(cur)) {
        for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
        continue;
      }

      for (const k of ["downloadURL", "downloadUrl", "url", "path", "name"]) {
        const v = cur[k];
        if (typeof v === "string") {
          const lower = v.toLowerCase();
          if (
            lower.includes("firebasestorage.googleapis.com") &&
            lower.includes(`.${targetExt}`)
          ) {
            return v;
          }
        }
      }

      const keys = Object.keys(cur);
      for (let i = 0; i < keys.length; i++) {
        stack.push(cur[keys[i]]);
      }
    }

    return null;
  } catch (e) {
    console.warn("[findUrlByExtensionDeep] fallback null:", e);
    return null;
  }
}

export function getDownloadUrlForModel(model: any, ext: string): string | null {
  if (!model) return null;
  const fmtKey = ext.toLowerCase();

  const mainUrl = model.mainFile?.downloadUrl || model.mainFile?.url;
  const mainName =
    model.mainFile?.fileName ||
    model.mainFile?.name ||
    model.mainFileName ||
    model.modelFileName ||
    "";
  if (
    mainUrl &&
    typeof mainName === "string" &&
    mainName.toLowerCase().includes(`.${fmtKey}`)
  ) {
    return mainUrl;
  }

  if (model.files && !Array.isArray(model.files)) {
    const filesObj = model.files;
    const entry =
      filesObj[fmtKey] || filesObj[fmtKey.toUpperCase()] || filesObj[fmtKey];

    if (entry) {
      if (entry.downloadUrl) return entry.downloadUrl;
      if (entry.url) return entry.url;
      if (entry.path) return buildStorageUrl(entry.path);
    }
  }

  if (Array.isArray(model.files) && model.files.length > 0) {
    const matched =
      model.files.find((f: any) => {
        const name = (f.fileName || f.name || "").toLowerCase();
        const e = (f.ext || f.fileType || "")
          .toString()
          .toLowerCase()
          .replace(/^\./, "");
        return name.endsWith(`.${fmtKey}`) || e === fmtKey;
      }) || null;

    if (matched?.downloadUrl) return matched.downloadUrl;
    if (matched?.url) return matched.url;
    if (matched?.path) return buildStorageUrl(matched.path);
  }

  const candidates = [
    model.downloadUrl,
    model.fileUrl,
    model.storageUrl,
    model.url,
    model.modelUrl,
    model.glbUrl,
    model.blendUrl,
  ].filter(Boolean);

  for (const u of candidates) {
    const lower = String(u).toLowerCase();
    if (
      lower.includes("firebasestorage.googleapis.com") &&
      lower.includes(`.${fmtKey}`)
    ) {
      return u;
    }
  }

  const deepUrl = findUrlByExtensionDeep(model, fmtKey);
  if (deepUrl) return deepUrl;

  return null;
}

export async function resolveDownloadUrl(model: any, ext: string, canonicalModelId: string): Promise<string | null> {
  const direct = getDownloadUrlForModel(model, ext);
  if (direct) return direct;

  const modelId = canonicalModelId;
  if (!modelId) return null;

  try {
    const snap = await getDoc(doc(db, "assets", modelId));
    if (!snap.exists()) return null;

    const fullData = { id: snap.id, ...snap.data() };
    const fromDoc = getDownloadUrlForModel(fullData, ext);
    if (fromDoc) return fromDoc;

    return null;
  } catch (e) {
    console.error("[DesktopModelCard] Failed to refetch model doc:", e);
    return null;
  }
}

export function getSizeLabelForModel(model: any, ext: string): string | null {
  if (!model) return null;
  const key = ext.toLowerCase();

  let s: any = null;

  if (model.files && !Array.isArray(model.files)) {
    const entry =
      model.files[key] || model.files[key.toUpperCase()] || model.files[key];
    if (entry && typeof entry === "object") {
      s = entry.size;
    }
  }

  if (s == null && Array.isArray(model.files) && model.files.length > 0) {
    const matched =
      model.files.find((f: any) => {
        const name = (f.fileName || f.name || "").toLowerCase();
        const e = (f.ext || f.fileType || "")
          .toString()
          .toLowerCase()
          .replace(/^\./, "");
        return name.endsWith(`.${key}`) || e === key;
      }) || null;
    s = matched?.size;
  }

  if (s == null) {
    if (key === "3dm") s = model.size3dm;
    else if (key === "glb") s = model.sizeGlb;
    else if (key === "blend") s = model.sizeBlend;
  }

  // Fallback to top-level model.size if the requested key is the primary format
  if (s == null) {
    const rawSize = model.size ?? model.sizeBytes ?? model.originalFileSize;
    if (rawSize != null) {
      const topExt = (model.ext || model.format || "").toString().toLowerCase().replace(/^\./, "");
      if (topExt === key) {
        s = rawSize;
      }
    }
  }

  if (s == null && model.metadata) {
    const meta = model.metadata;
    if (meta.files && !Array.isArray(meta.files)) {
      const entry = meta.files[key] || meta.files[key.toUpperCase()];
      if (entry && typeof entry === "object") s = entry.size;
    }
    if (s == null && Array.isArray(meta.files)) {
      const matched = meta.files.find((f: any) => {
        const name = (f.fileName || f.name || "").toLowerCase();
        const e = (f.ext || f.fileType || "").toString().toLowerCase().replace(/^\./, "");
        return name.endsWith(`.${key}`) || e === key;
      });
      s = matched?.size;
    }
    if (s == null) {
      if (key === "3dm") s = meta.size3dm;
      else if (key === "glb") s = meta.sizeGlb;
      else if (key === "blend") s = meta.sizeBlend;
    }
    if (s == null) {
      const rawSize = meta.size ?? meta.sizeBytes ?? meta.originalFileSize;
      if (rawSize != null) {
        const topExt = (meta.ext || meta.format || "").toString().toLowerCase().replace(/^\./, "");
        if (topExt === key) s = rawSize;
      }
    }
  }

  if (s == null || String(s).trim() === "") return null;

  const sStr = String(s).trim();
  
  // Already has unit formatting
  if (/[a-zA-Z]/.test(sStr)) {
    const lower = sStr.toLowerCase();
    if (lower.includes("mb")) return sStr.toUpperCase().replace(/\s+/g, '');
    if (lower.includes("kb") || lower.includes("gb")) return sStr; // Leave others if explicitly set
    // Otherwise it might be just "bytes", we can parse if we strip text, but safer to return
  }

  const num = parseFloat(sStr.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return sStr;

  // Assume bytes, convert to MB
  // (If it was previously stored as a bare MB value like "2.5", and we divide by 1024*1024 it's bad.
  // But 3D models < 100 bytes is essentially impossible, so if it's less than 1000, it might already be MB)
  if (num < 1000) {
     return `${num.toFixed(1)}MB`;
  }

  const mb = num / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

export function getAvailableFormatsFromModel(model: any) {
  const topExt = (model?.ext || model?.format || "").toLowerCase();
  
  const has3dm =
    topExt === "3dm" ||
    !!getDownloadUrlForModel(model, "3dm") ||
    !!model?.files?.["3dm"] ||
    !!model?.files?.["3DM"];
  const hasGlb =
    topExt === "glb" ||
    !!getDownloadUrlForModel(model, "glb") ||
    !!model?.files?.glb ||
    !!model?.files?.GLB ||
    !!model?.glbUrl;
  const hasBlend =
    topExt === "blend" ||
    !!getDownloadUrlForModel(model, "blend") ||
    !!model?.files?.blend ||
    !!model?.files?.BLEND ||
    !!model?.blendUrl;

  return { has3dm: !!has3dm, hasGlb: !!hasGlb, hasBlend: !!hasBlend };
}

export function buildOpenTargets(formats: any) {
  const targets = [];

  if (formats?.has3dm) {
    targets.push({
      id: "rhino-3dm",
      label: "Rhino（3DM）",
      app: "rhino",
      ext: "3dm",
    });
  }
  if (formats?.hasGlb) {
    targets.push({
      id: "rhino-glb",
      label: "Rhino（GLB）",
      app: "rhino",
      ext: "glb",
    });
  }
  if (formats?.hasBlend || formats?.hasGlb) {
    targets.push({
      id: "blender-any",
      label: "Blender（BLEND / GLB）",
      app: "blender",
      extCandidates: ["blend", "glb"],
    });
  }

  return targets;
}
