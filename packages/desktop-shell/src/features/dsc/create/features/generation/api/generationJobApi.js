// In-memory mock of Firestore documents
const activeJobs = {};
// In-memory mock of Firestore listeners
const listeners = {};

/**
 * Creates a new generation job in "Firestore".
 * In production, this adds a document to the `generationJobs` collection.
 */
export async function createGenerationJob(payload) {
  const id = `job-${Date.now()}`;
  const job = {
    id,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  activeJobs[id] = job;
  return { id };
}

/**
 * Subscribes to changes on a specific generation job document.
 * In production, this wraps `onSnapshot(doc(db, 'generationJobs', jobId))`.
 */
export function subscribeGenerationJob(jobId, onUpdate) {
  listeners[jobId] = onUpdate;
  
  if (activeJobs[jobId]) {
    onUpdate(activeJobs[jobId]);
  }

  // Return unsubscribe function
  return () => {
    delete listeners[jobId];
  };
}

/**
 * Updates the progress and status of a generation job.
 * In production, this updates the Firestore document, usually done by Cloud Run/Functions backend.
 * We include it here to mock the backend's behavior.
 */
export async function updateGenerationJobStatus(jobId, status, progress) {
  if (activeJobs[jobId]) {
    activeJobs[jobId] = { 
      ...activeJobs[jobId], 
      status, 
      progress, 
      updatedAt: new Date().toISOString() 
    };
    if (listeners[jobId]) {
      listeners[jobId](activeJobs[jobId]);
    }
  }
}

/**
 * Completes the generation job with results.
 * In production, this is done by the backend worker.
 */
export async function finalizeGenerationJob(jobId, results) {
  if (activeJobs[jobId]) {
    activeJobs[jobId] = { 
      ...activeJobs[jobId], 
      status: 'done', 
      progress: 100, 
      ...results, 
      updatedAt: new Date().toISOString() 
    };
    if (listeners[jobId]) {
      listeners[jobId](activeJobs[jobId]);
    }
  }
}

/**
 * Marks the generation job as failed.
 * In production, this is done by the backend worker catching an exception.
 */
export async function failGenerationJob(jobId, errorMessage) {
  if (activeJobs[jobId]) {
    activeJobs[jobId] = { 
      ...activeJobs[jobId], 
      status: 'error', 
      errorMessage, 
      updatedAt: new Date().toISOString() 
    };
    if (listeners[jobId]) {
      listeners[jobId](activeJobs[jobId]);
    }
  }
}
