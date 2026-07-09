// aiOrchestrator.js
// 「AI実行（おまかせ）」のオーケストレーション。各自動アクションを順番に組み合わせて
// 内装〜パース/動画までの成果物を一気に生成する v1（決定論的パイプライン。将来 LLM 化可能）。
// 実行する工程は useAiPipelineStore で個別にオン/オフ。パースは標準/Cycles を選択。
// 進捗・完了・失敗は useAutoActionStore のトーストで通知する。
import { useAutoActionStore } from "../store/useAutoActionStore";
import { useAiResultStore } from "../store/useAiResultStore";
import { useAiPipelineStore } from "../store/useAiPipelineStore";
import { useAutoLayoutStore } from "../store/useAutoLayoutStore";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
import { useShotStore, shotsOfSet } from "../store/useShotStore";
import { useRenderHistoryStore } from "../store/useRenderHistoryStore";
import { useMediaSettingsStore } from "../store/useMediaSettingsStore";
import { useVideoRenderStore } from "../store/useVideoRenderStore";
import { generateAutoAngles } from "./autoCameraAngles";
import { captureLayoutPerspective } from "./layoutPerspectiveCapture";
import { checkBlender, renderWithCycles } from "./layoutCyclesCapture";
import { makeHistoryThumbnail } from "./imageThumbnail";
import { AUTO_MATERIAL_STYLES } from "./autoMaterialPipeline";
import { FURNITURE_MATERIAL_STYLES } from "./autoFurnitureMaterialPipeline";
import { AUTO_LIGHTING_MOODS } from "./autoLightingPipeline";
import { AUTO_REPLACE_STYLES } from "./autoReplacePipeline";
import { invoke } from "@tauri-apps/api/core";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstKey = (obj) => (obj ? Object.keys(obj)[0] : undefined);

let running = false;
export const isAiRunning = () => running;

// styleKey: 内装の基調スタイル（AUTO_MATERIAL_STYLES のキー）。各ステップ用にマッピングする。
export async function runAiPipeline(styleKey, runners) {
  if (running) return;
  running = true;
  const toast = (sev, msg) => useAutoActionStore.getState().pushToast(sev, msg);

  const matKey = AUTO_MATERIAL_STYLES?.[styleKey] ? styleKey : firstKey(AUTO_MATERIAL_STYLES);
  const furKey = FURNITURE_MATERIAL_STYLES?.[styleKey] ? styleKey : firstKey(FURNITURE_MATERIAL_STYLES);
  const repKey = AUTO_REPLACE_STYLES?.[styleKey] ? styleKey : firstKey(AUTO_REPLACE_STYLES);
  const moodKey = firstKey(AUTO_LIGHTING_MOODS);
  const run = runners?.runByKind ?? {};
  const { steps, renderQuality } = useAiPipelineStore.getState();

  // 進捗カウンタ（有効な工程数で n/total）
  const total = Object.values(steps).filter(Boolean).length || 1;
  let n = 0;
  const step = (msg) => { n++; toast("info", `AIおまかせ（${n}/${total}）${msg}`); };

  // 完了時にダイアログでまとめて表示するための結果サマリ
  const styleLabel = AUTO_MATERIAL_STYLES?.[matKey]?.label || "おまかせ";
  const results = [];
  const mediaPerspectives = []; // 生成したパースのサムネイル
  const mediaVideos = [];       // 生成（開始）した動画
  const pushResult = (label, status, detail) => results.push({ label, status, detail });
  // サブアクションの実行結果（useAutoActionStore.lastResults[kind]）から1行作る
  const recordFrom = (kind, label) => {
    const r = useAutoActionStore.getState().lastResults?.[kind];
    pushResult(label, r?.severity || "success", r?.msg);
  };

  try {
    // 1. 躯体解析（自動ラベル）
    if (steps.label) {
      step("躯体を解析中…");
      try { run.autoLabel?.(); } catch {}
      await sleep(1800);
      pushResult("躯体解析（自動ラベル）", "success", "床・壁・天井を判定しました");
    }

    // 2. 自動配置（家具レイアウト）
    if (steps.layout) {
      step("家具を自動配置中…");
      try {
        const lt = useLayoutTaskStore.getState();
        const ids = lt.selectedZoneIds?.length
          ? lt.selectedZoneIds
          : lt.zones?.length ? lt.zones.map((z) => z.id) : ["__full_room__"];
        useAutoLayoutStore.getState().requestAutoLayout(ids);
        await sleep(500);
        let t = 0;
        while (useAutoLayoutStore.getState().isGenerating && t < 15000) { await sleep(300); t += 300; }
        await sleep(400);
        pushResult("自動レイアウト", "success", "選定・プログラムに沿って家具を配置しました");
      } catch { pushResult("自動レイアウト", "warning", "配置中に問題が発生しました"); }
    }

    // 3. 家具差し替え
    if (steps.replace) {
      step("家具を整える…");
      try { await run.autoReplace?.(repKey); } catch {}
      await sleep(200);
      recordFrom("autoReplace", "自動家具差し替え");
    }

    // 4. 内装マテリアル
    if (steps.material) {
      step("内装マテリアルを付与…");
      try { await run.autoMaterial?.(matKey); } catch {}
      await sleep(200);
      recordFrom("autoMaterial", "自動マテリアル");
    }

    // 5. 家具マテリアル
    if (steps.furMat) {
      step("家具マテリアルを付与…");
      try { await run.autoFurMat?.(furKey); } catch {}
      await sleep(200);
      recordFrom("autoFurMat", "自動家具マテリアル");
    }

    // 6. ライティング
    if (steps.lighting) {
      step("ライティングを設定…");
      try { run.autoLighting?.(moodKey); } catch {}
      await sleep(600);
      recordFrom("autoLighting", "自動ライティング");
    }

    // 7. カメラアングル生成（still）
    const shotStore = useShotStore.getState();
    let generated = [];
    if (steps.angles) {
      step("カメラアングルを生成…");
      const angles = (generateAutoAngles("still") || []).slice(0, 4);
      for (const a of angles) {
        let thumb = null;
        try { thumb = await captureLayoutPerspective(a.camera, { forceShadows: false }); } catch {}
        const id = shotStore.addShot(a.camera, thumb, "still", { name: a.name });
        generated.push({ id, name: a.name, camera: a.camera });
      }
      pushResult(
        "カメラアングル生成",
        generated.length ? "success" : "warning",
        generated.length ? `${generated.length}アングルを作成しました` : "アングルを作成できませんでした",
      );
    }

    // パース/動画の対象アングル（生成したもの。無ければアクティブセットの既存 still）
    const st0 = useShotStore.getState();
    const targets = generated.length
      ? generated
      : shotsOfSet(st0.shots, st0.sets, st0.activeSetId ?? null, "still").map((s) => ({ id: s.id, name: s.name, camera: s.camera }));

    // 8. パース生成（標準 / Cycles）
    if (steps.render) {
      step(`パースを生成（${renderQuality === "cycles" ? "Cycles" : "標準"}）…`);
      const hist = useRenderHistoryStore.getState();
      let blenderPath = null;
      if (renderQuality === "cycles") {
        try { const info = await checkBlender(); blenderPath = info?.path ?? null; }
        catch { toast("warning", "Blender 未導入のため標準品質でパースを生成します"); }
      }
      let rendered = 0;
      for (const tg of targets) {
        try {
          let full = null;
          if (blenderPath) full = await renderWithCycles(tg.camera, blenderPath, 128);
          else full = await captureLayoutPerspective(tg.camera, { forceShadows: false });
          if (full) {
            const h = await makeHistoryThumbnail(full);
            hist.addEntry({ shotId: tg.id, shotName: tg.name, thumbnail: h, quality: blenderPath ? "cycles" : "standard" });
            mediaPerspectives.push({ name: tg.name, thumbnail: h ?? full ?? null });
            rendered++;
          }
        } catch {}
      }
      toast("success", `パース ${rendered} 枚を生成しました（履歴に保存）`);
      pushResult(
        "パース生成",
        rendered > 0 ? "success" : "warning",
        rendered > 0
          ? `${rendered}枚を生成（${blenderPath ? "Cycles" : "標準"}・履歴に保存）`
          : "パースを生成できませんでした",
      );
    }

    // 9. 動画生成（バックグラウンド・ベストエフォート）
    if (steps.movie) {
      step("動画を生成…");
      let movieStatus = "warning";
      let movieDetail = "動画を生成できませんでした";
      try {
        if (!targets.length) {
          toast("warning", "動画の起点になるアングルがありません");
          movieDetail = "起点になるアングルがありません";
        } else {
          const ms = useMediaSettingsStore.getState();
          ms.setSelectedShotIds(targets.map((t) => t.id));
          const built = ms.buildSelectedPath();
          if (!built.ok) {
            toast("warning", built.error || "動画パスを作成できませんでした");
            movieDetail = built.error || "動画パスを作成できませんでした";
          } else {
            const tgs = built.value.targets;
            const common = {
              cameraPath: built.value.cameraPath,
              durationSec: ms.videoDuration,
              resultName: tgs[0].name,
              posterCamera: tgs[0].camera,
              posterFallback: tgs[0].thumbnail ?? null,
              historyShotId: tgs[0].id,
              historyShotName: tgs[0].name,
            };
            const startVideoRender = useVideoRenderStore.getState().startVideoRender;
            if (ms.videoMode === "fast" || ms.videoMode === "quality") {
              let info = null;
              try { info = await invoke("check_ffmpeg", { ffmpegPath: null }); } catch {}
              if (!info?.path) { toast("warning", "FFmpeg 未導入のため動画はスキップしました"); movieStatus = "skip"; movieDetail = "FFmpeg 未導入のためスキップ"; }
              else { startVideoRender({ engine: "threejs", ffmpegPath: info.path, threejsQuality: ms.videoMode === "quality" ? 2 : 1, ...common }); toast("info", "動画をバックグラウンドで生成中…"); movieStatus = "info"; movieDetail = "バックグラウンドで生成中…"; mediaVideos.push({ name: tgs[0].name, poster: tgs[0].thumbnail ?? null, status: "生成中" }); }
            } else {
              let info = null;
              try { info = await checkBlender(); } catch {}
              if (!info?.path) { toast("warning", "Blender 未導入のため動画はスキップしました"); movieStatus = "skip"; movieDetail = "Blender 未導入のためスキップ"; }
              else { startVideoRender({ engine: "cycles", blenderPath: info.path, samples: 64, ...common }); toast("info", "動画をバックグラウンドで生成中…"); movieStatus = "info"; movieDetail = "バックグラウンドで生成中…"; mediaVideos.push({ name: tgs[0].name, poster: tgs[0].thumbnail ?? null, status: "生成中" }); }
            }
          }
        }
      } catch (e) { console.warn("[aiOrchestrator] movie failed", e); }
      pushResult("動画生成", movieStatus, movieDetail);
    }

    toast("success", "AIおまかせ完了");
    useAiResultStore.getState().show(results, {
      styleLabel, hadError: false,
      media: { perspectives: mediaPerspectives, videos: mediaVideos },
    });
  } catch (e) {
    console.error("[aiOrchestrator] failed", e);
    toast("warning", "AIおまかせの途中で問題が発生しました（コンソール参照）");
    pushResult("エラー", "warning", "途中で問題が発生しました（コンソール参照）");
    useAiResultStore.getState().show(results, {
      styleLabel, hadError: true,
      media: { perspectives: mediaPerspectives, videos: mediaVideos },
    });
  } finally {
    running = false;
  }
}
