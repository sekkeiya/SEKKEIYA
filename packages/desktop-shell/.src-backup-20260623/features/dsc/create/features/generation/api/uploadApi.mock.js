/**
 * Simulates uploading an image to Firebase / Cloud Storage.
 * In production, this will use `uploadBytesResumable` from firebase/storage.
 */
export async function uploadGenerationSourceImage(file, ownerId, jobId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mocked storage path
      resolve({ path: `generation-inputs/${ownerId}/${jobId}/source-image.jpg` });
    }, 500);
  });
}
