import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Typography,
  Stack,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
} from "@mui/material";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PentagonRoundedIcon from "@mui/icons-material/PentagonRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";

import { useMapGroundStore } from "../../../../store/useMapGroundStore";
import { useSceneObjectRegistryStore } from "../../../../store/sceneObjectRegistryStore";
import { layoutSceneRef } from "../../../../services/layoutSceneRef";
import * as THREE from "three";
import {
  geocodeAddress,
  fetchAerialImage,
  type MapProvider,
} from "../../../../services/mapImagery";
import LeafletLocator from "./LeafletLocator";

/** 小見出し付きステップ枠。 */
function Step({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Chip label={no} size="small" color="primary" sx={{ height: 20, fontWeight: 700 }} />
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

export default function MapPanel() {
  const setGenerated = useMapGroundStore((s) => s.setGenerated);
  const imageUrl = useMapGroundStore((s) => s.imageUrl);
  const visible = useMapGroundStore((s) => s.visible);
  const setVisible = useMapGroundStore((s) => s.setVisible);
  const scale = useMapGroundStore((s) => s.scale);
  const setScale = useMapGroundStore((s) => s.setScale);
  const opacity = useMapGroundStore((s) => s.opacity);
  const setOpacity = useMapGroundStore((s) => s.setOpacity);
  const rotationDeg = useMapGroundStore((s) => s.rotationDeg);
  const setRotationDeg = useMapGroundStore((s) => s.setRotationDeg);
  const baseWidthMm = useMapGroundStore((s) => s.baseWidthMm);
  const attribution = useMapGroundStore((s) => s.attribution);
  const clear = useMapGroundStore((s) => s.clear);
  const setOffset = useMapGroundStore((s) => s.setOffset);
  const setYMm = useMapGroundStore((s) => s.setYMm);

  const pinLat = useMapGroundStore((s) => s.pinLat);
  const pinLng = useMapGroundStore((s) => s.pinLng);
  const setPin = useMapGroundStore((s) => s.setPin);

  const drawMode = useMapGroundStore((s) => s.drawMode);
  const setDrawMode = useMapGroundStore((s) => s.setDrawMode);
  const sitePoints = useMapGroundStore((s) => s.sitePoints);
  const clearSite = useMapGroundStore((s) => s.clearSite);
  const linePoints = useMapGroundStore((s) => s.linePoints);
  const clearLine = useMapGroundStore((s) => s.clearLine);

  const [address, setAddress] = useState("");
  const [provider, setProvider] = useState<MapProvider>("satellite");
  const [zoom, setZoom] = useState(19);
  const [tiles, setTiles] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lineLengthInput, setLineLengthInput] = useState("");
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const nonceRef = useRef(0);

  // パネルを離れたら作図モード解除。
  useEffect(() => {
    return () => setDrawMode("none");
  }, [setDrawMode]);

  // Base（躯体）中心。
  const getBaseCenter = useCallback(() => {
    const box = new THREE.Box3();
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    if (colliders.length) {
      colliders.forEach((c: any) => {
        c?.updateMatrixWorld?.(true);
        box.expandByObject(c);
      });
    }
    if (box.isEmpty() && layoutSceneRef.baseRoot) {
      try {
        layoutSceneRef.baseRoot.updateMatrixWorld?.(true);
        box.expandByObject(layoutSceneRef.baseRoot);
      } catch {}
    }
    if (box.isEmpty()) return null;
    const c = box.getCenter(new THREE.Vector3());
    return { x: c.x, z: c.z, minY: box.min.y };
  }, []);

  // ① 住所検索 → 地図をその場所へ移動＋ピン。
  const handleSearch = useCallback(async () => {
    if (!address.trim()) {
      setError("住所を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("住所を検索中…");
    try {
      const geo = await geocodeAddress(address);
      setPin(geo.lat, geo.lng);
      nonceRef.current += 1;
      setFocus({ lat: geo.lat, lng: geo.lng, nonce: nonceRef.current });
      setStatus("地図を移動しました。ピンを敷地の中心に合わせて『生成』してください。");
    } catch (e: any) {
      setError(e?.message || "検索に失敗しました。");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [address, setPin]);

  // ② ピン（敷地中心）で航空写真を生成し 3D 地面へ。
  const handleGenerate = useCallback(async () => {
    if (pinLat == null || pinLng == null) {
      setError("先に地図でピンを置いてください（クリックまたは検索）。");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("航空写真を取得中…");
    try {
      const img = await fetchAerialImage({
        lat: pinLat,
        lng: pinLng,
        zoom,
        tilesPerSide: tiles,
        provider,
      });
      setGenerated({
        imageUrl: img.dataUrl,
        baseWidthMm: img.widthMm,
        provider,
        centerLat: img.centerLat,
        centerLng: img.centerLng,
        zoom: img.zoom,
        address: address || "敷地",
        attribution: img.attribution,
      });
      // Base があれば建物の真下へ配置。
      const b = getBaseCenter();
      if (b) {
        setOffset(b.x, b.z);
        setYMm(b.minY - 2);
      }
      setStatus(
        `生成しました：範囲 約 ${(img.widthMm / 1000).toFixed(0)} m 四方。次に基準線で縮尺を合わせてください。`
      );
    } catch (e: any) {
      setError(e?.message || "生成に失敗しました。");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [pinLat, pinLng, zoom, tiles, provider, address, setGenerated, getBaseCenter, setOffset, setYMm]);

  // ③ 基準線の現在実寸（m）
  const lineMeasuredM = useMemo(() => {
    if (linePoints.length < 2) return null;
    const [a, b] = linePoints;
    const Lmm = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return Lmm / (1000 * scale);
  }, [linePoints, scale]);

  const handleCalibrate = useCallback(() => {
    if (linePoints.length < 2) {
      setError("基準線を2点で引いてください。");
      return;
    }
    const D = parseFloat(lineLengthInput);
    if (!(D > 0)) {
      setError("基準線の実寸（m）を入力してください。");
      return;
    }
    const [a, b] = linePoints;
    const Lmm = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Lmm <= 0) return;
    setScale(Lmm / (1000 * D));
    clearLine();
    setDrawMode("none");
    setError(null);
    setStatus(`基準線を ${D} m に合わせて縮尺を確定しました。`);
  }, [linePoints, lineLengthInput, setScale, clearLine, setDrawMode]);

  const widthM = (baseWidthMm * scale) / 1000;

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 1.25 }}>
      <Stack spacing={2}>
        {/* ① 場所を決める */}
        <Step no={1} title="場所を決める">
          <Stack direction="row" spacing={1}>
            <TextField
              label="住所で検索"
              placeholder="例：千葉県浦安市"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) handleSearch();
              }}
              fullWidth
              size="small"
              disabled={busy}
            />
            <IconButton onClick={handleSearch} disabled={busy} color="primary">
              <SearchRoundedIcon />
            </IconButton>
          </Stack>
          <ToggleButtonGroup
            value={provider}
            exclusive
            size="small"
            fullWidth
            onChange={(_, v) => v && setProvider(v)}
          >
            <ToggleButton value="satellite">航空写真</ToggleButton>
            <ToggleButton value="osm">地図（道路）</ToggleButton>
          </ToggleButtonGroup>
          <LeafletLocator
            provider={provider}
            initialLat={pinLat}
            initialLng={pinLng}
            focus={focus}
            onPick={(la, lo) => setPin(la, lo)}
            height={300}
          />
          <Typography variant="caption" color="text.secondary">
            地図をドラッグで移動・ホイールでズーム。<strong>クリックで敷地にピン</strong>（ドラッグで微調整）。
            {pinLat != null && pinLng != null && (
              <>
                {" "}
                現在のピン：{pinLat.toFixed(5)}, {pinLng.toFixed(5)}
              </>
            )}
          </Typography>
        </Step>

        <Divider />

        {/* ② 敷地中心で生成 */}
        <Step no={2} title="敷地中心で生成">
          <Box>
            <Typography variant="caption" color="text.secondary">
              詳細度（ズーム {zoom}）／ タイル数（{tiles}×{tiles}）
            </Typography>
            <Slider
              value={zoom}
              min={16}
              max={21}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_, v) => setZoom(v as number)}
              disabled={busy}
            />
            <Slider
              value={tiles}
              min={2}
              max={8}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_, v) => setTiles(v as number)}
              disabled={busy}
            />
          </Box>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={busy || pinLat == null}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <MapRoundedIcon />}
          >
            {busy ? "処理中…" : "ピンの位置で生成"}
          </Button>
        </Step>

        {error && <Alert severity="error">{error}</Alert>}
        {status && !error && <Alert severity="success">{status}</Alert>}

        {imageUrl && (
          <>
            <Box>
              <img
                src={imageUrl}
                alt="map preview"
                style={{ width: "100%", borderRadius: 8, display: "block" }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  {attribution}
                </Typography>
                <Box>
                  <Tooltip title={visible ? "地面を隠す" : "地面を表示"}>
                    <IconButton size="small" onClick={() => setVisible(!visible)}>
                      {visible ? (
                        <VisibilityRoundedIcon fontSize="small" />
                      ) : (
                        <VisibilityOffRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="地図を削除">
                    <IconButton size="small" onClick={() => clear()}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* ③ 基準線で縮尺を合わせる */}
            <Step no={3} title="基準線で縮尺を合わせる">
              <Typography variant="caption" color="text.secondary">
                3D 地図上で<strong>左クリック2点</strong>、実在の長さが分かる線（道路幅・敷地辺など）を引きます。
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant={drawMode === "line" ? "contained" : "outlined"}
                  size="small"
                  fullWidth
                  startIcon={<StraightenRoundedIcon />}
                  onClick={() => setDrawMode(drawMode === "line" ? "none" : "line")}
                >
                  {drawMode === "line" ? `基準線（${linePoints.length}/2点）` : "基準線を引く"}
                </Button>
                <Button variant="outlined" size="small" onClick={() => clearLine()} disabled={linePoints.length === 0}>
                  クリア
                </Button>
              </Stack>
              {lineMeasuredM != null && (
                <Typography variant="caption" color="text.secondary">
                  現在の線の長さ：約 {lineMeasuredM.toFixed(2)} m
                </Typography>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="実寸 (m)"
                  type="number"
                  size="small"
                  value={lineLengthInput}
                  onChange={(e) => setLineLengthInput(e.target.value)}
                  sx={{ width: 120 }}
                />
                <Button variant="contained" size="small" onClick={handleCalibrate} disabled={linePoints.length < 2}>
                  この寸法に合わせる
                </Button>
              </Stack>
            </Step>

            {/* ④ 敷地を描く */}
            <Step no={4} title="敷地を描く">
              <Typography variant="caption" color="text.secondary">
                3D 地図上を<strong>左クリック</strong>で敷地の角を順に打ち、<strong>ダブルクリック/Enter</strong>で確定。
                頂点は<strong>ドラッグで移動</strong>、選択して<strong>Deleteで削除</strong>。
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant={drawMode === "site" ? "contained" : "outlined"}
                  size="small"
                  fullWidth
                  startIcon={<PentagonRoundedIcon />}
                  onClick={() => setDrawMode(drawMode === "site" ? "none" : "site")}
                >
                  {drawMode === "site" ? `作図中（${sitePoints.length}点）` : "敷地を描く"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    clearSite();
                    setDrawMode("none");
                  }}
                  disabled={sitePoints.length === 0}
                >
                  クリア
                </Button>
              </Stack>
            </Step>

            <Divider />

            {/* 仕上げ調整 */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                向き（{rotationDeg}°）／ 位置は<strong>右ドラッグ</strong>、ズームは<strong>Ctrl+右ドラッグ</strong>
              </Typography>
              <Slider
                value={rotationDeg}
                min={-180}
                max={180}
                step={1}
                valueLabelDisplay="auto"
                onChange={(_, v) => setRotationDeg(v as number)}
              />
              <Typography variant="caption" color="text.secondary">
                縮尺（×{scale.toFixed(3)}） ／ 一辺 約 {widthM.toFixed(0)} m
              </Typography>
              <Slider
                value={scale}
                min={0.05}
                max={3}
                step={0.005}
                valueLabelDisplay="auto"
                onChange={(_, v) => setScale(v as number)}
              />
              <Typography variant="caption" color="text.secondary">
                不透明度（{Math.round(opacity * 100)}%）
              </Typography>
              <Slider
                value={opacity}
                min={0.1}
                max={1}
                step={0.05}
                valueLabelDisplay="auto"
                onChange={(_, v) => setOpacity(v as number)}
              />
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
