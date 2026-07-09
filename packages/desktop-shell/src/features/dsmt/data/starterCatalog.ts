/**
 * スターターカタログ：代表的な仕上げ材を「単色プレースホルダ素材」として一括生成する。
 *  - メーカー名・品番は含めない（汎用種別のみ）。テクスチャは後でユーザーが差し替える前提。
 *  - 各素材は applications（部位）＋ 種別タグ付きなので、自動マテリアル付与がすぐ機能する。
 */
import { FINISH_SUBTYPES } from "./finishTaxonomy";
import { dsmtUploadService } from "../api/dsmtUploadService";

/** 種別キー → 代表的な見た目（baseColor / roughness / metalness）。 */
const LOOK: Record<string, { color: string; rough: number; metal?: number }> = {
  flooring_solid:   { color: "#b07a3c", rough: 0.7 },
  flooring_eng:     { color: "light-dark(#7b5f32, #c2a06a)", rough: 0.65 },
  tile_carpet:      { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.95 },
  vinyl_sheet:      { color: "var(--brand-fg)", rough: 0.5 },
  floor_tile_pvc:   { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.55 },
  porcelain_tile:   { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.4 },
  mosaic_tile:      { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.35 },
  vinyl_cloth:      { color: "var(--brand-fg)", rough: 0.92 },
  woven_cloth:      { color: "var(--brand-fg)", rough: 0.95 },
  plaster:          { color: "var(--brand-fg)", rough: 0.98 },
  deco_tile:        { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.7 },
  wood_panel:       { color: "#a07a4f", rough: 0.7 },
  ceiling_board:    { color: "var(--brand-fg)", rough: 1.0 },
  siding_ceramic:   { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.85 },
  siding_metal:     { color: "#6e7378", rough: 0.5, metal: 0.25 },
  exterior_plaster: { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.95 },
  exterior_tile:    { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.5 },
};

export interface SeedResult { ok: boolean; created: number; reason?: string; }

/**
 * FINISH_SUBTYPES からスターター素材を一括生成して Firestore に保存する。
 * 既存と重複しても害は無いが、二重生成を避けたい場合は呼び出し側で確認すること。
 */
export async function seedStarterMaterials(projectId?: string): Promise<SeedResult> {
  if (!projectId) return { ok: false, created: 0, reason: "プロジェクトが選択されていません" };
  let created = 0;
  for (const s of FINISH_SUBTYPES) {
    const look = LOOK[s.key] || { color: "rgb(var(--brand-fg-rgb) / 0.65)", rough: 0.7 };
    try {
      await dsmtUploadService.createMaterial(projectId, {
        title: s.label,
        category: s.category,
        params: { baseColor: look.color, roughness: look.rough, metalness: look.metal ?? 0 },
        tags: [s.label],
        applications: s.applications,
        visibility: "private",
      }, undefined, undefined, `dsmt_starter_${s.key}`); // 固定ID＝再実行しても重複せず上書き
      created++;
    } catch {
      // 1件失敗しても続行
    }
  }
  return { ok: created > 0, created, reason: created ? undefined : "生成に失敗しました" };
}
