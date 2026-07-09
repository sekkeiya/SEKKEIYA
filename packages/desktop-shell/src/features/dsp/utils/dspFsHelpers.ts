import { join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, exists, stat } from '@tauri-apps/plugin-fs';
import { getDefaultBaseDirPath } from '../../projects/utils/workFileFsHelpers';
import { sanitizeFileName } from '../../projects/utils/workFileFsHelpers';
import type { PresentationContent } from '../types/dsp.types';

/** `{AI Drive}/Projects/{projectName}/WorkFiles/3DSP/` 配下のファイルパスを返す */
async function getDspFilePath(
  projectId: string,
  projectName: string,
  workFileId: string,
  workFileName: string,
): Promise<string> {
  const baseDir = await getDefaultBaseDirPath(projectId, projectName);
  const dirPath = await join(baseDir, '3DSP');
  if (!(await exists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
  }
  const safeName = sanitizeFileName(workFileName || 'untitled');
  // ファイル名: "{プレゼン名}_{workFileId先頭8文字}.json"
  return await join(dirPath, `${safeName}_${workFileId.slice(0, 8)}.json`);
}

export const dspFsHelpers = {
  async saveLocalDraft(
    projectId: string,
    projectName: string,
    workFileId: string,
    workFileName: string,
    content: PresentationContent,
  ): Promise<void> {
    const filePath = await getDspFilePath(projectId, projectName, workFileId, workFileName);
    await writeTextFile(filePath, JSON.stringify(content, null, 2));
  },

  async loadLocalDraft(
    projectId: string,
    projectName: string,
    workFileId: string,
    workFileName: string,
  ): Promise<{ content: PresentationContent; mtime: number } | null> {
    const tryLoad = async (filePath: string) => {
      if (!(await exists(filePath))) return null;
      const metadata = await stat(filePath);
      const jsonStr = await readTextFile(filePath);
      const mtime = metadata.mtime
        ? (typeof metadata.mtime === 'number' ? metadata.mtime : (metadata.mtime as Date).getTime() || Date.now())
        : Date.now();
      return { content: JSON.parse(jsonStr) as PresentationContent, mtime };
    };

    try {
      // 新パス: 3DSP サブフォルダ
      const newPath = await getDspFilePath(projectId, projectName, workFileId, workFileName);
      const result = await tryLoad(newPath);
      if (result) return result;

      // 旧パス へのフォールバック（UnnamedProject または projectName で保存された旧 draft.json）
      for (const pName of [projectName, 'UnnamedProject']) {
        const oldBase = await getDefaultBaseDirPath(projectId, pName);
        const oldPath = await join(oldBase, workFileId, 'draft.json');
        const old = await tryLoad(oldPath);
        if (old) return old;
      }
    } catch (e) {
      console.error('[DSP] Failed to load local draft', e);
    }
    return null;
  },
};
