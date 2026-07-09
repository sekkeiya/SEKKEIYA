import { invoke } from "@tauri-apps/api/core";

const POSITIVE_TTL_MS = 30_000;
const NEGATIVE_TTL_MS = 1_500;

interface CacheItem {
  value: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheItem>();
const inFlight = new Map<string, Promise<string | null>>();

function makeKey(modelId: string, ext: string): string {
  return `${String(modelId)}::${String(ext || "").toLowerCase()}`;
}

function now(): number {
  return Date.now();
}

function getFromCache(key: string): string | null | undefined {
  const item = cache.get(key);
  if (!item) return undefined;

  if (item.expiresAt <= now()) {
    cache.delete(key);
    return undefined;
  }
  return item.value;
}

function setCache(key: string, value: string | null, ttlMs: number): void {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

async function invokeGetModelLocalPath(modelId: string, ext: string): Promise<unknown> {
  const e = String(ext || "").toLowerCase();
  return await invoke("get_model_local_path", {
    modelId: String(modelId),
    model_id: String(modelId),
    ext: e,
  });
}

export async function getModelLocalPathCached(modelId: string, ext: string): Promise<string | null> {
  if (!modelId || !ext) return null;

  const key = makeKey(modelId, ext);

  const cached = getFromCache(key);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(key);
  if (existing) return await existing;

  const p = (async () => {
    try {
      const filePath = await invokeGetModelLocalPath(modelId, ext);

      if (typeof filePath === "string" && filePath.length > 0) {
        setCache(key, filePath, POSITIVE_TTL_MS);
        return filePath;
      }

      setCache(key, null, NEGATIVE_TTL_MS);
      return null;
    } catch (err) {
      setCache(key, null, NEGATIVE_TTL_MS);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return await p;
}

export function invalidateModelLocalPathCacheByModelId(modelId: string): void {
  if (!modelId) return;
  const prefix = `${String(modelId)}::`;

  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
  for (const k of Array.from(inFlight.keys())) {
    if (k.startsWith(prefix)) inFlight.delete(k);
  }
}

export function clearModelLocalPathCache(): void {
  cache.clear();
  inFlight.clear();
}
