import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Button, Stack, Chip, CircularProgress, Alert, Divider, Grid,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PaymentsIcon from "@mui/icons-material/Payments";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import LaunchIcon from "@mui/icons-material/Launch";
import { useNavigate } from "react-router-dom";
import { getAllDonationPayments } from "@/shared/api/payments/stripe";

// Stripe は LIVE 稼働中（拡張機能を sk_live で再構成済み・本番5プラン投入済み）。
// 遷移先は本番ダッシュボード。テストモードに戻す必要が出たら true にする。
const STRIPE_TEST_MODE = false;
const STRIPE_BASE = `https://dashboard.stripe.com${STRIPE_TEST_MODE ? "/test" : ""}`;
const STRIPE_LINKS = {
  home: `${STRIPE_BASE}/dashboard`,
  payments: `${STRIPE_BASE}/payments`,
  subscriptions: `${STRIPE_BASE}/subscriptions`,
  payouts: `${STRIPE_BASE}/payouts`,
};

function yen(n) {
  return typeof n === "number" && Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : "¥0";
}
function fmtDateSec(sec) {
  if (!sec) return "";
  try { return new Date(sec * 1000).toLocaleString("ja-JP"); } catch { return ""; }
}

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function AdminRevenuePage() {
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      setDonations(await getAllDonationPayments());
    } catch (e) {
      setErr(e?.message || "読み込みに失敗しました。（管理者権限が必要です）");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const monthStartSec = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
    let total = 0, count = 0, monthTotal = 0, monthCount = 0;
    for (const d of donations) {
      total += d.amount; count += 1;
      if (d.createdSec >= monthStartSec) { monthTotal += d.amount; monthCount += 1; }
    }
    return { total, count, monthTotal, monthCount, avg: count ? total / count : 0 };
  }, [donations]);

  const recent = donations.slice(0, 8);

  return (
    <Box sx={{ color: "#fff", maxWidth: 1000 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>収益サマリー</Typography>
        <Button variant="outlined" onClick={load} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
          再読み込み
        </Button>
      </Stack>

      {STRIPE_TEST_MODE && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          現在 Stripe は<strong>テストモード</strong>で稼働中です。表示・遷移先はすべてテスト環境で、実際の売上ではありません。
          本番化後にこのページの <code>STRIPE_TEST_MODE</code> を false に切り替えてください。
        </Alert>
      )}

      {/* Stripe 遷移ボタン群：詳細な会計・分析は Stripe ダッシュボードが SSOT */}
      <Box sx={{ p: 2.5, mb: 4, borderRadius: 2, bgcolor: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.25)" }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Stripe ダッシュボード</Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", mb: 2 }}>
          サブスクリプション・MRR・入金・返金・税などの詳細管理は Stripe が正の情報源です。
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={() => openExternal(STRIPE_LINKS.home)}
            sx={{ bgcolor: "#635BFF", "&:hover": { bgcolor: "#5147e6" }, textTransform: "none", fontWeight: 700 }}>
            Stripe ダッシュボードを開く
          </Button>
          <Button variant="outlined" startIcon={<PaymentsIcon />} onClick={() => openExternal(STRIPE_LINKS.payments)}
            sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", textTransform: "none" }}>
            決済一覧
          </Button>
          <Button variant="outlined" startIcon={<AutorenewIcon />} onClick={() => openExternal(STRIPE_LINKS.subscriptions)}
            sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", textTransform: "none" }}>
            サブスク一覧
          </Button>
          <Button variant="outlined" startIcon={<AccountBalanceIcon />} onClick={() => openExternal(STRIPE_LINKS.payouts)}
            sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", textTransform: "none" }}>
            入金 (Payouts)
          </Button>
        </Stack>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 3 }}>{err}</Alert>}

      {loading ? (
        <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress sx={{ color: "#38bdf8" }} /></Box>
      ) : (
        <>
          {/* 寄付 KPI：Stripe 決済記録(customers/*\/payments)を正本に集計。コメント有無を問わず全件を含む */}
          <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 1.5, fontWeight: 600 }}>寄付（Stripe決済記録より集計）</Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <StatCard label="今月の寄付額" value={yen(stats.monthTotal)} sub={`${stats.monthCount} 件`} accent="#A78BFA" />
            <StatCard label="累計寄付額" value={yen(stats.total)} sub={`${stats.count} 件`} accent="#38bdf8" />
            <StatCard label="平均寄付額" value={yen(stats.avg)} sub="1件あたり" accent="#4ade80" />
            <StatCard label="総件数" value={stats.count.toLocaleString("ja-JP")} sub="全期間" accent="#fbbf24" />
          </Grid>

          {/* サブスク：CMS 内では集計せず Stripe へ誘導 */}
          <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 1.5, fontWeight: 600 }}>サブスクリプション</Typography>
          <Box sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", textAlign: "center" }}>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 1.5 }}>
              サブスク状況（アクティブ数・プラン別内訳・MRR）は Stripe ダッシュボードで確認できます。
            </Typography>
            <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => openExternal(STRIPE_LINKS.subscriptions)}
              sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)", textTransform: "none" }}>
              Stripe でサブスクを確認
            </Button>
          </Box>

          {/* 直近の寄付 */}
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 3 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>直近の寄付</Typography>
            <Button size="small" onClick={() => navigate("/admin/donations")} sx={{ color: "#38bdf8", textTransform: "none" }}>
              寄付コメント承認へ →
            </Button>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", mb: 1.5 }}>
            ※ コメント付きの寄付のみ、管理者承認後に公式サイトへ掲載されます。
          </Typography>
          {recent.length === 0 && <Typography sx={{ color: "rgba(255,255,255,0.3)" }}>まだ寄付はありません。</Typography>}
          {recent.map((item) => (
            <Box key={item.id} sx={{ p: 2, mb: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 700 }}>{item.donorName?.trim() || "匿名の支援者"}</Typography>
                  <Chip size="small" label={yen(item.amount)} sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#A78BFA" }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>{fmtDateSec(item.createdSec)}</Typography>
                </Stack>
                <Chip size="small" label={item.donationComment?.trim() ? "コメントあり" : "コメントなし"}
                  sx={{ bgcolor: item.donationComment?.trim() ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)", color: item.donationComment?.trim() ? "#4ade80" : "rgba(255,255,255,0.5)" }} />
              </Stack>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <Grid item xs={6} md={3}>
      <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", height: "100%" }}>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", mb: 0.5 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1.5rem", color: accent, lineHeight: 1.2 }}>{value}</Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", mt: 0.5 }}>{sub}</Typography>
      </Box>
    </Grid>
  );
}
