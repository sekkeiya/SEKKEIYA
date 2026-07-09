import { SITE_URL, DEFAULT_OG_IMAGE, SITE_LOGO } from "@/config/seoConfig.js";

export const SchemaTypes = {
  getOrganization: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SEKKEIYA",
    "url": SITE_URL,
    "logo": SITE_LOGO,
    "sameAs": [
      "https://twitter.com/sekkeiya_jp"
    ]
  }),

  getWebSite: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SEKKEIYA",
    "alternateName": "セッケイヤ",
    "url": SITE_URL,
    "inLanguage": "ja-JP",
    "publisher": { "@type": "Organization", "name": "SEKKEIYA", "url": SITE_URL },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/services?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  }),

  // パンくず構造化データ。items = [{ name, url }]（url は絶対URL推奨）。
  // 検索結果にパンくず表示が出やすくなり、サイト構造の理解も助ける。
  getBreadcrumbList: (items = []) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": it.name,
      "item": it.url,
    })),
  }),

  // 製品(SEKKEIYA本体)を表す SoftwareApplication。検索結果のリッチ表示に効く。
  getSoftwareApplication: (
    name = "SEKKEIYA",
    desc = "AIとの対話で家具の自動レイアウト・インテリアの3D可視化・プレゼン資料生成までを行うAI空間設計OS。",
    url = SITE_URL,
    category = "DesignApplication"
  ) => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": name,
    "description": desc,
    "url": url,
    "applicationCategory": category,
    "operatingSystem": "WebBrowser, Windows, macOS",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "JPY"
    }
  }),

  // FAQ 構造化データ。faqs = [{ q, a }]。検索結果に Q&A のリッチリザルトが出やすくなる。
  getFAQPage: (faqs = []) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  }),

  // アプリ/機能の一覧。items = [{ name, desc }]。サービス一覧ページの理解を助ける。
  getItemList: (name, items = []) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": name,
    "itemListElement": items.map((it, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": it.name,
      "description": it.desc,
    })),
  }),

  getArticle: (title, excerpt, url, imageUrl, datePublished, authorName) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": excerpt,
    "image": imageUrl || DEFAULT_OG_IMAGE,
    "url": url,
    "datePublished": datePublished,
    "author": {
      "@type": "Person",
      "name": authorName || "SEKKEIYA Official"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SEKKEIYA",
      "logo": {
        "@type": "ImageObject",
        "url": SITE_LOGO
      }
    }
  })
};
