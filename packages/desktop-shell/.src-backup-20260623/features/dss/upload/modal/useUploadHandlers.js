import { v4 as uuidv4 } from 'uuid';

/** undefined を含まない file payload を作る（サムネ用に size を落とせる） */
const packFile = (fileObj, { allowSize = true } = {}) => {
  if (!fileObj) return undefined;
  const out = {};
  if (fileObj.path) out.path = fileObj.path;
  if (fileObj.url) out.url = fileObj.url;
  if (allowSize && typeof fileObj.size !== "undefined") out.size = fileObj.size;
  return out;
};

const getExt = (nameOrUrl = "") => (nameOrUrl.split(".").pop() || "").toLowerCase();

const isGlbUrl = (url = "") => {
  if (!url) return false;
  try {
    const { pathname } = new URL(url);
    return /\.glb$/i.test(pathname);
  } catch {
    return /\.glb(\?.*)?$/i.test(url);
  }
};

/* ========= 追加：AI → タグ同期ユーティリティ ========= */
const syncTagsWithAi = (tagsIn, ai) => {
  const tags = Array.isArray(tagsIn) ? [...tagsIn] : [];
  // 既存 aiタグを除去
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i];
    if (t === "ai-generated" || (typeof t === "string" && t.startsWith("ai:"))) {
      tags.splice(i, 1);
    }
  }
  // ONなら付与
  if (ai?.generated) {
    if (!tags.includes("ai-generated")) tags.push("ai-generated");
    const src = (ai.source || "").toLowerCase();
    if (src) {
      const key = `ai:${src}`;
      if (!tags.includes(key)) tags.push(key);
    }
  }
  return tags;
};

/* ========= 追加：類似商品のクレンジング ========= */
const cleanSimilarProducts = (itemsIn) => {
  const asArr = Array.isArray(itemsIn) ? itemsIn : [];
  const out = [];

  for (const raw of asArr) {
    const name = (raw?.name || "").trim();
    const url = (raw?.url || "").trim();
    if (!name || !/^https?:\/\//i.test(url)) continue;

    let price = raw?.price;
    if (price === "" || price === null || typeof price === "undefined") {
      price = undefined;
    } else {
      const num = Number(price);
      price = Number.isFinite(num) && num >= 0 ? num : undefined;
    }

    const priceCurrency = (raw?.priceCurrency || "JPY").trim() || "JPY";

    const imageRaw = (raw?.image || "").trim();
    const image = imageRaw && /^https?:\/\//i.test(imageRaw) ? imageRaw : undefined;

    const s = raw?.size || {};
    const parseDim = (v) => {
      if (v === "" || v === null || typeof v === "undefined") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const size = {
      width: parseDim(s.width),
      depth: parseDim(s.depth),
      height: parseDim(s.height),
      sh: parseDim(s.sh),
    };
    const sizeClean = size.width ?? size.depth ?? size.height ?? size.sh ? size : undefined;

    out.push({
      id: raw?.id || (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
      name,
      url,
      price,
      priceCurrency,
      image,
      size: sizeClean,
    });
    if (out.length >= 5) break;
  }

  return out;
};

import { db, functions } from '../../../../lib/firebase/client';
import { collection, collectionGroup, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { isValidModelFile } from '../utils/fileValidation';
import { autoFillModelMetadata } from '../utils/fileMetadataExtractor';
import { generateThumbnailFromGlb } from '../utils/generateThumbnailFromGlb';
import { extractDimensionsFromGlb } from '../utils/extractDimensionsFromGlb';
import { convert3dmToGlb } from '../utils/convert3dmToGlb';
import { 
  findSimilarExistingModels, 
  aggregateCategoryCandidatesFromSimilarModels, 
  aggregateTagCandidatesFromSimilarModels 
} from '../utils/aiCompletionCandidateEngine';
import { normalizeAndSanitizeCategory } from '../utils/categoryNormalizer';

export const useUploadHandlers = ({
  user,
  uploadQueue,
  setters,
  onClose,
  setUploading,
  setIsLoadingFiles,
  setLoadingProgress,
  setLoadingCurrent,
  setLoadingTotal,
  setLoadingMessage,
  projectId,
  workspaceId,
  mergedCategoryMap,
}) => {
  
  // Create a new item struct based on the dropped file
  const createQueueItem = (file) => {
    try {
      return {
        id: uuidv4(),
        file,
        filename: file?.name || "unknown",
        ext: getExt(file?.name || ""),
        title: file?.name || "unknown",
        macroCategory: "家具 (既製品)", // default
        mainCategory: "",
        subCategory: "",
        visibility: "public",
        thumbnailPreviewUrl: "",
        thumbnailBlob: null,
        status: "parsing",
        progress: 0,
        errorMsg: "",
        ai: { generated: !!file?.aiGenerated, source: 'tripo', prompt: file?.aiPrompt || '' },
        tags: [],
        rooms: [],
        zones: [],
        buildingTypes: [],
        companionClasses: [],
        materials: [],
        similarProducts: [],
        companion3dmFile: null,
        companionGlbFile: null,
        thumbnailFile: null, // manual override
        glbGenerated: false,
        conversionStatus: "pending", // "pending" | "processing" | "done" | "error"
        conversionError: null,
        thumbnailGenerated: false,
        thumbnailStatus: "pending", // "pending" | "processing" | "done" | "error"
        thumbnailError: null,
        uploadEnabled: true,
        
        // Phase 2 additions
        dimensions: file?.dimensionsMm ? { ...file.dimensionsMm, unit: 'mm', autoExtracted: true, extractError: null } : { width: '', depth: '', height: '', unit: 'mm', autoExtracted: false, extractError: null },
        dimensionSource: file?.dimensionsMm ? 'ai' : 'none',
        autoTags: [],
        duplicateInfo: null, // { level: 'exact'|'strong', matchedId: '', matchedFilename: '', matchedSize: 0, matchedThumb: '', matchedUpdatedAt: null, action: 'skip'|'overwrite'|'new' }
        
        // Phase 5.2 AI Auto Input
        aiSuggested: null, // { title, type, mainCategory, subCategory, tags, confidence }
        aiStatus: 'idle', // 'idle' | 'loading' | 'done' | 'error'
        ai: file?.aiGenerated ? { prompt: file.aiPrompt } : null,

        preparingProgress: 0, // 0-100 for PremiumLoadingOverlay
      };
    } catch (err) {
      console.warn("createQueueItem error:", err);
      // Minimal fallback to prevent crash
      return {
        id: uuidv4(),
        file,
        filename: file?.name || "error",
        title: file?.name || "error",
        ext: getExt(file?.name || ""),
        status: "error",
        errorMsg: "解析初期化に失敗しました",
        uploadEnabled: false,
        tags: []
      };
    }
  };

  const handleFilesDrop = async (eOrFiles) => {
    // Phase 5.2E: Start Loading Overlay and initialization
    if (setIsLoadingFiles) {
      setIsLoadingFiles(true);
      if (setLoadingMessage) setLoadingMessage("ファイルを準備中...");
      if (setLoadingProgress) setLoadingProgress(0);
      if (setLoadingCurrent) setLoadingCurrent(0);
      if (setLoadingTotal) setLoadingTotal(0);
      await new Promise(r => setTimeout(r, 10)); 
    }

    try {
      let rawFiles = [];
      if (eOrFiles?.preventDefault) {
        eOrFiles.preventDefault();
        if (eOrFiles.dataTransfer && eOrFiles.dataTransfer.files) {
          rawFiles = Array.from(eOrFiles.dataTransfer.files);
        }
      } else if (eOrFiles?.length > 0) {
        rawFiles = Array.from(eOrFiles);
      }

      if (rawFiles.length === 0) return;

    // Remove duplicates
    const uniqueFiles = rawFiles.filter(f => {
      // Check if file is already in queue
      const isDuplicate = uploadQueue?.some(item => item.filename === f.name);
      return !isDuplicate;
    });

    const validModelFiles = uniqueFiles.filter(f => isValidModelFile(f.name));

    if (validModelFiles.length === 0) {
      if (setIsLoadingFiles) setIsLoadingFiles(false);
      
      if (uniqueFiles.length < rawFiles.length) {
         alert("追加されたファイルは既にリストに存在するか、非対応の形式です。");
      } else {
         alert("対応形式（.3dm, .glb, .skp, .blend, .gh, .obj）のファイルが見つかりませんでした。");
      }
      return;
    }

    let skipMsg = "";
    if (uniqueFiles.length < rawFiles.length) {
      skipMsg = `${rawFiles.length - uniqueFiles.length}件の同名ファイルをスキップしました。\n`;
    }
    if (validModelFiles.length < uniqueFiles.length) {
      skipMsg += `${uniqueFiles.length - validModelFiles.length}件の非対応ファイルをスキップしました。\n`;
    }

    if (skipMsg) {
      alert(`${skipMsg}\n${validModelFiles.length}件のファイルをキューに追加しました。`);
    }

    if (setLoadingTotal) setLoadingTotal(validModelFiles.length);
    if (setLoadingMessage) setLoadingMessage("ファイルを解析しています...");

    const newItems = [];
    for (let i = 0; i < validModelFiles.length; i++) {
        newItems.push(createQueueItem(validModelFiles[i]));
        
        // Update progress per item
        if (setLoadingCurrent) setLoadingCurrent(i + 1);
        if (setLoadingProgress) setLoadingProgress(Math.round(((i + 1) / validModelFiles.length) * 100));
        
        // Yield every few files to allow the UI progress bar to animate smoothly without freezing
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    // Append to queue first so UI updates immediately
    setters.appendFilesToQueue(newItems);

    // Yield main thread to React to render the initial pending UI
    await new Promise(r => setTimeout(r, 100)); // give a tiny delay so 100% is visibly reached before dismissing

    // Phase A completion: Dismiss global overlay to reveal individual card overlays (Phase B)
    if (setIsLoadingFiles) {
        setIsLoadingFiles(false);
    }

    // Check duplicates against Firestore (Asynchronous)
    const checkDuplicates = async () => {
        try {
            const userId = user?.uid;
            if (!userId) return;
            // Note: In SEKKEIYA OS SSOT, all items are under projects/*/workspaces/*/items
            // We use collectionGroup to find all models owned by this user
            const filenames = newItems.map(i => i.filename);
            const chunks = [];
            for (let i = 0; i < filenames.length; i += 10) {
                chunks.push(filenames.slice(i, i + 10));
            }
            
            for (const chunk of chunks) {
                 const itemsGroup = collectionGroup(db, 'items');
                 const q = query(
                     itemsGroup,
                     where("ownerId", "==", userId),
                     where("originalFilename", "in", chunk)
                 );
                 const snapshot = await getDocs(q);
                 
                 snapshot.forEach(doc => {
                     const data = doc.data();
                     // Find which newly added item matches this doc
                     const matchedItem = newItems.find(item => item.filename === data.originalFilename);
                     if (matchedItem) {
                         const isExact = data.originalFileSize === matchedItem.file.size;
                         
                         // Change: Overwrite duplicates by default rather than skipping
                         const initialAction = 'overwrite';
                         
                         setters.updateQueueItem(matchedItem.id, {
                            duplicateInfo: {
                                level: isExact ? 'exact' : 'strong',
                                matchedId: doc.id,
                                matchedFilename: data.originalFilename,
                                matchedSize: data.originalFileSize || 0,
                                matchedThumb: data.thumbnailUrl || '',
                                matchedUpdatedAt: data.updatedAt || data.createdAt || Date.now(),
                                action: initialAction
                            },
                            uploadEnabled: true // default to upload
                         });
                     }
                 });
            }
        } catch (err) {
            console.error("Duplicate check failed:", err);
            // Ignore missing index error softly during migration transition
            if (err.message && err.message.includes('index')) {
                console.warn("Index missing for duplicate checks. See Firebase Console.");
            }
        }
    }
    checkDuplicates();

    // 🚀 NEW: Fetch recent existing models ONCE for local similarity inference
    let existingDocs = [];
    try {
      if (user?.uid) {
        const q = query(
            collectionGroup(db, "items"),
            where("ownerId", "==", user.uid),
            where("type", "==", "model"),
            orderBy("createdAt", "desc"), 
            limit(200)
        );
        const snapshot = await getDocs(q);
        existingDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (err) {
      console.warn("Failed to fetch existing models for similarity search", err);
    }

        // Process files sequentially to prevent main thread blocking
        for (const item of newItems) {
            // 1. Lightweight Metadata Extraction
            const autoFilled = autoFillModelMetadata(item.file, [], null, mergedCategoryMap);
            setters.updateQueueItem(item.id, {
                title: autoFilled.title,
                macroCategory: autoFilled.macroCategory || item.macroCategory,
                mainCategory: autoFilled.mainCategory,
                subCategory: autoFilled.subCategory,
                tags: autoFilled.tags || [],
                autoTags: autoFilled.tags || [],
                rooms: autoFilled.rooms || [],
                zones: autoFilled.zones || [],
                buildingTypes: autoFilled.buildingTypes || [],
                materials: autoFilled.materials || [],
                companionClasses: autoFilled.companionClasses || [],
                status: 'queued',
                preparingProgress: 20
            });
            await new Promise(r => setTimeout(r, 0)); // Yield to UI after metadata

            const ext = getExt(item.filename);
        let extractedDims = { ...item.dimensions };
        let dimSource = item.dimensionSource || 'none';
        let newTagsSet = new Set([...(autoFilled.tags || [])]);

        if (ext === 'glb') {
            setters.updateQueueItem(item.id, { status: 'thumbnailing', thumbnailStatus: 'processing', preparingProgress: 20 });
            
            // 1. Generate Thumbnail
            let thumbnailBlob = null;
            let thumbnailFile = null;
            let thumbnailPreviewUrl = "";
            let thumbnailGenerated = false;
            let thumbError = "";
            
            try {
                const thumbResult = await generateThumbnailFromGlb(item.file);
                thumbnailBlob = thumbResult.blob;
                thumbnailFile = thumbResult.file;
                thumbnailPreviewUrl = URL.createObjectURL(thumbnailBlob);
                thumbnailGenerated = true;
                setters.updateQueueItem(item.id, { preparingProgress: 70 });
            } catch (err) {
                console.warn("Failed to generate thumbnail for", item.filename, err);
                thumbError = err.message || "Thumbnail failed";
            }

            // 2. Extract Dimensions
            if (dimSource !== 'manual' && dimSource !== 'ai') {
                try {
                     const dims = await extractDimensionsFromGlb(item.file);
                     extractedDims = {
                         width: dims.width,
                         depth: dims.depth,
                         height: dims.height,
                         unit: 'mm',
                         autoExtracted: true,
                         extractError: null
                     };
                     dimSource = 'auto';
                } catch (err) {
                     console.warn("Failed to extract dimensions for", item.filename, err);
                     extractedDims.extractError = err.message;
                }
            }

            // 3. Update Item State
            // Re-run rule-based tags generation now that dimensions are known
            if (extractedDims.width) {
               const maxDim = Math.max(extractedDims.width, extractedDims.depth, extractedDims.height);
               if (maxDim < 500) newTagsSet.add("小物");
               else if (maxDim > 2000) newTagsSet.add("大型");
            }

            setters.updateQueueItem(item.id, { 
                preparingProgress: 100,
                thumbnailBlob, 
                thumbnailFile,
                thumbnailPreviewUrl,
                errorMsg: thumbError ? 'Thumbnail failed' : '',
                thumbnailStatus: thumbError ? 'error' : 'done',
                thumbnailError: thumbError || null,
                glbGenerated: true,
                thumbnailGenerated,
                dimensions: extractedDims,
                dimensionSource: dimSource,
                tags: Array.from(newTagsSet)
            });
            await new Promise(r => setTimeout(r, 200)); // Show 100% briefly
            setters.updateQueueItem(item.id, { status: thumbError ? 'error' : 'queued' });
        } else if (ext === '3dm') {
            setters.updateQueueItem(item.id, { status: 'processing', conversionStatus: 'processing', thumbnailStatus: 'pending', preparingProgress: 20 });
            // Sequential conversion to avoid blocking the main thread all at once
            await new Promise(r => setTimeout(r, 50)); // Yield before heavy processing
            
            let glbFile = null;
                try {
                    glbFile = await convert3dmToGlb(item.file);
                    setters.updateQueueItem(item.id, {
                        companionGlbFile: glbFile,
                        conversionStatus: 'done',
                        glbGenerated: true,
                        status: 'thumbnailing',
                        thumbnailStatus: 'processing',
                        preparingProgress: 60
                    });
                } catch (err) {
                    console.error("3DM to GLB conversion failed for", item.filename, err);
                    setters.updateQueueItem(item.id, {
                        companionGlbFile: null,
                        conversionStatus: 'error',
                        conversionError: err.message || "GLB変換に失敗しました",
                        status: 'queued'
                    });
                    continue; // Skip to next file if GLB generation failed
                }

                // Now generate thumbnail from companion GLB
                if (glbFile) {
                    try {
                        const thumbResult = await generateThumbnailFromGlb(glbFile);
                        setters.updateQueueItem(item.id, { preparingProgress: 85 });
                        
                        // Extract dimension for 3DM
                        if (dimSource !== 'manual') {
                             try {
                                const dims = await extractDimensionsFromGlb(glbFile);
                                extractedDims = {
                                    width: dims.width,
                                    depth: dims.depth,
                                    height: dims.height,
                                    unit: 'mm',
                                    autoExtracted: true,
                                    extractError: null
                                };
                                dimSource = 'auto';
                             } catch (err) {
                                console.warn("Dim extraction failed for companion", item.filename, err);
                             }
                        }
                        
                        if (extractedDims.width) {
                           const maxDim = Math.max(extractedDims.width, extractedDims.depth, extractedDims.height);
                           if (maxDim < 500) newTagsSet.add("小物");
                           else if (maxDim > 2000) newTagsSet.add("大型");
                        }

                        setters.updateQueueItem(item.id, {
                            preparingProgress: 100,
                            thumbnailBlob: thumbResult.blob,
                            thumbnailFile: thumbResult.file,
                            thumbnailPreviewUrl: URL.createObjectURL(thumbResult.blob),
                            thumbnailGenerated: true,
                            thumbnailStatus: 'done',
                            dimensions: extractedDims,
                            dimensionSource: dimSource,
                            tags: Array.from(newTagsSet)
                        });
                        await new Promise(r => setTimeout(r, 200)); // Show 100% briefly
                        setters.updateQueueItem(item.id, { status: 'queued' });
                    } catch (err) {
                        console.error("Thumbnail generation failed for 3DM companion", item.filename, err);
                        setters.updateQueueItem(item.id, {
                            thumbnailStatus: 'error',
                            thumbnailError: err.message || "サムネ生成失敗",
                            status: 'queued'
                        });
                    }
                }
        } else {
            // other files like obj, skp, blend
            setters.updateQueueItem(item.id, { status: 'queued' });
        }
        
        // --- 4. 完全自動ハイブリッド・ローカルエンジン推論 ---
        setters.updateQueueItem(item.id, { aiStatus: 'loading' });
        await new Promise(r => setTimeout(r, 0));

        let topSimilarModels = [];
        let similarityCategories = { maxScore: 0, candidates: [] };

        if (existingDocs.length > 0) {
            topSimilarModels = findSimilarExistingModels(item.file, existingDocs, 5);
            similarityCategories = aggregateCategoryCandidatesFromSimilarModels(topSimilarModels);
        }

        let fallbackType = autoFilled.type || item.type;
        const { furnitureScore = 0, buildingScore = 0 } = similarityCategories;
        if (furnitureScore > 0 || buildingScore > 0) {
           fallbackType = furnitureScore >= buildingScore ? "家具" : "建築";
        }

        const normalizedFallback = normalizeAndSanitizeCategory({
           title: autoFilled.title || item.title,
           type: fallbackType,
           mainCategory: autoFilled.mainCategory || item.mainCategory || "",
           subCategory: autoFilled.subCategory || item.subCategory || "",
           tags: Array.from(newTagsSet)
        }, similarityCategories, mergedCategoryMap);

        const { ruleBasedClassify } = await import('../../utils/aiAutoFillService');
        const spatialInference = ruleBasedClassify(
            normalizedFallback.title || autoFilled.title || item.title, 
            normalizedFallback.tags || [],
            normalizedFallback.mainCategory || ""
        );

        setters.updateQueueItem(item.id, (currentItem) => {
           const uiChangedMain = currentItem.mainCategory !== "";
           const tagsToUse = currentItem.tags?.length > 0 ? currentItem.tags : (spatialInference.newTags || normalizedFallback.tags);
           return {
               aiStatus: 'done',
               title: currentItem.title, // keep user edits to title
               macroCategory: uiChangedMain ? currentItem.macroCategory : (normalizedFallback.macroCategory || "家具 (既製品)"),
               mainCategory: uiChangedMain ? currentItem.mainCategory : (normalizedFallback.mainCategory || ""),
               subCategory: uiChangedMain ? currentItem.subCategory : (normalizedFallback.subCategory || ""),
               tags: tagsToUse,
               materials: currentItem.materials?.length > 0 ? currentItem.materials : (spatialInference.materials || []),
               buildingTypes: currentItem.buildingTypes?.length > 0 ? currentItem.buildingTypes : (spatialInference.buildingTypes || []),
               rooms: currentItem.rooms?.length > 0 ? currentItem.rooms : (spatialInference.rooms || []),
               zones: currentItem.zones?.length > 0 ? currentItem.zones : (spatialInference.zones || []),
               companionClasses: currentItem.companionClasses?.length > 0 ? currentItem.companionClasses : (spatialInference.companionClasses || []),
               ai: { generated: currentItem.ai?.generated || true, source: 'hybrid-local', prompt: currentItem.ai?.prompt || '' }
           };
        });
    }

    } catch (err) {
        console.error("Drop Error:", err);
    } finally {
        // Overlay is already dismissed early to reveal Phase B card loading
    }
  };

  const handleProcessQueue = async (uploadQueue) => {
    if (!uploadQueue || uploadQueue.length === 0 || !user) {
      alert("ファイルがありません、またはログインしていません。");
      return;
    }

    const { WorkspaceItemRepository } = await import("../../../workspace/WorkspaceItemRepository");
    const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
    const { storage } = await import("../../../../lib/firebase/client");

    // Get items that need processing (queued or error, allow retry) AND are enabled for upload
    const itemsToProcess = uploadQueue.filter(
        item => item.uploadEnabled && (item.status === 'queued' || item.status === 'error')
    );

    if (itemsToProcess.length === 0) return;

    setUploading(true);

    // Process serially to avoid overwhelming network/memory
    for (const item of itemsToProcess) {
      try {
        setters.updateQueueItem(item.id, { status: 'uploading_model', progress: 0, errorMsg: '' });
        
        const primaryExt = getExt(item.filename);
        const isOverwrite = item.duplicateInfo?.action === 'overwrite';
        // Note: in SEKKEIYA v2 schema, we always generate a new asset ID
        // Overwrite handled at higher logical level or skip for now to keep parity simple
        const modelId = isOverwrite ? item.duplicateInfo.matchedId : uuidv4();
        
        const storageDir = `assets/${modelId}`;
        const uploadMetadata = { customMetadata: { ownerId: user.uid } };

        // 1) Primary file upload
        const primaryStorageRef = ref(storage, `${storageDir}/${item.file.name}`);
        const primaryUploadTask = uploadBytesResumable(primaryStorageRef, item.file, uploadMetadata);

        await new Promise((resolve, reject) => {
          primaryUploadTask.on('state_changed',
            (snap) => {
              const p = (snap.bytesTransferred / snap.totalBytes) * 100;
              setters.updateQueueItem(item.id, { progress: p });
            },
            (error) => reject(error),
            () => resolve()
          );
        });
        const primaryDownloadUrl = await getDownloadURL(primaryStorageRef);

        // 2) Thumbnail upload
        let uploadedThumbUrl = null;
        let uploadedThumbPath = "";
        
        if (item.thumbnailFile) {
            setters.updateQueueItem(item.id, { status: 'uploading_thumbnail', progress: 0 });
            const thumbPath = `${storageDir}/${item.thumbnailFile.name}`;
            const thumbRef = ref(storage, thumbPath);
            const thumbTask = uploadBytesResumable(thumbRef, item.thumbnailFile, uploadMetadata);
            await new Promise((resolve, reject) => thumbTask.on('state_changed', (snap) => setters.updateQueueItem(item.id, { progress: (snap.bytesTransferred/snap.totalBytes)*100 }), reject, resolve));
            uploadedThumbUrl = await getDownloadURL(thumbRef);
            uploadedThumbPath = thumbPath;
        } else if (item.thumbnailBlob) {
            setters.updateQueueItem(item.id, { status: 'uploading_thumbnail', progress: 0 });
            const thumbPath = `${storageDir}/thumbnail.webp`;
            const thumbRef = ref(storage, thumbPath);
            const thumbTask = uploadBytesResumable(thumbRef, item.thumbnailBlob, uploadMetadata);
            await new Promise((resolve, reject) => thumbTask.on('state_changed', (snap) => setters.updateQueueItem(item.id, { progress: (snap.bytesTransferred/snap.totalBytes)*100 }), reject, resolve));
            uploadedThumbUrl = await getDownloadURL(thumbRef);
            uploadedThumbPath = thumbPath;
        }

        // 2.5) Companion GLB upload
        let uploadedGlbUrl = null;
        let uploadedGlbPath = "";
        
        if (item.companionGlbFile) {
            setters.updateQueueItem(item.id, { status: 'uploading_model', progress: 50 });
            const glbPath = `${storageDir}/${item.companionGlbFile.name}`;
            const glbRef = ref(storage, glbPath);
            const glbTask = uploadBytesResumable(glbRef, item.companionGlbFile, uploadMetadata);
            await new Promise((resolve, reject) => glbTask.on('state_changed', null, reject, resolve));
            uploadedGlbUrl = await getDownloadURL(glbRef);
            uploadedGlbPath = glbPath;
        }

        const normalizedTags = syncTagsWithAi(item.tags, item.ai);

        // 3) Create Global Master Asset in /assets
        setters.updateQueueItem(item.id, { status: 'saving_doc' });
        
        // Native DB Insertion (SEKKEIYA Schema)
        const finalTitle = item.title || item.filename;
        const mainCat = typeof item.mainCategory === 'string' ? item.mainCategory : 'Uncategorized';
        
        const activeWorkspaceId = workspaceId || "models";

        // Save AI taxonomy and Companion GLB data
        const extendedMetadata = {
           dimensions: item.dimensions || null,
           dimensionSource: item.dimensionSource || null,
           ai: item.ai || null,
           companionGlbUrl: uploadedGlbUrl,
           companionGlbStoragePath: uploadedGlbPath,
           sizeGlb: item.companionGlbFile ? item.companionGlbFile.size : null
        };

        await WorkspaceItemRepository.createGlobalAsset(modelId, {
           id: modelId,
           name: finalTitle,
           type: '3d-model',
           format: primaryExt,
           sizeBytes: item.file.size,
           storagePath: `${storageDir}/${item.file.name}`,
           downloadUrl: primaryDownloadUrl,
           thumbnailUrl: uploadedThumbUrl || "",
           thumbnailStoragePath: uploadedThumbPath || "",
           glbUrl: uploadedGlbUrl || "",
           sizeGlb: item.companionGlbFile ? item.companionGlbFile.size : null,
           ownerId: user.uid,
           brand: item.brand || "",
           visibility: item.visibility || 'public',
           category: item.macroCategory || '家具 (既製品)',
           macroCategory: item.macroCategory || '家具 (既製品)',
           mainCategory: item.mainCategory || '',
           subCategory: item.subCategory || '',
           dimensions: item.dimensions || null,
           dimensionSource: item.dimensionSource || null,
           tags: normalizedTags,
           extendedMetadata: {
             ...extendedMetadata,
             macroCategory: item.macroCategory || '家具 (既製品)',
             mainCategory: item.mainCategory || '',
             subCategory: item.subCategory || ''
           },
           materials: item.materials || [],
           buildingTypes: item.buildingTypes || [],
           rooms: item.rooms || [],
           zones: item.zones || [],
           companionClasses: item.companionClasses || [],
           latestVersion: 1,
           versions: {
             "1": {
               downloadUrl: primaryDownloadUrl,
               glbUrl: uploadedGlbUrl || "",
               thumbnailUrl: uploadedThumbUrl || "",
               createdAt: Date.now()
             }
           }
        });

        // 4) Optionally link to project IF we are uploading directly into a project
        if (projectId) {
            await WorkspaceItemRepository.createItem(projectId, activeWorkspaceId, modelId, {
               id: modelId,
               itemType: '3DSS', // Legacy compat
               type: 'model', // Unified SSOT type
               workspaceType: '3dss',
               projectId: projectId,
               workspaceId: activeWorkspaceId,
               pinnedVersion: 1,
               ownerId: user.uid,
               visibility: item.visibility || 'public',
               macroCategory: item.macroCategory || '家具 (既製品)',
               mainCategory: item.mainCategory || '',
               subCategory: item.subCategory || '',
               dimensions: item.dimensions || null,
               dimensionSource: item.dimensionSource || null,
               modelType: (item.macroCategory === '建築・空間') ? 'Architecture' : 'Furniture',
               category: item.macroCategory || '家具 (既製品)',
               tags: normalizedTags,
               assetRef: modelId, // Use assetRef pointing to the Global Model
               thumbnailUrl: uploadedThumbUrl || "", // サムネイルURL（プロジェクトビューで表示するために必要）
               title: finalTitle,
               name: finalTitle,
               originalFilename: item.filename,
               originalFileSize: item.file?.size,
               extendedMetadata: {
                 ...extendedMetadata,
                 macroCategory: item.macroCategory || '家具 (既製品)',
                 mainCategory: item.mainCategory || '',
                 subCategory: item.subCategory || ''
               },
               materials: item.materials || [],
               buildingTypes: item.buildingTypes || [],
               rooms: item.rooms || [],
               zones: item.zones || [],
               companionClasses: item.companionClasses || []
            });
        }

        setters.updateQueueItem(item.id, { status: 'done', progress: 100 });
        
      } catch (err) {
        console.error(`Failed to process ${item.filename}:`, err);
        setters.updateQueueItem(item.id, { status: 'error', errorMsg: err.message || "Upload Failed" });
      }
    }

    setUploading(false);
  };

  const handleRunAI = async (itemId) => {
    // Phase 5.2 Update: Removed Cloud Functions AI completely as we now use hybrid local inferencing on file drop
    // Keeps interface to not break older references if any exist.
    console.log("handleRunAI called but Cloud AI is removed. Inference is done locally on upload.");
  };

  /**
   * AI Drive (ローカル) に保存する。
   * Rhino からのアップロード（File に __rhinoSource3dmPath が付いている）のみ対応。
   * クラウドアップロードと同じ豊富なメタデータ（カテゴリ、タグ、寸法、AI判定など）を保存する。
   */
  const handleProcessLocal = async (uploadQueue) => {
    if (!uploadQueue || uploadQueue.length === 0) {
      alert("ファイルがありません。");
      return;
    }

    const itemsToProcess = uploadQueue.filter(
      item => item.uploadEnabled && (item.status === 'queued' || item.status === 'error')
    );

    if (itemsToProcess.length === 0) return;

    // ローカル保存は現状 Rhino 由来のファイル（__rhinoSource3dmPath 付き）のみサポート
    const nonRhinoItems = itemsToProcess.filter(item => !item.file?.__rhinoSource3dmPath);
    if (nonRhinoItems.length > 0) {
      alert(
        `ローカル保存は現在 Rhino からのアップロードのみ対応しています。\n` +
        `対象外: ${nonRhinoItems.length}件\n\n` +
        `クラウドに切り替えるか、対象外ファイルのアップロードをOFFにしてください。`
      );
      return;
    }

    const { invoke } = await import('@tauri-apps/api/core');

    setUploading(true);

    for (const item of itemsToProcess) {
      try {
        setters.updateQueueItem(item.id, { status: 'uploading_model', progress: 0, errorMsg: '' });

        const localId = uuidv4();
        const normalizedTags = syncTagsWithAi(item.tags, item.ai);
        const finalTitle = item.title || item.filename;
        const file = item.file;

        const result = await invoke('save_selection_locally', {
          localId,
          title: finalTitle,
          category: item.mainCategory || 'uncategorized',
          macroCategory: item.macroCategory || null,
          subCategory: item.subCategory || null,
          tags: normalizedTags,
          source3dmPath: file.__rhinoSource3dmPath,
          thumbnailPath: file.__rhinoThumbnailPath || null,
          companionGlbPath: null, // GLB はローカル保存では生成しない（必要なら後で対応）
          width: item.dimensions?.width || null,
          depth: item.dimensions?.depth || null,
          height: item.dimensions?.height || null,
          unitSystem: item.dimensions?.unit || null,
          aiGenerated: item.ai?.generated || false,
          source: file.__rhinoSource || 'rhino-selection',
        });

        console.log('[Upload] ローカル保存成功:', result);
        setters.updateQueueItem(item.id, { status: 'done', progress: 100 });

      } catch (err) {
        console.error(`Failed to save ${item.filename} locally:`, err);
        setters.updateQueueItem(item.id, {
          status: 'error',
          errorMsg: typeof err === 'string' ? err : (err?.message || "ローカル保存に失敗"),
        });
      }
    }

    setUploading(false);
  };

  return {
    handleFilesDrop,
    handleProcessQueue,
    handleProcessLocal,
    handleRunAI,
  };
};
