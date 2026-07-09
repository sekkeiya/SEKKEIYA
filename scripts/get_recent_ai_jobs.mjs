import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "shapeshare3d"
});

async function run() {
  const db = admin.firestore();
  
  // Just find some recent aiJobs the hard way to avoid missing indexes
  const users = await db.collection("users").limit(10).get();
  
  let allJobs = [];
  for (const user of users.docs) {
    const jobs = await user.ref.collection("aiJobs")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
      
    jobs.forEach(doc => {
      allJobs.push({id: doc.id, data: doc.data()});
    });
  }

  // Sort by createdAt descending
  allJobs.sort((a, b) => {
    const dateA = a.data.createdAt ? a.data.createdAt.toDate() : new Date(0);
    const dateB = b.data.createdAt ? b.data.createdAt.toDate() : new Date(0);
    return dateB - dateA;
  });

  const recentJobs = allJobs.slice(0, 5);

  recentJobs.forEach(job => {
    console.log(job.id, "=>", job.data.status, "\nError:", job.data.errorMessage, "\nURL:", job.data.inputImageUrl, "\n---");
  });
}

run().catch(console.error);
