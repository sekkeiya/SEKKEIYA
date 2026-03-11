import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import BoardSortBar from "../components/BoardSortBar";
import BoardFilterBar from "../components/BoardFilterBar";
import BoardItemsList from "../components/BoardItemsList";
import { useBoardItems } from "../hooks/useBoardItems";
import { useAuth } from "@/features/auth/context/AuthContext";
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

export default function GenericMediaTab({ board, itemCollection, emptyMessage = "データがありません" }) {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  
  const { items, loading, error } = useBoardItems({ 
    board, 
    itemCollection, 
    currentUserId 
  });

  const [searchValue, setSearchValue] = useState("");
  const [sortKey, setSortKey] = useState("latest");
  const [sortDir, setSortDir] = useState("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const filteredItems = items.filter(item => {
    if (!searchValue.trim()) return true;
    const q = searchValue.toLowerCase();
    const titleMatch = (item.snapshot?.title || "").toLowerCase().includes(q);
    const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
    return titleMatch || tagMatch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortKey === "latest") {
      return sortDir === "desc" 
        ? new Date(b.updatedAt) - new Date(a.updatedAt)
        : new Date(a.updatedAt) - new Date(b.updatedAt);
    }
    if (sortKey === "name") {
      return sortDir === "desc" 
        ? (b.snapshot?.title || "").localeCompare(a.snapshot?.title || "")
        : (a.snapshot?.title || "").localeCompare(b.snapshot?.title || "");
    }
    return 0;
  });

  const renderPreview = (item) => {
    const isVideo = itemCollection === "movies";
    return (
      <Box sx={{ position: "relative", pt: "75%", bgcolor: "#fff", overflow: "hidden" }}>
        {item.snapshot?.thumbnailUrl ? (
          <img 
            src={item.snapshot.thumbnailUrl} 
            alt={item.snapshot?.title || "Item"}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} 
          />
        ) : (
          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f0f0f0", color: "#999" }}>
            No Image
          </Box>
        )}
        
        {isVideo && (
          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.2)"}}>
            <PlayCircleOutlineIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.8)" }} />
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", pt: 2 }}>
      <BoardSortBar 
        totalCount={filteredItems.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortKey={sortKey} 
        setSortKey={setSortKey}
        sortDir={sortDir} 
        setSortDir={setSortDir}
        filterCount={0}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />

      {filtersOpen && (
        <BoardFilterBar filters={{}} setFilters={() => {}} />
      )}

      {error ? (
        <Typography color="error" sx={{ my: 4 }}>データの取得に失敗しました: {error.message}</Typography>
      ) : (
        <BoardItemsList 
          items={sortedItems} 
          loading={loading} 
          emptyMessage={emptyMessage}
          renderPreview={renderPreview}
        />
      )}
    </Box>
  );
}
