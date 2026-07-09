import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { getGlobalDb, getGlobalStorage } from '../api/firebaseDb';

export function useTemplates(appType, uid) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTemplates() {
      if (!appType) return;
      try {
        setLoading(true);
        setError(null);
        const db = getGlobalDb();
        
        let results = [];

        // 1. officialTemplates
        try {
          const offQ = query(collection(db, 'officialTemplates'), where('appType', '==', appType));
          const offSnap = await getDocs(offQ);
          offSnap.forEach(d => results.push({ id: d.id, ...d.data() }));
        } catch(e) { console.error(e); }

        // 2. publicTemplates
        try {
          const pubQ = query(collection(db, 'publicTemplates'), where('appType', '==', appType));
          const pubSnap = await getDocs(pubQ);
          pubSnap.forEach(d => results.push({ id: d.id, ...d.data() }));
        } catch(e) { console.error(e); }

        // 3. User's personal templates
        if (uid) {
          try {
            const userQ = query(collection(db, `users/${uid}/templates`), where('appType', '==', appType));
            const userSnap = await getDocs(userQ);
            userSnap.forEach(d => results.push({ id: d.id, ...d.data() }));
          } catch(e) { console.error(e); }
        }

        results.sort((a, b) => (a.order || 0) - (b.order || 0));
        setTemplates(results);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, [appType, uid]);

  const launchTemplate = async (template, projectName) => {
    if (!template.storageFullPath) {
      throw new Error("Invalid template: Missing storageFullPath");
    }

    try {
      const storage = getGlobalStorage();
      const storageRef = ref(storage, template.storageFullPath);
      const url = await getDownloadURL(storageRef);

      // Create a blob URL to enforce the custom filename download across origins
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch file data");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const ext = appType === 'rhino' ? '3dm' : 'blend';
      const defaultFileName = `${projectName}_v1.${ext}`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Cleanup
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
      return true;
    } catch (err) {
      console.error("Failed to launch template:", err);
      throw err;
    }
  };

  return {
    templates,
    loading,
    error,
    launchTemplate
  };
}
