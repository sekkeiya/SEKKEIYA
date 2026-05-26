import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, CircularProgress, Chip, Button, ButtonGroup,
  Switch, Divider, FormControl, Select, MenuItem, TextField,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import WeekendIcon from "@mui/icons-material/Weekend";
import ChairIcon from "@mui/icons-material/Chair";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import BedIcon from "@mui/icons-material/Bed";
import KitchenIcon from "@mui/icons-material/Kitchen";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import ParkIcon from "@mui/icons-material/Park";
import DomainIcon from "@mui/icons-material/Domain";
import BathtubIcon from "@mui/icons-material/Bathtub";
import LightIcon from "@mui/icons-material/Light";
import TvIcon from "@mui/icons-material/Tv";
import YardIcon from "@mui/icons-material/Yard";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import CategoryIcon from "@mui/icons-material/Category";
import AppsIcon from "@mui/icons-material/Apps";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { useNavigate } from "react-router-dom";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";

const MACRO_CATEGORY_ORDER = [
  "家具 (既製品)", "家具 (造作)", "設備・備品", "インテリア小物", "グリーン", "建築・空間",
];

const DEFAULT_CATEGORY_MAP = {
  "家具 (既製品)": {
    "ソファ": ["1人掛けソファ", "2人掛けソファ", "3人掛けソファ", "カウチソファ", "モジュールソファ", "オットマン"],
    "チェア": ["ダイニングチェア", "ラウンジチェア", "オフィスチェア", "スツール", "ベンチ", "座椅子", "ゲーミングチェア"],
    "テーブル": ["ダイニングテーブル", "ローテーブル", "コーヒーテーブル", "サイドテーブル", "デスク", "コンソールテーブル", "会議テーブル"],
    "収納・ボード": ["テレビボード", "キャビネット", "シェルフ・ラック", "チェスト", "本棚", "ワードローブ"],
    "ベッド": ["シングル", "セミダブル", "ダブル", "クイーン", "キング", "2段ベッド・ロフト"],
    "什器・業務用家具": ["陳列棚", "ワゴン", "レジカウンター", "ディスプレイケース", "ホワイトボード", "パーテーション", "ロッカー", "その他業務用"],
    "キッズ・ベビー": ["ベビーベッド", "キッズチェア", "学習机", "おもちゃ・遊具"],
    "家電": ["テレビ", "冷蔵庫", "洗濯機", "エアコン", "PC・モニター", "スピーカー", "キッチン家電"],
  },
  "家具 (造作)": {
    "造作収納": ["壁面収納", "テレビボード一体型", "吊り戸棚", "床下収納", "クローゼット内部"],
    "造作カウンター・デスク": ["キッチンカウンター", "スタディデスク", "バーカウンター", "受付カウンター"],
    "造作ベンチ・座席": ["窓際ベンチ（ヌック）", "ダイニングベンチ", "待合ベンチ", "ファミレス席"],
    "水回り造作": ["造作洗面台", "トイレ手洗い"],
    "造作什器": ["オリジナル陳列棚", "店舗用造作カウンター", "展示台", "ショーケース"],
  },
  "建築・空間": {
    "建物モデル（全体）": ["戸建て住宅", "集合住宅", "店舗・レストラン", "オフィスビル", "公共施設", "工場・倉庫"],
    "構造・躯体": ["柱", "梁", "壁", "床", "階段", "吹き抜け", "屋根", "天井"],
    "建具（内装・外装）": ["片開きドア", "親子ドア", "引き戸", "折れ戸", "掃き出し窓", "腰窓", "天窓"],
    "外構（エクステリア）": ["フェンス・柵", "カーポート・ガレージ", "門扉・アプローチ", "ウッドデッキ", "テラス・バルコニー"],
  },
  "設備・備品": {
    "水回り・住宅設備": ["システムキッチン", "システムバス", "トイレ", "洗面ボウル", "水栓金具", "レンジフード"],
    "照明器具": ["ペンダントライト", "シーリングライト", "ダウンライト", "スポットライト", "フロアスタンド", "ブラケットライト"],
    "家電・デバイス": ["テレビ", "冷蔵庫", "洗濯機", "エアコン", "PC・モニター", "スピーカー", "キッチン家電"],
  },
  "インテリア小物": {
    "装飾・アート・趣味": ["アートフレーム・絵画", "オブジェ・彫像", "時計", "本・雑誌・ファイル", "楽器"],
    "ファブリック・窓周り": ["カーテン", "ブラインド", "ロールスクリーン", "ラグ・カーペット", "クッション・ブランケット"],
    "日用品・水周り小物": ["キッチン小物・調理器具", "テーブルウェア", "サニタリー小物", "ゴミ箱（ダストボックス）"],
  },
  "グリーン": {
    "インテリアグリーン": ["観葉植物（大型）", "観葉植物（小型）", "プランター・鉢", "ハンギング・壁面緑化"],
  },
};

const DENSITY_PRESETS = [
  { key: "compact", label: "Compact", value: 168 },
  { key: "default", label: "Default", value: 210 },
  { key: "large",   label: "Large",   value: 246 },
];

const INITIAL_FILTERS = {
  type: "ALL", category: "ALL", subCategory: "ALL",
  format: "", tags: "", buildingTypes: "", rooms: "", zones: "", materials: "", companionClasses: "",
};

function getCategoryIcon(catName) {
  if (catName === "すべて" || catName === "ALL") return AppsIcon;
  if (catName.includes("ソファ") || catName.includes("ロビー")) return WeekendIcon;
  if (catName.includes("チェア") || catName.includes("スツール") || catName.includes("ベンチ")) return ChairIcon;
  if (catName.includes("テーブル") || catName.includes("デスク")) return TableRestaurantIcon;
  if (catName.includes("ベッド")) return BedIcon;
  if (catName.includes("収納") || catName.includes("ボード") || catName.includes("キャビネット") || catName.includes("キッチン")) return KitchenIcon;
  if (catName.includes("什器") || catName.includes("業務用")) return StorefrontIcon;
  if (catName.includes("キッズ") || catName.includes("ベビー")) return ChildCareIcon;
  if (catName.includes("建具") || catName.includes("ドア") || catName.includes("窓")) return MeetingRoomIcon;
  if (catName.includes("外構") || catName.includes("エクステリア")) return ParkIcon;
  if (catName.includes("建築") || catName.includes("建物") || catName.includes("躯体")) return DomainIcon;
  if (catName.includes("水回り") || catName.includes("衛生") || catName.includes("サニタリー")) return BathtubIcon;
  if (catName.includes("照明")) return LightIcon;
  if (catName.includes("家電") || catName.includes("デバイス")) return TvIcon;
  if (catName.includes("グリーン") || catName.includes("植物") || catName.includes("植栽")) return YardIcon;
  if (catName.includes("装飾") || catName.includes("アート") || catName.includes("趣味")) return ColorLensIcon;
  if (catName.includes("ファブリック")) return CheckroomIcon;
  if (catName.includes("日用品") || catName.includes("テーブルウェア")) return RestaurantIcon;
  if (catName.includes("その他") || catName.includes("備品") || catName.includes("小物")) return LocalOfferIcon;
  return CategoryIcon;
}

function ModelCard({ item, cardSize, showDetails }) {
  const navigate = useNavigate();
  const thumbnailUrl =
    item.thumbnailUrl || item.thumbnail?.url || item.imageUrl || item.previewUrl || "";
  const title = item.name || item.title || "Untitled";

  return (
    <Box
      onDoubleClick={() => navigate(`/app/share/model/${item.id}`)}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: 2.5,
        overflow: "hidden",
        cursor: "pointer",
        bgcolor: "#020617",
        backgroundImage: "radial-gradient(circle at 20% 0%, rgba(51,65,85,0.4) 0%, rgba(2,6,23,1) 70%)",
        border: "1px solid rgba(148,163,184,0.2)",
        transition: "box-shadow 0.2s, border-color 0.2s",
        "&:hover": {
          borderColor: "rgba(148,163,184,0.4)",
          boxShadow: "0 16px 32px rgba(0,0,0,0.6)",
        },
        "&:hover .card-thumb": {
          transform: "scale(1.08) translateY(-3px)",
          filter: "drop-shadow(5px 10px 14px rgba(0,0,0,0.6))",
        },
        "&:hover .card-details": { opacity: 1 },
        "& .card-details": {
          opacity: showDetails ? 1 : 0,
          transition: "opacity 0.2s",
        },
      }}
    >
      {thumbnailUrl ? (
        <Box
          className="card-thumb"
          component="img"
          src={thumbnailUrl}
          alt={title}
          loading="lazy"
          sx={{
            position: "absolute",
            top: "-75%", left: "-75%",
            width: "250%", height: "250%",
            objectFit: "contain",
            transform: "scale(1.0)",
            transformOrigin: "center center",
            transition: "transform 220ms cubic-bezier(0.22,0.61,0.36,1), filter 220ms ease",
            filter: "drop-shadow(5px 10px 14px rgba(0,0,0,0.5))",
          }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <Box sx={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(148,163,184,0.3)",
        }}>
          <ViewInArRoundedIcon sx={{ fontSize: cardSize * 0.28 }} />
        </Box>
      )}

      <Box
        className="card-details"
        sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.6) 60%, transparent 100%)",
          p: 1, pt: 2.5,
        }}
      >
        <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>
          {title}
        </Typography>
        {item.category && (
          <Typography noWrap sx={{ fontSize: 10, color: "rgba(148,163,184,0.8)", mt: 0.25 }}>
            {item.category}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function FilterPanel({ filters, setFilters, onReset }) {
  const inputSx = {
    "& .MuiInputBase-root": { height: 26, fontSize: 11 },
    "& input": { color: "#fff", px: 1 },
    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
    "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)", borderRadius: 1 },
  };
  const selectSx = {
    height: 26, fontSize: 11, color: "#fff", bgcolor: "rgba(0,0,0,0.2)",
    ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.1)" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
  };
  const menuProps = {
    PaperProps: { sx: { bgcolor: "#1a1f2b", backgroundImage: "none", border: "1px solid rgba(255,255,255,0.1)" } },
  };

  const patch = (p) => setFilters((prev) => ({ ...prev, ...p }));

  const activePrimaryType = DEFAULT_CATEGORY_MAP[filters.type] ? filters.type : "家具 (既製品)";
  const availableCategories = ["すべて", ...Object.keys(DEFAULT_CATEGORY_MAP[activePrimaryType] || {})];
  const activeCategoryUI = !filters.category || filters.category === "ALL" ? "すべて" : filters.category;
  const availableDetailed =
    activeCategoryUI !== "すべて" && DEFAULT_CATEGORY_MAP[activePrimaryType]?.[activeCategoryUI]
      ? DEFAULT_CATEGORY_MAP[activePrimaryType][activeCategoryUI]
      : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pb: 2 }}>
      {/* Header */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)", pb: 1.5, mb: -0.5,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FilterAltIcon sx={{ fontSize: 18, color: "#a5d6a7" }} />
          <Typography sx={{ fontWeight: 600, color: "#fff", letterSpacing: 0.5, fontSize: 12 }}>
            Search & Filter
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 12 }} />}
          onClick={onReset}
          sx={{
            color: "rgba(148,163,184,0.85)", textTransform: "none", fontSize: 10,
            height: 22, minWidth: 0, px: 1, borderRadius: 1,
            "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          Reset
        </Button>
      </Box>

      {/* FILE FORMAT */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", fontWeight: 600, fontSize: 10 }}>
          FILE FORMAT
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {["ALL", "3DM", "BLEND", "GLB"].map((fmt) => {
            const isActive = fmt === "ALL" ? !filters.format : filters.format === fmt;
            return (
              <Button
                key={fmt}
                fullWidth
                disableElevation
                variant="outlined"
                onClick={() => patch({ format: fmt === "ALL" ? "" : fmt })}
                sx={{
                  color: isActive ? "#a5d6a7" : "rgba(148,163,184,0.85)",
                  fontWeight: isActive ? 600 : 400,
                  borderColor: isActive ? "#a5d6a7" : "rgba(255,255,255,0.1)",
                  bgcolor: isActive ? "rgba(165,214,167,0.15)" : "transparent",
                  textTransform: "none", fontSize: 10, height: 28, borderRadius: 1.5, minWidth: 0,
                  "&:hover": { borderColor: "#a5d6a7", color: "#a5d6a7", bgcolor: "rgba(165,214,167,0.05)" },
                }}
              >
                {fmt}
              </Button>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

      {/* PRIMARY CATEGORY */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", fontWeight: 600, fontSize: 10 }}>
          PRIMARY CATEGORY
        </Typography>
        <Box sx={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5,
          bgcolor: "rgba(0,0,0,0.2)", p: 0.5, borderRadius: 1.5,
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <Button
            fullWidth
            disableElevation
            onClick={() => patch({ type: "ALL", category: "ALL", subCategory: "ALL" })}
            sx={{
              gridColumn: "1 / -1",
              color: !filters.type || filters.type === "ALL" ? "#a5d6a7" : "rgba(148,163,184,0.85)",
              fontWeight: !filters.type || filters.type === "ALL" ? 600 : 400,
              fontSize: 10, height: 26, borderRadius: 1, textTransform: "none",
              bgcolor: !filters.type || filters.type === "ALL" ? "rgba(165,214,167,0.15)" : "transparent",
              "&:hover": { bgcolor: "rgba(165,214,167,0.1)" },
            }}
          >
            ALL
          </Button>
          {MACRO_CATEGORY_ORDER.map((cat) => {
            const isActive = filters.type === cat;
            return (
              <Button
                key={cat}
                fullWidth
                disableElevation
                onClick={() => patch({ type: cat, category: "ALL", subCategory: "ALL" })}
                sx={{
                  color: isActive ? "#a5d6a7" : "rgba(148,163,184,0.85)",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 10, height: 26, borderRadius: 1, textTransform: "none",
                  bgcolor: isActive ? "rgba(165,214,167,0.15)" : "transparent",
                  "&:hover": { bgcolor: "rgba(165,214,167,0.1)" },
                  whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {cat}
              </Button>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

      {/* SUB CATEGORIES */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", fontWeight: 600, fontSize: 10 }}>
          SUB CATEGORIES
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.5 }}>
          {availableCategories.map((cat) => {
            const logicalCat = cat === "すべて" ? "ALL" : cat;
            const isActive = logicalCat === "ALL"
              ? !filters.category || filters.category === "ALL"
              : filters.category === logicalCat;
            const IconComp = getCategoryIcon(cat);
            return (
              <Button
                key={cat}
                variant="outlined"
                onClick={() => patch({ category: logicalCat, subCategory: "ALL" })}
                sx={{
                  flexDirection: "column", py: 1.5, px: 0.5,
                  color: isActive ? "#a5d6a7" : "rgba(148,163,184,0.85)",
                  borderColor: isActive ? "rgba(165,214,167,0.3)" : "rgba(255,255,255,0.1)",
                  bgcolor: isActive ? "rgba(165,214,167,0.05)" : "transparent",
                  borderRadius: 1.5, fontSize: 9, minWidth: 0, textTransform: "none",
                  "&:hover": { borderColor: "#a5d6a7", color: "#a5d6a7", bgcolor: "rgba(165,214,167,0.05)" },
                }}
              >
                <IconComp sx={{ mb: 0.5, fontSize: 16, opacity: isActive ? 1 : 0.8 }} />
                {cat}
              </Button>
            );
          })}
        </Box>
        <FormControl fullWidth size="small" sx={{ mt: 0.5 }} disabled={availableDetailed.length === 0}>
          <Select
            value={filters.subCategory || "ALL"}
            sx={selectSx}
            MenuProps={menuProps}
            onChange={(e) => patch({ subCategory: e.target.value === "ALL" ? "" : e.target.value })}
          >
            <MenuItem value="ALL" sx={{ fontSize: 11 }}>詳細カテゴリ: すべて</MenuItem>
            {availableDetailed.map((d) => (
              <MenuItem key={d} value={d} sx={{ fontSize: 11 }}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

      {/* TAGS */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", fontWeight: 600, fontSize: 10 }}>
          TAGS
        </Typography>
        <TextField
          fullWidth size="small" placeholder="例: 北欧, シンプル"
          sx={inputSx} value={filters.tags || ""}
          onChange={(e) => patch({ tags: e.target.value })}
        />
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

      {/* EXTENDED METADATA */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", fontWeight: 600, fontSize: 10 }}>
          EXTENDED METADATA
        </Typography>
        <TextField fullWidth size="small" placeholder="BUILDING TYPES (例: 住宅, 店舗)" sx={inputSx} value={filters.buildingTypes || ""} onChange={(e) => patch({ buildingTypes: e.target.value })} />
        <TextField fullWidth size="small" placeholder="ROOMS (例: リビング, 厨房)" sx={inputSx} value={filters.rooms || ""} onChange={(e) => patch({ rooms: e.target.value })} />
        <TextField fullWidth size="small" placeholder="ZONES (例: 作業, リラックス)" sx={inputSx} value={filters.zones || ""} onChange={(e) => patch({ zones: e.target.value })} />
        <TextField fullWidth size="small" placeholder="MATERIALS (例: 木材, スチール)" sx={inputSx} value={filters.materials || ""} onChange={(e) => patch({ materials: e.target.value })} />
        <TextField fullWidth size="small" placeholder="COMPANION (例: ダイニングセット)" sx={inputSx} value={filters.companionClasses || ""} onChange={(e) => patch({ companionClasses: e.target.value })} />
      </Box>
    </Box>
  );
}

export default function ShapeSearchDashboard({ scope, setScope, activeProjectId = null, setActiveProjectId }) {
  const { user, authLoading } = useAuth();

  const [contentMode, setContentMode] = useState("furniture");  // furniture | set_furniture
  const [density, setDensity]         = useState("default");
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch]           = useState("");
  const [filters, setFilters]         = useState(INITIAL_FILTERS);
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);

  const cardSize = DENSITY_PRESETS.find((d) => d.key === density)?.value ?? 210;
  const isGlobalScope = scope === "explore" || scope === "following";

  useEffect(() => {
    if ((scope === "my_public" || scope === "my_private") && !user && !authLoading) setScope("explore");
    if ((scope === "project" || scope === "team_project") && !activeProjectId) setScope("explore");
  }, [scope, user, authLoading, activeProjectId]);

  useEffect(() => {
    setLoading(true);
    setItems([]);

    const assetsCol = collection(db, "assets");
    let q;

    if (scope === "explore" || scope === "following") {
      q = query(assetsCol, where("type", "==", "3d-model"), where("visibility", "==", "public"), limit(120));
    } else if (scope === "my_public" && user?.uid) {
      q = query(assetsCol, where("type", "==", "3d-model"), where("ownerId", "==", user.uid), where("visibility", "==", "public"), limit(120));
    } else if (scope === "my_private" && user?.uid) {
      q = query(assetsCol, where("type", "==", "3d-model"), where("ownerId", "==", user.uid), where("visibility", "==", "private"), limit(120));
    } else if ((scope === "project" || scope === "team_project") && activeProjectId) {
      q = query(collection(db, `projects/${activeProjectId}/assets`), where("type", "==", "3d-model"), limit(120));
    } else {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.status !== "archived" && item.isArchived !== true);
      setItems(data);
      setLoading(false);
    }, (err) => {
      console.error("[ShapeSearchDashboard]", err);
      setLoading(false);
    });
    return () => unsub();
  }, [scope, user?.uid, activeProjectId]);

  const pFilter = useMemo(() => ({
    type:           filters.type,
    category:       filters.category,
    subCategory:    filters.subCategory,
    format:         filters.format ? filters.format.toLowerCase() : null,
    tags:           filters.tags ? filters.tags.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    buildingTypes:  filters.buildingTypes ? filters.buildingTypes.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    rooms:          filters.rooms ? filters.rooms.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    zones:          filters.zones ? filters.zones.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    materials:      filters.materials ? filters.materials.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    companionClasses: filters.companionClasses ? filters.companionClasses.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) : null,
    query:          search.trim() ? search.trim().toLowerCase() : null,
  }), [filters, search]);

  const filtered = useMemo(() => items.filter((m) => {
    if (m.type === "image" || m.type === "pdf") return false;

    if (pFilter.type && pFilter.type !== "ALL") {
      if (m.macroCategory) {
        if (m.macroCategory !== pFilter.type) return false;
      } else {
        const catStr = [m.category, m.mainCategory].filter(Boolean).join(" ");
        const typeKey = pFilter.type.replace(" (既製品)", "").replace(" (造作)", "");
        if (!catStr.includes(typeKey)) return false;
      }
    }

    if (pFilter.category && pFilter.category !== "ALL") {
      const catStr = [m.category, m.mainCategory, m.categoryMain, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])].filter(Boolean).join(" ");
      if (!catStr.includes(pFilter.category)) return false;
    }

    if (pFilter.subCategory && pFilter.subCategory !== "ALL") {
      const subCatStr = [m.category, m.subCategory, m.userCategory, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])].filter(Boolean).join(" ");
      if (!subCatStr.includes(pFilter.subCategory)) return false;
    }

    if (pFilter.format) {
      const fmtStr = `${m.format || ""} ${m.fileFormat || ""}`.toLowerCase();
      const urlStr = `${m.downloadUrl || ""} ${m.storagePath || ""}`.toLowerCase();
      if (!fmtStr.includes(pFilter.format) && !urlStr.includes(`.${pFilter.format}`)) return false;
    }

    const tagsStr = (Array.isArray(m.tags) ? m.tags.join(" ") : (m.tags || "")).toLowerCase();
    for (const t of pFilter.tags || []) { if (!tagsStr.includes(t)) return false; }

    const buildingStr = (Array.isArray(m.buildingTypes) ? m.buildingTypes.join(" ") : (m.buildingTypes || "")).toLowerCase();
    for (const t of pFilter.buildingTypes || []) { if (!buildingStr.includes(t)) return false; }

    const roomsStr = (Array.isArray(m.rooms) ? m.rooms.join(" ") : (m.rooms || "")).toLowerCase();
    for (const t of pFilter.rooms || []) { if (!roomsStr.includes(t)) return false; }

    const zonesStr = (Array.isArray(m.zones) ? m.zones.join(" ") : (m.zones || "")).toLowerCase();
    for (const t of pFilter.zones || []) { if (!zonesStr.includes(t)) return false; }

    const matsStr = (Array.isArray(m.materials) ? m.materials.join(" ") : (m.materials || "")).toLowerCase();
    for (const t of pFilter.materials || []) { if (!matsStr.includes(t)) return false; }

    const compStr = (Array.isArray(m.companionClasses) ? m.companionClasses.join(" ") : (m.companionClasses || "")).toLowerCase();
    for (const t of pFilter.companionClasses || []) { if (!compStr.includes(t)) return false; }

    if (pFilter.query) {
      const hay = [m.title, m.name, m.brand, m.ownerHandle, m.ownerName, Array.isArray(m.tags) ? m.tags.join(" ") : ""].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(pFilter.query)) return false;
    }

    return true;
  }), [items, pFilter]);

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const hasActiveFilters =
    (filters.type && filters.type !== "ALL") ||
    (filters.category && filters.category !== "ALL") ||
    (filters.subCategory && filters.subCategory !== "ALL") ||
    filters.format || filters.tags;

  const scopeTitle =
    scope === "my_public" ? "My Public Models" :
    scope === "my_private" ? "My Private Models" :
    (scope === "project" || scope === "team_project") ? "Project 3D Assets" : "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: BRAND.bg, color: BRAND.text }}>

      {/* ── Sticky Header ── */}
      <Box sx={{
        position: "sticky", top: 0, zIndex: 20, flexShrink: 0,
        background: "rgba(2,6,23,0.92)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(148,163,184,0.18)",
      }}>

        {/* Top Bar */}
        <Box sx={{ minHeight: 58, px: 2, py: "10px", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "nowrap" }}>

          {/* Title Block */}
          <Box sx={{ minWidth: 200, display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(148,163,184,0.85)", lineHeight: 1.2 }}>
              Global Asset Hub
            </Typography>
            {isGlobalScope ? (
              <Box sx={{ display: "flex", gap: 3, alignItems: "baseline" }}>
                <Typography
                  onClick={() => setScope("explore")}
                  sx={{
                    fontSize: 22, fontWeight: 700, cursor: "pointer",
                    color: scope === "explore" ? "#fff" : "rgba(255,255,255,0.35)",
                    transition: "color 0.2s", "&:hover": { color: "#fff" },
                  }}
                >
                  Explore
                </Typography>
                <Typography
                  onClick={() => setScope("following")}
                  sx={{
                    fontSize: 22, fontWeight: 700, cursor: "pointer",
                    color: scope === "following" ? "#fff" : "rgba(255,255,255,0.35)",
                    transition: "color 0.2s", "&:hover": { color: "#fff" },
                  }}
                >
                  Following
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  onClick={() => setScope("explore")}
                  sx={{ fontSize: 11, color: "rgba(148,163,184,0.6)", cursor: "pointer", "&:hover": { color: "#fff" } }}
                >
                  ← Explore
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 760, color: "#e2e8f0", letterSpacing: 0.2 }}>
                  {scopeTitle}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* Search */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1,
            px: "10px", py: "7px", borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.30)",
            background: "rgba(15,23,42,0.62)",
            width: "min(560px, 100%)", minWidth: 200,
          }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: "rgba(148,163,184,0.9)", flexShrink: 0 }} />
            <Box
              component="input"
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                flex: 1, border: "none", outline: "none",
                background: "transparent", color: "#e5e7eb", fontSize: 12,
              }}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 12 }} />

          {/* Density */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>Density</Typography>
            <ButtonGroup
              size="small"
              variant="outlined"
              sx={{ "& .MuiButton-root": { textTransform: "none", borderColor: "rgba(148,163,184,0.22)" } }}
            >
              {DENSITY_PRESETS.map(({ key, label }) => (
                <Button
                  key={key}
                  onClick={() => setDensity(key)}
                  sx={density === key ? {
                    color: "#0b1220", background: "rgba(96,165,250,0.9)", borderColor: "rgba(96,165,250,0.9)",
                    px: "10px", py: "3px", fontSize: 11,
                    "&:hover": { background: "rgba(96,165,250,0.95)" },
                  } : {
                    color: "rgba(229,231,235,0.9)", background: "rgba(15,23,42,0.32)",
                    borderColor: "rgba(148,163,184,0.22)", px: "10px", py: "3px", fontSize: 11,
                  }}
                >
                  {label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </Box>

        {/* Filter Row */}
        <Box sx={{
          px: 2, py: "8px", display: "flex", alignItems: "center", gap: 1.25,
          borderTop: "1px solid rgba(148,163,184,0.08)", minHeight: 40, flexWrap: "nowrap",
        }}>
          {/* Furniture / Set Furniture */}
          <Box sx={{
            display: "flex", flexShrink: 0, borderRadius: "6px", overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <Button
              size="small"
              onClick={() => setContentMode("furniture")}
              sx={{
                textTransform: "none", fontSize: 11, px: 1.5, py: 0, borderRadius: 0, height: 28, minWidth: 0,
                bgcolor: contentMode === "furniture" ? "rgba(96,165,250,0.15)" : "transparent",
                color: contentMode === "furniture" ? "#60a5fa" : "rgba(148,163,184,0.7)",
                borderRight: "1px solid rgba(148,163,184,0.15)",
                "&:hover": { bgcolor: "rgba(96,165,250,0.1)" },
              }}
            >
              Furniture
            </Button>
            <Button
              size="small"
              onClick={() => setContentMode("set_furniture")}
              sx={{
                textTransform: "none", fontSize: 11, px: 1.5, py: 0, borderRadius: 0, height: 28, minWidth: 0,
                bgcolor: contentMode === "set_furniture" ? "rgba(167,139,250,0.15)" : "transparent",
                color: contentMode === "set_furniture" ? "#a78bfa" : "rgba(148,163,184,0.7)",
                "&:hover": { bgcolor: "rgba(167,139,250,0.1)" },
              }}
            >
              Set Furniture
            </Button>
          </Box>

          {/* Active filter chips */}
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
            {!hasActiveFilters && (
              <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)" }}>No filters applied</Typography>
            )}
            {filters.type && filters.type !== "ALL" && (
              <Chip
                size="small" label={`Primary: ${filters.type}`}
                onDelete={() => setFilters((f) => ({ ...f, type: "ALL", category: "ALL", subCategory: "ALL" }))}
                sx={{ bgcolor: "rgba(165,214,167,0.1)", color: "#a5d6a7", border: "1px solid rgba(165,214,167,0.3)", height: 22, fontSize: 11 }}
              />
            )}
            {filters.category && filters.category !== "ALL" && (
              <Chip
                size="small" label={`Category: ${filters.category}`}
                onDelete={() => setFilters((f) => ({ ...f, category: "ALL", subCategory: "ALL" }))}
                sx={{ bgcolor: "rgba(165,214,167,0.1)", color: "#a5d6a7", border: "1px solid rgba(165,214,167,0.3)", height: 22, fontSize: 11 }}
              />
            )}
            {filters.subCategory && filters.subCategory !== "ALL" && (
              <Chip
                size="small" label={`Sub: ${filters.subCategory}`}
                onDelete={() => setFilters((f) => ({ ...f, subCategory: "ALL" }))}
                sx={{ bgcolor: "rgba(165,214,167,0.1)", color: "#a5d6a7", border: "1px solid rgba(165,214,167,0.3)", height: 22, fontSize: 11 }}
              />
            )}
            {filters.format && (
              <Chip
                size="small" label={`Format: ${filters.format}`}
                onDelete={() => setFilters((f) => ({ ...f, format: "" }))}
                sx={{ bgcolor: "rgba(165,214,167,0.1)", color: "#a5d6a7", border: "1px solid rgba(165,214,167,0.3)", height: 22, fontSize: 11 }}
              />
            )}
            {filters.tags && filters.tags.split(/[\s,]+/).filter(Boolean).map((t) => (
              <Chip
                key={t} size="small" label={t}
                onDelete={() => setFilters((f) => ({ ...f, tags: f.tags.split(/[\s,]+/).filter((tt) => tt !== t).join(" ") }))}
                sx={{ bgcolor: "rgba(165,214,167,0.1)", color: "#a5d6a7", border: "1px solid rgba(165,214,167,0.3)", height: 22, fontSize: 11 }}
              />
            ))}
          </Box>

          {/* Actions Right */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.85)", mr: 0.75, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>
                詳細表示
              </Typography>
              <Switch size="small" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} color="primary" />
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<CloudUploadIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: "none", borderRadius: 999, fontSize: 11, px: "12px", py: "4px", height: 30,
                bgcolor: "#29b6f6", color: "#fff", "&:hover": { bgcolor: "#0288d1" },
              }}
            >
              Upload
            </Button>
            <Button
              size="small"
              startIcon={<SortRoundedIcon sx={{ fontSize: 14 }} />}
              sx={{
                textTransform: "none", borderRadius: 999, fontSize: 11, px: "12px", py: "4px", height: 30,
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(15,23,42,0.52)", color: "#e5e7eb",
                "&:hover": { background: "rgba(15,23,42,0.70)" },
              }}
            >
              Sort
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* Grid Area */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
              <CircularProgress size={28} sx={{ color: "#ff5252" }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <ViewInArRoundedIcon sx={{ fontSize: 48, color: BRAND.sub2, mb: 2 }} />
              <Typography sx={{ fontWeight: 600, color: BRAND.text }}>モデルが見つかりません</Typography>
              <Typography sx={{ fontSize: 13, color: BRAND.sub2, mt: 0.5 }}>
                {(scope === "my_public" || scope === "my_private") ? "あなたのモデルがまだありません" :
                 (scope === "project" || scope === "team_project") ? "このプロジェクトにモデルがありません" :
                 "公開モデルがまだありません"}
              </Typography>
            </Box>
          ) : (
            <Box sx={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
              gap: 1.5,
            }}>
              {filtered.map((item) => (
                <ModelCard key={item.id} item={item} cardSize={cardSize} showDetails={showDetails} />
              ))}
            </Box>
          )}
        </Box>

        {/* Right Filter Sidebar */}
        <Box sx={{
          width: 240, flexShrink: 0,
          borderLeft: "1px solid rgba(148,163,184,0.12)",
          overflow: "auto", p: 2,
          bgcolor: "rgba(2,6,23,0.7)",
        }}>
          <FilterPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
        </Box>
      </Box>
    </Box>
  );
}
