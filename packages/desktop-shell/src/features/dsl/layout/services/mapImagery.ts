/**
 * mapImagery.ts
 * 住所 → 緯度経度（ジオコーディング）→ 航空写真/地図タイルを合成して
 * 1枚の画像（dataURL）＋実寸（mm）を返すサービス。
 *
 * すべて API キー不要のサービスを使う:
 *   - ジオコーディング: OpenStreetMap Nominatim
 *   - 航空写真:        Esri World Imagery（衛星/航空写真タイル）
 *   - 地図:            OpenStreetMap 標準タイル（道路地図）
 *
 * 縮尺は Web Mercator のタイル数学から正確に算出するため、生成画像を
 * そのまま地面に貼れば建物が実寸で正しく乗る。
 *
 * ⚠️ 利用規約メモ:
 *   - Nominatim / OSM タイルは「重い自動利用」を禁止。設計検証時の単発取得は許容範囲だが、
 *     量産・常時ポーリング用途には自前タイルor商用APIへ差し替えること。
 *   - 生成画像には各プロバイダの帰属表示（attribution）が必要。
 */

export type MapProvider = "satellite" | "osm";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface AerialImageResult {
  /** 合成画像（JPEG dataURL）。Three.js の TextureLoader にそのまま渡せる。 */
  dataUrl: string;
  /** 画像が覆う実世界の一辺の長さ（ミリメートル）。地面プレーンの寸法に使う。 */
  widthMm: number;
  /** 画像の一辺ピクセル数（正方形）。 */
  sizePx: number;
  /** 1ピクセルあたりの実寸（メートル/px、中心緯度基準）。 */
  metersPerPixel: number;
  centerLat: number;
  centerLng: number;
  zoom: number;
  attribution: string;
}

const TILE_SIZE = 256;

/** プロバイダ別の attribution 文言。 */
export const PROVIDER_ATTRIBUTION: Record<MapProvider, string> = {
  satellite: "Imagery © Esri, Maxar, Earthstar Geographics",
  osm: "© OpenStreetMap contributors",
};

/** タイル URL を組み立てる（プロバイダごとに座標順が違う点に注意）。 */
function tileUrl(provider: MapProvider, z: number, x: number, y: number): string {
  if (provider === "satellite") {
    // Esri World Imagery は {z}/{y}/{x} の順。
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  // OSM 標準タイルは {z}/{x}/{y}。
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** 経度 → タイル X（小数） */
function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

/** 緯度 → タイル Y（小数、Web Mercator） */
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

/** 中心緯度・ズームでの 1px あたりメートル（標準 256px タイル基準）。 */
export function metersPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

/**
 * 中心(lat,lng)から東へ eastM・北へ northM メートル離れた地点の緯度経度。
 * 小範囲の平面近似（敷地中心の逆算に十分）。
 */
export function offsetMetersToLatLng(
  centerLat: number,
  centerLng: number,
  eastM: number,
  northM: number
): { lat: number; lng: number } {
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos((centerLat * Math.PI) / 180));
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}

/**
 * 住所（日本語可）→ 緯度経度。Nominatim を使用。
 * 失敗時は例外を投げる。
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const q = encodeURIComponent(address.trim());
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ja&q=${q}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ジオコーディングに失敗しました (HTTP ${res.status})`);
  const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("住所が見つかりませんでした。表記を変えて再度お試しください。");
  }
  const hit = arr[0];
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
  };
}

/** 1枚のタイル画像を読み込む（CORS 対応）。失敗してもグレーで埋めて続行できるよう reject しない。 */
function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * 中心(lat,lng)を画像中心に据え、tilesPerSide×tilesPerSide 分のタイルを
 * 合成した正方形画像を生成する。中心がぴったり画像中心に来るようオフセットして切り出す。
 */
export async function fetchAerialImage(opts: {
  lat: number;
  lng: number;
  zoom?: number;
  tilesPerSide?: number;
  provider?: MapProvider;
}): Promise<AerialImageResult> {
  const { lat, lng } = opts;
  const zoom = Math.max(1, Math.min(21, Math.round(opts.zoom ?? 19)));
  const provider = opts.provider ?? "satellite";
  const N = Math.max(2, Math.min(8, opts.tilesPerSide ?? 4));

  const sizePx = N * TILE_SIZE;

  // 中心のワールドピクセル座標（タイル小数 × タイルサイズ）。
  const cxPx = lngToTileX(lng, zoom) * TILE_SIZE;
  const cyPx = latToTileY(lat, zoom) * TILE_SIZE;

  // キャンバス左上のワールドピクセル原点（中心を canvas 中央に合わせる）。
  const originX = cxPx - sizePx / 2;
  const originY = cyPx - sizePx / 2;

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D コンテキストを取得できませんでした");
  ctx.fillStyle = "#2b2b33";
  ctx.fillRect(0, 0, sizePx, sizePx);

  const maxTile = Math.pow(2, zoom);
  const firstTileX = Math.floor(originX / TILE_SIZE);
  const firstTileY = Math.floor(originY / TILE_SIZE);
  const lastTileX = Math.floor((originX + sizePx - 1) / TILE_SIZE);
  const lastTileY = Math.floor((originY + sizePx - 1) / TILE_SIZE);

  const jobs: Promise<void>[] = [];
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      // 経度方向はラップ、緯度方向は範囲外なら描かない。
      const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
      if (ty < 0 || ty >= maxTile) continue;
      const dx = tx * TILE_SIZE - originX;
      const dy = ty * TILE_SIZE - originY;
      const url = tileUrl(provider, zoom, wrappedX, ty);
      jobs.push(
        loadTile(url).then((img) => {
          if (img) ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
        })
      );
    }
  }
  await Promise.all(jobs);

  const mpp = metersPerPixel(lat, zoom);
  const widthMm = sizePx * mpp * 1000;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  return {
    dataUrl,
    widthMm,
    sizePx,
    metersPerPixel: mpp,
    centerLat: lat,
    centerLng: lng,
    zoom,
    attribution: PROVIDER_ATTRIBUTION[provider],
  };
}
