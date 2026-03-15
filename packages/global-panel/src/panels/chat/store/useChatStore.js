import { create } from "zustand";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const useChatStore = create((set, get) => ({
  threads: [],
  activeThreadId: null,
  messages: [],
  isLoading: false,
  error: null,
  db: null, // <-- injected Firebase DB
  functions: null, // <-- injected Firebase Functions

  _threadsUnsubscribe: null,
  _messagesUnsubscribe: null,

  /**
   * 1) Init (called by GlobalPanelHost with uid and db)
   */
  init: (uid, dbInstance, functionsInstance) => {
    if (!uid || !dbInstance || !functionsInstance) {
      get().resetStore();
      return;
    }
    // Save db and functions reference
    set({ db: dbInstance, functions: functionsInstance });

    // Only subscribe to threads once
    if (!get()._threadsUnsubscribe) {
       get().subscribeThreads(uid);
    }
  },

  /**
   * 2) Subscribe to threads (real-time list)
   */
  subscribeThreads: (uid) => {
    const { db } = get();
    get()._threadsUnsubscribe?.();
    set({ isLoading: true, error: null });

    const threadsRef = collection(db, "users", uid, "chatThreads");
    const threadsQuery = query(threadsRef, orderBy("updatedAt", "desc"));

    const unsub = onSnapshot(
      threadsQuery,
      (snapshot) => {
        const threadsData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        set({ threads: threadsData, isLoading: false });
      },
      (error) => {
        console.error("Failed to fetch chatThreads:", error);
        set({ error: error.message, isLoading: false });
      }
    );

    set({ _threadsUnsubscribe: unsub });
  },

  /**
   * 3) Select thread
   */
  selectThread: (threadId, uid) => {
    if (!uid) return;

    // Unsubscribe from previous messages if any
    get()._messagesUnsubscribe?.();

    if (!threadId) {
      set({ activeThreadId: null, messages: [], _messagesUnsubscribe: null });
      return;
    }

    set({ activeThreadId: threadId, messages: [], isLoading: true });
    get().subscribeMessages(threadId, uid);
  },

  /**
   * 4) Subscribe to messages for a thread
   */
  subscribeMessages: (threadId, uid) => {
    const { db } = get();
    const messagesRef = collection(db, "users", uid, "chatThreads", threadId, "messages");
    const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messagesData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        set({ messages: messagesData, isLoading: false });
      },
      (error) => {
        console.error(`Failed to fetch messages for thread ${threadId}:`, error);
        set({ error: error.message, isLoading: false });
      }
    );

    set({ _messagesUnsubscribe: unsub });
  },

  /**
   * 5) Send Message
   */
  sendMessage: async (text, uid) => {
    if (!text || !uid) return;

    let { activeThreadId, db, functions } = get();
    
    // Create thread if none active
    if (!activeThreadId) {
      activeThreadId = `thread_${Date.now()}`;
      const newThreadRef = doc(db, "users", uid, "chatThreads", activeThreadId);
      await setDoc(newThreadRef, {
        id: activeThreadId,
        title: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
        agentMode: "assistant", // default mode
        provider: "gemini",
        model: "gemini-2.5-flash",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageText: text,
        lastMessageAt: serverTimestamp(),
      });
      // Will auto-subscribe via threads listener, but let's select it immediately
      get().selectThread(activeThreadId, uid);
    } else {
      // Update existing thread's timestamp/preview
      const threadRef = doc(db, "users", uid, "chatThreads", activeThreadId);
      await setDoc(threadRef, {
        updatedAt: serverTimestamp(),
        lastMessageText: text,
        lastMessageAt: serverTimestamp(),
      }, { merge: true });
    }

    // Insert user message
    const msgIdUser = `msg_${Date.now()}`;
    const userMsgRef = doc(db, "users", uid, "chatThreads", activeThreadId, "messages", msgIdUser);
    await setDoc(userMsgRef, {
      id: msgIdUser,
      role: "user",
      text: text,
      status: "done",
      source: "user",
      createdAt: serverTimestamp(),
    });

    // Invoke Cloud Function AI Orchestrator
    try {
      const orchestratorFn = httpsCallable(functions, "runChatOrchestrator");
      await orchestratorFn({
        threadId: activeThreadId,
        agentMode: "assistant",
        provider: "gemini",
        model: "gemini-2.5-flash",
        context: {}
      });
    } catch (err) {
      console.error("AI Orchestrator Error:", err);
      // NOTE: The orchestrator handles updating the message to 'error' state inside Firestore,
      // so we don't necessarily need to perform local fallback state updates here.
      // The UI will re-render when the Firestore listener syncs the 'error' status.
      set({ error: "Failed to connect to AI background service." });
    }
  },

  /**
   * Reset store logic
   */
  resetStore: () => {
    get()._threadsUnsubscribe?.();
    get()._messagesUnsubscribe?.();
    set({
      threads: [],
      activeThreadId: null,
      messages: [],
      error: null,
      isLoading: false,
      _threadsUnsubscribe: null,
      _messagesUnsubscribe: null,
    });
  },
}));

export default useChatStore;
