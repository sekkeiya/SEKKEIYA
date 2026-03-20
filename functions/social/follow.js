const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

exports.followUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to follow users.");
  }
  
  const uid = request.auth.uid;
  const targetUserId = request.data.targetUserId;
  
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "Missing targetUserId.");
  }
  
  if (uid === targetUserId) {
    throw new HttpsError("invalid-argument", "You cannot follow yourself.");
  }

  const db = admin.firestore();
  const batch = db.batch();
  
  const followingRef = db.collection("users").doc(uid).collection("following").doc(targetUserId);
  const followerRef = db.collection("users").doc(targetUserId).collection("followers").doc(uid);
  
  const currentUserRef = db.collection("users").doc(uid);
  const targetUserRef = db.collection("users").doc(targetUserId);

  batch.set(followingRef, {
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  batch.set(followerRef, {
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // Increment root level counters
  batch.set(currentUserRef, {
    followingCount: FieldValue.increment(1)
  }, { merge: true });

  batch.set(targetUserRef, {
    followersCount: FieldValue.increment(1)
  }, { merge: true });

  try {
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error in followUser:", error);
    throw new HttpsError("internal", "Failed to follow user.");
  }
});

exports.unfollowUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to unfollow users.");
  }
  
  const uid = request.auth.uid;
  const targetUserId = request.data.targetUserId;
  
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "Missing targetUserId.");
  }

  const db = admin.firestore();
  const batch = db.batch();
  
  const followingRef = db.collection("users").doc(uid).collection("following").doc(targetUserId);
  const followerRef = db.collection("users").doc(targetUserId).collection("followers").doc(uid);
  
  const currentUserRef = db.collection("users").doc(uid);
  const targetUserRef = db.collection("users").doc(targetUserId);

  batch.delete(followingRef);
  batch.delete(followerRef);

  batch.set(currentUserRef, {
    followingCount: FieldValue.increment(-1)
  }, { merge: true });

  batch.set(targetUserRef, {
    followersCount: FieldValue.increment(-1)
  }, { merge: true });

  try {
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error in unfollowUser:", error);
    throw new HttpsError("internal", "Failed to unfollow user.");
  }
});
