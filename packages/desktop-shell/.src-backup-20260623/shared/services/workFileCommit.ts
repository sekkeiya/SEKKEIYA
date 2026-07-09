import type { WorkingFileInfo } from '../../store/useAppStore';

export type Visibility = 'public' | 'private';

/**
 * 未保存ファイルをクラウドへ保存する横断 committer。
 * 未保存一覧（タブのドット）と終了時ダイアログの両方から使う。
 * 各アプリの「現在アクティブな（ストアに読み込まれている）」編集状態から保存する。
 * 新規ファイルは visibility（既定: private）で公開設定を決める。
 */
export async function commitWorkingFile(
  info: WorkingFileInfo,
  opts?: { visibility?: Visibility },
): Promise<void> {
  const visibility: Visibility = opts?.visibility ?? 'private';
  const { getAuth } = await import('firebase/auth');
  const uid = getAuth().currentUser?.uid ?? 'anonymous';

  switch (info.scope) {
    case '3dsl': {
      // S.Layout は登録済みの保存コマンド（toolsStore.save）に委譲
      const { useToolsStore } = await import('../../features/dsl/layout/store/toolsStore/useToolsStore');
      await useToolsStore.getState().save();
      return;
    }

    case '3dsc': {
      const { useDscStore, DSC_NEW_SESSION_KEY } = await import('../../features/dsc/store/useDscStore');
      const { WorkFileRepository } = await import('../../features/projects/workFileRepository');
      const s = useDscStore.getState();
      const componentsJson = JSON.stringify(s.components);
      let fileId = s.currentWorkFileId;
      if (fileId) {
        await WorkFileRepository.updateWorkFile(info.projectId, fileId, {
          name: s.furnitureName || '新規造作家具',
          componentsJson,
        } as any);
      } else {
        const created = await WorkFileRepository.createWorkFile({
          projectId: info.projectId,
          name: s.furnitureName || '新規造作家具',
          appScope: '3dsc',
          createdBy: uid,
          updatedBy: uid,
          status: 'active',
          thumbnailUrl: null,
          storagePath: null,
          componentsJson,
          visibility,
        } as any);
        fileId = created.id;
        useDscStore.getState().setCurrentWorkFileId(fileId);
      }
      useDscStore.getState().setDirty(false);
      useDscStore.getState().clearSession(DSC_NEW_SESSION_KEY);
      if (fileId) useDscStore.getState().clearSession(fileId);
      return;
    }

    case '3dsd': {
      const { useDsdStore } = await import('../../features/dsd/store/useDsdStore');
      const { saveDsdDiagramState } = await import('../../features/dsd/library/dsdDiagramService');
      const { useAppStore } = await import('../../store/useAppStore');
      const s: any = useDsdStore.getState();
      const state: any = {
        currentTemplate: s.currentTemplate, diagramTitle: s.diagramTitle, style: s.style,
        presetShape: s.presetShape, customPolygon: s.customPolygon,
        buildingWidth: s.buildingWidth, buildingDepth: s.buildingDepth, buildingHeight: s.buildingHeight,
        northAngle: s.northAngle, month: s.month, timeHour: s.timeHour, latitude: s.latitude,
        layoutMode: s.layoutMode, zones: s.zones, flows: s.flows,
        siteBoundaryW: s.siteBoundaryW, siteBoundaryH: s.siteBoundaryH, siteNorthAngle: s.siteNorthAngle,
        siteElements: s.siteElements, siteAccesses: s.siteAccesses,
        windDirection: s.windDirection, windSpeed: s.windSpeed, envLayer: s.envLayer,
        noiseSources: s.noiseSources, thermalSeason: s.thermalSeason,
        windViewCx: s.windViewCx, windViewCy: s.windViewCy, windViewW: s.windViewW, windViewH: s.windViewH,
        annotations: s.annotations,
      };
      const existingId = useAppStore.getState().activeDiagramId;
      if (!existingId) state.visibility = visibility; // 新規のみ公開設定
      const newId = await saveDsdDiagramState(info.projectId, state, existingId);
      useAppStore.getState().setActiveDiagramId(newId);
      useDsdStore.getState().bumpSavedTick(); // 基準更新 → 未保存解除
      return;
    }

    case '3dsp': {
      const { useDspStore } = await import('../../features/dsp/store/useDspStore');
      const { dspRepository } = await import('../../features/dsp/api/dspRepository');
      const s: any = useDspStore.getState();
      if (s.workFileId && s.presentation) {
        await dspRepository.savePresentationContent(info.projectId, s.workFileId, s.presentation, uid);
        if (typeof s.setSaveStatus === 'function') s.setSaveStatus('saved');
      }
      return;
    }

    default:
      console.warn('[workFileCommit] unknown scope', info.scope);
  }
}
