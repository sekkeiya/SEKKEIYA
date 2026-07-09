import React, { useEffect, useState } from "react";
import {
  Box, Typography, Switch, Button, Stack, Chip, CircularProgress, Alert, Divider,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { db } from "@/shared/config/firebase";
import {
  collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc,
} from "firebase/firestore";

function yen(n) {
  return typeof n === "number" ? `¥${n.toLocaleString("ja-JP")}` : "—";
}
function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds * 1000) : null);
    return d ? d.toLocaleString("ja-JP") : "";
  } catch { return ""; }
}

export default function AdminDonationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const snap = await getDocs(query(collection(db, "donationComments"), orderBy("createdAt", "desc")));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setErr(e?.message || "読み込みに失敗しました。（管理者権限が必要です）");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleApproved = async (item) => {
    setSavingId(item.id);
    try {
      await updateDoc(doc(db, "donationComments", item.id), { approved: !item.approved });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, approved: !item.approved } : x)));
    } catch (e) {
      setErr(e?.message || "更新に失敗しました。");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item) => {
    if (!window.confirm("このコメントを削除しますか？")) return;
    setSavingId(item.id);
    try {
      await deleteDoc(doc(db, "donationComments", item.id));
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      setErr(e?.message || "削除に失敗しました。");
    } finally {
      setSavingId(null);
    }
  };

  const pending = items.filter((i) => !i.approved);
  const approved = items.filter((i) => i.approved);

  return (
    <Box sx={{ color: "#fff", maxWidth: 900 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>寄付コメント承認</Typography>
        <Button variant="outlined" onClick={load} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
          再読み込み
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 3 }}>{err}</Alert>}

      {loading ? (
        <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress sx={{ color: "#38bdf8" }} /></Box>
      ) : (
        <>
          <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 1.5 }}>承認待ち（{pending.length}）</Typography>
          {pending.length === 0 && <Typography sx={{ color: "rgba(255,255,255,0.3)", mb: 3 }}>なし</Typography>}
          {pending.map((item) => (
            <Row key={item.id} item={item} saving={savingId === item.id}
              onToggle={() => toggleApproved(item)} onDelete={() => remove(item)} />
          ))}

          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 4 }} />

          <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 1.5 }}>公開中（{approved.length}）</Typography>
          {approved.map((item) => (
            <Row key={item.id} item={item} saving={savingId === item.id}
              onToggle={() => toggleApproved(item)} onDelete={() => remove(item)} />
          ))}
        </>
      )}
    </Box>
  );
}

function Row({ item, saving, onToggle, onDelete }) {
  return (
    <Box sx={{ p: 2.5, mb: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 700 }}>{item.name?.trim() || "匿名の支援者"}</Typography>
            <Chip size="small" label={yen(item.amount)} sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#A78BFA" }} />
            {item.showAmount === false && (
              <Chip size="small" label="金額非公開" sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />
            )}
            <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>{fmtDate(item.createdAt)}</Typography>
          </Stack>
          <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.9rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {item.comment}
          </Typography>
        </Box>
        <Stack alignItems="center" spacing={0.5}>
          <Switch checked={!!item.approved} disabled={saving} onChange={onToggle} />
          <Typography sx={{ fontSize: "0.7rem", color: item.approved ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
            {item.approved ? "公開中" : "非公開"}
          </Typography>
          <Button size="small" color="error" disabled={saving} onClick={onDelete}
            startIcon={<DeleteOutlineIcon />} sx={{ textTransform: "none", minWidth: 0 }}>
            削除
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
