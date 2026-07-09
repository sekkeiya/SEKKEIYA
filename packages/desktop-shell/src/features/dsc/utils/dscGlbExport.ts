// @ts-nocheck
import { join } from '@tauri-apps/api/path';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { getDefaultBaseDirPath, sanitizeFileName } from '../../projects/utils/workFileFsHelpers';

/** mm → Three.js unit (1m = 1000mm) */
const SCALE = 1 / 1000;

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${MM}${dd}`;
}

/**
 * 家具コンポーネント配列から最小限の Three.js シーンを構築し、
 * GLB フォーマット (ArrayBuffer) としてエクスポートする。
 */
export async function exportComponentsToGlb(components: any[]): Promise<ArrayBuffer> {
  const { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Color, Group } =
    await import('three');
  const { GLTFExporter } = await import(
    'three/examples/jsm/exporters/GLTFExporter.js'
  );

  const scene = new Scene();
  const group = new Group();
  group.name = 'furniture';

  for (const comp of components) {
    const { width, height, depth } = comp.dimensions;
    const [px, py, pz] = comp.position;

    const geo = new BoxGeometry(
      width  * SCALE,
      height * SCALE,
      depth  * SCALE,
    );
    const mat = new MeshStandardMaterial({
      color: new Color(comp.color || '#c8a882'),
      roughness: 0.7,
      metalness: 0.05,
    });
    const mesh = new Mesh(geo, mat);
    mesh.name = comp.name || comp.id;
    // Three.js の Y 軸 = 高さ方向。ボックスの中心を pos + height/2 に配置
    mesh.position.set(
      px * SCALE,
      (py + height / 2) * SCALE,
      pz * SCALE,
    );
    group.add(mesh);
  }

  scene.add(group);

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // binary:true のはずだが、念のため JSON フォールバック
          const bytes = new TextEncoder().encode(JSON.stringify(result));
          resolve(bytes.buffer as ArrayBuffer);
        }
      },
      (error) => reject(error),
      { binary: true },
    );
  });
}

/**
 * GLB バッファを AI Drive の WorkFiles/3DSC/ 配下に保存する。
 * 保存先: {AI Drive}/Projects/{ProjectName}/WorkFiles/3DSC/{FurnitureName}_{YYYYMMDD}.glb
 * @returns 保存したファイルの絶対パス
 */
export async function saveGlbLocally(
  projectId: string,
  projectName: string,
  furnitureName: string,
  glbBuffer: ArrayBuffer,
): Promise<string> {
  const baseDir = await getDefaultBaseDirPath(projectId, projectName);
  const dscDir  = await join(baseDir, '3DSC');

  if (!(await exists(dscDir))) {
    await mkdir(dscDir, { recursive: true });
  }

  const safeName  = sanitizeFileName(furnitureName || '造作家具');
  const dateStr   = formatDate(new Date());
  const fileName  = `${safeName}_${dateStr}.glb`;
  const filePath  = await join(dscDir, fileName);

  await writeFile(filePath, new Uint8Array(glbBuffer));
  return filePath;
}
