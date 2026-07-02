import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Container, Typography, Button, Stack, Chip, CircularProgress, Alert,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
  getPlansCatalog,
  startSubscriptionCheckout,
  watchActiveSubscriptions,
  openBillingPortal,
  startTopupCheckout,
  TOPUP_PACKS,
} from "@/shared/api/payments/stripe";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";
const SUB = "rgba(255,255,255,0.6)";

const yen = (n) => `¥${Number(n || 0).toLocaleString("ja-JP")}`;
const bytesToGB = (b) => (b ? Math.round(b / (1024 ** 3)) : null);

// plans doc から表示用の機能リストを作る（クレジット制・docs/17）
function buildFeatures(plan) {
  const f = [];
  if (plan.description) f.push(plan.description);
  // 課金の核 = 月次 AI クレジット。3D化 1個 = 10 クレジット。
  if (plan.monthlyCredits != null)
    f.push(`月 ${Number(plan.monthlyCredits).toLocaleString("ja-JP")} クレジット（3D化 約${Math.floor(plan.monthlyCredits / 10)}個）`);
  else if (plan.creditsCustom)
    f.push("クレジット カスタム");
  const gb = bytesToGB(plan.privateStorageLimitBytes);
  if (gb != null) f.push(`${gb >= 1000 ? `${Math.round(gb / 1000)}TB` : `${gb}GB`} ストレージ`);
  // Cyclesレンダはユーザーのローカル GPU で実行 = 全プラン無制限。
  f.push("Cyclesレンダ無制限（ローカルGPU）");
  if (plan.commercialUse) f.push("商用利用OK");
  if (plan.allowApiAccess) f.push("API アクセス");
  if (plan.teamRoles) f.push("チーム権限管理（Owner/Editor/Viewer）");
  return f;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyPriceId, setBusyPriceId] = useState(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [subs, setSubs] = useState([]);
  const [topupBusy, setTopupBusy] = useState(null);
  const [topupNotice, setTopupNotice] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("topup") === "success"
      ? "クレジットを追加しました。反映まで少し時間がかかる場合があります。"
      : ""
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getPlansCatalog();
        if (alive) setPlans(list);
      } catch (e) {
        if (alive) setErr(e?.message || "料金情報の取得に失敗しました。");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user || isAnonymous) { setSubs([]); return; }
    const unsub = watchActiveSubscriptions(setSubs);
    return () => unsub && unsub();
  }, [user, isAnonymous]);

  const subscribedPriceIds = useMemo(() => {
    const ids = new Set();
    for (const s of subs) {
      const pid = s.price?.id || s.price || s.items?.[0]?.price?.id;
      if (pid) ids.add(pid);
    }
    return ids;
  }, [subs]);

  // free（無料）/ 有料（stripePriceId あり）/ カスタム（enterprise 等＝応相談）に分ける
  const { freePlan, paidPlans, customPlans } = useMemo(() => {
    const free = plans.find((p) => p.id === "free");
    const paid = plans
      .filter((p) => p.stripePriceId && (p.pricePerMonth ?? 0) > 0)
      .sort((a, b) => (a.pricePerMonth ?? 0) - (b.pricePerMonth ?? 0));
    const custom = plans.filter((p) => p.id !== "free" && !p.stripePriceId);
    return { freePlan: free, paidPlans: paid, customPlans: custom };
  }, [plans]);

  const handleSubscribe = async (plan) => {
    setErr("");
    if (!user || isAnonymous) {
      navigate(`/login?return_to=${encodeURIComponent("/pricing")}`);
      return;
    }
    try {
      setBusyPriceId(plan.stripePriceId);
      await startSubscriptionCheckout(plan.stripePriceId);
    } catch (e) {
      setErr(e?.message || "決済の開始に失敗しました。");
      setBusyPriceId(null);
    }
  };

  const handlePortal = async () => {
    setErr("");
    try {
      setPortalBusy(true);
      await openBillingPortal(`${window.location.origin}/pricing`);
    } catch (e) {
      setErr(e?.message || "管理画面を開けませんでした。");
      setPortalBusy(false);
    }
  };

  const handleTopup = async (pack) => {
    setErr("");
    if (!user || isAnonymous) {
      navigate(`/login?return_to=${encodeURIComponent("/pricing")}`);
      return;
    }
    try {
      setTopupBusy(pack.credits);
      await startTopupCheckout(pack);
    } catch (e) {
      setErr(e?.message || "クレジット購入の開始に失敗しました。");
      setTopupBusy(null);
    }
  };

  const colCount = Math.min((freePlan ? 1 : 0) + paidPlans.length + customPlans.length, 4) || 1;

  return (
    <Box sx={{ bgcolor: "#000", color: "#fff", minHeight: "100vh", py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: "center", mb: { xs: 6, md: 8 } }}>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.04em",
            fontSize: { xs: "2rem", md: "3rem" } }}>
            料金プラン
          </Typography>
          <Typography sx={{ color: SUB, mt: 2, fontSize: "1.05rem" }}>
            まずは無料で。必要になったらいつでもアップグレードできます。
          </Typography>
          {subs.length > 0 && (
            <Button onClick={handlePortal} disabled={portalBusy} variant="outlined"
              sx={{ mt: 3, borderRadius: "100px", textTransform: "none", color: "#fff",
                borderColor: "rgba(255,255,255,0.3)" }}>
              {portalBusy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "プランを管理 / 解約"}
            </Button>
          )}
        </Box>

        {err && <Alert severity="error" sx={{ mb: 4 }}>{err}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: "center", py: 10 }}><CircularProgress sx={{ color: "#A78BFA" }} /></Box>
        ) : (freePlan || paidPlans.length > 0 || customPlans.length > 0) ? (
          <Box sx={{ display: "grid", gap: 3,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: `repeat(${colCount}, 1fr)` } }}>
            {freePlan && (
              <PlanCard
                name={freePlan.name || "Free"}
                priceText="¥0"
                features={buildFeatures(freePlan)}
                cta={user && !isAnonymous ? "利用中" : "無料で始める"}
                ctaDisabled={!!(user && !isAnonymous)}
                onClick={() => (user && !isAnonymous ? null : navigate("/signup"))}
              />
            )}
            {paidPlans.map((plan, i) => {
              const isCurrent = subscribedPriceIds.has(plan.stripePriceId);
              return (
                <PlanCard
                  key={plan.id}
                  name={plan.name || plan.id}
                  priceText={yen(plan.pricePerMonth)}
                  priceSuffix=" / 月"
                  priceNote={plan.priceNote}
                  features={buildFeatures(plan)}
                  highlight={i === paidPlans.length - 1}
                  badge={i === paidPlans.length - 1 ? "おすすめ" : null}
                  cta={isCurrent ? "現在のプラン" : "このプランにする"}
                  ctaDisabled={isCurrent}
                  busy={busyPriceId === plan.stripePriceId}
                  onClick={() => handleSubscribe(plan)}
                />
              );
            })}
            {customPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                name={plan.name || plan.id}
                priceText="応相談"
                features={buildFeatures(plan)}
                cta="お問い合わせ"
                onClick={() => window.location.assign("mailto:info@sekkeiya.com?subject=" + encodeURIComponent(`${plan.name || plan.id} プランについて`))}
              />
            ))}
          </Box>
        ) : (
          <Alert severity="info" sx={{ maxWidth: 640, mx: "auto" }}>
            現在表示できるプランがありません。
          </Alert>
        )}

        {topupNotice && <Alert severity="success" sx={{ mt: 5, maxWidth: 720, mx: "auto" }}>{topupNotice}</Alert>}

        <Box sx={{ mt: { xs: 7, md: 9 } }}>
          <Typography variant="h5" sx={{ fontWeight: 800, textAlign: "center" }}>
            クレジットを追加購入
          </Typography>
          <Typography sx={{ color: SUB, mt: 1.5, textAlign: "center", fontSize: "0.95rem" }}>
            月のクレジットを使い切っても、その場で追加できます（買い切り・繰越OK）。
          </Typography>
          <Box sx={{ display: "grid", gap: 2, mt: 4, maxWidth: 760, mx: "auto",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
            {TOPUP_PACKS.map((pack) => (
              <Box key={pack.credits} sx={{ display: "flex", flexDirection: "column", alignItems: "center",
                p: 3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Typography sx={{ fontSize: "1.6rem", fontWeight: 900 }}>
                  +{pack.credits.toLocaleString("ja-JP")}
                </Typography>
                <Typography sx={{ color: SUB, fontSize: "0.8rem", mb: 0.5 }}>クレジット</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", mb: 2 }}>
                  3D化 約{Math.floor(pack.credits / 10)}個ぶん
                </Typography>
                <Button fullWidth variant="outlined" disabled={topupBusy === pack.credits}
                  onClick={() => handleTopup(pack)}
                  sx={{ py: 1.1, borderRadius: "100px", textTransform: "none", fontWeight: 700,
                    color: "#fff", borderColor: "rgba(255,255,255,0.3)", "&:hover": { borderColor: "#fff" } }}>
                  {topupBusy === pack.credits ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : `${yen(pack.priceJpy)} で購入`}
                </Button>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", textAlign: "center", mt: 6, maxWidth: 720, mx: "auto", lineHeight: 1.8 }}>
          クレジットは画像→3D化・AI画像生成・Chat で消費します（3D化 1個 = 10 クレジット）。
          Cyclesレンダはお使いの PC の GPU で実行されるため、全プランで無制限です。
          使い切った場合は追加クレジットをいつでも購入できます。
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", textAlign: "center", mt: 2 }}>
          価格は税込表示です。決済は Stripe を通じて安全に処理されます。
        </Typography>
      </Container>
    </Box>
  );
}

function PlanCard({ name, priceText, priceSuffix, priceNote, features = [], highlight, badge, cta, ctaDisabled, busy, onClick }) {
  return (
    <Box sx={{
      position: "relative", display: "flex", flexDirection: "column",
      p: 4, borderRadius: 4,
      bgcolor: highlight ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
      border: highlight ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
      boxShadow: highlight ? "0 0 40px rgba(124,58,237,0.15)" : "none",
    }}>
      {badge && (
        <Chip label={badge} size="small"
          sx={{ position: "absolute", top: 16, right: 16, background: GRAD, color: "#fff", fontWeight: 700 }} />
      )}
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{name}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 1.5, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>{priceText}</Typography>
        {priceSuffix && <Typography sx={{ color: SUB, fontSize: "0.9rem" }}>{priceSuffix}</Typography>}
      </Box>
      {priceNote && (
        <Typography sx={{ color: "#A78BFA", fontSize: "0.78rem", mt: -1, mb: 1.5 }}>{priceNote}</Typography>
      )}
      <Stack spacing={1.2} sx={{ my: 2, flexGrow: 1 }}>
        {features.map((f, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "#A78BFA" }} />
            <Typography sx={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)" }}>{f}</Typography>
          </Box>
        ))}
      </Stack>
      <Button
        fullWidth variant={highlight ? "contained" : "outlined"}
        disabled={ctaDisabled || busy} onClick={onClick}
        sx={{
          mt: "auto", py: 1.3, borderRadius: "100px", textTransform: "none", fontWeight: 700,
          ...(highlight
            ? { background: GRAD, color: "#fff", "&:hover": { background: "linear-gradient(135deg,#6D28D9,#1D4ED8)" } }
            : { color: "#fff", borderColor: "rgba(255,255,255,0.3)", "&:hover": { borderColor: "#fff" } }),
        }}
      >
        {busy ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : cta}
      </Button>
    </Box>
  );
}
