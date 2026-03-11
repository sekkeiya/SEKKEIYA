import React, { useState } from "react";
import { Box } from "@mui/material";
import SearchBar from "@/features/search/components/SearchBar";
import { BRAND } from "@/shared/ui/theme";

export default function AiSearchBar({ scope = "global", projectId = null }) {
  const [q, setQ] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;

    if (scope === "global") {
      console.log(`[AI Command - Global] query:`, query);
      // Global search / command execution (to be implemented)
    } else if (scope === "project") {
      console.log(`[AI Command - Project ${projectId}] query:`, query);
      // Project-specific chat / generation (to be implemented)
    }
    
    setQ(""); // 実行後にクリア
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 860, mx: "auto" }}>
      <SearchBar q={q} setQ={setQ} onSubmit={handleSubmit} brand={BRAND} />
    </Box>
  );
}
