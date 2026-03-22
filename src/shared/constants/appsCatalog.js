import sharePng from "@/assets/icons/share.png";
import layoutPng from "@/assets/icons/layout.png";
import presentsPng from "@/assets/icons/presents.png";
import questPng from "@/assets/icons/quest.png";
import createPng from "@/assets/icons/create.png";
import booksPng from "@/assets/icons/books.png";

export const APPS_CATALOG = [
  {
    key: "3dss",
    label: "3D Shape Share",
    sub: "クラウドストレージ",
    icon: sharePng,
    hrefPublic: "/app/share/",
    hrefAuth: "/app/share/dashboard",
    badge: null,
  },
  {
    key: "3dsl",
    label: "3D Shape Layout",
    sub: "レイアウト / 配置",
    icon: layoutPng,
    hrefPublic: "/app/layout/",
    hrefAuth: "/app/layout/dashboard",
    badge: null,
  },
  {
    key: "3dsc",
    label: "3D Shape Create",
    sub: "3D生成 / モデル作成",
    icon: createPng,
    hrefPublic: "/app/create/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsp",
    label: "3D Shape Presents",
    sub: "プレゼン / 見積もり",
    icon: presentsPng,
    hrefPublic: "/app/presents/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsb",
    label: "3D Shape Books",
    sub: "物語 / 体験",
    icon: booksPng,
    hrefPublic: "/app/books/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsq",
    label: "3D Shape Quest",
    sub: "学習 / クエスト",
    icon: questPng,
    hrefPublic: "/app/quest/",
    hrefAuth: null,
    badge: null,
  },
];
