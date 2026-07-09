// 用途（family）別の「ページ → 子セクション」ブループリント。
// 実在の提案書（インテリア家具ご提案書）の目次構造をルール化したもの。
// 状況に応じた AI 判断の前段として、まずはこのルールで精度を担保する。

import type { ChartType, SiteSectionType, SiteSectionVariant, SiteTemplateFamily } from '../projects/types';

export interface SectionSpec {
  type: SiteSectionType;
  variant?: SiteSectionVariant;
  title?: string;
  body?: string;
  chartType?: ChartType;                          // target 用
  chartKey?: 'audience' | 'site' | 'context';     // target のサンプルデータ選択
}
export interface PageSpec {
  title: string;
  slug: string;
  sections: SectionSpec[];
}

export const BLUEPRINTS: Record<SiteTemplateFamily, PageSpec[]> = {
  // 設計提案プレゼン：提案書の目次をそのまま Web 化（5 ページ）
  proposal: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'spec' },
        { type: 'layout', variant: 'feature', title: 'レイアウト' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    {
      title: 'リサーチ', slug: 'research', sections: [
        { type: 'research', title: '敷地・周辺調査' },
        { type: 'target', title: '敷地ポテンシャル評価', chartType: 'radar', chartKey: 'site' },
        { type: 'target', title: 'ターゲット利用者', chartType: 'donut', chartKey: 'audience' },
        { type: 'target', title: '周辺環境の構成', chartType: 'bar', chartKey: 'context' },
        { type: 'regulation', title: '法規・与条件' },
        { type: 'references', title: '参考文献・出典' },
      ],
    },
    {
      title: 'コンセプト', slug: 'concept', sections: [
        { type: 'concept', title: 'コンセプト' },
        { type: 'process', title: '検討の過程' },
      ],
    },
    {
      title: 'プラン', slug: 'plan', sections: [
        { type: 'layout', variant: 'feature', title: 'レイアウト' },
        { type: 'zoning', title: 'ゾーニング' },
        { type: 'flow', title: '動線計画' },
        { type: 'gallery', variant: 'mosaic', title: 'パース' },
        { type: 'itemspec', title: 'アイテムスペック' },
      ],
    },
    { title: 'ギャラリー', slug: 'gallery', sections: [{ type: 'gallery', variant: 'masonry', title: 'ギャラリー' }] },
    {
      title: '提案・比較', slug: 'proposal', sections: [
        { type: 'comparison', title: '比較検討' },
        { type: 'diagram', variant: 'duo', title: '照明・環境検討' },
      ],
    },
    {
      title: '会社概要', slug: 'about', sections: [
        { type: 'custom', title: '会社概要' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
  ],

  // 竣工・実例の記録：ギャラリー中心
  record: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'spec' },
        { type: 'gallery', variant: 'band', title: 'ハイライト' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    { title: 'ギャラリー', slug: 'gallery', sections: [{ type: 'gallery', variant: 'masonry', title: 'ギャラリー' }] },
    {
      title: '図面・資料', slug: 'docs', sections: [
        { type: 'drawing', variant: 'duo', title: '図面' },
        { type: 'diagram', variant: 'duo', title: 'ダイアグラム' },
      ],
    },
    { title: 'ウォークスルー', slug: 'walk', sections: [{ type: 'walkthrough', title: 'ウォークスルー' }] },
    { title: '会社概要', slug: 'about', sections: [{ type: 'custom', title: '会社概要' }] },
  ],

  // 作品ポートフォリオ
  portfolio: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'portfolio', variant: 'feature', title: '作品' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    {
      title: '作品', slug: 'works', sections: [
        { type: 'portfolio', variant: 'masonry', title: '作品集' },
        { type: 'gallery', variant: 'mosaic', title: 'ギャラリー' },
      ],
    },
    {
      title: 'プロフィール', slug: 'about', sections: [
        { type: 'overview', title: 'プロフィール' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
  ],

  // 集合住宅・分譲プロジェクト（kozielskapark 型）
  residence: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'spec', title: 'プロジェクト概要' },
        { type: 'gallery', variant: 'band', title: 'ハイライト' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    {
      title: '部屋一覧', slug: 'units', sections: [
        { type: 'unitlist', title: '空室・販売中一覧' },
      ],
    },
    {
      title: 'アメニティ', slug: 'amenities', sections: [
        { type: 'overview', title: 'アメニティ・共用施設' },
        { type: 'gallery', variant: 'mosaic', title: '共用部分' },
        { type: 'itemspec', title: '設備・仕様' },
      ],
    },
    {
      title: '立地', slug: 'location', sections: [
        { type: 'research', title: '周辺環境・立地' },
        { type: 'target', title: '周辺施設構成', chartType: 'bar', chartKey: 'context' },
      ],
    },
    { title: 'ギャラリー', slug: 'gallery', sections: [{ type: 'gallery', variant: 'masonry', title: 'ギャラリー' }] },
  ],

  // 区画・戸建て分譲（malinowskiego 型）
  parcel: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'unitpicker', title: '区画・棟セレクター' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    {
      title: '立地', slug: 'location', sections: [
        { type: 'research', title: '周辺環境・アクセス' },
        { type: 'target', title: '周辺施設構成', chartType: 'bar', chartKey: 'context' },
      ],
    },
    {
      title: '仕様', slug: 'spec', sections: [
        { type: 'spec', title: 'プロジェクト概要' },
        { type: 'itemspec', title: '建築仕様・素材' },
        { type: 'regulation', title: '法規・与条件' },
      ],
    },
    { title: 'ギャラリー', slug: 'gallery', sections: [{ type: 'gallery', variant: 'masonry', title: 'ギャラリー' }] },
  ],

  // 事務所・スタジオ紹介（vinode 型）
  studio: [
    {
      title: 'ホーム', slug: 'home', sections: [
        { type: 'hero' },
        { type: 'overview' },
        { type: 'services', title: 'サービス・業務領域' },
        { type: 'profilestats' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
    {
      title: '実績', slug: 'works', sections: [
        { type: 'works', title: '実績プロジェクト' },
      ],
    },
    {
      title: '比較・プラン', slug: 'plans', sections: [
        { type: 'comparison', title: 'サービスの比較' },
        { type: 'process', title: '設計の流れ' },
      ],
    },
    {
      title: 'プロフィール', slug: 'about', sections: [
        { type: 'overview', title: '事務所概要' },
        { type: 'custom', title: 'お問い合わせ' },
      ],
    },
  ],
};
