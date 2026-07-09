import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getGlobalDb } from "../api/firebaseDb";

const getTimestampTime = (val) => {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

const normalizeAndSort = (arr) => {
  return arr.sort((a, b) => {
    const at = getTimestampTime(b?.createdAt);
    const bt = getTimestampTime(a?.createdAt);
    return bt - at;
  });
};

const useProjects = (userId) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef({});

  const subscribeToProjects = useCallback(() => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    unsubscribeRef.current = {};

    // In v3 unified schema, projects are stored in the "projects" collection
    const projectsRef = collection(getGlobalDb(), "projects");

    const ownerQuery = query(projectsRef, where("ownerId", "==", userId));
    const memberQuery = query(projectsRef, where("memberIds", "array-contains", userId));

    let fetchedOwner = [];
    let fetchedMember = [];

    const flushProjects = () => {
      const mergedMap = new Map();
      fetchedOwner.forEach(p => { if (!p.deletedAt && !p.isDeleted) mergedMap.set(p.id, p) });
      fetchedMember.forEach(p => { if (!p.deletedAt && !p.isDeleted) mergedMap.set(p.id, p) });
      
      const allProjects = Array.from(mergedMap.values());
      setProjects(normalizeAndSort(allProjects));
      setLoading(false);
    };

    unsubscribeRef.current.owner = onSnapshot(ownerQuery, (snap) => {
      fetchedOwner = snap.docs.map(d => ({ id: d.id, ...d.data(), isOwner: true }));
      flushProjects();
    }, (err) => {
      console.error("[useProjects] Owner read error:", err);
      delete unsubscribeRef.current.owner;
      fetchedOwner = [];
      flushProjects();
    });

    unsubscribeRef.current.member = onSnapshot(memberQuery, (snap) => {
      fetchedMember = snap.docs.map(d => ({ id: d.id, ...d.data(), isOwner: d.data().ownerId === userId }));
      flushProjects();
    }, (err) => {
      console.error("[useProjects] Member read error:", err);
      delete unsubscribeRef.current.member;
      fetchedMember = [];
      flushProjects();
    });

  }, [userId]);

  useEffect(() => {
    subscribeToProjects();
    return () => {
      Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
      unsubscribeRef.current = {};
    };
  }, [subscribeToProjects]);

  return {
    projects,
    loading,
    refreshProjects: subscribeToProjects,
  };
};

export default useProjects;
