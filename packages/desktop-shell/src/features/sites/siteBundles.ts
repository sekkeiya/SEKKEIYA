import type { SiteThemePersonality, SiteLayoutMode } from '../projects/types';

export interface SiteBundle {
  id: string;
  name: string;
  description: string;
  personality: SiteThemePersonality;
  layoutMode: SiteLayoutMode;
  motionPresetId: string;
}

export const SITE_BUNDLES: SiteBundle[] = [
  { id: 'b-architect', name: '建築スタジオ', description: 'モノクロ・フルブリード・シネマ', personality: 'mono', layoutMode: 'magazine', motionPresetId: 'mo-parallax' },
  { id: 'b-gallery',   name: 'ギャラリー',   description: '没入3D・大胆な余白',       personality: 'gallery', layoutMode: 'immersive', motionPresetId: 'mo-particles' },
  { id: 'b-journal',   name: 'ジャーナル',   description: '誌面・サイドバー・スムーズ', personality: 'journal', layoutMode: 'editorial', motionPresetId: 'mo-smooth' },
  { id: 'b-minimal',   name: 'ミニマル',     description: '中央寄せ・静かなフェード',   personality: 'atelier', layoutMode: 'minimal', motionPresetId: 'mo-fade' },
  { id: 'b-studio',    name: 'スタジオ',     description: '全幅・大胆な立ち上がり',     personality: 'studio', layoutMode: 'studio', motionPresetId: 'mo-rise' },
  { id: 'b-portfolio', name: 'ポートフォリオ', description: 'フルスクリーン没入・スナップ', personality: 'gallery', layoutMode: 'portfolio', motionPresetId: 'mo-snap' },
];

export function findBundle(id: string): SiteBundle | undefined {
  return SITE_BUNDLES.find(b => b.id === id);
}
