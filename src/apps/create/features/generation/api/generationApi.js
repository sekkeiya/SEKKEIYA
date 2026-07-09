// Mock implementations for future integration
export async function createGenerationJob(domain, engine, quality) {
  console.log('Dummy createGenerationJob', { domain, engine, quality });
  return { id: 'mock-job-123' };
}

export async function uploadSourceImage(jobId, file) {
  console.log('Dummy uploadSourceImage', jobId, file.name);
  return { path: `generations/${jobId}/source.jpg` };
}

export async function startGenerationJob(jobId) {
  console.log('Dummy startGenerationJob', jobId);
  return { status: 'queued' };
}

export function subscribeGenerationJob(jobId, onUpdate) {
  console.log('Dummy subscribeGenerationJob', jobId);
  // Returns unsubscribe function
  return () => {};
}
