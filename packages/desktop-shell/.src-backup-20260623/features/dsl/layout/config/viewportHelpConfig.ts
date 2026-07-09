export interface ShortcutItem {
  keys: string[];
  action: string;
  description?: string;
}

export interface HelpCategory {
  title: string;
  icon?: string;
  items: ShortcutItem[];
}

export const VIEWPORT_HELP_CONFIG: HelpCategory[] = [
  {
    title: "Camera Navigation",
    icon: "camera",
    items: [
      { keys: ["RMB Drag"], action: "Look Around", description: "視点回転・見回し" },
      { keys: ["RMB", "W A S D Q E"], action: "Move", description: "ウォークスルー移動 (W/S:前後, A/D:左右, Q/E:上下)" },
      { keys: ["RMB", "Scroll Wheel"], action: "Speed", description: "移動速度調整" },
      { keys: ["Shift", "RMB Drag"], action: "Pan", description: "平行移動（視点のピボットをずらす）" },
      { keys: ["MMB Drag"], action: "Orbit", description: "オービット（注視点周りを回転）" },
      { keys: ["F"], action: "Focus", description: "選択対象へカメラをフォーカス" },
    ],
  },
  {
    title: "Selection",
    icon: "pointer",
    items: [
      { keys: ["LMB"], action: "Select", description: "単一選択（背景クリックで解除）" },
      { keys: ["Shift", "LMB"], action: "Multi Select", description: "複数選択・追加/除外" },
      { keys: ["Background", "LMB Drag"], action: "Box Select", description: "範囲選択（矩形で囲んで一括選択）" },
    ],
  },
  {
    title: "Transform / Gizmo",
    icon: "move",
    items: [
      { keys: ["Gizmo Drag"], action: "Transform", description: "移動 / 回転 / スケールの変更" },
      { keys: ["Status"], action: "Camera Locked", description: "※Gizmo操作中はカメラ操作が無効になります" },
    ],
  },
];
