import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, TextField, IconButton, Chip, LinearProgress } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";

const textFieldStyles = {
  "& .MuiOutlinedInput-root": {
    color: "#fff",
    bgcolor: "rgba(0,0,0,0.2)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
    "&.Mui-focused fieldset": { borderColor: "#00BFFF" },
  },
  "& .MuiInputBase-input": {
    color: "#fff"
  }
};

export function ConceptBlock({ meta, onChange, editMode }) {
  const [title, setTitle] = useState(meta?.conceptTitle || "");
  const [desc, setDesc] = useState(meta?.conceptDescription || "");

  useEffect(() => {
    setTitle(meta?.conceptTitle || "");
    setDesc(meta?.conceptDescription || "");
  }, [meta?.conceptTitle, meta?.conceptDescription]);

  const handleBlur = (field, value) => {
    if (meta[field] !== value) {
      onChange(field, value);
    }
  };

  if (!editMode) {
    return (
      <Box sx={{ px: 1 }}>
        <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, mb: 2, letterSpacing: "-0.5px" }}>
          {meta.conceptTitle || "コンセプト名が設定されていません"}
        </Typography>
        <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.8, fontSize: "1.05rem", whiteSpace: "pre-wrap" }}>
          {meta.conceptDescription || "詳細を記述することでプロジェクトのブレを防ぎます。"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, px: 1 }}>
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="コンセプト名、スローガンなど" value={title}
        onChange={(e) => setTitle(e.target.value)} 
        onBlur={() => handleBlur("conceptTitle", title)}
        sx={{ ...textFieldStyles, "& .MuiInputBase-input": { fontSize: "1.2rem", fontWeight: 800, py: 1.5 } }}
      />
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="具体的な詳細や背景について（なぜやるのか等）" multiline rows={6} value={desc}
        onChange={(e) => setDesc(e.target.value)} 
        onBlur={() => handleBlur("conceptDescription", desc)}
        sx={{ ...textFieldStyles, "& .MuiInputBase-input": { lineHeight: 1.6 } }}
      />
    </Box>
  );
}

// Wrapper for blocks that provides Move/Delete controls
function BlockWrapper({ children, isFirst, isLast, onMoveUp, onMoveDown, onDelete, editMode }) {
  return (
    <Paper sx={{ p: 2.5, bgcolor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, position: "relative", display: "flex", gap: 2, alignItems: "flex-start" }}>
      {editMode && (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, opacity: 0.5 }}>
          <DragIndicatorRoundedIcon fontSize="small" sx={{ mb: 1 }} />
          <IconButton size="small" disabled={isFirst} onClick={onMoveUp} sx={{ p: 0.5, color: "#fff" }}><ArrowUpwardRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={isLast} onClick={onMoveDown} sx={{ p: 0.5, color: "#fff" }}><ArrowDownwardRoundedIcon fontSize="small" /></IconButton>
        </Box>
      )}
      <Box sx={{ flex: 1 }}>
        {children}
      </Box>
      {editMode && (
        <IconButton size="small" onClick={onDelete} sx={{ color: "#ff4d4f", ml: 1 }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      )}
    </Paper>
  );
}

export function PersonaBlock({ block, onChange, isFirst, isLast, onMoveUp, onMoveDown, onDelete, editMode }) {
  const [profileName, setProfileName] = useState(block.profileName || "");
  const [traits, setTraits] = useState((block.traits || []).join(", "));

  useEffect(() => {
    setProfileName(block.profileName || "");
    setTraits((block.traits || []).join(", "));
  }, [block.profileName, block.traits]);

  const handleBlur = (field, value) => {
    onChange(block.id, field, value);
  };

  const handleTraitsBlur = () => {
    const arr = traits.split(",").map(s => s.trim()).filter(Boolean);
    onChange(block.id, "traits", arr);
  };

  const content = editMode ? (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="ペルソナ名 / 属性" value={profileName}
        onChange={(e) => setProfileName(e.target.value)} 
        onBlur={() => handleBlur("profileName", profileName)}
        sx={textFieldStyles}
      />
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="特徴・ニーズ（カンマ区切り）" value={traits}
        onChange={(e) => setTraits(e.target.value)} 
        onBlur={handleTraitsBlur}
        sx={textFieldStyles}
      />
    </Box>
  ) : (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: "#fa709a", fontWeight: 800, letterSpacing: 1.5, display: "block", mb: 0.5 }}>PERSONA</Typography>
      <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900, mb: 2, letterSpacing: "-0.5px" }}>
        {block.profileName || "名称未設定のペルソナ"}
      </Typography>
      
      {(!block.traits || block.traits.length === 0) ? (
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
          特徴・ニーズが未入力です。
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {(block.traits || []).map((t, idx) => (
            <Chip key={idx} label={t} size="medium" sx={{ bgcolor: "rgba(250, 112, 154, 0.08)", color: "#ffb199", fontSize: "0.85rem", fontWeight: 600, border: "1px solid rgba(250, 112, 154, 0.2)" }} />
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ 
      position: "relative",
      p: 3, 
      bgcolor: "rgba(0,0,0,0.2)", 
      border: "1px solid rgba(255,255,255,0.08)", 
      borderRadius: 4, 
      width: { xs: "100%", sm: "calc(50% - 16px)", md: "calc(33.333% - 21px)" },
      minWidth: 280,
      overflow: "hidden"
    }}>
      <Box sx={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, bgcolor: "rgba(250, 112, 154, 0.05)", borderRadius: "0 16px 0 100%" }} />
      {content}
    </Box>
  );
}

export function IssueBlock({ block, onChange, isFirst, isLast, onMoveUp, onMoveDown, onDelete, editMode }) {
  const [title, setTitle] = useState(block.title || "");
  const [description, setDescription] = useState(block.description || "");

  useEffect(() => {
    setTitle(block.title || "");
    setDescription(block.description || "");
  }, [block.title, block.description]);

  const handleBlur = (field, value) => {
    onChange(block.id, field, value);
  };

  const content = editMode ? (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="課題の件名" value={title}
        onChange={(e) => setTitle(e.target.value)} 
        onBlur={() => handleBlur("title", title)}
        sx={textFieldStyles}
      />
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="課題の詳細、未検討な背景など" multiline rows={3} value={description}
        onChange={(e) => setDescription(e.target.value)} 
        onBlur={() => handleBlur("description", description)}
        sx={textFieldStyles}
      />
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Chip 
          label="未解決 (Open)" 
          clickable 
          onClick={() => onChange(block.id, "status", "open")} 
          sx={{ bgcolor: block.status === "open" ? "rgba(255,77,79,0.3)" : "rgba(255,255,255,0.1)", color: block.status === "open" ? "#ff4d4f" : "#fff", fontWeight: 700 }} 
        />
        <Chip 
          label="解決済み (Resolved)" 
          clickable 
          onClick={() => onChange(block.id, "status", "resolved")} 
          sx={{ bgcolor: block.status === "resolved" ? "rgba(67,233,123,0.3)" : "rgba(255,255,255,0.1)", color: block.status === "resolved" ? "#43e97b" : "#fff", fontWeight: 700 }} 
        />
      </Box>
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", alignSelf: "center", mr: 1 }}>優先度:</Typography>
        <Chip 
          label="High" clickable onClick={() => onChange(block.id, "priority", "high")} 
          sx={{ bgcolor: block.priority === "high" ? "rgba(255,77,79,0.3)" : "rgba(255,255,255,0.1)", color: block.priority === "high" ? "#ff4d4f" : "#fff" }} 
        />
        <Chip 
          label="Med" clickable onClick={() => onChange(block.id, "priority", "medium")} 
          sx={{ bgcolor: block.priority === "medium" || !block.priority ? "rgba(246,211,101,0.3)" : "rgba(255,255,255,0.1)", color: block.priority === "medium" || !block.priority ? "#f6d365" : "#fff" }} 
        />
        <Chip 
          label="Low" clickable onClick={() => onChange(block.id, "priority", "low")} 
          sx={{ bgcolor: block.priority === "low" ? "rgba(79,172,254,0.3)" : "rgba(255,255,255,0.1)", color: block.priority === "low" ? "#4facfe" : "#fff" }} 
        />
      </Box>
    </Box>
  ) : (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
        <Chip 
          label={block.status === "resolved" ? "解決済み" : "未解決"} 
          size="small" 
          sx={{ 
            bgcolor: block.status === "resolved" ? "rgba(67,233,123,0.1)" : "rgba(255,77,79,0.15)", 
            color: block.status === "resolved" ? "#43e97b" : "#ff4d4f", 
            border: `1px solid ${block.status === "resolved" ? "rgba(67,233,123,0.3)" : "rgba(255,77,79,0.3)"}`,
            height: 24, fontSize: "0.75rem", fontWeight: 800, px: 0.5
          }} 
        />
        <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>
          {block.title || "名称未設定の課題"}
        </Typography>
        {block.priority === "high" && <Chip label="High" size="small" sx={{ bgcolor: "rgba(255,77,79,0.2)", color: "#ff4d4f", fontSize: "0.7rem", height: 20 }} />}
        {(!block.priority || block.priority === "medium") && <Chip label="Med" size="small" sx={{ bgcolor: "rgba(246,211,101,0.2)", color: "#f6d365", fontSize: "0.7rem", height: 20 }} />}
        {block.priority === "low" && <Chip label="Low" size="small" sx={{ bgcolor: "rgba(79,172,254,0.2)", color: "#4facfe", fontSize: "0.7rem", height: 20 }} />}
      </Box>
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 1, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {block.description || "詳細は入力されていません。"}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ 
      position: "relative",
      p: 3, 
      bgcolor: "rgba(0,0,0,0.2)", 
      border: "1px solid rgba(255,255,255,0.08)", 
      borderRadius: 4, 
      width: { xs: "100%", md: "calc(50% - 12px)" },
      minWidth: 300
    }}>
      {content}
    </Box>
  );
}

export function KPIBlock({ block, onChange, editMode, onMoveUp, onMoveDown, onDelete }) {
  const [metric, setMetric] = useState(block.metric || "");
  const [target, setTarget] = useState(block.target || "");
  const [current, setCurrent] = useState(block.current || "");

  useEffect(() => {
    setMetric(block.metric || "");
    setTarget(block.target || "");
    setCurrent(block.current || "");
  }, [block.metric, block.target, block.current]);

  const handleBlur = (field, value) => {
    onChange(block.id, field, value);
  };

  const getProgress = () => {
    const c = parseFloat(String(block.current).replace(/[^0-9.-]+/g, ""));
    const t = parseFloat(String(block.target).replace(/[^0-9.-]+/g, ""));
    if (isNaN(c) || isNaN(t) || t === 0) return 0;
    return Math.min(100, Math.max(0, (c / t) * 100));
  };
  const progStr = getProgress();

  const content = editMode ? (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <TextField 
        fullWidth variant="outlined" size="small" placeholder="KPI項目 (例: 年間売上)" value={metric}
        onChange={(e) => setMetric(e.target.value)} onBlur={() => handleBlur("metric", metric)}
        sx={textFieldStyles}
      />
      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField 
          fullWidth variant="outlined" size="small" placeholder="目標値" value={target}
          onChange={(e) => setTarget(e.target.value)} onBlur={() => handleBlur("target", target)}
          sx={textFieldStyles}
        />
        <TextField 
          fullWidth variant="outlined" size="small" placeholder="現在値" value={current}
          onChange={(e) => setCurrent(e.target.value)} onBlur={() => handleBlur("current", current)}
          sx={textFieldStyles}
        />
      </Box>
    </Box>
  ) : (
    <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", p: 2, position: "relative" }}>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase", mb: 1 }}>{block.metric || "未設定のKPI"}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 1 }}>
        <Typography variant="h4" sx={{ color: "#00BFFF", fontWeight: 900 }}>{block.current || "-"}</Typography>
        <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.4)" }}>/ {block.target || "-"}</Typography>
      </Box>
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: '100%' }}>
          <LinearProgress variant="determinate" value={progStr} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00BFFF', borderRadius: 3 } }} />
        </Box>
        <Typography variant="caption" sx={{ color: "#00BFFF", fontWeight: 700, minWidth: 35 }}>{Math.round(progStr)}%</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ 
      p: 2, bgcolor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, flex: 1, minWidth: 200 
    }}>
      {content}
    </Box>
  );
}
