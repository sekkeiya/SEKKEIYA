const admin = require("firebase-admin");

/**
 * AI Drive Search Service
 * 
 * Provides methods for querying and filtering the user's AI Drive assets.
 * Used primarily for injecting context into the AI Chat Orchestrator.
 */
class DriveSearchService {
  constructor(uid) {
    if (!uid) throw new Error("DriveSearchService requires a valid user uid");
    this.uid = uid;
    this.db = admin.firestore();
    this.assetsRef = this.db.collection("users").doc(this.uid).collection("driveAssets");
  }

  /**
   * Basic tag-based context query.
   * Finds assets that match ANY of the provided tags or categories.
   * @param {string[]} tags List of semantic tags extracted from user intent.
   * @param {number} limit Max number of results.
   * @returns {Promise<Array>} List of relevant assets.
   */
  async searchByTags(tags = [], limit = 5) {
    if (!tags || tags.length === 0) return [];

    try {
      // Due to Firestore indexing limits on 'in' / 'array-contains-any', 
      // we do a simple array-contains-any query if we have 10 or fewer tags.
      const searchTags = tags.slice(0, 10); 
      const q = this.assetsRef
        .where("tags", "array-contains-any", searchTags)
        .where("isDeleted", "!=", true)
        .limit(limit);

      const snapshot = await q.get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          type: data.type,
          category: data.category,
          tags: data.tags || [],
          projectId: data.projectId || null,
          url: data.url || data.storagePath || ""
        };
      });
    } catch (error) {
      console.error("searchByTags failed:", error);
      return [];
    }
  }

  /**
   * Search specifically by project ID (or name).
   * @param {string} projectId 
   * @param {number} limit 
   */
  async searchByProject(projectId, limit = 10) {
    if (!projectId) return [];
    
    try {
      // Fallback: check if the project name was injected as a tag instead of projectId
      // (since analyzeDriveAsset currently injects suggested Project as a tag)
      const exactQ = this.assetsRef
        .where("projectId", "==", projectId)
        .where("isDeleted", "!=", true)
        .limit(limit);

      const exactSnap = await exactQ.get();
      if (!exactSnap.empty) {
        return exactSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // If no exact match by ID, search by tags
      return await this.searchByTags([projectId], limit);
    } catch (error) {
      console.error("searchByProject failed:", error);
      return [];
    }
  }

  /**
   * Semantic Search Placeholder
   * Future implementation will use generateAssetEmbedding vectors.
   */
  async semanticSearch(query, limit = 5) {
    console.warn("Semantic search not fully implemented. Falling back to tag search.");
    // In the meantime, we could just extract basic keywords and do a tag search
    const words = query.split(" ").filter(w => w.length > 2);
    if (words.length > 0) {
      return await this.searchByTags(words, limit);
    }
    return [];
  }
}

module.exports = { DriveSearchService };
