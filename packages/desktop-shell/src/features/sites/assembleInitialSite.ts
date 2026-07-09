// 初期サイトのアセンブラ（決定的）。
// ★ここが「後で LLM に差し替える継ぎ目」。同じ入出力契約で LLM 版を用意すれば置換できる。
//   入力: { projectId, projectName, answers, assets } → 出力: ProjectSite
// 方針: 概要は必ずテキストで埋め、素材が必要なセクションは実素材で埋める。
//       実素材が無いセクションはプレースホルダ枠で視覚的に埋める（ユーザー選択: ダミー充填）。
// 仕様: docs/09_project_site_spec.md §4 / §7

import type {
  ProjectSite, SiteAssetRef, SiteSection, SiteSectionType, SiteSectionVariant, SiteThemePersonality,
} from '../projects/types';
import { TEMPLATE_FAMILIES, createSection, createPage } from './siteTemplates';
import { resolveEditorialTheme } from './editorialThemes';
import { sampleFill, sampleHeroRef } from './sampleAssets';
import {
  heroBody, overviewBody, sectionIntro, captionFor, CTA_BODY,
  specSample, itemSpecSample, calloutsFor, comparisonSample,
  researchCalloutsSample, targetChartSample, siteRadarSample, contextBarSample,
  regulationRowsSample, conceptKeywordsSample, CONCEPT_BODY, processStepsSample,
  referencesSample, RESEARCH_MAP_QUERY,
  unitListSample, unitPickerSample, serviceCardsSample,
} from './siteCopy';
import { BLUEPRINTS, type SectionSpec } from './siteBlueprints';
import type { OnboardingAnswers } from './onboardingScript';
import type { ProjectAssetItem } from './projectAssetsApi';

// 人格ごとの構成レシピ。hero/overview の variant と、素材セクションの循環パターンを変える。
// → 同じ素材でも人格を変えると「構成自体」が変わる。
interface Recipe { hero: SiteSectionVariant; overview: SiteSectionVariant; cycle: SiteSectionVariant[]; deep: SiteSectionVariant; }
const RECIPE: Record<SiteThemePersonality, Recipe> = {
  journal: { hero: 'hero-editorial',    overview: 'lead',      cycle: ['feature', 'index-list', 'duo', 'split'],        deep: 'index-list' },
  atelier: { hero: 'hero-editorial',    overview: 'lead',      cycle: ['feature', 'split', 'band', 'duo'],              deep: 'masonry' },
  gallery: { hero: 'hero-fullbleed',    overview: 'statement', cycle: ['band', 'mosaic', 'overlap', 'filmstrip'],       deep: 'mosaic' },
  salon:   { hero: 'hero-split',        overview: 'quote',     cycle: ['feature', 'split', 'masonry', 'duo'],           deep: 'masonry' },
  mono:    { hero: 'hero-typographic',  overview: 'statement', cycle: ['index-list', 'duo', 'split', 'feature'],        deep: 'index-list' },
  studio:  { hero: 'hero-fullbleed',    overview: 'statement', cycle: ['feature', 'overlap', 'mosaic', 'band'],         deep: 'mosaic' },
};

function assetVariant(cycle: SiteSectionVariant[], idx: number, count: number): SiteSectionVariant {
  if (count <= 1) return 'feature';
  return cycle[idx % cycle.length];
}

const HOME_ASSET_COUNT = 4;      // 各素材セクションの枚数
const HOME_SAMPLE_FALLBACK = 3;  // サンプル充填する際の枚数

// サンプル素材にキャプション（文言）を添える
function withCaptions(refs: SiteAssetRef[], type: SiteSectionType): SiteAssetRef[] {
  return refs.map((r, i) => (r.sample && !r.title ? { ...r, title: captionFor(type, i) } : r));
}

export function assembleInitialSite(args: {
  projectId: string;
  projectName: string;
  answers: OnboardingAnswers;
  assets: ProjectAssetItem[];
}): ProjectSite {
  const { projectId, projectName, answers, assets } = args;
  const fam = TEMPLATE_FAMILIES.find(t => t.family === answers.family) ?? TEMPLATE_FAMILIES[0];
  const recipe = RECIPE[answers.personality] ?? RECIPE.journal;

  // 素材をセクション種別ごとに束ねる
  const byType = new Map<SiteSectionType, SiteAssetRef[]>();
  for (const a of assets) {
    const arr = byType.get(a.sectionType) ?? [];
    arr.push(a.ref);
    byType.set(a.sectionType, arr);
  }

  // ヒーローのカバー画像: 実画像のうち最初の1枚
  const coverPriority: SiteSectionType[] = ['layout', 'gallery', 'drawing', 'walkthrough', 'diagram', 'presentation', 'portfolio'];
  let coverRef: SiteAssetRef | undefined;
  for (const t of coverPriority) {
    const found = (byType.get(t) ?? []).find(r => r.thumbnailUrl && !r.placeholder);
    if (found) { coverRef = found; break; }
  }

  // ブループリント駆動で各セクションを生成（型ごとに内容を充填）
  let assetIdx = 0;
  const buildSection = (spec: SectionSpec): SiteSection => {
    const base = createSection(spec.type);
    const title = spec.title ?? base.title;
    switch (spec.type) {
      case 'hero':
        return { ...base, title: projectName, body: heroBody(projectName, answers), variant: recipe.hero, assetRefs: [coverRef ?? sampleHeroRef('hero')] };
      case 'overview':
        return { ...base, title: spec.title ?? '概要', body: spec.body ?? overviewBody(projectName, answers), variant: recipe.overview };
      case 'spec':
        return { ...base, title: spec.title ?? 'プロジェクト概要', specRows: specSample(projectName, answers) };
      case 'itemspec':
        return { ...base, title, body: sectionIntro('itemspec'), items: itemSpecSample() };
      case 'comparison':
        return { ...base, title, body: sectionIntro('comparison'), columns: comparisonSample() };
      case 'research':
        return { ...base, title, body: sectionIntro('research'), mapQuery: RESEARCH_MAP_QUERY, callouts: researchCalloutsSample() };
      case 'target': {
        const chartType = spec.chartType ?? 'donut';
        const chartData = spec.chartKey === 'site' ? siteRadarSample()
          : spec.chartKey === 'context' ? contextBarSample()
          : targetChartSample();
        return { ...base, title, body: sectionIntro('target'), chartType, chartData };
      }
      case 'regulation':
        return { ...base, title, body: sectionIntro('regulation'), specRows: regulationRowsSample() };
      case 'concept':
        return { ...base, title, body: CONCEPT_BODY, keywords: conceptKeywordsSample() };
      case 'process':
        return { ...base, title, body: sectionIntro('process'), steps: processStepsSample() };
      case 'references':
        return { ...base, title, body: sectionIntro('references'), references: referencesSample() };
      case 'unitlist':
        return { ...base, title, body: sectionIntro('unitlist'), units: unitListSample() };
      case 'unitpicker': {
        const pickerAssets = (byType.get('drawing') ?? []).slice(0, 1);
        const pickerRefs = pickerAssets.length > 0 ? pickerAssets : sampleFill('drawing', 1, base.id);
        return { ...base, title, body: sectionIntro('unitpicker'), assetRefs: pickerRefs, unitEntries: unitPickerSample() };
      }
      case 'services':
        return { ...base, title, body: sectionIntro('services'), serviceCards: serviceCardsSample() };
      case 'zoning':
      case 'flow':
        return { ...base, title, body: sectionIntro(spec.type), assetRefs: withCaptions(sampleFill(spec.type, 1, base.id), spec.type), callouts: calloutsFor(spec.type) };
      case 'custom':
        return { ...base, title, body: spec.body ?? (title === 'お問い合わせ' ? CTA_BODY : ''), variant: 'statement' };
      default: {
        // 素材系: layout/gallery/drawing/diagram/presentation/portfolio/walkthrough
        const real = (byType.get(spec.type) ?? []).slice(0, HOME_ASSET_COUNT);
        const refs = withCaptions(real.length > 0 ? real : sampleFill(spec.type, HOME_SAMPLE_FALLBACK, base.id), spec.type);
        const variant: SiteSectionVariant = spec.variant ?? assetVariant(recipe.cycle, assetIdx++, refs.length);
        return { ...base, title, body: sectionIntro(spec.type), assetRefs: refs, variant };
      }
    }
  };

  const pages = BLUEPRINTS[fam.family].map(pageSpec => {
    const page = createPage(pageSpec.title, pageSpec.sections.map(buildSection));
    page.slug = pageSpec.slug;
    return page;
  });

  const now = new Date().toISOString();
  return {
    projectId,
    templateFamily: fam.family,
    templateId: fam.templateId,
    theme: { accent: resolveEditorialTheme(answers.personality).accent, mode: 'dark', personality: answers.personality },
    pages,
    publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null },
    createdAt: now,
    updatedAt: now,
  };
}
