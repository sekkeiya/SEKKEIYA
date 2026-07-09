// src/features/layout/LayoutViewer/LeftSidebar/ViewerAllPlansTree.jsx
import React, { useMemo, useState } from "react";
import { Box, Collapse, Stack, Typography, List, ListItemButton, ListItemText } from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

export default function ViewerAllPlansTree({
  bases,
  plansByBase,
  allowBrowseAll,
  selected,
  onSelect,
}) {
  const [openBaseIds, setOpenBaseIds] = useState(() => new Set());

  const basesSafe = useMemo(() => bases || [], [bases]);

  if (!allowBrowseAll) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2">全プラン</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          この共有リンクでは “推奨プランのみ” 表示です
        </Typography>
      </Box>
    );
  }

  const toggleBase = (baseId) => {
    setOpenBaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(baseId)) next.delete(baseId);
      else next.add(baseId);
      return next;
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        全プラン（自由切替）
      </Typography>

      <List dense disablePadding>
        {basesSafe.map((base) => {
          const open = openBaseIds.has(base.id) || selected.baseId === base.id;
          const plans = plansByBase?.[base.id] || [];
          return (
            <Box key={base.id} sx={{ mb: 1 }}>
              <ListItemButton onClick={() => toggleBase(base.id)} sx={{ borderRadius: 1 }}>
                {open ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
                <ListItemText
                  primary={`Base: ${base.name || base.id}`}
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>

              <Collapse in={open} timeout="auto" unmountOnExit>
                <Stack spacing={0.5} sx={{ pl: 3, pt: 0.5 }}>
                  {plans.length === 0 ? (
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Plan がありません
                    </Typography>
                  ) : (
                    plans.map((plan) => {
                      const active = selected.baseId === base.id && selected.planId === plan.id;
                      return (
                        <ListItemButton
                          key={plan.id}
                          selected={active}
                          onClick={() => onSelect({ baseId: base.id, planId: plan.id })}
                          sx={{ borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={`Plan: ${plan.name || plan.id}`}
                            primaryTypographyProps={{ variant: "body2" }}
                          />
                        </ListItemButton>
                      );
                    })
                  )}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </List>
    </Box>
  );
}
