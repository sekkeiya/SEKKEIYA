// useAutoActions.js
// 「自動○○」アクションの実行ロジックを一箇所に集約した共有フック。
// ボトムバーのホバー実行ポップアップと、右サイドバーの専用パネルの双方から使う。
// 実行結果は useAutoActionStore に記録し（右サイドバーの詳細表示）、
// 同時に toast を push する（ホバー実行の即時フィードバック）。
import { useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";

import { useAppStore } from "../../../../../store/useAppStore";
import { subscribeProjectMaterials } from "../../../../dsmt/api/dsmtQueries";
import { autoApplyMaterials, AUTO_MATERIAL_STYLES } from "../../services/autoMaterialPipeline";
import { FURNITURE_MATERIAL_STYLES, applyFurnitureMaterialStyleFromRegistry } from "../../services/autoFurnitureMaterialPipeline";
import { autoApplyLightingAnimated, AUTO_LIGHTING_MOODS } from "../../services/autoLightingPipeline";
import { AUTO_REPLACE_STYLES } from "../../services/autoReplacePipeline";
import { generateSlots, summarizeSelection } from "../../services/furnitureSelectionService";
import { useFurnitureSelectionStore } from "../../store/useFurnitureSelectionStore";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useAutoLayoutStore } from "../../store/useAutoLayoutStore";
import { autoLabelStructure } from "../../services/structureAutoLabel";
import { autoZoning } from "../../services/autoZoning";
import { useScanFxStore } from "../../services/scanFx";
import { layoutSceneRef } from "../../services/layoutSceneRef";
import { useToolsStore } from "../../store/toolsStore/useToolsStore";
import { useAutoActionStore } from "../../store/useAutoActionStore";

// 自動家具選定のスコープ（住宅→部屋→ゾーンの階層）。
export const AUTO_SELECT_SCOPES = [
  { key: "zone",  label: "ゾーン" },
  { key: "room",  label: "部屋" },
  { key: "house", label: "住宅" },
];

// 各自動アクションの選択肢（スタイル/ムード）。右サイドバーとホバーポップアップで共有。
export const AUTO_ACTION_OPTIONS = {
  autoSelect:   AUTO_SELECT_SCOPES,
  autoMaterial: Object.entries(AUTO_MATERIAL_STYLES).map(([key, s]) => ({ key, label: s.label })),
  autoFurMat:   Object.entries(FURNITURE_MATERIAL_STYLES).map(([key, s]) => ({ key, label: s.label })),
  autoLighting: Object.entries(AUTO_LIGHTING_MOODS).map(([key, m]) => ({ key, label: m.label })),
  autoReplace:  Object.entries(AUTO_REPLACE_STYLES).map(([key, s]) => ({ key, label: s.label })),
  autoLabel:    null, // 単一実行
  autoZone:     null, // 単一実行
};

export function useAutoActions() {
  const setResult = useAutoActionStore((s) => s.setResult);
  const pushToast = useAutoActionStore((s) => s.pushToast);

  const [busyKind, setBusyKind] = useState(null); // 実行中の kind（UI のスピナー用）

  // S.Material ライブラリ（テクスチャ解決用）を購読
  const projectId = useAppStore((s) => s.activeProjectId);
  const [dsmtMaterials, setDsmtMaterials] = useState([]);
  useEffect(() => {
    if (!projectId) { setDsmtMaterials([]); return; }
    const unsub = subscribeProjectMaterials(projectId, setDsmtMaterials);
    return () => unsub();
  }, [projectId]);

  const report = useCallback((kind, severity, msg) => {
    setResult(kind, { severity, msg });
    pushToast(severity, msg);
  }, [setResult, pushToast]);

  // ── 自動マテリアル ──
  const runMaterial = useCallback(async (styleKey) => {
    setBusyKind("autoMaterial");
    try {
      const res = await autoApplyMaterials(styleKey, dsmtMaterials);
      if (res.ok) {
        const tex = res.texturedTypes.length ? `テクスチャ: ${res.texturedTypes.join("・")}` : "テクスチャ素材なし";
        const solid = res.solidTypes.length ? ` / 単色: ${res.solidTypes.join("・")}` : "";
        report("autoMaterial", "success", `${res.styleLabel}を自動付与（床 ${res.counts.floor} / 壁 ${res.counts.wall} / 天井 ${res.counts.ceiling} 面）｜${tex}${solid}`);
      } else {
        report("autoMaterial", "warning", res.reason || "自動付与に失敗しました");
      }
    } finally {
      setBusyKind(null);
    }
  }, [dsmtMaterials, report]);

  // ── 自動家具マテリアル ──
  const runFurniture = useCallback(async (styleKey) => {
    setBusyKind("autoFurMat");
    const label = FURNITURE_MATERIAL_STYLES[styleKey]?.label ?? styleKey;
    try {
      const { applied } = applyFurnitureMaterialStyleFromRegistry(styleKey);
      if (applied === 0) {
        report("autoFurMat", "warning", "マテリアルバリアントが登録されている家具が見つかりませんでした");
        return;
      }
      report("autoFurMat", "success", `「${label}」スタイルで ${applied} 個の家具に自動付与しました`);
      const fn = useToolsStore.getState().commands?.autoFurnitureMaterial;
      if (typeof fn === "function") { fn(styleKey).catch(() => {}); }
    } catch {
      report("autoFurMat", "warning", "自動家具マテリアルの付与に失敗しました");
    } finally {
      setBusyKind(null);
    }
  }, [report]);

  // ── 自動ラベリング（3Dスキャン演出付き） ──
  const runLabel = useCallback(() => {
    const root = layoutSceneRef.baseRoot;
    if (!root) { report("autoLabel", "warning", "躯体モデルが読み込まれていません"); return; }
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) { report("autoLabel", "warning", "躯体メッシュが見つかりません"); return; }

    setBusyKind("autoLabel");
    useScanFxStore.getState().startScan(box, { color: "light-dark(#0099ad, #34e7ff)" });
    pushToast("info", "3Dスキャン中… 床・壁・天井を解析しています");
    const total = useScanFxStore.getState().totalMs();
    window.setTimeout(() => {
      const res = autoLabelStructure();
      if (res.ok) {
        report("autoLabel", "success", `自動ラベリング完了（床 ${res.counts.floor} / 外床 ${res.counts.outer_floor} / 内壁 ${res.counts.inner_wall} / 外壁 ${res.counts.outer_wall} / 天井 ${res.counts.ceiling} 面）`);
      } else {
        report("autoLabel", "warning", res.reason || "自動ラベリングに失敗しました");
      }
      setBusyKind(null);
    }, total);
  }, [report, pushToast]);

  // ── 自動ライティング ──
  const runLighting = useCallback((moodKey) => {
    setBusyKind("autoLighting");
    try {
      const n = autoApplyLightingAnimated(moodKey);
      const label = AUTO_LIGHTING_MOODS[moodKey]?.label ?? moodKey;
      report("autoLighting", "success", `「${label}」で照明を${n}灯生成しました（ピン留め以外を置換）`);
    } catch {
      report("autoLighting", "warning", "自動ライティングに失敗しました");
    } finally {
      setBusyKind(null);
    }
  }, [report]);

  // ── 自動ゾーニング（自動ラベルの床/内壁から部屋＝ゾーンを自動生成）──
  const runZone = useCallback(() => {
    setBusyKind("autoZone");
    try {
      const res = autoZoning();
      if (res.ok) {
        report("autoZone", "success", `自動ゾーニング完了（${res.roomCount}部屋・${res.zoneCount}ゾーンを生成）`);
      } else {
        report("autoZone", "warning", res.reason || "自動ゾーニングに失敗しました");
      }
    } catch (e) {
      console.error("[autoZone] failed", e);
      report("autoZone", "warning", "自動ゾーニングに失敗しました");
    } finally {
      setBusyKind(null);
    }
  }, [report]);

  // ── 自動家具選定（製品は確定せず役割スロットを選定。スコープ=ゾーン/部屋/住宅）──
  const runSelect = useCallback((scopeKey) => {
    setBusyKind("autoSelect");
    try {
      const { zones, activeZoneId, selectedZoneIds } = useLayoutTaskStore.getState();
      const buildingType = useAutoLayoutStore.getState().buildingType;
      if (!zones || zones.length === 0) {
        report("autoSelect", "warning", "ゾーン（部屋）が作成されていません");
        return;
      }
      const selections = generateSlots(scopeKey, { zones, buildingType, activeZoneId, selectedZoneIds });
      useFurnitureSelectionStore.getState().setSelections(scopeKey, selections);
      if (selections.length === 0) {
        report("autoSelect", "warning", "選定対象の部屋が見つかりませんでした（用途を設定してください）");
        return;
      }
      report("autoSelect", "success", summarizeSelection(selections));
    } catch (e) {
      console.error("[autoSelect] failed", e);
      report("autoSelect", "warning", "自動家具選定に失敗しました");
    } finally {
      setBusyKind(null);
    }
  }, [report]);

  // ── 自動家具差し替え（配置固定・家具のみ差し替え）──
  const runReplace = useCallback(async (styleKey) => {
    const fn = useToolsStore.getState().commands?.autoReplaceFurniture;
    if (typeof fn !== "function") {
      report("autoReplace", "warning", "差し替えコマンドが利用できません");
      return;
    }
    setBusyKind("autoReplace");
    const label = AUTO_REPLACE_STYLES[styleKey]?.label ?? styleKey;
    try {
      const res = await fn(styleKey);
      if (res && res.ok) {
        if (res.replaced > 0) {
          report("autoReplace", "success", `「${label}」で ${res.replaced} 個の家具を差し替えました`);
        } else {
          report("autoReplace", "warning", "差し替え可能な同カテゴリの家具が見つかりませんでした");
        }
      } else {
        report("autoReplace", "warning", res?.reason || "自動家具差し替えに失敗しました");
      }
    } catch {
      report("autoReplace", "warning", "自動家具差し替えに失敗しました");
    } finally {
      setBusyKind(null);
    }
  }, [report]);

  // kind → 実行関数（option を引数に取る）。autoLabel は引数なし。
  const runByKind = useMemo(() => ({
    autoSelect: runSelect,
    autoMaterial: runMaterial,
    autoFurMat: runFurniture,
    autoLighting: runLighting,
    autoReplace: runReplace,
    autoLabel: () => runLabel(),
    autoZone: () => runZone(),
  }), [runSelect, runMaterial, runFurniture, runLighting, runReplace, runLabel, runZone]);

  return { busyKind, runByKind, runSelect, runMaterial, runFurniture, runLabel, runLighting, runReplace, runZone, options: AUTO_ACTION_OPTIONS };
}
