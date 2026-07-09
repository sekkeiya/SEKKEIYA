import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Container, Typography, Button, TextField, Stack, Chip, Avatar,
  CircularProgress, Alert, ToggleButton, ToggleButtonGroup, FormControlLabel,
  Checkbox, Dialog, DialogContent, IconButton,
} from "@mui/material";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import CloseIcon from "@mui/icons-material/Close";
import { useAuth } from "@/features/auth/context/AuthContext";
import { startDonationCheckout, getApprovedDonations } from "@/shared/api/payments/stripe";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";
const SUB = "rgba(255,255,255,0.6)";
const PRESETS = [500, 1000, 3000, 5000];

function yen(n) {
  return `¥${Number(n || 0).toLocaleString("ja-JP")}`;
}

// ── フワフワ浮き上がるメッセージバブル ──────────────────────────────────
function FloatingBubble({ donation, delay, duration, startX }) {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: "-10%",
        left: `${startX}%`,
        maxWidth: 200,
        opacity: 0,
        animation: `sekkeiyaFloat ${duration}s ${delay}s infinite ease-in-out`,
        pointerEvents: "none",
        "@keyframes sekkeiyaFloat": {
          "0%":   { transform: "translateY(0) scale(0.85)",  opacity: 0 },
          "8%":   { opacity: 0.9 },
          "75%":  { opacity: 0.75 },
          "100%": { transform: "translateY(-110vh) scale(1.05)", opacity: 0 },
        },
      }}
    >
      <Box sx={{
        p: 1.5, borderRadius: 3,
        bgcolor: "rgba(20,10,40,0.55)",
        border: "1px solid rgba(124,58,237,0.25)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Avatar sx={{ width: 22, height: 22, background: GRAD, fontSize: "0.65rem", flexShrink: 0 }}>
            {(donation.name || "匿").trim()[0] || "匿"}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: "0.7rem" }} noWrap>
              {donation.name?.trim() || "匿名"}
            </Typography>
            {donation.showAmount !== false && typeof donation.amount === "number" && (
              <Typography sx={{ color: "#A78BFA", fontSize: "0.62rem", fontWeight: 700 }}>
                {yen(donation.amount)}
              </Typography>
            )}
          </Box>
        </Stack>
        <Typography sx={{
          color: "rgba(255,255,255,0.82)", fontSize: "0.68rem", lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {donation.comment}
        </Typography>
      </Box>
    </Box>
  );
}

// ── 寄付フォームダイアログ ───────────────────────────────────────────────
function DonationDialog({ open, onClose, loggedIn, onNavigateLogin }) {
  const [amount, setAmount] = useState(1000);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [showAmount, setShowAmount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleDonate = async () => {
    setErr("");
    if (!loggedIn) { onNavigateLogin(); return; }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < 100) { setErr("寄付額は100円以上で入力してください。"); return; }
    try {
      setBusy(true);
      await startDonationCheckout({ amount: amt, comment, name, showAmount });
    } catch (e) {
      setErr(e?.message || "決済の開始に失敗しました。");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: "#0d0d1a", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 4, color: "#fff" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, pt: 2.5, pb: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>SEKKEIYA を応援する</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: "0.82rem", color: SUB, mb: 2.5 }}>
          いただいた寄付は開発の継続に充てられます。応援コメントは承認後にページに掲載されます。
        </Typography>

        <Typography sx={{ fontWeight: 700, color: "#fff", mb: 1, fontSize: "0.88rem" }}>金額を選ぶ</Typography>
        <ToggleButtonGroup exclusive value={PRESETS.includes(Number(amount)) ? Number(amount) : null}
          onChange={(_, v) => v && setAmount(v)}
          sx={{ flexWrap: "wrap", gap: 1, mb: 1.5,
            "& .MuiToggleButton-root": {
              color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "100px !important",
              px: 2, py: 0.6, textTransform: "none", fontSize: "0.82rem",
              "&.Mui-selected": { background: GRAD, color: "#fff", borderColor: "transparent",
                "&:hover": { background: "linear-gradient(135deg,#6D28D9,#1D4ED8)" } },
            } }}>
          {PRESETS.map((p) => <ToggleButton key={p} value={p}>{yen(p)}</ToggleButton>)}
        </ToggleButtonGroup>

        <TextField fullWidth type="number" label="金額（円）" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          InputProps={{ inputProps: { min: 100, step: 100 } }}
          sx={tfSx} size="small" />
        <TextField fullWidth label="お名前（任意・空欄で匿名）" value={name}
          onChange={(e) => setName(e.target.value)} sx={{ ...tfSx, mt: 1.5 }} size="small"
          inputProps={{ maxLength: 60 }} />
        <TextField fullWidth label="応援コメント（任意）" value={comment}
          onChange={(e) => setComment(e.target.value)} sx={{ ...tfSx, mt: 1.5 }}
          multiline minRows={3} inputProps={{ maxLength: 500 }}
          helperText={`${comment.length}/500`}
          FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.4)" } }} />

        <FormControlLabel sx={{ mt: 0.5 }}
          control={<Checkbox checked={showAmount} onChange={(e) => setShowAmount(e.target.checked)}
            sx={{ color: "rgba(255,255,255,0.4)", "&.Mui-checked": { color: "#A78BFA" } }} />}
          label={<Typography sx={{ fontSize: "0.8rem", color: SUB }}>金額を公開する</Typography>} />

        {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}

        <Button fullWidth variant="contained" onClick={handleDonate} disabled={busy}
          sx={{ mt: 2, py: 1.4, borderRadius: "100px", textTransform: "none", fontWeight: 800,
            background: GRAD, color: "#fff", "&:hover": { background: "linear-gradient(135deg,#6D28D9,#1D4ED8)" },
            "&:disabled": { opacity: 0.6 } }}>
          {busy ? <CircularProgress size={22} sx={{ color: "#fff" }} />
            : loggedIn ? `${yen(amount)} を寄付する` : "ログインして寄付する"}
        </Button>
        {!loggedIn && (
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.74rem", mt: 1.5, textAlign: "center" }}>
            寄付にはログインが必要です。
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── メインセクション ─────────────────────────────────────────────────────
export default function DonationSection() {
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getApprovedDonations(60);
        if (alive) setDonations(list);
      } catch { /* silent */ } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const visible = donations.filter((d) => d.showAmount !== false && typeof d.amount === "number");
    return { count: donations.length, sum: visible.reduce((a, d) => a + (d.amount || 0), 0) };
  }, [donations]);

  // バブル生成：少ない場合は複製して画面を賑やかに
  const bubbles = useMemo(() => {
    if (donations.length === 0) return [];
    const result = [];
    const positions = [5, 18, 32, 47, 60, 73, 85];
    const durations = [13, 11, 15, 12, 14, 10, 16];
    let idx = 0;
    const needed = Math.max(donations.length, 6);
    for (let i = 0; i < needed; i++) {
      const d = donations[i % donations.length];
      result.push({
        ...d,
        key: `${d.id}-${Math.floor(i / donations.length)}`,
        delay: (i * 2.5) % 20,
        duration: durations[idx % durations.length],
        startX: positions[idx % positions.length],
      });
      idx++;
    }
    return result;
  }, [donations]);

  const loggedIn = !!user && !isAnonymous;

  return (
    <Box id="support" sx={{
      py: { xs: 14, md: 20 },
      position: "relative",
      overflow: "hidden",
      minHeight: { xs: 520, md: 680 },
    }}>
      {/* 背景グロー */}
      <Box sx={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
        width: 900, height: 600,
        background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 65%)",
        pointerEvents: "none" }} />

      {/* フワフワバブル（背景） */}
      {!loadingList && bubbles.map((b) => (
        <FloatingBubble key={b.key} donation={b} delay={b.delay} duration={b.duration} startX={b.startX} />
      ))}

      {/* メインコンテンツ */}
      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <Chip icon={<FavoriteRoundedIcon sx={{ color: "#fff !important", fontSize: 16 }} />}
          label="Support" size="small"
          sx={{ background: GRAD, color: "#fff", fontWeight: 700, mb: 2.5 }} />

        <Typography variant="h3" sx={{
          fontWeight: 900, letterSpacing: "-0.04em",
          fontSize: { xs: "1.9rem", md: "2.8rem" }, color: "#fff",
        }}>
          SEKKEIYA を応援する
        </Typography>
        <Typography sx={{ color: SUB, mt: 2, fontSize: "1rem", lineHeight: 1.8, maxWidth: 520, mx: "auto" }}>
          いただいた寄付は開発の継続に充てられます。<br />
          応援コメントはこのページに掲載されます。
        </Typography>

        {/* 統計 */}
        {totals.count > 0 && (
          <Stack direction="row" spacing={5} justifyContent="center" sx={{ mt: 3.5 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: "#fff" }}>{totals.count}</Typography>
              <Typography sx={{ color: SUB, fontSize: "0.8rem" }}>応援メッセージ</Typography>
            </Box>
            {totals.sum > 0 && (
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, color: "#fff" }}>{yen(totals.sum)}</Typography>
                <Typography sx={{ color: SUB, fontSize: "0.8rem" }}>累計支援額（公開分）</Typography>
              </Box>
            )}
          </Stack>
        )}

        {/* 寄付ボタン */}
        <Button
          variant="contained"
          size="large"
          startIcon={<FavoriteRoundedIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{
            mt: 5, px: 5, py: 1.8, borderRadius: "100px",
            textTransform: "none", fontWeight: 800, fontSize: "1rem",
            background: GRAD, color: "#fff",
            boxShadow: "0 0 36px rgba(124,58,237,0.35)",
            "&:hover": {
              background: "linear-gradient(135deg,#6D28D9,#1D4ED8)",
              boxShadow: "0 0 48px rgba(124,58,237,0.5)",
            },
          }}
        >
          応援する
        </Button>

        {!loggedIn && (
          <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.76rem", mt: 1.5 }}>
            寄付にはログインが必要です
          </Typography>
        )}
      </Container>

      {/* 寄付ダイアログ */}
      <DonationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        loggedIn={loggedIn}
        onNavigateLogin={() => navigate(`/login?return_to=${encodeURIComponent("/#support")}`)}
      />
    </Box>
  );
}

const tfSx = {
  "& .MuiInputBase-root": { color: "#fff" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#A78BFA" },
};
