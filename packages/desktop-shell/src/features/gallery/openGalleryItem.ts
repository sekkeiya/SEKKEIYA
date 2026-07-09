import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAppStore } from '../../store/useAppStore';
import { useDscStore } from '../dsc/store/useDscStore';
import { useDsdStore } from '../dsd/store/useDsdStore';
import { useDsiStore } from '../dsi/store/useDsiStore';
import { useDsfStore } from '../dsf/store/useDsfStore';
import type { GalleryItem } from './galleryTypes';

/**
 * Gallery カード → 個別アイテムを該当アプリで開くディープリンク。
 *
 * ref から元ドキュメントの全フィールドを取得し、各子アプリ「自身の」オープン手順を再現する。
 * （各ハンドラはフルの item ドキュメントを受け取る設計。グローバル公開アイテムは projectId 経由で
 *  そのプロジェクトに切り替えて開く、という挙動は各アプリのダッシュボードと同一）
 */
export async function openGalleryItem(item: GalleryItem): Promise<void> {
  const app = useAppStore.getState();
  const ref = item.ref;

  try {
    // ── S.Models: 詳細を右パネルに表示（assets はグローバル） ──
    if (ref.kind === 'model') {
      const snap = await getDoc(doc(db, 'assets', ref.assetId));
      if (!snap.exists()) return;
      const model = { id: snap.id, ...snap.data() };
      app.setActiveProjectId(null);
      app.setModelsScope('global_models');
      app.setActiveWorkspaceId('models');
      app.setCurrentMainView('workspace');
      app.setPanelSelection('models', model);
      return;
    }

    // ── S.Layout: グローバルレイアウト一覧で当該アイテムを選択（右パネル表示） ──
    if (ref.kind === 'layout') {
      const path = `projects/${ref.projectId}/workspaces/${ref.workspaceId}/layouts/${ref.layoutId}`;
      const snap = await getDoc(doc(db, path));
      if (!snap.exists()) return;
      const layout = { id: snap.id, projectId: ref.projectId, workspaceId: ref.workspaceId, ...snap.data() };
      app.setActiveProjectId(null);
      app.setDslScope('global_layouts');
      app.setActiveWorkspaceId('layout');
      app.setCurrentMainView('workspace');
      app.setPanelSelection('layout', layout);
      return;
    }

    // ── workFiles 系: presentation / furniture / diagram ──
    const wfSnap = await getDoc(doc(db, `projects/${ref.projectId}/workFiles/${ref.workFileId}`));
    if (!wfSnap.exists()) return;
    const wf: any = { id: wfSnap.id, projectId: ref.projectId, ...wfSnap.data() };

    if (item.kind === 'presentation') {
      // DspDashboard.handleOpenEditor 相当
      if (wf.projectId) app.setActiveProjectId(wf.projectId);
      app.setActiveWorkspaceId('presents');
      app.setPanelSelection('presents', wf);
      app.setDspShellMode('editor');
      app.setCurrentMainView('workspace');
      return;
    }

    if (item.kind === 'furniture') {
      // DscDashboard.handleOpenItem 相当
      if (wf.projectId) app.setActiveProjectId(wf.projectId);
      app.setActiveWorkspaceId('create');
      useDscStore.getState().loadWorkFile(wf);
      app.setDscShellMode('studio');
      app.setCurrentMainView('workspace');
      return;
    }

    if (item.kind === 'image') {
      // DsiDashboard.handleSelectItem 相当。該当プロジェクトの S.Image を開いて右パネルに表示。
      if (wf.projectId) app.setActiveProjectId(wf.projectId);
      app.setDsiScope('project_images');
      app.setActiveWorkspaceId('image');
      app.setPanelSelection('image', wf);
      useDsiStore.getState().setOpenSetId(wf.parentSetId ?? null);
      useDsiStore.getState().setSelectedImageId(wf.id);
      app.setCurrentMainView('workspace');
      return;
    }

    if (item.kind === 'portfolio') {
      // DsfDashboard 相当。該当プロジェクトの S.Portfolio を開き、本ビューアを起動する。
      if (wf.projectId) app.setActiveProjectId(wf.projectId);
      app.setDsfScope('project_portfolios');
      app.setActiveWorkspaceId('portfolio');
      app.setPanelSelection('portfolio', wf);
      useDsfStore.getState().setSelectedPortfolioId(wf.id);
      useDsfStore.getState().setViewerPortfolioId(wf.id);
      app.setCurrentMainView('workspace');
      return;
    }

    if (item.kind === 'diagram') {
      // DsdAdapter.handleOpenDiagram 相当。
      // NOTE: このフィールドマッピングは Adapters.tsx の handleOpenDiagram と同期させること。
      const store = useDsdStore.getState();
      store.loadState({
        currentTemplate: wf.currentTemplate,
        diagramTitle: wf.diagramTitle,
        style: wf.style,
        presetShape: wf.presetShape,
        customPolygon: wf.customPolygon ?? [],
        buildingWidth: wf.buildingWidth,
        buildingDepth: wf.buildingDepth,
        buildingHeight: wf.buildingHeight,
        northAngle: wf.northAngle,
        month: wf.month,
        timeHour: wf.timeHour,
        latitude: wf.latitude,
        layoutMode: wf.layoutMode,
        zones: wf.zones ?? [],
        flows: wf.flows ?? [],
        siteBoundaryW: wf.siteBoundaryW,
        siteBoundaryH: wf.siteBoundaryH,
        siteNorthAngle: wf.siteNorthAngle,
        siteElements: wf.siteElements ?? [],
        siteAccesses: wf.siteAccesses ?? [],
        windDirection: wf.windDirection,
        windSpeed: wf.windSpeed,
        envLayer: wf.envLayer,
        noiseSources: wf.noiseSources ?? [],
        thermalSeason: wf.thermalSeason,
        windViewCx: wf.windViewCx,
        windViewCy: wf.windViewCy,
        windViewW: wf.windViewW,
        windViewH: wf.windViewH,
        annotations: wf.annotations ?? [],
      });
      if (wf.currentTemplate) store.setCurrentTemplate(wf.currentTemplate);
      app.setActiveWorkspaceId('diagram');
      app.setActiveDiagramId(wf.id);
      app.setDsdShellMode('editor');
      app.setCurrentMainView('workspace');
      return;
    }
  } catch (e) {
    console.error('[gallery] openGalleryItem failed', e);
  }
}
