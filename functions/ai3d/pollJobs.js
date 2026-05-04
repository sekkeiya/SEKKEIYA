const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { providerFactory } = require("./providers/providerFactory");

const tripoApiKey = defineSecret("TRIPO_API_KEY");

exports.pollAiJobs = onSchedule({ schedule: "every 1 minutes", secrets: [tripoApiKey] }, async (event) => {
  const db = admin.firestore();
  
  try {
    // Query all active jobs across all users.
    // Ensure you have a collectionGroup index for "aiJobs" on "status" field.
    const snapshot = await db.collectionGroup("aiJobs")
      .where("status", "==", "processing")
      .get();

    if (snapshot.empty) {
      console.log("No processing jobs found.");
      return;
    }

    // Filter for tripo (and mock if any, though mock usually finishes inline)
    // Meshy is currently out of scope for Phase 2-1
    const targetDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.archived === true || data.status === "cancelled" || data.status === "archived") return false;
      const p = data.provider;
      return p === "tripo3d" || p === "triposr" || p === "mock";
    });

    if (targetDocs.length === 0) {
      console.log("No processing Tripo jobs found.");
      return;
    }

    console.log(`Found ${targetDocs.length} Tripo jobs to poll.`);

    const promises = targetDocs.map(async (doc) => {
      const jobData = doc.data();
      const jobId = doc.id;
      // We need the uid. It's the parent of the parent.
      // Doc ref is: users/{uid}/aiJobs/{jobId}
      const uid = doc.ref.parent.parent.id;

      try {
        await providerFactory.checkJob(jobId, uid, jobData);
      } catch (err) {
        console.error(`Error checking job ${jobId}:`, err);
      }
    });

    await Promise.all(promises);
    console.log("Finished polling all jobs.");

  } catch (error) {
    console.error("Error in pollAiJobs:", error);
  }
});
