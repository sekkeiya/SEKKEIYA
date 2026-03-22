import React, { useState, useEffect } from "react";
import { Box, Typography, TextField, Avatar, Button, InputAdornment } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { collection, query, getDocs, doc, deleteDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";

export default function FollowersPage() {
  const { user } = useAuth();
  const [followers, setFollowers] = useState([]);
  const [followingMap, setFollowingMap] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // Fetch followers
        const qFollowers = query(collection(db, `users/${user.uid}/followers`));
        const snapFollowers = await getDocs(qFollowers);
        const users = [];
        for (const docSnap of snapFollowers.docs) {
          const ud = await getDoc(doc(db, "users", docSnap.id));
          if (ud.exists()) {
            users.push({ id: ud.id, ...ud.data() });
          } else {
            users.push({ id: docSnap.id, name: "Unknown User" });
          }
        }
        setFollowers(users);

        // Fetch whom I follow to know mutual status
        const qFollowing = query(collection(db, `users/${user.uid}/following`));
        const snapFollowing = await getDocs(qFollowing);
        const fMap = {};
        snapFollowing.docs.forEach(d => { fMap[d.id] = true; });
        setFollowingMap(fMap);
      } catch (e) {
        console.error("Failed to fetch followers", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleFollow = async (targetId) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/following`, targetId), { createdAt: serverTimestamp() });
      await setDoc(doc(db, `users/${targetId}/followers`, user.uid), { createdAt: serverTimestamp() });
      setFollowingMap(prev => ({ ...prev, [targetId]: true }));
    } catch (e) {
      alert("フォロー失敗: " + e.message);
    }
  };

  const handleUnfollow = async (targetId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/following`, targetId));
      await deleteDoc(doc(db, `users/${targetId}/followers`, user.uid));
      setFollowingMap(prev => { 
        const newMap = { ...prev }; 
        delete newMap[targetId]; 
        return newMap; 
      });
    } catch (e) {
      alert("解除失敗: " + e.message);
    }
  };

  const filtered = followers.filter(u => 
    (u.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: 4, color: "white", flex: 1, overflowY: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>フォロワー管理</Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)", mb: 4 }}>
        あなたをフォローしているユーザーの一覧です。
      </Typography>

      <TextField
        fullWidth
        placeholder="ユーザー名で検索"
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{
          mb: 4,
          bgcolor: "rgba(255,255,255,0.05)",
          borderRadius: 2,
          input: { color: "white" },
          "& fieldset": { display: "none" }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ color: "rgba(255,255,255,0.5)" }} />
            </InputAdornment>
          ),
        }}
      />

      {loading ? (
        <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>読み込み中...</Typography>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>フォロワーはいません</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map(u => {
            const isMutual = followingMap[u.id];
            return (
              <Box 
                key={u.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 2,
                  bgcolor: "rgba(255,255,255,0.05)",
                  borderRadius: 2,
                  border: `1px solid ${BRAND.line}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={u.photoURL} sx={{ width: 48, height: 48 }} />
                  <Box>
                    <Typography variant="body1" fontWeight="bold">
                      {u.name || "名称未設定ユーザー"}
                    </Typography>
                    {u.email && <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>{u.email}</Typography>}
                    {isMutual && (
                      <Typography variant="caption" sx={{ color: BRAND.primary, fontWeight: "bold", mt: 0.5, display: "block" }}>
                        相互フォロー
                      </Typography>
                    )}
                  </Box>
                </Box>
                {isMutual ? (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handleUnfollow(u.id)}
                    sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.3)" }}
                  >
                    フォロー中
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    size="small" 
                    onClick={() => handleFollow(u.id)}
                    sx={{ bgcolor: BRAND.primary }}
                  >
                    フォローする
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
