import { storage } from '../../../../../../services/firebase/firebaseApp';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export async function uploadGenerationSourceImage(file, ownerId, jobId) {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `generation-inputs/${ownerId}/${jobId}/source-image.${ext}`;
  const storageRef = ref(storage, path);
  
  const snapshot = await uploadBytesResumable(storageRef, file);
  // We can also retrieve the downloadUrl if we need to display it immediately
  // const downloadUrl = await getDownloadURL(snapshot.ref);

  return { path };
}
