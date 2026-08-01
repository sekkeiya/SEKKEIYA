// 詳細画面（DssModelDetailView とそのセクション群）で共有する型の置き場。
// 旧 `DssDetailActionBar.tsx`（Task 3 で OverviewSection の操作行に置き換えられ撤去）が
// 定義していた `DetailActions` を、コンポーネント削除に伴いここへ移設した（Task 8）。

/** 表示中の 1 モデルに対するアクション（ダウンロード/関連URL/カタログ/AI入力/Rhino/Blender/保存/共有/削除）。 */
export type DetailActions = {
  canRegister: boolean;
  canRhino: boolean;
  canBlender: boolean;
  canDelete: boolean;
  dccBusy: 'rhino' | 'blender' | null;
  onRegisterLinks: () => void;
  onCatalog: () => void;
  onAutoFill: () => void;
  onRhino: () => void;
  onBlender: () => void;
  onSave: () => void;
  onShare: () => void;
  onDelete: () => void;
};
