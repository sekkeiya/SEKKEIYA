// CAD（Rhino）ファイルをテンプレートから新規作成して Rhino を起動する共通ヘルパー。
// WorkFilesList の handleLaunchTemplate と同じ流れ。作成された WorkFile は
// CAD Files（toolType: 'rhino'）として登録され、保存すると同期される。

import { WorkFileRepository } from './workFileRepository';
import { constructLocalDirPath, createNextLocalVersion } from './utils/workFileFsHelpers';
import { useWorkFileStore } from '../../store/useWorkFileStore';
import { useAppStore } from '../../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import type { RhinoTemplate } from './types';

/** テンプレートから新規 CAD（Rhino）ファイルを作成し、Rhino を起動する。戻り値は作成した workFile の id。 */
export async function createCadFromTemplateAndLaunch(
  project: { id: string; name: string },
  userUid: string,
  template: RhinoTemplate,
): Promise<string> {
  useAppStore.getState().setGlobalLaunchingTool('rhino');
  try {
    const createdWorkFile = await WorkFileRepository.createWorkFile({
      projectId: project.id,
      name: `From Template: ${template.name}`,
      toolType: 'rhino',
      updatedBy: userUid,
      createdBy: userUid,
      status: 'active',
    });
    const dirPath = await constructLocalDirPath(
      project.id, createdWorkFile.id, project.name, createdWorkFile.name, createdWorkFile.toolType, createdWorkFile.appScope,
    );
    const targetPath = await createNextLocalVersion(dirPath, template.name);

    let localTemplatePathStr = template.templatePath;
    if (!template.isMock && template.templatePath.startsWith('http')) {
      try {
        localTemplatePathStr = await invoke('resolve_template_local_path', { templateId: template.id, uid: template.ownerId || 'common' });
      } catch {
        localTemplatePathStr = await invoke('cache_template_locally', { url: template.templatePath, templateId: template.id, uid: template.ownerId || 'common' });
      }
    }
    await invoke('launch_rhino', { templatePath: localTemplatePathStr, targetFilePath: targetPath });

    useWorkFileStore.getState().saveBinding(createdWorkFile.id, {
      localPath: dirPath, existsLocally: true, lastOpenedAt: new Date().toISOString(),
    });
    await WorkFileRepository.logActivity({
      projectId: project.id, type: 'work_file_created', targetType: 'workFile', targetId: createdWorkFile.id,
      userId: userUid, meta: { toolType: 'rhino', fileName: createdWorkFile.name, templateRef: template.id },
    });
    return createdWorkFile.id;
  } finally {
    useAppStore.getState().setGlobalLaunchingTool(null);
  }
}
