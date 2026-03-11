import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import BoardSortBar from "../components/BoardSortBar";
import BoardFilterBar from "../components/BoardFilterBar";
import BoardItemsList from "../components/BoardItemsList";
import { useBoardItems } from "../hooks/useBoardItems";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function ModelsTab({ board }) {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  
  const { items, loading, error } = useBoardItems({ 
    board, 
    itemCollection: "models", 
    currentUserId 
  });

  const [searchValue, setSearchValue] = useState("");
  const [sortKey, setSortKey] = useState("latest");
  const [sortDir, setSortDir] = useState("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // NOTE: Client-side sorting/filtering can be applied to `items` here
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
    return (
      <Box sx={{ position: "relative", pt: "75%", bgcolor: "#fff", overflow: "hidden" }}>
        <img 
          src={item.snapshot?.thumbnailUrl || "/assets/placeholder-image.png"} 
          alt={item.snapshot?.title || "Item"}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", padding: "16px" }} 
        />
        
        {/* Top Left Badge: File Type & Size */}
        {item.meta?.fileType && (
          <Box 
            sx={{ position: "absolute", top: 8, left: 8, bgcolor: "rgba(0,0,0,0.7)", color: "#fff", px: 1, py: 0.5, borderRadius: 1, fontSize: "0.65rem", fontWeight: 700 }} 
          >
            {item.meta.fileType} {item.meta.size ? (item.meta.size / 1024 / 1024).toFixed(2) + " MB" : ""}
          </Box>
        )}

        {/* Top Right Box: Dimensions */}
        {item.meta?.dimensions && (item.meta.dimensions.w || item.meta.dimensions.d || item.meta.dimensions.h) && (
          <Box sx={{ position: "absolute", top: 8, right: 8, p: 1, bgcolor: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 1, lineHeight: 1.2 }}>
            <Typography variant="caption" sx={{ display: "block", fontSize: "0.6rem", opacity: 0.8, mb: 0.5 }}>size:</Typography>
            <Typography variant="caption" sx={{ display: "block", fontSize: "0.65rem", fontWeight: 700 }}>W: {item.meta.dimensions.w}</Typography>
            <Typography variant="caption" sx={{ display: "block", fontSize: "0.65rem", fontWeight: 700 }}>D: {item.meta.dimensions.d}</Typography>
            <Typography variant="caption" sx={{ display: "block", fontSize: "0.65rem", fontWeight: 700 }}>H: {item.meta.dimensions.h}</Typography>
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
        <Typography color="error" sx={{ my: 4 }}>モデルの取得に失敗しました: {error.message}</Typography>
      ) : (
        <BoardItemsList 
          items={sortedItems} 
          loading={loading} 
          emptyMessage="まだモデルがありません"
          renderPreview={renderPreview}
        />
      )}
    </Box>
  );
}
