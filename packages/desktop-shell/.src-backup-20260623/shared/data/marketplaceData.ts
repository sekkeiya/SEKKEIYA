import type { AppScope } from "../layout/workspace/types";

import icon3DSS from "../../../src-tauri/src/assets/icons/share.png";
import icon3DSL from "../../../src-tauri/src/assets/icons/layout.png";
import icon3DSC from "../../../src-tauri/src/assets/icons/create.png";
import icon3DSP from "../../../src-tauri/src/assets/icons/presents.png";
import icon3DSD from "../../../src-tauri/src/assets/icons/diagram.png";
import icon3DSR from "../../../src-tauri/src/assets/icons/drawing.png";
import icon3DSI from "../../../src-tauri/src/assets/icons/image.png";
import icon3DSQ from "../../../src-tauri/src/assets/icons/quest.png";
import icon3DSF from "../../../src-tauri/src/assets/icons/books.png";

export type ServiceStatus = "ACTIVE" | "BETA" | "IN DEVELOPMENT";

export interface EcosystemService {
  id: string;
  category: string;
  title: string;
  /** 短い英語サブタイトル（カード上のキャッチ） */
  tagline: string;
  desc: string;
  color: string;
  icon: string;
  status: ServiceStatus;
  path: string;
  /** ワークスペースを持つ子アプリのみ。指定があると Marketplace から直接起動できる。 */
  workspaceId?: string;
  scope?: AppScope;
}

export interface ServiceCategory {
  id: string;
  label: string;
  subtitle: string;
  desc: string;
  themeColor: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "design",
    label: "DESIGN & 3D",
    subtitle: "空間をかたちにする",
    desc: "3Dモデルの共有・配置・生成・プレゼンまで、空間デザインの中核ワークフローを担うアプリ群。",
    themeColor: "#4A90E2",
  },
  {
    id: "document",
    label: "DRAWING & VISUAL",
    subtitle: "図面とビジュアル資料",
    desc: "ダイアグラム・図面・パース／AI画像など、設計の意図を伝えるビジュアルドキュメントを管理するアプリ群。",
    themeColor: "#50E3C2",
  },
  {
    id: "growth",
    label: "LEARNING & SHOWCASE",
    subtitle: "学び、魅せる",
    desc: "建築・インテリアのスキルを伸ばす学習プラットフォームと、成果を発信するポートフォリオ。",
    themeColor: "#E24A9A",
  },
];

export const ECOSYSTEM_SERVICES: EcosystemService[] = [
  // ── DESIGN & 3D ──────────────────────────────────────────────
  {
    id: "3dss",
    category: "design",
    title: "S.Models",
    tagline: "3D Shape Share",
    desc: "3Dモデルをブラウザ上で高速に共有し、ウォークスルーや注釈付けでレビューできるクラウド共有アプリ。",
    color: "#34A853",
    icon: icon3DSS,
    status: "ACTIVE",
    path: "/app/share",
    workspaceId: "models",
    scope: "3dss",
  },
  {
    id: "3dsl",
    category: "design",
    title: "S.Layout",
    tagline: "3D Shape Layout",
    desc: "登録済みの3Dアセットを使い、ブラウザ上で直感的に空間レイアウトを組み立てる配置シミュレータ。",
    color: "#E8542A",
    icon: icon3DSL,
    status: "ACTIVE",
    path: "/app/layout",
    workspaceId: "layout",
    scope: "3dsl",
  },
  {
    id: "3dsc",
    category: "design",
    title: "S.Create",
    tagline: "3D Shape Create",
    desc: "画像やテキストから独自の3Dアセットを素早く生成するAIモデリングジェネレーター。",
    color: "#F2C12E",
    icon: icon3DSC,
    status: "ACTIVE",
    path: "/app/create",
    workspaceId: "create",
    scope: "3dsc",
  },
  {
    id: "3dsp",
    category: "design",
    title: "S.Presentations",
    tagline: "3D Shape Presents",
    desc: "シネマティックなスクロール型プレゼンテーションを自動構築・配信するPresentsビルダー。",
    color: "#D2A24E",
    icon: icon3DSP,
    status: "BETA",
    path: "/app/presents",
    workspaceId: "presents",
    scope: "3dsp",
  },

  // ── DRAWING & VISUAL ─────────────────────────────────────────
  {
    id: "3dsd",
    category: "document",
    title: "S.Diagram",
    tagline: "3D Shape Diagram",
    desc: "ゾーニングや動線、システム構成などの設計ダイアグラムを作成・共有するドローイングツール。",
    color: "#3B45D4",
    icon: icon3DSD,
    status: "ACTIVE",
    path: "/app/diagram",
    workspaceId: "diagram",
    scope: "3dsd",
  },
  {
    id: "3dsr",
    category: "document",
    title: "S.Drawing",
    tagline: "3D Shape Drawing",
    desc: "平面図・立面図などの図面をセット単位でアップロード・管理し、チームと共有する図面管理アプリ。",
    color: "#E23B3B",
    icon: icon3DSR,
    status: "ACTIVE",
    path: "/app/drawing",
    workspaceId: "drawing",
    scope: "3dsr",
  },
  {
    id: "3dsi",
    category: "document",
    title: "S.Image",
    tagline: "3D Shape Image",
    desc: "パース・動画・AI生成画像などのビジュアル成果物を横断的に集約・管理するイメージライブラリ。",
    color: "#2E9BE6",
    icon: icon3DSI,
    status: "ACTIVE",
    path: "/app/image",
    workspaceId: "image",
    scope: "3dsi",
  },

  // ── LEARNING & SHOWCASE ──────────────────────────────────────
  {
    id: "3dsq",
    category: "growth",
    title: "S.Quest",
    tagline: "3D Shape Quest",
    desc: "建築・インテリア向けの学習プラットフォーム。動画講座やステップ式のコースでスキルを体系的に習得。",
    color: "#1FAE7E",
    icon: icon3DSQ,
    status: "BETA",
    path: "/app/quest",
    workspaceId: "quest",
    scope: "3dsq",
  },
  {
    id: "3dsf",
    category: "growth",
    title: "S.Portfolio",
    tagline: "3D Shape Folio",
    desc: "プロジェクトの成果物をまとめ、実績として発信できるポートフォリオ＆ナレッジベース。",
    color: "#9B51E0",
    icon: icon3DSF,
    status: "IN DEVELOPMENT",
    path: "/app/portfolio",
    workspaceId: "portfolio",
    scope: "3dsf",
  },
];
