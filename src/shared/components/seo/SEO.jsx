import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEOCONFIG } from '../../../config/seoConfig.js';

export const SEO = ({ title, description, path, canonical, ogImage, ogType = 'website', children }) => {
  const isDev = import.meta.env.VITE_APP_ENV !== 'production' && import.meta.env.MODE !== 'production';

  // Fallback to default if page specific config is missing
  const activeTitle = title || SEOCONFIG.default.title;
  const activeDescription = description || SEOCONFIG.default.description;
  const activePath = path || '';
  const activeOgImage = ogImage || SEOCONFIG.default.ogImage;
  // `canonical` (絶対URL) が渡されればそれを優先。なければ path から組み立てる。
  // これを欠くと全ページが同じ canonical(ホーム)に化けるので注意。
  const canonicalUrl = canonical || `${SEOCONFIG.default.canonicalUrl}${activePath}`;

  return (
    <Helmet titleTemplate={SEOCONFIG.default.titleTemplate} defaultTitle={SEOCONFIG.default.title}>
      {/* Standard Metadata */}
      <title>{activeTitle}</title>
      <meta name="description" content={activeDescription} />
      {/* Set specific tag or canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots Tag (Block indexing on dev) */}
      {isDev ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={activeTitle} />
      <meta property="og:description" content={activeDescription} />
      <meta property="og:image" content={activeOgImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={activeTitle} />
      <meta name="twitter:description" content={activeDescription} />
      <meta name="twitter:image" content={activeOgImage} />
      <meta name="twitter:site" content={SEOCONFIG.default.twitterHandle} />
      <meta name="twitter:creator" content={SEOCONFIG.default.twitterHandle} />

      {/* Structured Data Hooks */}
      {children}
    </Helmet>
  );
};
