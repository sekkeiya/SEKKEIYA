// capability から既定ワークフローを生成する。
// 既定 = 「verb を順に実行」。特定の作業（分岐や既定パラメータを持つもの）は
// OVERRIDES で手書きの豊かな既定を与える（run_auto_layout の家具なし分岐など）。

import type { AutomationCapability } from '../../global-settings/automationCatalog';
import type { WorkflowDef, WorkflowStep, WorkflowParam } from './workflowTypes';

/** verb → 人が読むステップ名（無ければ verb 名をそのまま表示）。 */
export const VERB_LABEL: Record<string, string> = {
  layout_list: '間取りを一覧',
  layout_get: '間取りの詳細を取得',
  layout_create: '間取りを新規作成',
  get_layout_outputs: '成果物（レンダー）を取得',
  run_auto_layout: 'ルールベース自動配置',
  run_auto_zoning: '自動ゾーニング',
  run_auto_material: '自動マテリアル',
  run_auto_lighting: '自動ライティング',
  run_auto_angles: '自動アングル',
  render_layout: 'レンダリング（静止画）',
  render_video: 'レンダリング（動画）',
  get_render_status: 'レンダー状況を確認',
  create_site_from_template: 'テンプレからサイト生成',
  add_section: 'セクション追加',
  update_section: 'セクション更新',
  remove_section: 'セクション削除',
  reorder_sections: 'セクション並べ替え',
  add_asset_to_section: '成果物をセクションに添付',
  gallery_query: 'ギャラリー検索',
  set_theme: 'テーマ変更',
  set_motion: 'モーション変更',
  apply_bundle: 'バンドル適用',
  apply_layout_preset: 'レイアウトプリセット適用',
  apply_motion_preset: 'モーションプリセット適用',
  start_3d_generation: '3D 生成を開始',
  open_image_picker: '画像を選択',
  start_material_generation: 'マテリアル生成を開始',
  open_material_source_picker: '素材ソースを選択',
  furniture_catalog_search: '家具カタログを検索',
  open_furniture_picker: '家具を手動選択',
  add_furniture_to_project: '家具をプロジェクトに追加',
  catalog_product_search: '商品カタログを検索',
  dsd_create_diagram: 'ダイアグラム生成',
  dsd_patch_spec: 'ダイアグラム仕様を更新',
  dsd_render_manim: 'Manim で動画化',
  create_blog_draft: 'ブログ下書きを作成',
  blog_list: 'ブログ一覧',
  blog_get: 'ブログ本文を取得',
  blog_update: 'ブログ本文を更新',
  library_save_note: 'メモを保存',
  library_add_url: 'URL を登録',
  library_add_pdf: 'PDF を登録',
  web_list_links: 'ページのリンクを列挙',
  library_list: '知識一覧',
  search_knowledge: '外付け脳（RAG）を検索',
  schedule_create: '予定を追加',
  task_create: 'タスクを追加',
  project_create: 'プロジェクトを作成',
};

/** 例文「〜」から鉤括弧を外してトリガー文言にする。 */
function exampleToTrigger(example: string): string {
  return example.replace(/^「/, '').replace(/」$/, '').trim();
}

/** 手書きの豊かな既定（分岐・パラメータを持つ作業）。id は automationCatalog に一致。 */
const OVERRIDES: Record<string, Partial<WorkflowDef>> = {
  auto_layout: {
    triggers: ['自動配置して', '家具を置いて', '自動レイアウトして'],
    steps: [
      { id: 'pick_plan', label: '配置先プランを特定', verb: 'layout_list', enabled: true },
      { id: 'run', label: 'ルールベース自動配置', verb: 'run_auto_layout', enabled: true },
      {
        id: 'no_furniture_branch',
        label: '家具が未登録のときの分岐',
        enabled: true,
        branches: [
          { id: 'auto_models', label: 'S.Modelsから自動で選ぶ' },
          { id: 'manual_models', label: 'S.Modelsから手動で選ぶ' },
        ],
      },
    ],
    params: [
      { key: 'furnitureSource', label: '家具ソース', type: 'select', options: ['S.Models', 'プロジェクト', '公開カタログ'], value: 'S.Models' },
      { key: 'roomMode', label: '部屋サイズ', type: 'select', options: ['自動導出', '手動指定'], value: '自動導出' },
    ],
  },
  furniture_pick: {
    triggers: ['家具を探して', '家具を選定して'],
    params: [
      { key: 'source', label: '検索ソース', type: 'select', options: ['索引済みカタログ', 'S.Models', '公開カタログ'], value: '索引済みカタログ' },
      { key: 'autoAdd', label: '選定後に自動追加', type: 'toggle', value: 'off' },
    ],
  },
  gen_3d: {
    triggers: ['3D化して', '3Dモデルを生成して'],
    params: [
      { key: 'batchLimit', label: '一度に生成する上限', type: 'number', value: '5' },
      { key: 'confirmCount', label: '生成前に件数確認', type: 'toggle', value: 'on' },
    ],
  },
};

/** 保存が無いときに使う既定ワークフローを capability から生成する。 */
export function buildDefaultWorkflow(cap: AutomationCapability): WorkflowDef {
  const override = OVERRIDES[cap.id];

  const steps: WorkflowStep[] =
    override?.steps ??
    cap.verbs.map(v => ({ id: v, label: VERB_LABEL[v] ?? v, verb: v, enabled: true }));

  const params: WorkflowParam[] = override?.params ?? [];

  const triggers: string[] = override?.triggers ?? [exampleToTrigger(cap.example)];

  return { capabilityId: cap.id, triggers, steps, params };
}

/** 深いコピー（編集用のドラフトを作る）。 */
export function cloneWorkflow(wf: WorkflowDef): WorkflowDef {
  return {
    capabilityId: wf.capabilityId,
    triggers: [...wf.triggers],
    steps: wf.steps.map(s => ({ ...s, branches: s.branches ? s.branches.map(b => ({ ...b })) : undefined })),
    params: wf.params.map(p => ({ ...p, options: p.options ? [...p.options] : undefined })),
    layout: wf.layout ? Object.fromEntries(Object.entries(wf.layout).map(([k, v]) => [k, { ...v }])) : undefined,
  };
}
