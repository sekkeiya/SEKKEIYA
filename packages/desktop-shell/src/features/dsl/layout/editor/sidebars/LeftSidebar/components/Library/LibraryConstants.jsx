import React from "react";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import ParkRoundedIcon from "@mui/icons-material/ParkRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import LandscapeRoundedIcon from "@mui/icons-material/LandscapeRounded";

// Icon imports for subcategories
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import BedRoundedIcon from "@mui/icons-material/BedRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ChildCareRoundedIcon from "@mui/icons-material/ChildCareRounded";
import WbShadeRoundedIcon from "@mui/icons-material/WbShadeRounded";

import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import HotTubRoundedIcon from "@mui/icons-material/HotTubRounded";
import HotelRoundedIcon from "@mui/icons-material/HotelRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import TrafficRoundedIcon from "@mui/icons-material/TrafficRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";

// ルートカテゴリ = 正典マクロ（useUserSettingsStore の MACRO_CATEGORY_ORDER）。
// サブグループ・リーフは getMergedCategoryMap() から動的に生成され、S.Models Settings と一致する。
//   macro:   モデルの macroCategory と照合するキー（null = 特殊パネル）
//   context: 'plan'=家具配置(Plan/Option)時 / 'base'=躯体(Base)時 / 'both'=両方で表示
export const ROOT_CATEGORIES = [
  { id: "furniture_ready",  macro: "家具 (既製品)",  label: "家具（既製品）",   context: "plan", icon: <WeekendRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "interior",         macro: "インテリア小物", label: "インテリア小物",   context: "plan", icon: <CategoryRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "furniture_custom", macro: "家具 (造作)",    label: "家具（造作）",     context: "plan", icon: <Inventory2RoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "green",            macro: "グリーン",       label: "グリーン",         context: "both", icon: <ParkRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "architecture",     macro: "建築・空間",     label: "建築・空間",       context: "base", icon: <HomeRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "equipment",        macro: "設備・備品",     label: "設備・備品",       context: "base", icon: <WbShadeRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "character",        macro: "キャラクター",   label: "キャラクター",     context: "plan", icon: <DirectionsWalkRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "lighting",     macro: null, label: "Lighting",    context: "both", special: "lighting",    icon: <WbSunnyRoundedIcon sx={{ fontSize: 40 }} /> },
  { id: "environment",  macro: null, label: "Environment", context: "base", special: "environment", icon: <LandscapeRoundedIcon sx={{ fontSize: 40 }} /> },
];

export const getIconForGroup = (groupId) => {
  if (!groupId) return <CategoryRoundedIcon />;
  const g = String(groupId).toLowerCase();

  // Furniture mapping logic
  if (g.includes("ソファ") || g.includes("ロビー")) return <WeekendRoundedIcon />;
  if (g.includes("チェア") || g.includes("椅子")) return <ChairRoundedIcon />;
  if (g.includes("テーブル") || g.includes("卓")) return <TableRestaurantRoundedIcon />;
  if (g.includes("ベッド")) return <BedRoundedIcon />;
  if (g.includes("収納") || g.includes("ボード") || g.includes("キャビネット") || g.includes("ロッカー") || g.includes("食器棚")) return <Inventory2RoundedIcon />;
  if (g.includes("キッズ") || g.includes("ベビー")) return <ChildCareRoundedIcon />;
  if (g.includes("アウトドア") || g.includes("グリーン") || g.includes("植")) return <ParkRoundedIcon />;
  if (g.includes("什器") || g.includes("業務")) return <StorefrontRoundedIcon />;
  if (g.includes("照明")) return <WbSunnyRoundedIcon />;
  if (g.includes("備品") || g.includes("設備") || g.includes("家電") || g.includes("水回り")) return <WbShadeRoundedIcon />;

  // Parts / Architecture mapping logic
  if (g.includes("建具") || g.includes("ドア")) return <DoorFrontRoundedIcon />;
  if (g.includes("窓")) return <WindowRoundedIcon />;
  if (g.includes("建物") || g.includes("構造") || g.includes("躯体")) return <ApartmentRoundedIcon />;
  if (g.includes("外構")) return <ParkRoundedIcon />;

  // Exterior mapping logic
  if (g.includes("信号")) return <TrafficRoundedIcon />;
  if (g.includes("店")) return <StorefrontRoundedIcon />;

  // Architecture mapping logic (buildings)
  if (g.includes("住宅")) return <HomeRoundedIcon />;
  if (g.includes("カフェ") || g.includes("店")) return <StorefrontRoundedIcon />;
  if (g.includes("オフィス")) return <ApartmentRoundedIcon />;
  if (g.includes("医療") || g.includes("高齢")) return <LocalHospitalRoundedIcon />;
  if (g.includes("温浴")) return <HotTubRoundedIcon />;
  if (g.includes("宿泊")) return <HotelRoundedIcon />;
  if (g.includes("公共") || g.includes("福利")) return <AccountBalanceRoundedIcon />;
  if (g.includes("文教") || g.includes("学校")) return <SchoolRoundedIcon />;

  return <CategoryRoundedIcon />;
};

// Translates a backend group label string into a more readable UI label if needed.
// E.g., 'ソファ・ロビーチェア' -> 'Sofas & Lobby', or just return as-is.
export const normalizeGroupLabelForUI = (groupStr) => {
  // If we want to fully translate to English / Twinmotion style, we can map here.
  // Currently, we will keep it largely intact to avoid alienating existing users,
  // but we can refine specific verbose labels.
  return groupStr || "";
};
