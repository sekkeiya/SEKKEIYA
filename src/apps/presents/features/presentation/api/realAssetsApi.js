import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export const getRealAssetsFrom3DSS = async () => {
    try {
        const assetsRef = collection(db, 'assets');
        // Fetch most recent assets as a primer
        const q = query(assetsRef, orderBy('createdAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || 'Untitled 3DSS Asset',
                thumbnailUrl: data.thumbnailUrl || data.thumbnail || '',
                previewUrl: data.glbPath || data.modelUrl || data.url || '',
                description: data.description || '',
                metadata: {
                    type: data.type,
                    category: data.mainCategory
                },
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
            };
        });
    } catch (error) {
        console.error("Error fetching real 3DSS assets:", error);
        return [];
    }
};

export const getRealUploadedAssets = async () => {
    // TODO: implement Firestore fetching for user's direct uploads
    return [];
};
