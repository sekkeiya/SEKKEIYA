import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getModelLocalPathCached } from "../../../lib/dss/modelLocalPathCache";
import { resolveDownloadUrl, getCanonicalModelId } from "../utils/modelUtils";

export interface RhinoDocument {
  id: string;
  name: string;
  path: string;
  is_active: boolean;
}

export interface CachedModelInfo {
  modelId: string;
  ext: string;
  filePath: string;
}

export function useRhinoDragImport() {
  const [isDraggingToRhino, setIsDraggingToRhino] = useState(false);
  const [isSendingToRhino, setIsSendingToRhino] = useState(false);
  const [openRhinoDocs, setOpenRhinoDocs] = useState<RhinoDocument[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const currentModelRef = useRef<CachedModelInfo | null>(null);

  const resolveCachedModelInfo = useCallback(async (model: any) => {
    if (!model) return null;

    const modelId = getCanonicalModelId(model) || model.id || model.modelId;
    if (!modelId) return null;

    const exts = ["3dm", "glb"];

    // 1. Try to find existing local copy
    for (const ext of exts) {
      const filePath = await getModelLocalPathCached(modelId, ext);
      if (filePath) {
        return { modelId, ext, filePath };
      }
    }

    // 2. Not cached locally, look for a download URL and try ensuring it on disk
    for (const ext of exts) {
      const downloadUrl = await resolveDownloadUrl(model, ext, modelId);
      if (downloadUrl) {
        try {
          console.log(`[useRhinoDragImport] downloading missing cache for ${modelId}.${ext}`);
          const filePath = await invoke<string>("ensure_model_cached", {
            modelId,
            ext,
            downloadUrl
          });
          return { modelId, ext, filePath };
        } catch (e) {
          console.error(`[useRhinoDragImport] ensure_model_cached failed for ${ext}:`, e);
        }
      }
    }

    return null;
  }, []);

  const clearState = useCallback(() => {
    setIsDraggingToRhino(false);
    setIsSendingToRhino(false);
    setErrorMessage("");
    setOpenRhinoDocs([]);
    currentModelRef.current = null;
  }, []);

  const startSendToRhino = useCallback(
    async (model: any) => {
      setErrorMessage("");
      setIsSendingToRhino(true);

      try {
        const info = await resolveCachedModelInfo(model);
        if (!info) {
          console.log("[useRhinoDragImport] model is not cached locally. DropZone Not Shown.");
          return;
        }

        currentModelRef.current = info;

        try {
          const docs = await invoke<RhinoDocument[]>("list_rhino_documents");
          const safeDocs = Array.isArray(docs) ? docs : [];

          setOpenRhinoDocs(safeDocs);

          if (safeDocs.length === 0) {
            setErrorMessage(
              "Rhino プラグインからドキュメント一覧を取得できませんでした。（プラグイン未インストール or 設定前の可能性があります）"
            );
            setIsDraggingToRhino(true);
          } else {
            setErrorMessage("");
            
            // Auto Import to active doc (or first doc if no active doc is found)
            const targetDoc = safeDocs.find(d => d.is_active) || safeDocs[0];
            
            try {
              await invoke("import_model_into_rhino_doc", {
                docId: targetDoc.id,
                filePath: info.filePath,
                ext: info.ext,
                modelId: info.modelId,
              });
              console.log("[useRhinoDragImport] auto import OK:", targetDoc.id, info.filePath);
              return; // Exit here. No dropzone overlay shown!
            } catch (importErr) {
              console.error("[useRhinoDragImport] auto import failed:", importErr);
              setErrorMessage("インポート中にエラーが発生しました。");
              setIsDraggingToRhino(true);
            }
          }
        } catch (err: any) {
          console.error("[useRhinoDragImport] list_rhino_documents failed:", err);
          setOpenRhinoDocs([]);

          const raw = typeof err === "string" ? err : err?.message || "";

          if (raw.includes("RHINO_NOT_RUNNING")) {
            setErrorMessage(
              "Rhino が開いていないか、プラグインからの情報待ちです。Rhino を起動し、S.Model プラグインを設定してから再度お試しください。"
            );
          } else {
            setErrorMessage(
              "Rhino プラグインからドキュメント一覧を取得できませんでした。（プラグイン未インストール or 設定前の可能性があります）"
            );
          }
          setIsDraggingToRhino(true);
        }
      } finally {
        setIsSendingToRhino(false);
      }
    },
    [resolveCachedModelInfo]
  );

  const handleCardDragStart = useCallback(
    (event: React.MouseEvent | React.DragEvent, model: any) => {
      // Ignored non-left clicks
      if (event && (event as React.MouseEvent).button !== 0 && (event as React.DragEvent).button !== 0) return;
      startSendToRhino(model);
    },
    [startSendToRhino]
  );

  const handleCardDragEnd = useCallback(() => {}, []);

  const handleCancelDrop = useCallback(() => {
    clearState();
  }, [clearState]);

  const handleDropToRhino = useCallback(
    async ({ docId, modelId, filePath }: { docId: string; modelId?: string; filePath?: string }) => {
      try {
        const info = currentModelRef.current;

        const finalFilePath = filePath || info?.filePath || null;
        if (!finalFilePath) {
          console.warn("[useRhinoDragImport] filePath が分からないため import をスキップします");
          return;
        }

        await invoke("import_model_into_rhino_doc", {
          docId,
          filePath: finalFilePath,
          ext: info?.ext ?? undefined,
          modelId: modelId ?? info?.modelId ?? undefined,
        });

        console.log("[useRhinoDragImport] import_model_into_rhino_doc OK:", docId, finalFilePath);
      } catch (err) {
        console.error("[useRhinoDragImport] import_model_into_rhino_doc failed:", err);
      } finally {
        clearState();
      }
    },
    [clearState]
  );

  return {
    isDraggingToRhino,
    openRhinoDocs,
    errorMessage,
    handleDropToRhino,
    handleCancelDrop,
    isSendingToRhino,
    startSendToRhino,
    handleCardDragStart,
    handleCardDragEnd,
  };
}
