/**
 * Normalizes 3DSS Firestore Model records into the generic Viewer-First `BoardItem` shape.
 * 
 * Target Shape:
 * {
 *   id, type, title, thumbnailUrl, description, createdAt, updatedAt, tags, sourceApp, meta,
 *   sourceRef: { app, boardId, itemId, ownerId, path },
 *   permissions: { canView, canEdit, canDelete, canDownload, canOpenSourceApp }
 * }
 */

export function adapt3dssModelToBoardItem(modelDoc, boardId, currentUserId) {
  if (!modelDoc) return null;
  
  const id = modelDoc.id || modelDoc.modelId;
  const isOwner = currentUserId && (currentUserId === modelDoc.ownerId || currentUserId === modelDoc.ownerUid);
  
  // Extract thumbnail from 3DSS model payload
  const thumbnail = modelDoc.thumbnailUrl || modelDoc.thumbUrl || modelDoc.previewUrl || modelDoc.coverUrl || 
                   (modelDoc.images?.[0]) || (modelDoc.gallery?.[0]?.url) || null;

  return {
    id,
    type: "model",
    entityId: id, // Provide explicit entityId for Universal Board hooks
    modelId: id, // Provide explicit modelId for legacy Dashboard clicks
    title: modelDoc.name || modelDoc.title || "Untitled Model",
    description: modelDoc.description || "",
    thumbnailUrl: thumbnail,
    
    // Normalize timestamps
    createdAt: normalizeTimestamp(modelDoc.createdAt || modelDoc.created_at),
    updatedAt: normalizeTimestamp(modelDoc.updatedAt || modelDoc.updated_at || modelDoc.createdAt),
    
    tags: modelDoc.tags || [],
    sourceApp: "3dss", // Origin application 
    
    sourceRef: {
      app: "3dss",
      boardId,
      itemId: id,
      ownerId: modelDoc.ownerId || modelDoc.ownerUid,
      path: `models/${id}`
    },
    
    // Permissions explicitly abstracted for the viewer
    permissions: {
      canView: true, 
      canEdit: isOwner, 
      canDelete: isOwner,
      canDownload: true, // 3DSS models are typically downloadable via the app
      canOpenSourceApp: true,
    },
    
    // Additional type-specific metadata
    meta: {
      price: modelDoc.price || 0,
      dimensions: {
        w: modelDoc.width || 0,
        d: modelDoc.depth || 0,
        h: modelDoc.height || 0
      },
      fileType: determineFileType(modelDoc),
      size: determineFileSize(modelDoc),
      isTemplate: modelDoc.isTemplate || false,
    }
  };
}

function determineFileType(doc) {
  if (doc.ext) return doc.ext.toUpperCase();
  if (doc?.has3dm || doc?.["3dm"] || Number(doc?.size3dm) > 0 || Number(doc?.size3dmMB) > 0) return "3DM";
  if (doc?.hasGlb || doc?.["glb"] || Number(doc?.sizeGlb) > 0 || Number(doc?.sizeGlbMB) > 0) return "GLB";
  if (doc?.hasBlend || doc?.["blend"] || Number(doc?.sizeBlend) > 0 || Number(doc?.sizeBlendMB) > 0) return "BLEND";
  
  if (doc?.files && Array.isArray(doc.files) && doc.files.length > 0) {
    return String(doc.files[0]).toUpperCase();
  }
  
  return "Unknown";
}

function determineFileSize(doc) {
  if (doc.size) return doc.size;
  
  const type = determineFileType(doc);
  if (type === "3DM") {
    if (doc.size3dm) return doc.size3dm;
    if (doc.size3dmMB) return doc.size3dmMB * 1024 * 1024;
  }
  if (type === "GLB") {
    if (doc.sizeGlb) return doc.sizeGlb;
    if (doc.sizeGlbMB) return doc.sizeGlbMB * 1024 * 1024;
  }
  if (type === "BLEND") {
    if (doc.sizeBlend) return doc.sizeBlend;
    if (doc.sizeBlendMB) return doc.sizeBlendMB * 1024 * 1024;
  }
  return 0;
}

function normalizeTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
  if (typeof ts === "number") return new Date(ts).toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}
