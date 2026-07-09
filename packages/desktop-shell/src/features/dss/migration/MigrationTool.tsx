import { useState } from 'react';
import { Box, Button, Typography, LinearProgress, Alert } from '@mui/material';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';

export const MigrationTool = () => {
  const { projects } = useAppStore();
  const { currentUser: user } = useAuthStore();
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const targetProjectId = projects?.length > 0 ? projects.find(p => p.ownerId === user?.uid)?.id || projects[0].id : null;

  const handleMigration = async () => {
    if (!user?.uid) {
      setErrorMsg('User not logged in.');
      return;
    }
    if (!targetProjectId) {
      setErrorMsg('No target project found. Please create a project first.');
      return;
    }

    setIsMigrating(true);
    setErrorMsg('');
    setStatusMsg('Fetching legacy models...');
    setProgress(0);

    try {
      // 1. Fetch old models
      const legacyRef = collection(db, 'users', user.uid, 'models');
      const snapshot = await getDocs(legacyRef);
      
      if (snapshot.empty) {
        setStatusMsg('No legacy models found. Migration not needed.');
        setIsMigrating(false);
        return;
      }

      const docs = snapshot.docs;
      setStatusMsg(`Found ${docs.length} models. Starting migration...`);

      let completed = 0;
      for (const modelDoc of docs) {
        const data = modelDoc.data();
        const modelId = modelDoc.id;

        const assetId = modelId; // reuse ID
        
        // 2. Write to unified assets
        const itemType = data.type || 'Object';
        const itemFormat = data.ext || 'glb';
        
        const assetData = {
          id: assetId,
          name: data.title || data.originalFilename || 'Legacy Model',
          type: '3d-model',
          format: itemFormat,
          sizeBytes: data.originalFileSize || 0,
          storagePath: data.files?.glb?.path || data.files?.blend?.path || '',
          downloadUrl: data.files?.glb?.url || data.files?.blend?.url || data.glbUrl || data.url || '',
          thumbnailUrl: data.thumbnailUrl || '',
          createdAt: data.createdAt || new Date().toISOString(),
          source: 'legacy_migration'
        };

        await setDoc(doc(db, `projects/${targetProjectId}/assets`, assetId), assetData, { merge: true });

        // 3. Write to unified Workspace Items
        const itemData = {
           id: modelId,
           itemType: '3DSS',
           type: 'model',
           workspaceType: '3dss',
           projectId: targetProjectId,
           workspaceId: 'models',
           ownerId: user.uid,
           visibility: data.visibility || 'public',
           modelType: itemType,
           category: data.mainCategory || data.category || 'Uncategorized',
           tags: data.tags || [],
           assetId: assetId,
           title: data.title || data.originalFilename || 'Legacy Model',
           name: data.title || data.originalFilename || 'Legacy Model',
           originalFilename: data.originalFilename || '',
           originalFileSize: data.originalFileSize || 0,
           createdAt: data.createdAt || new Date().toISOString(),
           updatedAt: data.updatedAt || new Date().toISOString(),
           extendedMetadata: {
             dimensions: data.dimensions || null,
             ai: data.ai || null
           }
        };

        await setDoc(doc(db, `projects/${targetProjectId}/workspaces/models/items`, modelId), itemData, { merge: true });

        completed++;
        setProgress(Math.round((completed / docs.length) * 100));
        setStatusMsg(`Migrating: ${completed} / ${docs.length}`);
      }

      setStatusMsg('Migration completed successfully!');
    } catch (err: any) {
      console.error('Migration failed:', err);
      setErrorMsg(err.message || 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Box sx={{ p: 2, mb: 3, border: '1px solid #ffb74d', borderRadius: 2, bgcolor: 'rgba(255, 183, 77, 0.1)' }}>
      <Typography variant="h6" color="#ffb74d" gutterBottom>
        ⚠️ Legacy Model Migration (Admin)
      </Typography>
      <Typography variant="body2" color="rgb(var(--brand-fg-rgb) / 0.7)" sx={{ mb: 2 }}>
        Move old models from <code>users/{user?.uid}/models</code> to <code>projects/{targetProjectId}/workspaces/models/items</code>.
        This enables cross-project searching and unifies the data structure.
      </Typography>
      
      {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
        <Button 
          variant="contained" 
          color="warning" 
          onClick={handleMigration} 
          disabled={isMigrating || !user}
        >
          {isMigrating ? 'Migrating...' : 'Run Migration'}
        </Button>
        <Typography variant="body2">{statusMsg}</Typography>
      </Box>

      {isMigrating && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}
    </Box>
  );
};
