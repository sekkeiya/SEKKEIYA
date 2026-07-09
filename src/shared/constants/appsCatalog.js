import sharePng from "@/assets/icons/share.png";
import layoutPng from "@/assets/icons/layout.png";
import presentsPng from "@/assets/icons/presents.png";
import questPng from "@/assets/icons/quest.png";
import createPng from "@/assets/icons/create.png";
import booksPng from "@/assets/icons/books.png";

export const APPS_CATALOG = [
  {
    key: "3dss",
    label: "S.Model",
    sub: "クラウドストレージ",
    icon: sharePng,
    hrefPublic: "/app/share/",
    hrefAuth: "/app/share/dashboard",
    badge: null,
  },
  {
    key: "3dsl",
    label: "S.Layout",
    sub: "レイアウト / 配置",
    icon: layoutPng,
    hrefPublic: "/app/layout/",
    hrefAuth: "/app/layout/dashboard",
    badge: null,
  },
  {
    key: "3dsc",
    label: "S.Create",
    sub: "3D生成 / モデル作成",
    icon: createPng,
    hrefPublic: "/app/create/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsp",
    label: "S.Slide",
    sub: "プレゼン / 見積もり",
    icon: presentsPng,
    hrefPublic: "/app/presents/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsb",
    label: "S.Books",
    sub: "物語 / 体験",
    icon: booksPng,
    hrefPublic: "/app/books/",
    hrefAuth: null,
    badge: null,
  },
  {
    key: "3dsq",
    label: "S.Quest",
    sub: "学習 / クエスト",
    icon: questPng,
    hrefPublic: "/app/quest/",
    hrefAuth: null,
    badge: null,
  },
];
