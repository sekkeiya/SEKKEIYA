/**
 * Simulates uploading an image to Firebase / Cloud Storage.
 * In production, this will use `uploadBytesResumable` from firebase/storage.
 */
export async function uploadGenerationSourceImage(file, jobId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mocked storage path
      resolve({ path: `users/dummy-user-123/generations/${jobId}/source.jpg` });
    }, 500);
  });
}
