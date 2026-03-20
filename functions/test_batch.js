const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "shapeshare3d"
});

const db = admin.firestore();
const uid = "test_user";
const targetUserId = "target_user";

async function testFollow() {
  const batch = db.batch();
  
  const followingRef = db.collection("users").doc(uid).collection("following").doc(targetUserId);
  const followerRef = db.collection("users").doc(targetUserId).collection("followers").doc(uid);
  
  const currentUserRef = db.collection("users").doc(uid);
  const targetUserRef = db.collection("users").doc(targetUserId);

  batch.set(followingRef, {
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  batch.set(followerRef, {
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(currentUserRef, {
    followingCount: admin.firestore.FieldValue.increment(1)
  }, { merge: true });

  batch.set(targetUserRef, {
    followersCount: admin.firestore.FieldValue.increment(1)
  }, { merge: true });

  try {
    await batch.commit();
    console.log("Success!");
  } catch (error) {
    console.error("Error in followUser:", error);
  }
}

testFollow();
