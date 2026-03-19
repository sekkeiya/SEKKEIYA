const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

exports.onModelFanout = onDocumentWritten("users/{uid}/models/{modelId}", async (event) => {
  const { uid, modelId } = event.params;
  const db = admin.firestore();

  const modelDataAfter = event.data.after.exists ? event.data.after.data() : null;
  const modelDataBefore = event.data.before.exists ? event.data.before.data() : null;

  const isPublicNow = modelDataAfter && modelDataAfter.visibility === 'public' && modelDataAfter.isDeleted !== true;
  const wasPublicBefore = modelDataBefore && modelDataBefore.visibility === 'public' && modelDataBefore.isDeleted !== true;

  const feedItemId = `3dss_${modelId}`;

  // Fan-in: Remove from feeds if deleted or changed to private
  if (wasPublicBefore && !isPublicNow) {
    try {
      // Use collection group query to find all feed items linking to this model
      const snapshot = await db.collectionGroup("feedItems").where("referenceId", "==", modelId).get();
      if (snapshot.empty) return;
      
      let batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        // Commit in chunks of 500 if necessary
        if (count % 500 === 0) {
          batch.commit();
          batch = db.batch();
        }
      });
      
      if (count % 500 !== 0) {
        await batch.commit();
      }
      console.log(`Fanned-in (deleted) ${count} feed items for model ${modelId}`);
    } catch (err) {
      console.error(`Error deleting feed items for ${modelId}:`, err);
    }
    return;
  }

  // Fan-out: Publish or update feed item
  if (isPublicNow) {
    const authorId = uid;
    
    // Construct denormalized feed item payload
    const feedItemData = {
      type: "3dss_model",
      referenceId: modelId,
      sourceApp: "3dss",
      sourcePath: `/models/${modelId}`,
      authorId: authorId,
      authorName: modelDataAfter.authorName || modelDataAfter.ownerName || "Unknown",
      authorPhotoURL: modelDataAfter.authorPhotoURL || modelDataAfter.ownerPhotoURL || "",
      thumbnailUrl: modelDataAfter.thumbnailUrl || (modelDataAfter.thumbnailFilePath && modelDataAfter.thumbnailFilePath.path) || "",
      title: modelDataAfter.title || modelDataAfter.name || "Untitled",
      createdAt: modelDataAfter.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    try {
      // Retrieve list of followers
      const followersSnap = await db.collection(`users/${authorId}/followers`).get();
      if (followersSnap.empty) return;

      let batch = db.batch();
      let count = 0;

      // Distribute to all followers
      for (const followerDoc of followersSnap.docs) {
        const followerId = followerDoc.id;
        const feedRef = db.doc(`users/${followerId}/feedItems/${feedItemId}`);
        
        // We write the feed item as merged so it updates existing data
        batch.set(feedRef, feedItemData, { merge: true });
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
      }
      console.log(`Fanned-out feed item to ${count} followers for model ${modelId}`);
    } catch (err) {
      console.error(`Error fanning out feed items for ${modelId}:`, err);
    }
  }
});
