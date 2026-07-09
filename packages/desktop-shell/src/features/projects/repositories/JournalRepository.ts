import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  FirestoreError,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/client';
import type { JournalEntry, JournalEntryDoc } from '../types';

export class JournalRepository {
  /**
   * Uploads an attachment to Firebase Storage and returns the public download URL.
   */
  static async uploadAttachment(projectId: string, file: File): Promise<string> {
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const fileName = `${uniqueId}.${fileExtension}`;
    const storageRef = ref(storage, `projects/${projectId}/journals/attachments/${fileName}`);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
  /**
   * Adds a new journal entry to the specified project.
   */
  static async addJournalEntry(projectId: string, entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>): Promise<string> {
    const journalRef = doc(collection(db, 'projects', projectId, 'journals'));
    const id = journalRef.id;

    const docData: JournalEntryDoc = {
      projectId,
      authorId: entryData.authorId,
      content: entryData.content,
      aiContextSnapshot: entryData.aiContextSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (entryData.title) docData.title = entryData.title;
    if (entryData.excerpt) docData.excerpt = entryData.excerpt;
    if (entryData.tags) docData.tags = entryData.tags;
    if (entryData.embeddingState) docData.embeddingState = entryData.embeddingState;

    const batch = writeBatch(db);
    batch.set(journalRef, docData);
    batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
    await batch.commit();

    return id;
  }

  /**
   * Subscribes to the most recent journal entries for a project.
   */
  static subscribeToRecentJournals(
    projectId: string, 
    maxCount: number, 
    onUpdate: (entries: JournalEntry[]) => void, 
    onError?: (error: FirestoreError) => void
  ): () => void {
    const q = query(
      collection(db, 'projects', projectId, 'journals'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );

    return onSnapshot(q, (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as JournalEntryDoc;
        if (data.isDeleted) return; // Soft delete filter
        
        entries.push({
          id: docSnap.id,
          projectId: data.projectId,
          authorId: data.authorId,
          content: data.content,
          title: data.title,
          excerpt: data.excerpt,
          aiContextSnapshot: data.aiContextSnapshot,
          tags: data.tags,
          embeddingState: data.embeddingState,
          isDeleted: data.isDeleted,
          createdAt: data.createdAt && typeof data.createdAt !== 'string' && 'toDate' in data.createdAt
            ? (data.createdAt as any).toDate().toISOString() 
            : (data.createdAt as string) || new Date().toISOString(),
          updatedAt: data.updatedAt && typeof data.updatedAt !== 'string' && 'toDate' in data.updatedAt
            ? (data.updatedAt as any).toDate().toISOString() 
            : (data.updatedAt as string) || new Date().toISOString(),
        });
      });
      onUpdate(entries);
    }, (error) => {
      if (onError) onError(error);
      else console.error("Failed to subscribe to journals:", error);
    });
  }

  /**
   * Updates an existing journal entry.
   */
  static async updateJournalEntry(projectId: string, entryId: string, updates: { content?: string; title?: string; excerpt?: string }): Promise<void> {
    const journalRef = doc(db, 'projects', projectId, 'journals', entryId);
    const batch = writeBatch(db);
    batch.update(journalRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
    await batch.commit();
  }

  /**
   * Soft deletes a journal entry.
   */
  static async deleteJournalEntry(projectId: string, entryId: string, userId: string): Promise<void> {
    const journalRef = doc(db, 'projects', projectId, 'journals', entryId);
    const batch = writeBatch(db);
    batch.update(journalRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
    await batch.commit();
  }
}
