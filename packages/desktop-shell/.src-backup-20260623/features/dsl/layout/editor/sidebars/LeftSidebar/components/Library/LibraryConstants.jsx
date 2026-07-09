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

import { TYPES } from "@desktop/shared/data/Categories";

// Root categories map to our generic names, but carry the strict TYPES context for filtering
export const ROOT_CATEGORIES = [
  {
    id: "furniture",
    label: "Furniture",
    type: TYPES.FURNITURE,
    subType: "",
    icon: <WeekendRoundedIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: "architecture",
    label: "Architecture",
    type: TYPES.ARCHITECTURE,
    subType: "建物（本体）",
    icon: <HomeRoundedIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: "parts",
    label: "Parts",
    type: TYPES.ARCHITECTURE,
    subType: "建具・部材",
    icon: <DoorFrontRoundedIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: "exterior",
    label: "Exterior",
    type: TYPES.ARCHITECTURE,
    subType: "外構・周辺",
    icon: <ParkRoundedIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: "lighting",
    label: "Lighting",
    type: null,       // ライブラリアセットではなく設定パネルを開く
    subType: null,
    icon: <WbSunnyRoundedIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: "environment",
    label: "Environment",
    type: null,       // ライブラリアセットではなく設定パネルを開く（Landscape プリセット）
    subType: null,
    icon: <LandscapeRoundedIcon sx={{ fontSize: 40 }} />,
  },
];

export const getIconForGroup = (groupId) => {
  if (!groupId) return <CategoryRoundedIcon />;
  const g = String(groupId).toLowerCase();

  // Furniture mapping logic
  if (g.includes("ソファ") || g.includes("ロビー")) return <WeekendRoundedIcon />;
  if (g.includes("チェア") || g.includes("椅子")) return <ChairRoundedIcon />;
  if (g.includes("テーブル") || g.includes("卓")) return <TableRestaurantRoundedIcon />;
  if (g.includes("ベッド")) return <BedRoundedIcon />;
  if (g.includes("キャビネット") || g.includes("ロッカー") || g.includes("食器棚")) return <Inventory2RoundedIcon />;
  if (g.includes("キッズ")) return <ChildCareRoundedIcon />;
  if (g.includes("アウトドア")) return <ParkRoundedIcon />;
  if (g.includes("備品")) return <WbShadeRoundedIcon />;

  // Parts mapping logic
  if (g.includes("ドア")) return <DoorFrontRoundedIcon />;
  if (g.includes("窓")) return <WindowRoundedIcon />;

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
