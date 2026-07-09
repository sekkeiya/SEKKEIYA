// WalkthroughShareDialog — ウォークスルーの共有リンクを作成するダイアログ。
//   公開範囲を選び → リンクを作成 → URL を表示 → コピー。
//   リンクを知っている人なら誰でもブラウザでウォークスルーを操作できる。

import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, RadioGroup, FormControlLabel, Radio,
  TextField, CircularProgress, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

export type ShareVisibility = "public" | "unlisted" | "private";

const OPTIONS: { value: ShareVisibility; label: string; desc: string; icon: JSX.Element }[] = [
  { value: "unlisted", label: "リンクを知っている人", desc: "URL を渡した相手だけが本番プレビューを閲覧できます（一覧には載りません）", icon: <LinkRoundedIcon fontSize="small" /> },
  { value: "public", label: "公開", desc: "誰でも閲覧・操作できます（ギャラリー等に掲載される可能性があります）", icon: <PublicRoundedIcon fontSize="small" /> },
  { value: "private", label: "非公開", desc: "自分だけ。共有を一時停止します", icon: <LockRoundedIcon fontSize="small" /> },
];

export default function WalkthroughShareDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (visibility: ShareVisibility) => Promise<string>;
}) {
  const [visibility, setVisibility] = useState<ShareVisibility>("unlisted");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  // 開くたびにリセット
  useEffect(() => {
    if (open) { setUrl(""); setErr(""); setCopied(false); setBusy(false); }
  }, [open]);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const u = await onCreate(visibility);
      setUrl(u);
      try { await navigator.clipboard.writeText(u); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
    } catch (e: any) {
      setErr(e?.message || "リンクの作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const openUrl = () => {
    if (!url) return;
    import("@tauri-apps/plugin-opener").then((m) => (m.openUrl ? m.openUrl(url) : window.open(url, "_blank"))).catch(() => window.open(url, "_blank"));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2, background: "#0b1020", border: `1px solid ${alpha("#4f8cff", 0.3)}` } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "#fff", fontWeight: 800, fontSize: "1rem" }}>
        <LinkRoundedIcon sx={{ color: "#4f8cff" }} />
        本番プレビューを共有
        <IconButton onClick={onClose} sx={{ ml: "auto", color: alpha("#fff", 0.6) }} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ color: alpha("#fff", 0.6), fontSize: "0.8rem", mb: 1.5 }}>
          公開範囲を選んでリンクを作成します。リンクを知っている人はブラウザですぐに本番プレビューを閲覧できます。
        </Typography>

        <RadioGroup value={visibility} onChange={(_, v) => { setVisibility(v as ShareVisibility); setUrl(""); }}>
          {OPTIONS.map((o) => (
            <FormControlLabel
              key={o.value}
              value={o.value}
              control={<Radio size="small" sx={{ color: alpha("#fff", 0.4), "&.Mui-checked": { color: "#4f8cff" } }} />}
              sx={{
                alignItems: "flex-start", m: 0, mb: 1, p: 1, borderRadius: 1.5,
                border: `1px solid ${visibility === o.value ? alpha("#4f8cff", 0.5) : alpha("#fff", 0.08)}`,
                background: visibility === o.value ? alpha("#4f8cff", 0.08) : "transparent",
                "& .MuiFormControlLabel-label": { width: "100%" },
              }}
              label={
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
                    <Box sx={{ color: "#7eaaff", display: "flex" }}>{o.icon}</Box>{o.label}
                  </Box>
                  <Typography sx={{ color: alpha("#fff", 0.55), fontSize: "0.72rem", mt: 0.25 }}>{o.desc}</Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>

        {err && <Typography sx={{ color: "#ff8a80", fontSize: "0.78rem", mt: 0.5 }}>{err}</Typography>}

        {url && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ color: alpha("#fff", 0.5), fontSize: "0.7rem", mb: 0.5, fontWeight: 700 }}>共有リンク</Typography>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
              <TextField
                value={url} fullWidth size="small" InputProps={{ readOnly: true }}
                onFocus={(e) => e.target.select()}
                sx={{ "& .MuiInputBase-input": { color: "#fff", fontSize: "0.78rem" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#4f8cff", 0.4) } }}
              />
              <Tooltip title={copied ? "コピーしました" : "コピー"}>
                <IconButton onClick={copy} sx={{ color: copied ? "#4caf50" : "#7eaaff", border: `1px solid ${alpha("#fff", 0.15)}` }}>
                  {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="ブラウザで開く">
                <IconButton onClick={openUrl} sx={{ color: "#7eaaff", border: `1px solid ${alpha("#fff", 0.15)}` }}>
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: alpha("#fff", 0.6), textTransform: "none" }}>閉じる</Button>
        <Button
          onClick={create}
          disabled={busy}
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LinkRoundedIcon />}
          sx={{ textTransform: "none", fontWeight: 800, background: "linear-gradient(180deg,#4f8cff,#2c5fff)", "&:hover": { filter: "brightness(1.1)" } }}
        >
          {url ? "リンクを再作成" : "リンクを作成"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
