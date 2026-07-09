import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface ImportedModel {
  id: string; // generated ID or file path
  title: string;
  glbUrl: string; // asset:// URL
  sourcePath: string; // original local path
}

/**
 * Open Tauri native file dialog to select local .glb / .gltf files.
 * Returns an array of imported model data.
 */
export async function openLocalModelFiles(): Promise<ImportedModel[]> {
  try {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "3D Models",
          extensions: ["glb", "gltf"],
        },
      ],
      title: "Select Local 3D Models",
    });

    if (!selected) {
      return [];
    }

    const filePaths = Array.isArray(selected) ? selected : [selected];
    const results: ImportedModel[] = [];

    for (const path of filePaths) {
      // Create a local asset URL that the webview can load
      const assetUrl = convertFileSrc(path);
      
      // Extract filename from path (cross-platform naïve approach)
      const filename = path.split(/[/\\]/).pop() || "Local Model";
      const title = filename.replace(/\.(glb|gltf)$/i, "");

      results.push({
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        glbUrl: assetUrl,
        sourcePath: path,
      });
    }

    return results;
  } catch (error) {
    console.error("[layoutFileImportService] Failed to open local files:", error);
    throw error;
  }
}
