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

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";

import { useWorkspaceStructureStore } from "../../../../store/useWorkspaceStructureStore";
import { useAppStore } from "../../../../../../../store/useAppStore";
import { useAIChatStore } from "../../../../../../../store/useAIChatStore";
import { useUiRightSidebarStore } from "../../../../store/uiRightSidebarStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { useLayoutOptionActions } from "../../../../hooks/useLayoutOptionActions";
import { useLayoutPatternStore } from "../../../../store/useLayoutPatternStore";
import { resolveProposalPlan } from "../../../../utils/layoutPatterns";
import { renameLayout } from "../../../../api/layoutDocApi";
import { TextField } from "@mui/material";

export default function EditorBasePlanOptionTree() {
  const theme = useTheme();
  const border = alpha(theme.palette.common.white, 0.08);

  const bases = useWorkspaceStructureStore((s: any) => s.bases);
  const plansOfSelectedBase = useWorkspaceStructureStore((s: any) => s.plansOfSelectedBase);

  const selectedBaseId = useWorkspaceStructureStore((s: any) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s: any) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s: any) => s.selectedOptionId);

  // Option = この Plan での見た目の組み合わせ（プレビューと同じ実体を読み書きする）
  const {
    busy: optionBusy,
    selectOption: selectViewOption,
    createOption,
    renameOption,
    removeOption: removeViewOption,
    plans: treePlans,
  } = useLayoutOptionActions();
  // 一覧と選択中はプレビューと同じくストアを直接購読する（経路を揃えて食い違いを無くす）。
  const viewOptions = useLayoutPatternStore((s) => s.patterns);
  const activeOptionId = useLayoutPatternStore((s) => s.activePatternId);
  // ツリーは常時表示のため、ここが落ちると画面全体が使えなくなる。フック側でも配列化しているが、
  // 万一 undefined が届いても描画は止めない（原因追跡のため一度だけ警告を出す）。
  const safeViewOptions = Array.isArray(viewOptions) ? viewOptions : [];
  if (!Array.isArray(viewOptions)) {
    console.warn("[EditorBasePlanOptionTree] Option 一覧が配列ではありません:", viewOptions);
  }
  // ── 提案名のその場編集（Plan と同じ方式）──
  const [renamingProposalId, setRenamingProposalId] = useState<string | null>(null);
  const [proposalNameDraft, setProposalNameDraft] = useState("");
  const startRenameProposal = useCallback((id: string, currentName: string) => {
    setRenamingProposalId(id);
    setProposalNameDraft(currentName);
  }, []);
  const commitRenameProposal = useCallback(() => {
    const id = renamingProposalId;
    const next = proposalNameDraft.trim();
    setRenamingProposalId(null);
    if (!id || !next) return;
    void renameOption(id, next);
  }, [renamingProposalId, proposalNameDraft, renameOption]);

  const selectBase = useWorkspaceStructureStore((s: any) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s: any) => s.selectPlan);
  const selectOption = useWorkspaceStructureStore((s: any) => s.selectOption);

  const openLayout = useWorkspaceStructureStore((s: any) => s.openLayout);

  const createPlan = useWorkspaceStructureStore((s: any) => s.createPlan);

  const duplicateBase = useWorkspaceStructureStore((s: any) => s.duplicateBase);
  const duplicatePlan = useWorkspaceStructureStore((s: any) => s.duplicatePlan);

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

  // ── Plan 名のその場編集（ダブルクリック or ✎ で開始）──
  // 保存先は layouts/{planId}.name。ツリーの一覧は Firestore 購読で流れてくるので、
  // 書き込みが通れば表示は自動で追従する（ローカルに二重の名前状態を持たない）。
  const planCtx = useEditorModeStore((s) => s.dslPlanContext);
  const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const startRenamePlan = useCallback((planId: string, currentName: string) => {
    setRenamingPlanId(planId);
    setRenameDraft(currentName);
  }, []);
  const commitRenamePlan = useCallback(async () => {
    const planId = renamingPlanId;
    const next = renameDraft.trim();
    setRenamingPlanId(null);
    if (!planId || !next) return;
    // 書き込み先が特定できないと renameLayout は黙って何もしない＝「変わらない」だけになる。
    // どこが欠けているのかコンソールに出す（原因追跡のため）。
    if (!planCtx?.projectId || !planCtx?.workspaceId) {
      console.error("[EditorBasePlanOptionTree] Plan 名の変更先を特定できません:", { planId, planCtx });
      return;
    }
    try {
      await renameLayout(planCtx.projectId, planCtx.workspaceId, planId, next);
    } catch (e) {
      console.error("[EditorBasePlanOptionTree] Plan 名の変更に失敗:", e);
    }
  }, [renamingPlanId, renameDraft, planCtx]);

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

  // エディター内には「いま開いている Base」しか出さない。別 Base への切替は
  // Exit → Layout Dashboard から行う（ヘッダーのパンくずも同じ方針）。
  const safeBases = useMemo(
    () => (Array.isArray(bases) ? bases.filter((b) => b?.id && b.id === selectedBaseId) : []),
    [bases, selectedBaseId]
  );
  const safePlans = useMemo(() => (Array.isArray(plansOfSelectedBase) ? plansOfSelectedBase : []), [plansOfSelectedBase]);

  // Plan/Option を開いていない＝躯体編集モード。Plan が 0 件の Base は戻り先が無いのでトグル不可。
  const isBaseOnly = !selectedPlanId && !selectedOptionId;
  const baseToggleDisabled = isBaseOnly && safePlans.length === 0;

  // Base 行＝躯体編集モードのトグル（ヘッダーのパンくずと同じ挙動）。
  //  通常時    → Plan / Option の選択を解除して躯体のみ表示
  //  躯体モード → 直前に開いていた Plan（無ければ先頭 Plan）へ戻る
  const handleSelectBase = useCallback(
    (baseId: string) => {
      if (!baseId) return;
      if (isBaseOnly) {
        if (baseToggleDisabled) return; // 戻り先が無い（Plan 0 件の Base）
        openLayout(baseId);
      } else {
        selectBase(baseId);
      }
    },
    [selectBase, openLayout, isBaseOnly, baseToggleDisabled]
  );

  const handleSelectPlan = useCallback(
    (planId: string) => {
      if (planId && planId !== selectedPlanId) selectPlan(planId);
    },
    [selectPlan, selectedPlanId]
  );



  // ── 議論履歴インジケーター（Phase 3）──
  // このプロジェクト × S.Layout のチャットセッション（メッセージ有り）を持つノード id 集合。
  // 該当ノードに 💬 を出し、クリックでノード選択＋右サイドバーのチャットパネルを開く。
  const chatSessions = useAIChatStore((s) => s.sessions);
  const chatMessages = useAIChatStore((s) => s.messages);
  const discussedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeProjectId) return set;
    const sessionsWithMsgs = new Set(chatMessages.map((m) => m.sessionId));
    chatSessions.forEach((s) => {
      if (s.projectId === activeProjectId && s.appScope === "3dsl" && s.taskId && sessionsWithMsgs.has(s.id)) {
        set.add(s.taskId);
      }
    });
    return set;
  }, [chatSessions, chatMessages, activeProjectId]);

  const openNodeChat = useCallback(
    (kind: "base" | "plan" | "option", id: string) => {
      // ノードを選択（チャットパネルは選択中ノードにバインドされるため、先に選択を合わせる）。
      // plan は「同じ id なら何もしない」ガードを通さず必ず選択し直す（Option 選択中でも
      // Plan のチャットへジャンプできるように、外部ハンドラ側の子クリアに任せる）。
      if (kind === "base") selectBase(id);
      else if (kind === "plan") selectPlan(id);
      else selectOption(id);
      // 右サイドバーをチャットパネルのみ表示に切り替え（排他）。
      const rs = useUiRightSidebarStore.getState();
      rs.closeAll();
      rs.setRightPanel("chat", true);
    },
    [selectBase, selectPlan, selectOption]
  );

  // ノード行の 💬 インジケーター（議論履歴があるノードだけ表示・常時可視）。
  const renderChatJump = useCallback(
    (kind: "base" | "plan" | "option", id: string) =>
      discussedNodeIds.has(id) ? (
        <Tooltip title="このノードの議論チャットを開く" placement="top">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); openNodeChat(kind, id); }}
            sx={{ p: 0.25, color: "light-dark(#0a45a4, #8ab4f8)", "&:hover": { bgcolor: "rgba(138,180,248,0.12)" } }}
          >
            <ForumRoundedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      ) : null,
    [discussedNodeIds, openNodeChat]
  );

  return (
    <Box sx={{ px: 1.5, py: 1, height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <Stack spacing={0.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Tooltip title="Layout Dashboard に戻る" placement="top">
            <ListItemButton
              onClick={() => goToDashboard && goToDashboard()}
              disableRipple
              sx={{ p: 0, '&:hover': { bgcolor: 'transparent', '& .project-name': { color: 'var(--brand-fg)', textDecoration: 'underline' } }, width: 'auto', flexGrow: 0 }}
            >
              <Typography className="project-name" variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2, transition: 'color 0.15s' }}>
                {activeProjectName || "Project"}
              </Typography>
            </ListItemButton>
          </Tooltip>
          {/* 新規 Base の作成は Layout Dashboard に一本化（エディター内では Base を切り替えない）。 */}
        </Stack>

        <Divider sx={{ opacity: 0.2 }} />

        <Collapse in timeout="auto">
          {safeBases.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.7, px: 1 }}>
              Base が開かれていません。プロジェクト名をクリックして一覧へ戻ってください。
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
                    <Tooltip
                      title={baseToggleDisabled ? "Plan がありません" : isBaseOnly ? "Plan に戻る" : "躯体を編集（Base のみ表示）"}
                      placement="top"
                    >
                      <ListItemButton
                        onClick={() => handleSelectBase(b.id)}
                        selected={isBaseOnly}
                        sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 28, opacity: baseToggleDisabled ? 0.5 : 1 }}
                      >
                        <ListItemText
                          primary={`Base: ${humanBaseName}`}
                          primaryTypographyProps={{ fontSize: 12.5, fontWeight: openBase ? 700 : 500, lineHeight: 1.2 }}
                        />
                      </ListItemButton>
                    </Tooltip>
                    {renderChatJump("base", b.id)}
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

                        return (
                          <Box key={p.id} sx={{ mt: 0 }}>
                            <Stack direction="row" alignItems="center" sx={{ pr: 1 }}>
                              {renamingPlanId === p.id ? (
                                // その場編集。Enter で確定 / Escape で取り消し / フォーカスが外れたら確定。
                                <TextField
                                  autoFocus
                                  fullWidth
                                  size="small"
                                  variant="standard"
                                  value={renameDraft}
                                  onChange={(e) => setRenameDraft(e.target.value)}
                                  onBlur={() => { void commitRenamePlan(); }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); void commitRenamePlan(); }
                                    else if (e.key === "Escape") { e.preventDefault(); setRenamingPlanId(null); }
                                  }}
                                  inputProps={{ style: { fontSize: 12.5, padding: "2px 4px" } }}
                                  sx={{ mx: 1, my: 0.25 }}
                                />
                              ) : (
                                <ListItemButton
                                  onClick={() => handleSelectPlan(p.id)}
                                  onDoubleClick={() => startRenamePlan(p.id, humanPlanName)}
                                  selected={openPlan}
                                  sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 28 }}
                                >
                                  <ListItemText
                                    primary={`Plan: ${humanPlanName}`}
                                    primaryTypographyProps={{ fontSize: 12.5, fontWeight: openPlan ? 700 : 500, lineHeight: 1.2 }}
                                  />
                                </ListItemButton>
                              )}
                              {renderChatJump("plan", p.id)}
                              <Box sx={{ display: "flex", gap: 0.25, opacity: openPlan ? 1 : 0.3 }}>
                                <Tooltip title="名前を変更（ダブルクリックでも可）" placement="top">
                                  <IconButton size="small" onClick={() => startRenamePlan(p.id, humanPlanName)} sx={{ p: 0.25 }}>
                                    <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                                <IconButton size="small" onClick={() => duplicatePlan?.(p.id)} sx={{ p: 0.25 }}>
                                  <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => askDelete("plan", p.id, humanPlanName)} sx={{ p: 0.25 }}>
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Box>
                            </Stack>
                          </Box>
                        );
                      })}
                  </List>
                  )}

                  {/* === 提案（Base 直下。Plan 込みの完全な最終形） === */}
                  {openBase && (
                    <List dense disablePadding sx={{ pl: 1.5, pt: 0.5 }}>
                      <Typography variant="caption" sx={{ pl: 1, opacity: 0.6, fontWeight: 700, letterSpacing: 0.4 }}>
                        提案
                      </Typography>
                      {safeViewOptions.map((o) => {
                        const isSel = o.id === activeOptionId;
                        const humanProposalName = o.name || '提案';
                        const planRef = resolveProposalPlan(o.planId ?? null, treePlans);
                        const planLabel =
                          planRef.kind === 'ok' ? planRef.name
                          : planRef.kind === 'none' ? '躯体のみ'
                          : 'Plan が見つかりません';
                        const broken = planRef.kind === 'missing';
                        return (
                          <Stack direction="row" alignItems="center" key={o.id} sx={{ pr: 1 }}>
                            {renamingProposalId === o.id ? (
                              // その場編集。Enter で確定 / Escape で取り消し / フォーカスが外れたら確定。
                              <TextField
                                autoFocus
                                fullWidth
                                size="small"
                                variant="standard"
                                value={proposalNameDraft}
                                onChange={(e) => setProposalNameDraft(e.target.value)}
                                onBlur={() => commitRenameProposal()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); commitRenameProposal(); }
                                  else if (e.key === "Escape") { e.preventDefault(); setRenamingProposalId(null); }
                                }}
                                inputProps={{ style: { fontSize: 12, padding: "2px 4px" } }}
                                sx={{ mx: 1, my: 0.25 }}
                              />
                            ) : (
                              <ListItemButton
                                onClick={broken ? undefined : () => void selectViewOption(o.id)}
                                onDoubleClick={() => startRenameProposal(o.id, humanProposalName)}
                                selected={isSel}
                                sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 26 }}
                              >
                                <ListItemText
                                  primary={humanProposalName}
                                  secondary={planLabel}
                                  primaryTypographyProps={{ fontSize: 12, fontWeight: isSel ? 700 : 500, lineHeight: 1.2 }}
                                  secondaryTypographyProps={{ fontSize: 10, sx: { opacity: 0.6, color: broken ? '#ff6b6b' : undefined } }}
                                />
                              </ListItemButton>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.25, opacity: isSel ? 1 : 0.3 }}>
                              <Tooltip title="名前を変更（ダブルクリックでも可）" placement="top">
                                <span>
                                  <IconButton size="small" onClick={() => startRenameProposal(o.id, humanProposalName)} sx={{ p: 0.25 }}>
                                    <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <IconButton size="small" onClick={() => void removeViewOption(o.id)} sx={{ p: 0.25 }}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Box>
                          </Stack>
                        );
                      })}
                      <Stack direction="row" alignItems="center" sx={{ pr: 1, mt: 0.25 }}>
                        <ListItemButton onClick={() => void createOption()} disabled={optionBusy} sx={{ borderRadius: 1, px: 1, py: 0.25, minHeight: 26 }}>
                          <ListItemText
                            primary="＋ 新しい提案"
                            primaryTypographyProps={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}
                            sx={{ opacity: 0.85 }}
                          />
                        </ListItemButton>
                      </Stack>
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
            sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}
          >
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>
              {confirm.title || "削除の確認"}
            </Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              {confirm.description}
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography
                onClick={() => !deleting && closeConfirm?.()}
                sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, "&:hover": { color: "var(--brand-fg)" } }}
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
