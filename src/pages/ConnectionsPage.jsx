import React, { useState, useEffect } from "react";
import { Box, Typography, TextField, Avatar, Button, InputAdornment, Tabs, Tab } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { collection, query, getDocs, doc, deleteDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";

export default function ConnectionsPage() {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0); // 0: Following, 1: Followers, 2: Mutual, 3: Recommended
  
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [followingMap, setFollowingMap] = useState({});
  const [followerMap, setFollowerMap] = useState({});
  
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const qFollowing = query(collection(db, `users/${user.uid}/following`));
        const snapFollowing = await getDocs(qFollowing);
        
        const qFollowers = query(collection(db, `users/${user.uid}/followers`));
        const snapFollowers = await getDocs(qFollowers);

        const fMap = {};
        const followerM = {};
        const followingUsers = [];
        const followerUsers = [];

        for (const d of snapFollowing.docs) {
          fMap[d.id] = true;
          const ud = await getDoc(doc(db, "users", d.id));
          followingUsers.push(ud.exists() ? { id: ud.id, ...ud.data() } : { id: d.id, name: "Unknown User" });
        }

        for (const d of snapFollowers.docs) {
          followerM[d.id] = true;
          const ud = await getDoc(doc(db, "users", d.id));
          followerUsers.push(ud.exists() ? { id: ud.id, ...ud.data() } : { id: d.id, name: "Unknown User" });
        }

        // Fetch all users for recommendations (limiting to 20 for now)
        const qUsers = query(collection(db, "users"));
        const snapUsers = await getDocs(qUsers);
        const allUsers = [];
        snapUsers.docs.forEach(d => {
          if (d.id !== user.uid && !fMap[d.id]) {
            allUsers.push({ id: d.id, ...d.data() });
          }
        });

        // Generate dummy recommendation reasons
        const reasons = ["最近アクティブ", "共通の関心", "おすすめユーザー", "相互フォロー候補"];
        const recommendedUsers = allUsers.slice(0, 10).map((u, i) => ({
          ...u,
          reasonLabel: reasons[i % reasons.length]
        }));

        setFollowing(followingUsers);
        setFollowers(followerUsers);
        setRecommended(recommendedUsers);
        setFollowingMap(fMap);
        setFollowerMap(followerM);
      } catch (e) {
        console.error("Failed to fetch connections", e);
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
      
      // If they were already in our loaded data somewhere, update their state
      // (This avoids needing a full refetch just to update the UI)
      if (!following.find(u => u.id === targetId)) {
        const ud = await getDoc(doc(db, "users", targetId));
        if (ud.exists()) {
          setFollowing(prev => [...prev, { id: ud.id, ...ud.data() }]);
        }
      }
    } catch (e) {
      alert("フォロー失敗: " + e.message);
    }
  };

  const handleUnfollow = async (targetId) => {
    if (!user) return;
    if (!window.confirm("フォローを解除しますか？")) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/following`, targetId));
      await deleteDoc(doc(db, `users/${targetId}/followers`, user.uid));
      setFollowingMap(prev => { 
        const newMap = { ...prev }; 
        delete newMap[targetId]; 
        return newMap; 
      });
      setFollowing(prev => prev.filter(u => u.id !== targetId));
    } catch (e) {
      alert("解除失敗: " + e.message);
    }
  };

  // Determine which list to show based on tab
  let sourceList = [];
  if (tabIndex === 0) sourceList = following;
  else if (tabIndex === 1) sourceList = followers;
  else if (tabIndex === 2) sourceList = following.filter(u => followerMap[u.id]);
  else if (tabIndex === 3) sourceList = recommended;

  const filtered = sourceList.filter(u => 
    (u.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: 4, color: "white", flex: 1, overflowY: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>つながり管理</Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)", mb: 4 }}>
        あなたがプロジェクト等でフォローしている、またはあなたをフォローしているユーザーの一覧です。
      </Typography>

      <Tabs 
        value={tabIndex} 
        onChange={(e, val) => setTabIndex(val)} 
        sx={{ 
          mb: 3, 
          ".MuiTab-root": { color: "rgba(255,255,255,0.5)" },
          ".Mui-selected": { color: "#fff !important" },
          ".MuiTabs-indicator": { bgcolor: BRAND.primary }
        }}
      >
        <Tab label={`Following (${following.length})`} />
        <Tab label={`Followers (${followers.length})`} />
        <Tab label={`Mutual (${following.filter(u => followerMap[u.id]).length})`} />
        <Tab label="Recommended" />
      </Tabs>

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
        <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>ユーザーが見つかりません</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map(u => {
            const isFollowing = followingMap[u.id];
            const isFollower = followerMap[u.id];
            const isMutual = isFollowing && isFollower;

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
                    
                    {/* Status Badges */}
                    <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                      {isMutual && (
                        <Typography variant="caption" sx={{ color: BRAND.primary, fontWeight: "bold" }}>
                          相互フォロー
                        </Typography>
                      )}
                      {!isMutual && isFollower && (
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: "bold" }}>
                          フォロワー
                        </Typography>
                      )}
                      {tabIndex === 3 && u.reasonLabel && (
                        <Typography variant="caption" sx={{ color: "#e67e22", fontWeight: "bold", border: "1px solid #e67e22", borderRadius: 1, px: 0.5 }}>
                          {u.reasonLabel}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {/* Future: Team Invitation Button etc could go here */}
                  
                  {isFollowing ? (
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
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
