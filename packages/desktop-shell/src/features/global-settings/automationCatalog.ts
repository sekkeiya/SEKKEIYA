// 自動化作業リスト（docs/19 / docs/20）。
// SEKKEIYA Chat に話しかけるだけで実行できる作業（verb）をユーザー向けに一覧化する。
// ここは「人が読む能力カタログ」。実行体は verbRegistry / dispatchAgentTool 側にある。
// 新しい自動化を足したらこの配列に1項目追加する（リストはここから増えていく）。
//
// 各 capability の `id` は「ワークフロー設定」の永続キー（useWorkflowConfigStore）。
// 一度公開した id はリネームしない（保存済み設定が孤立するため）。

export type CapabilityStatus = 'available' | 'beta' | 'planned';

export interface AutomationCapability {
  /** ワークフロー設定の永続キー（安定した snake_case。リネーム厳禁）。 */
  id: string;
  /** 関連 verb 名（複数）。レジストリ移行状況の照合＋既定ステップ生成に使う。 */
  verbs: string[];
  /** ユーザー向けタイトル。 */
  title: string;
  /** 何ができるかの説明。 */
  description: string;
  /** チャットでの依頼例。 */
  example: string;
  status: CapabilityStatus;
  /** S.Layout 等の 3D シーンを開いて実行する作業（docs/20 §2）。 */
  sceneBound?: boolean;
}

export interface AutomationCategory {
  id: string;
  title: string;
  /** 子アプリ/ドメインの一言説明。 */
  caption?: string;
  capabilities: AutomationCapability[];
}

export const AUTOMATION_CATALOG: AutomationCategory[] = [
  {
    id: 'site',
    title: 'Web 成果物（提案サイト）',
    caption: '最終成果物 = 公開できる 1 枚の Web。すべての作業はここに集約される。',
    capabilities: [
      {
        id: 'proposal_site',
        verbs: ['create_site_from_template', 'add_section', 'update_section', 'remove_section', 'reorder_sections'],
        title: '提案書・企画書サイトを自動構成',
        description: '用途・敷地・与条件から、表紙〜コンセプト〜プラン〜比較検討までのページ構成を自律的に組み立て、本文を下書きする。',
        example: '「世田谷の二世帯住宅の提案書を作って」',
        status: 'available',
      },
      {
        id: 'attach_asset',
        verbs: ['add_asset_to_section', 'gallery_query'],
        title: '成果物をセクションに添付',
        description: 'プロジェクト内のレンダー・画像・図面・図解を探し、サイトの該当セクションに紐付ける。',
        example: '「この間取りのレンダーをギャラリーに入れて」',
        status: 'available',
      },
      {
        id: 'style_layout_motion',
        verbs: ['set_theme', 'set_motion', 'apply_bundle', 'apply_layout_preset', 'apply_motion_preset'],
        title: 'スタイル・レイアウト・動きの変更',
        description: '人格（Journal/Atelier/Gallery 等）・誌面レイアウト・スクロール演出をまとめて切り替える。',
        example: '「もっと雑誌っぽく、動きをシネマティックにして」',
        status: 'available',
      },
    ],
  },
  {
    id: 'layout',
    title: 'S.Layout（間取り・3D）',
    caption: '最も価値の高い成果物エンジン。チャット駆動を順次拡大中（docs/20 Batch 1）。',
    capabilities: [
      {
        id: 'layout_browse',
        verbs: ['layout_list', 'layout_get', 'layout_create'],
        title: '間取りの一覧・詳細・新規作成',
        description: 'プロジェクトの間取りを一覧し、家具点数やゾーン有無を確認、または新しい間取りを作成する。',
        example: '「この案件の間取りを一覧して」',
        status: 'available',
      },
      {
        id: 'layout_outputs',
        verbs: ['get_layout_outputs'],
        title: '間取りの成果物（レンダー）を取得',
        description: '間取りのレンダー画像・代表サムネを取得し、そのままサイトに添付できる。',
        example: '「完成レンダーを提案書に載せて」',
        status: 'available',
      },
      {
        id: 'auto_layout',
        verbs: ['run_auto_layout'],
        title: 'ルールベース自動レイアウト',
        description: '部屋の寸法・用途から家具を自動配置し、結果を保存して S.Layout を開く。',
        example: '「6畳の寝室にベッドまわりを自動配置して」',
        status: 'available',
      },
      {
        id: 'auto_finish',
        verbs: ['run_auto_zoning', 'run_auto_material', 'run_auto_lighting', 'run_auto_angles'],
        title: '自動ゾーニング / マテリアル / ライティング / アングル',
        description: '読み込んだ 3D シーンに対して、部屋分け・素材付与・照明・撮影アングルを自動生成する。',
        example: '「この間取りを昼光のライティングで自動仕上げして」',
        status: 'planned',
        sceneBound: true,
      },
      {
        id: 'render_still',
        verbs: ['render_layout'],
        title: 'レンダリング（静止画・ヘッドレス）',
        description: '指定した間取りを裏側で（S.Layout を開かずに）レンダリングし、成果物として保存。結果はチャットに画像で表示され、そのままサイトに添付できる。複数チャットの並行作業でも使える。',
        example: '「Layout 3 を3枚レンダリングして」',
        status: 'available',
      },
      {
        id: 'render_video',
        verbs: ['render_video', 'get_render_status'],
        title: 'レンダリング（動画・フォトリアル）',
        description: '動画レンダリングや Blender Cycles のフォトリアル出力をバックグラウンドで実行する。',
        example: '「リビングをウォークスルー動画にして」',
        status: 'planned',
        sceneBound: true,
      },
    ],
  },
  {
    id: 'layout_flows',
    title: 'S.Layout 王道フロー（一気通貫）',
    caption: '自動○○を組み合わせた定番コース。質問は分岐の1〜2回だけ、あとは会話だけで完了する。',
    capabilities: [
      {
        id: 'flow_full_auto',
        verbs: ['layout_list', 'run_auto_zoning', 'run_auto_layout', 'run_auto_material', 'run_auto_lighting', 'run_auto_angles', 'render_layout'],
        title: '丸ごと自動仕上げ（フルコース）',
        description: '躯体から一気に完成へ。面ラベル→ゾーニング→家具配置→マテリアル→ライティング→アングル→レンダーまでを連続実行し、仕上がり画像をチャットに報告する。',
        example: '「このプランを丸ごと自動で仕上げて」',
        status: 'planned',
        sceneBound: true,
      },
      {
        id: 'flow_interior_refresh',
        verbs: ['layout_get', 'run_auto_material', 'run_auto_lighting', 'render_layout'],
        title: '内装の着せ替え（マテリアル＋ライト）',
        description: '家具配置はそのまま、内装スタイルと照明ムードだけを一括で切り替えて、確認用レンダーを1枚返す。',
        example: '「内装を北欧風・夕景に着せ替えて」',
        status: 'planned',
        sceneBound: true,
      },
      {
        id: 'flow_presentation_pack',
        verbs: ['layout_list', 'render_layout', 'get_layout_outputs', 'add_asset_to_section'],
        title: 'プレゼン一式（撮影→レンダー→提案書）',
        description: '撮影スタイル（不動産/雑誌/カタログ）を選ぶだけで、スタイルに合わせた自動アングル→静止画レンダー→提案書ギャラリーへの添付までを一気通貫・完全ヘッドレスで行う。',
        example: '「このプランを提案書用に撮影して載せて」',
        status: 'available',
      },
      {
        id: 'flow_option_compare',
        verbs: ['layout_get', 'run_auto_material', 'run_auto_lighting', 'render_layout'],
        title: 'バリエーション比較（Option 3案）',
        description: '比較軸（ライティング / マテリアル / 家具）を選ぶと Option を複製して各案を自動仕上げ・レンダーし、比較グリッドで提示。選んだ案を本命に昇格する。',
        example: '「ライティング違いで3案比較して」',
        status: 'planned',
        sceneBound: true,
      },
      {
        id: 'flow_video_tour',
        verbs: ['layout_get', 'run_auto_angles', 'render_video', 'get_render_status', 'add_asset_to_section'],
        title: '動画ウォークスルー',
        description: 'カメラパスを自動生成して動画レンダリングをバックグラウンド実行。完成したらチャットに報告し、サイトへ添付できる。',
        example: '「リビングのウォークスルー動画を作って」',
        status: 'planned',
        sceneBound: true,
      },
    ],
  },
  {
    id: 'create',
    title: '生成（3D・マテリアル・家具）',
    capabilities: [
      {
        id: 'gen_3d',
        verbs: ['start_3d_generation', 'open_image_picker'],
        title: '画像から 3D モデルを一括生成',
        description: '選んだ画像をバックグラウンドで 3D 化する（非ブロッキング）。',
        example: '「この家具の写真を 3D 化して」',
        status: 'available',
      },
      {
        id: 'gen_material',
        verbs: ['start_material_generation', 'open_material_source_picker'],
        title: 'テクスチャからマテリアルを生成',
        description: 'S.Image / ローカル素材からマテリアルを一括生成して保存する。',
        example: '「このテクスチャからマテリアルを作って」',
        status: 'available',
      },
      {
        id: 'furniture_pick',
        verbs: ['furniture_catalog_search', 'open_furniture_picker', 'add_furniture_to_project', 'catalog_product_search'],
        title: '家具の検索・選定・追加',
        description: '索引済みカタログから家具を検索し、選んでプロジェクトに追加する。',
        example: '「北欧風のダイニングチェアを探して」',
        status: 'available',
      },
    ],
  },
  {
    id: 'media',
    title: '図解・動画・記事',
    capabilities: [
      {
        id: 'diagram_manim',
        verbs: ['dsd_create_diagram', 'dsd_patch_spec', 'dsd_render_manim'],
        title: 'ダイアグラム生成・Manim 動画',
        description: '指示から図解を生成し、必要なら Manim でアニメーション動画化する。',
        example: '「動線のダイアグラムを作って」',
        status: 'available',
      },
      {
        id: 'movie_edit',
        verbs: ['movie_sequence_snapshot', 'movie_add_cut', 'movie_reorder_cuts', 'movie_set_transition', 'movie_set_bgm', 'movie_add_title', 'movie_export'],
        title: '動画のカット編集・書き出し',
        description: 'カットの追加・並べ替え・トランジション・BGM・テロップを編集し、動画を書き出す。',
        example: '「このカットを並べてBGMを付けて書き出して」',
        status: 'beta',
      },
      {
        id: 'blog_draft',
        verbs: ['create_blog_draft', 'blog_list', 'blog_get', 'blog_update'],
        title: 'ブログ記事の下書き・編集',
        description: '記事の下書き作成、一覧取得、本文の取得・更新を行う。',
        example: '「先週の現場の話でブログ下書きを作って」',
        status: 'available',
      },
    ],
  },
  {
    id: 'knowledge',
    title: '知識・リサーチ（S.Library / 外付け脳）',
    capabilities: [
      {
        id: 'knowledge_save',
        verbs: ['library_save_note', 'library_add_url', 'library_add_pdf', 'web_list_links', 'library_list'],
        title: '知識・カタログの保存と登録',
        description: '調べた内容をメモ保存、メーカー電子カタログの URL/PDF を登録、ページの実在リンクを列挙する。',
        example: '「サンゲツの電子カタログを S.Library に登録して」',
        status: 'available',
      },
      {
        id: 'rag_search',
        verbs: ['search_knowledge'],
        title: '外付け脳（RAG）を検索',
        description: '接続したナレッジから関連情報を検索し、根拠付きで回答する。',
        example: '「過去の保育園案件の納まりを調べて」',
        status: 'available',
      },
    ],
  },
  {
    id: 'manage',
    title: 'スケジュール・タスク・カレンダー',
    caption: 'マネージャーとして複数プロジェクトを並行管理するための作業。',
    capabilities: [
      {
        id: 'schedule_task',
        verbs: ['schedule_list', 'schedule_create', 'schedule_update', 'schedule_delete', 'task_list', 'task_create', 'task_update', 'task_delete'],
        title: '予定・タスクの確認 / 追加 / 変更 / 削除',
        description: 'プロジェクトの予定とタスクを把握し、登録・更新・削除する。AI への割り当ても可能。',
        example: '「来週の打合せを登録して、図面チェックを私にアサインして」',
        status: 'available',
      },
      {
        id: 'gcal_sync',
        verbs: ['gcal_list_events', 'gcal_create_event', 'gcal_update_event', 'gcal_delete_event', 'gcal_list_calendars'],
        title: 'Google カレンダー連携',
        description: 'Google カレンダーのイベントを確認・追加・更新・削除する。',
        example: '「明日の現場確認を Google カレンダーにも入れて」',
        status: 'available',
      },
      {
        id: 'project_manage',
        verbs: ['project_list', 'project_create', 'project_switch', 'project_promote_to_team', 'project_invite_member'],
        title: 'プロジェクトの作成・並行管理',
        description: 'プロジェクトの作成・切替・チーム化・メンバー招待をチャットから行う。',
        example: '「新しい店舗案件を作って、田中さんを編集者で招待して」',
        status: 'planned',
      },
    ],
  },
];

/** id から capability を引く（ワークフロー設定画面のディープリンク用）。 */
export function findCapabilityById(id: string): AutomationCapability | undefined {
  for (const cat of AUTOMATION_CATALOG) {
    const hit = cat.capabilities.find(c => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}
