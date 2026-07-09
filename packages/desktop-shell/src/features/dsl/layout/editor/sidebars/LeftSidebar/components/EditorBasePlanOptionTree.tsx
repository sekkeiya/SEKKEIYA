import { useMemo, useCallback, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useWorkspaceStructureStore } from "../../../../store/useWorkspaceStructureStore";
import { useAppStore } from "../../../../../../../store/useAppStore";

export default function EditorBasePlanOptionTree() {
  const theme = useTheme();
  const border = alpha(theme.palette.common.white, 0.08);

  const bases = useWorkspaceStructureStore((s: any) => s.bases);
  const plansOfSelectedBase = useWorkspaceStructureStore((s: any) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s: any) => s.options);

  const selectedBaseId = useWorkspaceStructureStore((s: any) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s: any) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s: any) => s.selectedOptionId);

  const selectBase = useWorkspaceStructureStore((s: any) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s: any) => s.selectPlan);
  const selectOption = useWorkspaceStructureStore((s: any) => s.selectOption);

  const createBase = useWorkspaceStructureStore((s: any) => s.createBase);
  const createPlan = useWorkspaceStructureStore((s: any) => s.createPlan);
  const createOption = useWorkspaceStructureStore((s: any) => s.createOption);

  const duplicateBase = useWorkspaceStructureStore((s: any) => s.duplicateBase);
  const duplicatePlan = useWorkspaceStructureStore((s: any) => s.duplicatePlan);
  const duplicateOption = useWorkspaceStructureStore((s: any) => s.duplicateOption);

  const openConfirm = useWorkspaceStructureStore((s: any) => s.openConfirm);
  const closeConfirm = useWorkspaceStructureStore((s: any) => s.closeConfirm);
  const confirm = useWorkspaceStructureStore((s: any) => s.confirm);
  const deleteBase = useWorkspaceStructureStore((s: any) => s.deleteBase);
  const deletePlan = useWorkspaceStructureStore((s: any) => s.deletePlan);
  const deleteOption = useWorkspaceStructureStore((s: any) => s.deleteOption);

  const goToDashboard = useWorkspaceStructureStore((s: any) => s.goToDashboard);

  const activeProjectId = useAppStore((s: any) => s.activeProjectId);
  const activeProjectName = useAppStore((s: any) => s.projects?.find((p: any) => p.id === activeProjectId)?.name ?? null);

  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirm?.open || !confirm?.targetId || deleting) return;
    setDeleting(true);
    try {
      if (confirm.type === "base") await deleteBase?.(confirm.targetId);
      else if (confirm.type === "plan") await deletePlan?.(confirm.targetId);
      else if (confirm.type === "option") await deleteOption?.(confirm.targetId);
      closeConfirm?.();
    } catch (e) {
      console.error("[EditorBasePlanOptionTree] delete failed:", e);
    } finally {
      setDeleting(false);
    }
  }, [confirm, deleting, deleteBase, deletePlan, deleteOption, closeConfirm]);

  const askDelete = useCallback(
    (type: string, targetId: string, labelForHuman: string) => {
      if (!openConfirm || !targetId) return;
      const title = type === "base" ? "Delete Base" : type === "plan" ? "Delete Plan" : "Delete Option";
      openConfirm({
        type,
        targetId,
        title,
        description: `「${labelForHuman || targetId}」を削除しますか？（この操作は取り消せません）`,
      });
    },
    [openConfirm]
  );

  const safeBases = useMemo(() => (Array.isArray(bases) ? bases : []), [bases]);
  const safePlans = useMemo(() => (Array.isArray(plansOfSelectedBase) ? plansOfSelectedBase : []), [plansOfSelectedBase]);
  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);

  const handleSelectBase = useCallback(
    (baseId: string) => {
      if (!baseId) return;
      // Base クリックは常に「Base（躯体）のみ表示」へ。
      // 同じ Base でも Plan / Option の選択を解除する（selectBase → onSelectBase が子をクリア）。
      selectBase(baseId);
    },
    [selectBase]
  );

  const handleSelectPlan = useCallback(
    (planId: string) => {
      if (planId && planId !== selectedPlanId) selectPlan(planId);
    },
    [selectPlan, selectedPlanId]
  );

  const handleSelectOption = useCallback(
    (optionId: string) => {
      if (optionId && optionId !== selectedOptionId) selectOption(optionId);
    },
    [selectOption, selectedOptionId]
  );


  // Options are hidden by default; expanded per-Plan only when the user wants to
  // examine material variations.
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});
  const togglePlanExpanded = useCallback((planId: string) => {
    setExpandedPlanIds((prev) => ({ ...prev, [planId]: !prev[planId] }));
  }, []);

  return (
    <Box sx={{ px: 1.5, py: 1, height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <Stack spacing={0.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Tooltip title="Layout Dashboard に戻る" placement="top">
            <ListItemButton
              onClick={() => goToDashboard && goToDashboard()}
              disableRipple
              sx={{ p: 0, '&:hover': { bgcolor: 'transparent', '& .project-name': { color: '#fff', textDecoration: 'underline' } }, width: 'auto', flexGrow: 0 }}
            >
              <Typography className="project-name" variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2, transition: 'color 0.15s' }}>
                {activeProjectName || "Project"}
              </Typography>
            </ListItemButton>
          </Tooltip>
          <Tooltip title="New Base" placement="top">
            <IconButton size="small" onClick={() => createBase && createBase()}>
              <AddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ opacity: 0.2 }} />

        <Collapse in timeout="auto">
          {safeBases.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.7, px: 1 }}>
              No bases available. Click + to create.
            </Typography>
          ) : (
          <List dense disablePadding sx={{ mt: 0.25 }}>
            {safeBases.map((b) => {
              const openBase = b?.id && b.id === selectedBaseId;
              const humanBaseName = b.name || "Unnamed Base";

              return (
                <Box key={b.id} sx={{ borderBottom: `1px solid ${border}`, pb: 0.25, mb: 0.25 }}>
                  {/* === Base === */}
                  <Stack direction="row" alignItems="center" sx={{ pr: 1 }}>
                    <ListItemButton
                      onClick={() => handleSelectBase(b.id)}
                      selected={openBase}
                      sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 28 }}
                    >
                      <ListItemText
                        primary={`Base: ${humanBaseName}`}
                        primaryTypographyProps={{ fontSize: 12.5, fontWeight: openBase ? 700 : 500, lineHeight: 1.2 }}
                      />
                    </ListItemButton>
                    {/* Action icons appear on hover ideally, but always visible is safer for MVP */}
                    <Box sx={{ display: "flex", gap: 0.25, opacity: openBase ? 1 : 0.3 }}>
                      <IconButton size="small" onClick={() => duplicateBase?.(b.id)} sx={{ p: 0.25 }}>
                        <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => askDelete("base", b.id, humanBaseName)} sx={{ p: 0.25 }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  </Stack>

                  {openBase && !b?.glbUrl && !b?.roomSpec && (
                    <Typography variant="caption" sx={{ pl: 2, opacity: 0.5, fontSize: 10 }}>
                      躯体モデル未設定 — キャンバスでモデルを選択
                    </Typography>
                  )}

                  {/* === Plans (always shown for selected base) === */}
                  {openBase && (
                  <List dense disablePadding sx={{ pl: 1.5, pt: 0.25 }}>
                    <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ pr: 1, mb: 0.25 }}>
                      <Tooltip title="このベースに新しいプランを追加" placement="top">
                        <IconButton size="small" onClick={() => createPlan?.(b.id)} sx={{ padding: '2px' }}>
                          <AddRoundedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    {safePlans.map((p) => {
                        const openPlan = p?.id && p.id === selectedPlanId;
                        const humanPlanName = p.name || "Unnamed Plan";
                        const optionsExpanded = !!expandedPlanIds[p.id];

                        return (
                          <Box key={p.id} sx={{ mt: 0 }}>
                            <Stack direction="row" alignItems="center" sx={{ pr: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => togglePlanExpanded(p.id)}
                                sx={{ p: 0.25, color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}
                              >
                                {optionsExpanded ? (
                                  <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                              <ListItemButton
                                onClick={() => handleSelectPlan(p.id)}
                                selected={openPlan}
                                sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 28 }}
                              >
                                <ListItemText
                                  primary={`Plan: ${humanPlanName}`}
                                  primaryTypographyProps={{ fontSize: 12.5, fontWeight: openPlan ? 700 : 500, lineHeight: 1.2 }}
                                />
                              </ListItemButton>
                              <Box sx={{ display: "flex", gap: 0.25, opacity: openPlan ? 1 : 0.3 }}>
                                <IconButton size="small" onClick={() => duplicatePlan?.(p.id)} sx={{ p: 0.25 }}>
                                  <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => askDelete("plan", p.id, humanPlanName)} sx={{ p: 0.25 }}>
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Box>
                            </Stack>

                            {/* === Options (collapsed by default) === */}
                            <Collapse in={optionsExpanded} timeout="auto" unmountOnExit>
                              <List dense disablePadding sx={{ pl: 2.5, pt: 0.25 }}>
                                <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ pr: 1, mb: 0.25 }}>
                                  <Tooltip title="New Option for this Plan" placement="top">
                                    <IconButton size="small" onClick={() => createOption?.({ baseId: b.id, planId: p.id })} sx={{ padding: '2px' }}>
                                      <AddRoundedIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>

                                {!openPlan ? (
                                  <Typography variant="caption" sx={{ pl: 3, opacity: 0.5 }}>Plan を選択するとOptionが表示されます</Typography>
                                ) : safeOptions.length === 0 ? (
                                  <Typography variant="caption" sx={{ pl: 3, opacity: 0.5 }}>No options</Typography>
                                ) : (
                                  safeOptions.map((o) => {
                                    const isSel = o?.id && o.id === selectedOptionId;
                                    const humanOptionName = o.name || "Unnamed Option";

                                    return (
                                      <Stack direction="row" alignItems="center" key={o.id} sx={{ pr: 1, mb: 0 }}>
                                        <ListItemButton
                                          onClick={() => handleSelectOption(o.id)}
                                          selected={isSel}
                                          sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 26 }}
                                        >
                                          <ListItemText
                                            primary={`Opt: ${humanOptionName}`}
                                            primaryTypographyProps={{ fontSize: 12, fontWeight: isSel ? 700 : 500, lineHeight: 1.2 }}
                                            sx={{ opacity: 0.95 }}
                                          />
                                        </ListItemButton>
                                        <Box sx={{ display: "flex", gap: 0.25, opacity: isSel ? 1 : 0.3 }}>
                                          <IconButton size="small" onClick={() => duplicateOption?.(o.id)} sx={{ p: 0.25 }}>
                                            <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                                          </IconButton>
                                          <IconButton size="small" onClick={() => askDelete("option", o.id, humanOptionName)} sx={{ p: 0.25 }}>
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                          </IconButton>
                                        </Box>
                                      </Stack>
                                    );
                                  })
                                )}
                              </List>
                            </Collapse>
                          </Box>
                        );
                      })}
                  </List>
                  )}
                </Box>
              );
            })}
          </List>
          )}
        </Collapse>
      </Stack>

      {confirm?.open && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            bgcolor: "rgba(0,0,0,0.5)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => !deleting && closeConfirm?.()}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>
              {confirm.title || "削除の確認"}
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              {confirm.description}
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography
                onClick={() => !deleting && closeConfirm?.()}
                sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, "&:hover": { color: "#fff" } }}
              >
                キャンセル
              </Typography>
              <Typography
                onClick={handleConfirmDelete}
                sx={{
                  color: "#ff4d4f",
                  fontSize: 13,
                  cursor: deleting ? "not-allowed" : "pointer",
                  py: 1,
                  fontWeight: 600,
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                削除
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
