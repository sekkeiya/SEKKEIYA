// 本番ドメイン。全SEO参照(canonical / OGP / 構造化データ / sitemap)の単一の真実。
// ここを変えれば全ページのメタ情報が追従する。過去にファイル毎にドメインがズレて
// canonical が死んだURLを指す事故があったため、必ずこの定数を経由すること。
export const SITE_URL = "https://sekkeiya.com";

// 既定のOGPシェア画像（SNSシェア時のカード画像）。専用 1200×630。
// 差し替えは public/assets/og-image.jpg を置換すればよい（参照は全てこの定数経由）。
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-image.jpg`;

// 組織ロゴ（構造化データの logo 用）。OGPバナーとは別に正方形アイコンを使う。
export const SITE_LOGO = `${SITE_URL}/assets/icons/sekkeiya.png`;

export const SEOCONFIG = {
  default: {
    title: "SEKKEIYA - Design With AI.",
    titleTemplate: "%s | SEKKEIYA",
    description: "次世代の建築デジタルトランスフォーメーション。すべてのプロジェクトデータを統合し、AIとの対話で理想の空間を設計します。",
    canonicalUrl: SITE_URL,
    ogImage: DEFAULT_OG_IMAGE,
    twitterHandle: "@sekkeiya_jp"
  },
  pages: {
    home: {
      title: "SEKKEIYA - Design With AI.",
      description: "AI駆動の次世代建築OS「SEKKEIYA」。AIとの対話だけで、家具の自動レイアウトからインテリアの3D可視化・プレゼン資料までを一気通貫で生成。分断されたツール群を単一のデータベースで統合します。",
      path: "/",
    },
    about: {
      title: "Philosophy",
      description: "分断された作業環境から、対話を通じた創造のプロセスへ。SEKKEIYAが目指す「OSとしての設計環境」のビジョンをご紹介します。",
      path: "/about",
    },
    services: {
      title: "機能一覧 — AI建築設計OSの全アプリ",
      description: "SEKKEIYAの全機能。AIによる家具の自動レイアウト、3Dモデルの管理・共有、PBR素材作成、歩ける3Dプレゼン、AIフォトリアルレンダリング、図面・ポートフォリオ管理まで——建築・インテリア設計に必要な12のアプリとAIスイートを1つのOSに統合します。",
      path: "/services",
    },
    demo: {
      title: "Try Demo - Future OS Experience",
      description: "SEKKEIYAのAIを活用した次世代の設計プロセスや、リアルタイムに生成される高品質なプロポーザルをデモ環境でご体験ください。",
      path: "/demo",
    }
  }
};
