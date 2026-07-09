import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, TextField, InputAdornment,
  CircularProgress, Chip, Tooltip,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddIcon from "@mui/icons-material/Add";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import ViewComfyRoundedIcon from "@mui/icons-material/ViewComfyRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { alpha } from "@mui/material/styles";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collectionGroup, collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";

const SCOPES = [
  { id: "global",  label: "Explore",      icon: LanguageRoundedIcon },
  { id: "my",      label: "My Furniture", icon: PersonRoundedIcon  },
  { id: "project", label: "Project",      icon: FolderRoundedIcon  },
];

const DENSITY = [
  { id: "compact", size: 140, Icon: GridViewRoundedIcon,   label: "コンパクト" },
  { id: "default", size: 180, Icon: ViewModuleRoundedIcon, label: "デフォルト" },
  { id: "large",   size: 220, Icon: ViewComfyRoundedIcon,  label: "大" },
];

const DSC_COLOR = "#ffa726";

function FurnitureCard({ item, cardSize, onClick }) {
  const hasThumb = Boolean(item.thumbnailUrl);
  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: 2,
        border: `1px solid ${BRAND.line}`,
        bgcolor: BRAND.panel,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.18s, transform 0.15s",
        "&:hover": { borderColor: BRAND.line2, transform: "translateY(-2px)" },
      }}
    >
      <Box sx={{
        width: "100%",
        height: cardSize * 0.72,
        bgcolor: alpha("#fff", 0.04),
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {hasThumb ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            alt={item.title || item.name || ""}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <ViewInArRoundedIcon sx={{ fontSize: cardSize * 0.34, color: alpha("#fff", 0.18) }} />
        )}
      </Box>
      <Box sx={{ p: 1 }}>
        <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: BRAND.text }}>
          {item.title || item.name || "Untitled"}
        </Typography>
        {item.createdAt && (
          <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.2 }}>
            {item.createdAt?.toDate?.()?.toLocaleDateString?.() ?? ""}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function FurnitureDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [scope,   setScope]   = useState("global");
  const [search,  setSearch]  = useState("");
  const [density, setDensity] = useState("default");
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const cardSize     = DENSITY.find(d => d.id === density)?.size ?? 180;
  const visibleScopes = SCOPES.filter(s => s.id !== "project" || Boolean(projectId));

  useEffect(() => {
    if (scope === "my"      && !user)      setScope("global");
    if (scope === "project" && !projectId) setScope("global");
  }, [scope, user, projectId]);

  useEffect(() => {
    setLoading(true);
    setItems([]);

    const wfGroup = collectionGroup(db, "workFiles");
    let q;

    if (scope === "global") {
      q = query(wfGroup,
        where("appScope", "==", "3dsc"),
        where("visibility", "==", "public"),
        limit(60),
      );
    } else if (scope === "my" && user?.uid) {
      q = query(wfGroup,
        where("appScope", "==", "3dsc"),
        where("createdBy", "==", user.uid),
        limit(60),
      );
    } else if (scope === "project" && projectId) {
      q = query(
        collection(db, `projects/${projectId}/workFiles`),
        where("appScope", "==", "3dsc"),
        limit(60),
      );
    } else {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...d.data() }))
        .filter(item => item.status !== "archived" && item.isArchived !== true);
      setItems(data);
      setLoading(false);
    }, (err) => {
      console.error("[FurnitureDashboard]", err);
      setLoading(false);
    });

    return () => unsub();
  }, [scope, user?.uid, projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      String(item.title || item.name || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const goToStudio = () => {
    const url = projectId
      ? `/app/create/studio?projectId=${projectId}`
      : "/app/create/studio";
    navigate(url);
  };

  const EMPTY_MSGS = {
    global:  "公開されている家具がまだありません",
    my:      "あなたの家具がまだありません",
    project: "このプロジェクトに家具がありません",
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: BRAND.bg, color: BRAND.text }}>

      {/* ── Header ── */}
      <Box sx={{
        flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
        bgcolor: BRAND.bg, borderBottom: `1px solid ${BRAND.line}`,
        px: 2.5, py: 1.25,
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
      }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>S.Create</Typography>
          <Typography sx={{ fontSize: 12, color: BRAND.sub2 }}>S.Create</Typography>
          {!loading && (
            <Chip
              label={filtered.length}
              size="small"
              sx={{ height: 18, bgcolor: alpha("#fff", 0.08), color: BRAND.sub, fontSize: 11, "& .MuiChip-label": { px: 0.75 } }}
            />
          )}
        </Box>

        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="家具を検索..."
          sx={{
            width: 280,
            "& .MuiOutlinedInput-root": {
              borderRadius: 999, bgcolor: BRAND.panel,
              "& fieldset":             { borderColor: BRAND.line },
              "&:hover fieldset":       { borderColor: BRAND.line2 },
              "&.Mui-focused fieldset": { borderColor: alpha("#fff", 0.3) },
            },
            "& input": { color: BRAND.text, fontSize: 13 },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16, color: BRAND.sub }} />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ flex: 1 }} />

        {/* Density */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {DENSITY.map(({ id, Icon, label }) => (
            <Tooltip key={id} title={label}>
              <Box
                onClick={() => setDensity(id)}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 1, cursor: "pointer",
                  color:   density === id ? "#fff"             : BRAND.sub,
                  bgcolor: density === id ? alpha("#fff", 0.1) : "transparent",
                  "&:hover": { bgcolor: alpha("#fff", 0.07), color: "#fff" },
                  transition: "all 0.15s",
                }}
              >
                <Icon sx={{ fontSize: 16 }} />
              </Box>
            </Tooltip>
          ))}
        </Box>

        {/* New Furniture */}
        <Box
          onClick={goToStudio}
          sx={{
            display: "flex", alignItems: "center", gap: 0.5,
            px: 1.5, py: 0.5, borderRadius: 999,
            bgcolor: DSC_COLOR, color: "#000",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            "&:hover": { bgcolor: "#ffb74d" },
            transition: "background 0.15s",
            userSelect: "none",
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
          新規造作
        </Box>
      </Box>

      {/* ── Scope Tabs ── */}
      <Box sx={{
        flexShrink: 0, display: "flex",
        borderBottom: `1px solid ${BRAND.line}`,
        px: 2.5, bgcolor: BRAND.bg,
      }}>
        {visibleScopes.map((s) => {
          const isActive = scope === s.id;
          const Icon = s.icon;
          return (
            <Box
              key={s.id}
              onClick={() => setScope(s.id)}
              sx={{
                display: "flex", alignItems: "center", gap: 0.75,
                py: 0.9, px: 1.5, mr: 0.25,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "#fff" : BRAND.sub,
                cursor: "pointer",
                borderBottom: isActive ? `2px solid ${DSC_COLOR}` : "2px solid transparent",
                mb: "-1px",
                "&:hover": { color: "#fff" },
                transition: "color 0.15s",
              }}
            >
              <Icon sx={{ fontSize: 14 }} />
              {s.label}
            </Box>
          );
        })}
      </Box>

      {/* ── Grid ── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
            <CircularProgress size={28} sx={{ color: DSC_COLOR }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <ViewInArRoundedIcon sx={{ fontSize: 48, color: BRAND.sub2, mb: 2 }} />
            <Typography sx={{ fontWeight: 600, color: BRAND.text }}>家具が見つかりません</Typography>
            <Typography sx={{ fontSize: 13, color: BRAND.sub2, mt: 0.5 }}>
              {EMPTY_MSGS[scope] ?? ""}
            </Typography>
            <Box
              onClick={goToStudio}
              sx={{
                mt: 2, display: "inline-flex", alignItems: "center", gap: 0.5,
                px: 2, py: 0.75, borderRadius: 999,
                border: `1px solid ${BRAND.line}`, color: BRAND.text, cursor: "pointer",
                "&:hover": { borderColor: BRAND.line2, bgcolor: BRAND.panel },
                userSelect: "none",
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
              新規造作
            </Box>
          </Box>
        ) : (
          <Box sx={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
            gap: 1.5,
          }}>
            {filtered.map(item => (
              <FurnitureCard
                key={item.id}
                item={item}
                cardSize={cardSize}
                onClick={goToStudio}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
