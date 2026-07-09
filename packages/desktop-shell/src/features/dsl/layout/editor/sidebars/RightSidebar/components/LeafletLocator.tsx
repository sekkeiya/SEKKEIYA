import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapProvider } from "../../../../services/mapImagery";

interface FocusTarget {
  lat: number;
  lng: number;
  nonce: number;
}

interface Props {
  provider: MapProvider;
  initialLat: number | null;
  initialLng: number | null;
  /** nonce が変わると setView + ピン移動 + onPick を行う（検索からのフォーカス用）。 */
  focus: FocusTarget | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
}

const TILE = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    maxZoom: 21,
  },
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
} as const;

const pinIcon = L.divIcon({
  className: "sek-map-pin",
  html:
    '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:#f97316;' +
    'border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 5px rgba(0,0,0,.6)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 16],
});

/**
 * Google マップ風の場所選択。パン/ズーム/クリックでピン、検索からのフォーカスに対応。
 * バニラ Leaflet を div にマウント（react-leaflet 非依存）。
 */
export default function LeafletLocator({
  provider,
  initialLat,
  initialLng,
  focus,
  onPick,
  height = 300,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const placeMarker = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onPickRef.current?.(p.lat, p.lng);
      });
      markerRef.current = m;
    }
  };

  // 初期化（1回）
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const hasInit = initialLat != null && initialLng != null;
    const map = L.map(elRef.current, {
      center: [hasInit ? (initialLat as number) : 35.681, hasInit ? (initialLng as number) : 139.767],
      zoom: hasInit ? 18 : 5,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    const t = TILE[provider];
    layerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
      onPickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    if (hasInit) placeMarker(initialLat as number, initialLng as number);

    // パネル幅確定後にサイズ再計算
    const ro = new ResizeObserver(() => map.invalidateSize());
    if (elRef.current) ro.observe(elRef.current);
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // プロバイダ切替でタイルレイヤ差し替え
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    const t = TILE[provider];
    layerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom }).addTo(map);
  }, [provider]);

  // 検索からのフォーカス
  useEffect(() => {
    if (!focus) return;
    const map = mapRef.current;
    if (!map) return;
    map.setView([focus.lat, focus.lng], 18);
    placeMarker(focus.lat, focus.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return (
    <div
      ref={elRef}
      style={{ width: "100%", height, borderRadius: 8, overflow: "hidden", background: "var(--brand-bg)" }}
    />
  );
}
