// WalkthroughMetadataEditor.tsx
//
// Phase D: S.Model のモデル詳細で「ウォークスルー設定」を編集する。
//   - キャラクター属性（目線高さ）
//   - ギミック（クリックで開閉）: クリップ割当 or ヒンジ定義
//   - GLB を解析してアニメクリップ名・ノード名・リグ有無を表示
//
// 値は { character, gimmick } 形式で onChange する。
// 保存先は asset.extendedMetadata.character / .gimmick（DssRightPanel が永続化）。

import React, { Suspense, useEffect, useMemo, useState } from "react";
import {
  Box, Typography, TextField, MenuItem, Select, ToggleButtonGroup, ToggleButton, Chip, Button, IconButton,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useGLTF } from "@react-three/drei";
import type { GimmickSpec } from "../../shared/walkthrough/gimmicks";

export interface GlbInfo {
  clips: string[];
  nodes: string[];
  bones: number;
  skinned: boolean;
}

// ── GLB プローブ（drei キャッシュを再利用、Canvas 外でも動作）─────
function GlbInspectorProbe({ url, onResult }: { url: string; onResult: (info: GlbInfo) => void }) {
  const gltf = useGLTF(url) as any;
  useEffect(() => {
    const clips: string[] = (gltf.animations || []).map((a: any) => a.name).filter(Boolean);
    const nodes: string[] = [];
    let bones = 0;
    let skinned = false;
    gltf.scene?.traverse((o: any) => {
      if (o.name && (o.isMesh || o.isObject3D) && nodes.indexOf(o.name) < 0) nodes.push(o.name);
      if (o.isBone) bones += 1;
      if (o.isSkinnedMesh) skinned = true;
    });
    onResult({ clips, nodes, bones, skinned });
  }, [gltf, url]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

class ProbeBoundary extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  constructor(p: any) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const labelSx = { color: "rgb(var(--brand-fg-rgb) / 0.55)", fontSize: 10, mb: 0.25 } as const;
const boxSx = {
  display: "flex", flexDirection: "column", gap: 0.75, mt: 0.5, p: 1,
  bgcolor: "light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))", borderRadius: 1, border: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
} as const;
const inputSx = {
  "& .MuiOutlinedInput-root": { color: "var(--brand-fg)", fontSize: 12, bgcolor: "rgb(var(--brand-fg-rgb) / 0.04)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgb(var(--brand-fg-rgb) / 0.1)" },
} as const;

export default function WalkthroughMetadataEditor({
  glbUrl,
  macroCategory,
  character,
  gimmicks,
  anim,
  info,
  onChange,
  disabled = false,
  showInfo = true,
  infoOnly = false,
}: {
  glbUrl?: string | null;
  macroCategory?: string;
  character?: any;
  gimmicks?: GimmickSpec[];
  anim?: any;
  info?: any;
  onChange: (next: { character: any; gimmicks: GimmickSpec[]; gimmick: any; anim: any; info: any }) => void;
  disabled?: boolean;
  /** false で情報セクションを隠す（動きタブ用）。 */
  showInfo?: boolean;
  /** true で情報セクションのみ表示（情報タブ用）。 */
  infoOnly?: boolean;
}) {
  const isCharacter = macroCategory === "キャラクター";

  const [glbInfo, setGlbInfo] = useState<GlbInfo | null>(null);
  const [analyze, setAnalyze] = useState(false);
  const [failed, setFailed] = useState(false);

  // モデルが変わったら解析結果をリセット（解析はユーザー操作で実行＝毎回DLしない）
  useEffect(() => {
    setGlbInfo(null);
    setFailed(false);
    setAnalyze(false);
  }, [glbUrl]);

  const eyeCm = useMemo(() => {
    const m = Number(character?.eyeM);
    return Number.isFinite(m) && m > 0 ? Math.round(m * 100) : "";
  }, [character?.eyeM]);

  const gimmickList: GimmickSpec[] = Array.isArray(gimmicks) ? gimmicks : [];

  const emit = (patch: { character?: any; gimmicks?: GimmickSpec[]; anim?: any; info?: any }) => {
    const nextGimmicks = patch.gimmicks !== undefined ? patch.gimmicks : gimmickList;
    onChange({
      character: patch.character !== undefined ? patch.character : character || null,
      gimmicks: nextGimmicks,
      gimmick: (nextGimmicks && nextGimmicks[0]) || null,
      anim: patch.anim !== undefined ? patch.anim : anim || null,
      info: patch.info !== undefined ? patch.info : info || null,
    });
  };

  const newGimmick = (type: "clip" | "hinge" | "slide"): GimmickSpec => {
    if (type === "clip") return { id: crypto.randomUUID(), type: "clip", openClip: "", closeClip: "", label: "ドア" };
    if (type === "slide") return { id: crypto.randomUUID(), type: "slide", axis: "x", distance: 200, pivot: "", label: "動かす" };
    return { id: crypto.randomUUID(), type: "hinge", axis: "y", openDeg: 90, pivot: "", label: "ドア" };
  };
  const addGimmick = (type: "clip" | "hinge" | "slide") => emit({ gimmicks: [...gimmickList, newGimmick(type)] });
  const updateGimmick = (id: string, patch: Partial<GimmickSpec>) =>
    emit({ gimmicks: gimmickList.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const removeGimmick = (id: string) => emit({ gimmicks: gimmickList.filter((g) => g.id !== id) });

  const aType: "none" | "rotate" | "move" = anim?.type === "rotate" || anim?.type === "move" ? anim.type : "none";
  const setAnimType = (t: "none" | "rotate" | "move") => {
    if (t === "none") return emit({ anim: null });
    if (t === "rotate") return emit({ anim: { type: "rotate", axis: anim?.axis || "y", speedDeg: anim?.speedDeg ?? 30 } });
    return emit({ anim: { type: "move", axis: anim?.axis || "y", distance: anim?.distance ?? 100, period: anim?.period ?? 3 } });
  };

  // ④ アイテム情報
  const infoLinks: Array<{ title: string; url: string }> = Array.isArray(info?.links) ? info.links : [];
  const normInfo = (next: { description?: string; links?: any[] }) => {
    const description = next.description !== undefined ? next.description : info?.description || "";
    const links = next.links !== undefined ? next.links : infoLinks;
    // 編集中は空行も保持（保存時に DssModelDetailView 側で空リンクを除去する）。
    const hasContent = !!(description && description.trim()) || (Array.isArray(links) && links.length > 0);
    return hasContent ? { description: description || "", links: links || [] } : null;
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      {!infoOnly && (
        <Typography sx={{ color: "var(--brand-fg)", fontSize: 12, fontWeight: 700, mb: 0.5 }}>
          アニメーション設定
        </Typography>
      )}

      {!infoOnly && (<>
      {/* GLB 解析 */}
      {glbUrl && analyze && !glbInfo && !failed && (
        <Suspense fallback={<Typography sx={labelSx}>モデルを解析中…</Typography>}>
          <ProbeBoundary onFail={() => { setFailed(true); }}>
            <GlbInspectorProbe url={glbUrl} onResult={setGlbInfo} />
          </ProbeBoundary>
        </Suspense>
      )}

      <Box sx={boxSx}>
        <Typography sx={labelSx}>モデル解析（アニメ・ノードの検出）</Typography>
        {!glbUrl && <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>GLB がありません</Typography>}
        {glbUrl && !analyze && !glbInfo && (
          <Button size="small" onClick={() => { setFailed(false); setAnalyze(true); }}
            sx={{ alignSelf: "flex-start", fontSize: 11, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", border: "1px solid rgba(79,140,255,0.4)", px: 1, py: 0.25 }}>
            このモデルを解析
          </Button>
        )}
        {failed && <Typography sx={{ color: "light-dark(#ad6700, #ffb74d)", fontSize: 11 }}>解析できませんでした（圧縮形式など）。手動で設定できます。</Typography>}
        {glbInfo && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
              <Chip size="small" label={`アニメ ${glbInfo.clips.length}`} sx={{ height: 18, fontSize: 10, bgcolor: "rgba(79,140,255,0.2)", color: "light-dark(#003fad, #9ec1ff)" }} />
              <Chip size="small" label={glbInfo.skinned ? `リグあり (${glbInfo.bones}ボーン)` : "リグなし"} sx={{ height: 18, fontSize: 10, bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", color: "rgb(var(--brand-fg-rgb) / 0.7)" }} />
              <Chip size="small" label={`ノード ${glbInfo.nodes.length}`} sx={{ height: 18, fontSize: 10, bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", color: "rgb(var(--brand-fg-rgb) / 0.7)" }} />
            </Box>
            {glbInfo.clips.length > 0 && (
              <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontSize: 10 }}>
                クリップ: {glbInfo.clips.join(" / ")}
              </Typography>
            )}
          </Box>
        )}
        {glbUrl && (failed || glbInfo) && (
          <Button size="small" onClick={() => { setGlbInfo(null); setFailed(false); setAnalyze(true); }}
            sx={{ alignSelf: "flex-start", fontSize: 10, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", minWidth: 0, p: 0.25 }}>
            再解析
          </Button>
        )}
      </Box>

      {/* キャラクター属性 */}
      {isCharacter && (
        <Box sx={boxSx}>
          <Typography sx={labelSx}>キャラクター（一人称の目線高さ）</Typography>
          <TextField
            size="small" type="number" disabled={disabled}
            value={eyeCm}
            onChange={(e) => {
              const cm = Number(e.target.value);
              const next = Number.isFinite(cm) && cm > 0 ? { ...(character || {}), eyeM: cm / 100 } : { ...(character || {}) };
              if (!(cm > 0)) delete next.eyeM;
              emit({ character: Object.keys(next).length ? next : null });
            }}
            placeholder="例: 160"
            InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>cm</Typography> }}
            sx={inputSx}
          />
          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.35)", fontSize: 10 }}>
            未入力なら全高から自動推定（全高 − 12cm）。
          </Typography>
        </Box>
      )}

      {/* ギミック（複数登録可・各ボタンがウォークスルーに出る） */}
      <Box sx={boxSx}>
        <Typography sx={labelSx}>ギミック（クリックで操作・複数可）</Typography>

        {gimmickList.length === 0 && (
          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>未登録（下のボタンで追加）</Typography>
        )}

        {gimmickList.map((g) => (
          <Box key={g.id} sx={{ p: 1, borderRadius: 1, bgcolor: "rgb(var(--brand-fg-rgb) / 0.03)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.07)", display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip size="small" label={g.type === "hinge" ? "ヒンジ" : g.type === "slide" ? "スライド" : "アニメ"} sx={{ height: 18, fontSize: 10, bgcolor: "rgba(79,140,255,0.2)", color: "light-dark(#003fad, #9ec1ff)" }} />
              <TextField size="small" disabled={disabled} value={g.label || ""}
                onChange={(e) => updateGimmick(g.id, { label: e.target.value })}
                placeholder="表示名（例: ドア）" sx={{ ...inputSx, flex: 1 }} />
              <IconButton size="small" disabled={disabled} onClick={() => removeGimmick(g.id)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", "&:hover": { color: "#ef5350" } }}>
                <CloseRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>

            {g.type === "clip" && (
              <>
                <Box>
                  <Typography sx={labelSx}>開くクリップ</Typography>
                  <Select size="small" fullWidth disabled={disabled} value={g.openClip || ""} displayEmpty
                    onChange={(e) => updateGimmick(g.id, { openClip: e.target.value })} sx={inputSx}>
                    <MenuItem value=""><em>自動（open/最初のクリップ）</em></MenuItem>
                    {(glbInfo?.clips || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </Box>
                <Box>
                  <Typography sx={labelSx}>閉じるクリップ（任意・無ければ逆再生）</Typography>
                  <Select size="small" fullWidth disabled={disabled} value={g.closeClip || ""} displayEmpty
                    onChange={(e) => updateGimmick(g.id, { closeClip: e.target.value })} sx={inputSx}>
                    <MenuItem value=""><em>自動 / 逆再生</em></MenuItem>
                    {(glbInfo?.clips || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </Box>
              </>
            )}

            {g.type === "hinge" && (
              <>
                <Box>
                  <Typography sx={labelSx}>回転軸</Typography>
                  <ToggleButtonGroup exclusive size="small" disabled={disabled} value={g.axis || "y"}
                    onChange={(_, v) => v && updateGimmick(g.id, { axis: v })}
                    sx={{ "& .MuiToggleButton-root": { color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 11, py: 0.25, px: 1.25, borderColor: "rgb(var(--brand-fg-rgb) / 0.12)" }, "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(79,140,255,0.35) !important" } }}>
                    <ToggleButton value="x">X</ToggleButton>
                    <ToggleButton value="y">Y（縦軸）</ToggleButton>
                    <ToggleButton value="z">Z</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box>
                  <Typography sx={labelSx}>開く角度</Typography>
                  <TextField size="small" type="number" disabled={disabled} value={g.openDeg ?? 90}
                    onChange={(e) => updateGimmick(g.id, { openDeg: Number(e.target.value) })}
                    InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>°</Typography> }} sx={inputSx} />
                </Box>
                <Box>
                  <Typography sx={labelSx}>回転させるノード（ヒンジ）</Typography>
                  <Select size="small" fullWidth disabled={disabled} value={g.pivot || ""} displayEmpty
                    onChange={(e) => updateGimmick(g.id, { pivot: e.target.value })} sx={inputSx}>
                    <MenuItem value=""><em>モデル全体</em></MenuItem>
                    {(glbInfo?.nodes || []).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  </Select>
                </Box>
              </>
            )}

            {g.type === "slide" && (
              <>
                <Typography sx={{ ...labelSx, mt: -0.25 }}>クリックで一回再生（移動して停止・再押下で戻る）</Typography>
                <Box>
                  <Typography sx={labelSx}>移動軸</Typography>
                  <ToggleButtonGroup exclusive size="small" disabled={disabled} value={g.axis || "x"}
                    onChange={(_, v) => v && updateGimmick(g.id, { axis: v })}
                    sx={{ "& .MuiToggleButton-root": { color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 11, py: 0.25, px: 1.25, borderColor: "rgb(var(--brand-fg-rgb) / 0.12)" }, "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(79,140,255,0.35) !important" } }}>
                    <ToggleButton value="x">X</ToggleButton>
                    <ToggleButton value="y">Y（縦軸）</ToggleButton>
                    <ToggleButton value="z">Z</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box>
                  <Typography sx={labelSx}>移動量</Typography>
                  <TextField size="small" type="number" disabled={disabled} value={g.distance ?? 200}
                    onChange={(e) => updateGimmick(g.id, { distance: Number(e.target.value) })}
                    InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>mm</Typography> }} sx={inputSx} />
                </Box>
                <Box>
                  <Typography sx={labelSx}>動かすノード（任意・既定はモデル全体）</Typography>
                  <Select size="small" fullWidth disabled={disabled} value={g.pivot || ""} displayEmpty
                    onChange={(e) => updateGimmick(g.id, { pivot: e.target.value })} sx={inputSx}>
                    <MenuItem value=""><em>モデル全体</em></MenuItem>
                    {(glbInfo?.nodes || []).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  </Select>
                </Box>
              </>
            )}
          </Box>
        ))}

        <Box sx={{ display: "flex", gap: 1, mt: 0.25 }}>
          <Button size="small" disabled={disabled} startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => addGimmick("hinge")} sx={{ fontSize: 11, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", border: "1px solid rgba(79,140,255,0.4)", px: 1 }}>
            ヒンジ追加
          </Button>
          <Button size="small" disabled={disabled} startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => addGimmick("clip")} sx={{ fontSize: 11, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", border: "1px solid rgba(79,140,255,0.4)", px: 1 }}>
            アニメ追加
          </Button>
          <Button size="small" disabled={disabled} startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => addGimmick("slide")} sx={{ fontSize: 11, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", border: "1px solid rgba(79,140,255,0.4)", px: 1 }}>
            スライド追加
          </Button>
        </Box>
      </Box>

      {/* ③ 常時アニメ（展示用ループ） */}
      <Box sx={boxSx}>
        <Typography sx={labelSx}>常時アニメ（展示用ループ）</Typography>
        <ToggleButtonGroup
          exclusive size="small" disabled={disabled}
          value={aType}
          onChange={(_, v) => v && setAnimType(v)}
          sx={{ "& .MuiToggleButton-root": { color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 11, py: 0.25, px: 1, borderColor: "rgb(var(--brand-fg-rgb) / 0.12)", textTransform: "none" }, "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(79,140,255,0.35) !important" } }}
        >
          <ToggleButton value="none">なし</ToggleButton>
          <ToggleButton value="rotate">回転</ToggleButton>
          <ToggleButton value="move">往復</ToggleButton>
        </ToggleButtonGroup>

        {(aType === "rotate" || aType === "move") && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 0.5 }}>
            <Box>
              <Typography sx={labelSx}>軸</Typography>
              <ToggleButtonGroup
                exclusive size="small" disabled={disabled}
                value={anim?.axis || "y"}
                onChange={(_, v) => v && emit({ anim: { ...anim, axis: v } })}
                sx={{ "& .MuiToggleButton-root": { color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 11, py: 0.25, px: 1.25, borderColor: "rgb(var(--brand-fg-rgb) / 0.12)" }, "& .Mui-selected": { color: "#fff !important", bgcolor: "rgba(79,140,255,0.35) !important" } }}
              >
                <ToggleButton value="x">X</ToggleButton>
                <ToggleButton value="y">Y（縦軸）</ToggleButton>
                <ToggleButton value="z">Z</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {aType === "rotate" && (
              <Box>
                <Typography sx={labelSx}>回転速度</Typography>
                <TextField size="small" type="number" disabled={disabled}
                  value={anim?.speedDeg ?? 30}
                  onChange={(e) => emit({ anim: { ...anim, type: "rotate", speedDeg: Number(e.target.value) } })}
                  InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>°/秒</Typography> }}
                  sx={inputSx} />
              </Box>
            )}
            {aType === "move" && (
              <>
                <Box>
                  <Typography sx={labelSx}>振幅</Typography>
                  <TextField size="small" type="number" disabled={disabled}
                    value={anim?.distance ?? 100}
                    onChange={(e) => emit({ anim: { ...anim, type: "move", distance: Number(e.target.value) } })}
                    InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>mm</Typography> }}
                    sx={inputSx} />
                </Box>
                <Box>
                  <Typography sx={labelSx}>周期</Typography>
                  <TextField size="small" type="number" disabled={disabled}
                    value={anim?.period ?? 3}
                    onChange={(e) => emit({ anim: { ...anim, type: "move", period: Number(e.target.value) } })}
                    InputProps={{ endAdornment: <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 11 }}>秒</Typography> }}
                    sx={inputSx} />
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      </>)}

      {(infoOnly || showInfo) && (
      <Box sx={boxSx}>
        <Typography sx={labelSx}>アイテム情報（ⓘ・アニメーションで開示）</Typography>
        <TextField
          size="small" multiline minRows={2} disabled={disabled}
          value={info?.description || ""} placeholder="説明（素材・特徴・寸法など）"
          onChange={(e) => emit({ info: normInfo({ description: e.target.value }) })}
          sx={inputSx}
        />
        <Typography sx={{ ...labelSx, mt: 0.5 }}>リンク（似た製品・購入先など）</Typography>
        {infoLinks.map((l, i) => (
          <Box key={i} sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <TextField size="small" disabled={disabled} value={l.title || ""} placeholder="タイトル"
              onChange={(e) => { const links = infoLinks.slice(); links[i] = { ...links[i], title: e.target.value }; emit({ info: normInfo({ links }) }); }}
              sx={{ ...inputSx, flex: "0 0 36%" }} />
            <TextField size="small" disabled={disabled} value={l.url || ""} placeholder="https://..."
              onChange={(e) => { const links = infoLinks.slice(); links[i] = { ...links[i], url: e.target.value }; emit({ info: normInfo({ links }) }); }}
              sx={{ ...inputSx, flex: 1 }} />
            <IconButton size="small" disabled={disabled}
              onClick={() => { const links = infoLinks.filter((_, j) => j !== i); emit({ info: normInfo({ links }) }); }}
              sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", "&:hover": { color: "#ef5350" } }}>
              <CloseRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
        <Button size="small" disabled={disabled} startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => emit({ info: normInfo({ links: [...infoLinks, { title: "", url: "" }] }) })}
          sx={{ alignSelf: "flex-start", fontSize: 11, color: "light-dark(#003fad, #9ec1ff)", textTransform: "none", mt: 0.25 }}>
          リンク追加
        </Button>
      </Box>
      )}
    </Box>
  );
}
