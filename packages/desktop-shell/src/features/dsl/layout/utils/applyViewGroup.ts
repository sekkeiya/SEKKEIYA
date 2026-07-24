// applyViewGroup — 「2D 配置 / 3D 演出」上位グループ切替の副作用をまとめた共有関数。
// applySelectionScope と同じ React 非依存パターン（全ストアを getState で操作）。
//
// グループの意味:
// - 2D 配置: 平面での配置作業。スコープ = ALL / Item(家具) / Zone / Material(面仕上げ) / Map(敷地)
//   Material は図面ビュー（平面/立面/断面/展開）のまま面を選んで仕上げを貼るモード。
// - 3D 演出: 見え方の演出。スコープ = ALL / Lighting / Material / Label(面)
//
// 切替時の副作用:
// 1. ウォークスルー中なら退出（グループ切替はウォークスルーの外の概念）
// 2. 行き先グループに属さないスコープに居たら ALL へ（applySelectionScope で後片付け込み）
// 3. カメラ tilt: 2D → "top"（真上）/ 3D → "default"（俯瞰パース）
//    ※ グループ内でのカメラ変更は従来通り自由（モード内カメラ統一ポリシーは維持）
import { useEditorModeStore, type EditorViewGroup } from "../store/useEditorModeStore";
import { useSelectionScopeStore } from "../store/useSelectionScopeStore";
import { applySelectionScope } from "./applySelectionScope";

export const SCOPES_2D = ["all", "item", "zone", "material", "map"] as const;
export const SCOPES_3D = ["all", "lighting", "material", "label"] as const;

export function scopesForGroup(group: EditorViewGroup): readonly string[] {
    return group === "2d" ? SCOPES_2D : SCOPES_3D;
}

export function applyViewGroup(next: EditorViewGroup): void {
    if (next !== "2d" && next !== "3d") return;

    const modeStore = useEditorModeStore.getState();
    // ※ 同一グループでも early-return しない：
    //    アクティブな方をもう一度押す＝「グループ既定ビューへ戻す」操作として機能させる
    //    （起動直後は 2D グループでもカメラは俯瞰のままなので、初回クリックで真上へスナップできる）

    // ① ウォークスルー中なら退出してから切替える
    if (modeStore.editorMode === "walkthrough") {
        modeStore.exitWalkthrough();
    }

    // ② 行き先グループに属さないスコープなら ALL へ戻す
    //    （applySelectionScope が material/map/label 等の後片付けを行う）
    const scope = useSelectionScopeStore.getState().scope;
    const allowed = scopesForGroup(next);
    if (!allowed.includes(scope)) {
        applySelectionScope("all");
    }

    // ③ カメラ tilt をグループの既定へ（2D=真上 / 3D=俯瞰パース）
    useEditorModeStore.getState().setLayoutCameraTilt(next === "2d" ? "top" : "default");

    useEditorModeStore.getState().setEditorViewGroup(next);
}
