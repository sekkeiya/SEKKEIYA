import React, { useMemo, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Chip,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

/**
 * bases: [{ id, name, plans:[{ id, name, options:[{id,name}] }]}]
 * selected: { baseId, planId, optionId }
 * onSelect: ({ baseId, planId, optionId }) => void
 */
export default function ViewerBasePlanOptionTree({ bases = [], selected, onSelect }) {
  const theme = useTheme();
  const border = alpha(theme.palette.common.white, 0.08);

  const selBaseId = selected?.baseId || null;
  const selPlanId = selected?.planId || null;
  const selOptionId = selected?.optionId || null;

  const safeBases = useMemo(() => (Array.isArray(bases) ? bases : []), [bases]);

  const handleSelectBase = useCallback(
    (base) => {
      const firstPlan = base?.plans?.[0] || null;
      const firstOpt = firstPlan?.options?.[0] || null;

      onSelect?.({
        baseId: base?.id || null,
        planId: firstPlan?.id || null,
        optionId: firstOpt?.id || null,
      });
    },
    [onSelect]
  );

  const handleSelectPlan = useCallback(
    (base, plan) => {
      const firstOpt = plan?.options?.[0] || null;
      onSelect?.({
        baseId: base?.id || null,
        planId: plan?.id || null,
        optionId: firstOpt?.id || null,
      });
    },
    [onSelect]
  );

  const handleSelectOption = useCallback(
    (base, plan, opt) => {
      onSelect?.({
        baseId: base?.id || null,
        planId: plan?.id || null,
        optionId: opt?.id || null,
      });
    },
    [onSelect]
  );

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
            全プラン（自由切替）
          </Typography>

          <Chip
            size="small"
            label={`Base:${selBaseId ? 1 : 0} Plan:${selPlanId ? 1 : 0} Opt:${selOptionId ? 1 : 0}`}
            sx={{ opacity: 0.75 }}
          />
        </Stack>

        <Divider sx={{ opacity: 0.2 }} />

        {safeBases.length === 0 ? (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            切替用のデータがありません（share doc の catalog を確認してください）
          </Typography>
        ) : (
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {safeBases.map((b) => {
              const openBase = b?.id && b.id === selBaseId;

              return (
                <Box key={b.id} sx={{ borderBottom: `1px solid ${border}`, pb: 0.5, mb: 0.5 }}>
                  {/* Base */}
                  <ListItemButton
                    onClick={() => handleSelectBase(b)}
                    selected={openBase}
                    sx={{ borderRadius: 1 }}
                  >
                    {openBase ? (
                      <ExpandMoreRoundedIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                    ) : (
                      <ChevronRightRoundedIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                    )}
                    <ListItemText
                      primary={`Base: ${b.name || b.id}`}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }}
                    />
                  </ListItemButton>

                  {/* Plans */}
                  <Collapse in={openBase} timeout="auto" unmountOnExit>
                    <List dense disablePadding sx={{ pl: 2 }}>
                      {(b.plans || []).map((p) => {
                        const openPlan = p?.id && p.id === selPlanId;

                        return (
                          <Box key={p.id} sx={{ mt: 0.25 }}>
                            <ListItemButton
                              onClick={() => handleSelectPlan(b, p)}
                              selected={openPlan}
                              sx={{ borderRadius: 1 }}
                            >
                              {openPlan ? (
                                <ExpandMoreRoundedIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                              ) : (
                                <ChevronRightRoundedIcon fontSize="small" sx={{ mr: 1, opacity: 0.8 }} />
                              )}
                              <ListItemText
                                primary={`Plan: ${p.name || p.id}`}
                                primaryTypographyProps={{ fontSize: 13, fontWeight: 650 }}
                              />
                            </ListItemButton>

                            {/* Options */}
                            <Collapse in={openPlan} timeout="auto" unmountOnExit>
                              <List dense disablePadding sx={{ pl: 2 }}>
                                {(p.options || []).map((o) => {
                                  const isSel = o?.id && o.id === selOptionId;
                                  return (
                                    <ListItemButton
                                      key={o.id}
                                      onClick={() => handleSelectOption(b, p, o)}
                                      selected={isSel}
                                      sx={{ borderRadius: 1 }}
                                    >
                                      <ListItemText
                                        primary={`Option: ${o.name || o.id}`}
                                        primaryTypographyProps={{ fontSize: 12.5, opacity: 0.95 }}
                                      />
                                    </ListItemButton>
                                  );
                                })}
                              </List>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        )}
      </Stack>
    </Box>
  );
}
