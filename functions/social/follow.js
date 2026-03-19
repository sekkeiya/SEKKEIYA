const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

exports.followUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const uid = request.auth.uid;
  const targetUserId = request.data.targetUserId;
  
  if (!targetUserId) throw new HttpsError("invalid-argument", "Missing targetUserId");
  if (uid === targetUserId) throw new HttpsError("invalid-argument", "Cannot follow yourself");

  const db = admin.firestore();
  const followingRef = db.doc(`users/${uid}/following/${targetUserId}`);
  const followerRef = db.doc(`users/${targetUserId}/followers/${uid}`);

  await db.runTransaction(async (t) => {
    t.set(followingRef, { createdAt: FieldValue.serverTimestamp() }, { merge: true });
    t.set(followerRef, { createdAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { success: true };
});

exports.unfollowUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const uid = request.auth.uid;
  const targetUserId = request.data.targetUserId;
  
  if (!targetUserId) throw new HttpsError("invalid-argument", "Missing targetUserId");

  const db = admin.firestore();
  const followingRef = db.doc(`users/${uid}/following/${targetUserId}`);
  const followerRef = db.doc(`users/${targetUserId}/followers/${uid}`);

  await db.runTransaction(async (t) => {
    t.delete(followingRef);
    t.delete(followerRef);
  });

  return { success: true };
});
