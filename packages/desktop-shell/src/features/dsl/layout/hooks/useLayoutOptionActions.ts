import { useCallback, useEffect, useState } from 'react';
import { useEditorModeStore } from '../store/useEditorModeStore';
import { useWorkspaceStructureStore } from '../store/useWorkspaceStructureStore';
import { useLayoutPatternStore } from '../store/useLayoutPatternStore';
import { createPattern, deletePattern, setActivePatternId, updatePattern } from '../api/layoutPatternsApi';
import { applyPattern, capturePattern } from '../services/patternSnapshot';
import { resolveProposalPlan, sanitizeItemsForSnapshot, type LayoutPattern } from '../utils/layoutPatterns';
import { flushProposalCapture, cancelProposalCapture } from './useProposalAutoCapture';
import { getProposalItemsBridge } from '../services/proposalItemsBridge';

/**
 * ⚠ 同ディレクトリに別物の useOptionActions.js（OptionDoc の items 更新）があるため、
 * 名前が衝突しないよう useLayoutOptionActions とする。
 *
 * 提案（旧 Option）＝「どの Plan を使い、どんな見た目にするか」の完全な最終形。
 * 実体は layouts/{baseId}/patterns。切替は planId が違えば Plan 切替を含む。
 * ツリー / パンくず / トップバー / プレビューのどこから操作しても Firestore 経由で連動する。
 *
 * v2（自動保存）: 提案は常にちょうど1つアクティブで、編集は自動的にアクティブ提案へ
 * 書き込まれる（useProposalAutoCapture）。デフォルト（未選択）状態は存在しない —
 * 「提案が無い」は起こり得ず、ensure-active effect が必ず1つ用意する。
 */

// ensure-active の多重実行ガード。フックは複数 UI で同時マウントされるため、
// インスタンスローカルの ref ではなくモジュールレベルで Base 単位に握る。
const ensuringBases = new Set<string>();

export function useLayoutOptionActions() {
  const ctx = useEditorModeStore((s) => s.dslPlanContext);
  const selectedBaseId = useWorkspaceStructureStore((s: { selectedBaseId?: string | null }) => s.selectedBaseId) ?? null;
  const selectedPlanId = useWorkspaceStructureStore((s: { selectedPlanId?: string | null }) => s.selectedPlanId) ?? null;
  const rawPlans = useWorkspaceStructureStore((s: { plansOfSelectedBase?: { id: string; name?: string }[] }) => s.plansOfSelectedBase);
  const plans = Array.isArray(rawPlans) ? rawPlans : [];
  // ストアの値をそのまま使わず必ず配列に落とす（初期化順の都合で undefined だと即クラッシュ）。
  const rawOptions = useLayoutPatternStore((s) => s.patterns);
  const options: LayoutPattern[] = Array.isArray(rawOptions) ? rawOptions : [];
  const optionCount = options.length;
  const activeOptionId = useLayoutPatternStore((s) => s.activePatternId) ?? null;
  const patternsLoaded = useLayoutPatternStore((s) => s.loaded);
  const [busy, setBusy] = useState(false);

  const ready = !!(ctx?.projectId && ctx?.workspaceId && selectedBaseId);

  /** 既存の提案へ切り替える。 */
  const selectOption = useCallback(async (id: string) => {
    if (!ready || busy || !id || id === activeOptionId) return;
    setBusy(true);
    const patternStore = useLayoutPatternStore.getState();
    // 切替中に別の提案をクリックした場合、前の予約がロード完了時に
    // 上書き適用されてしまうのを防ぐため、まず古い予約を破棄する。
    // 新しい予約はこの後の分岐（Plan 切替を伴う場合）で改めて積み直す。
    patternStore.setPendingApply(null);
    try {
      const p = options.find((x) => x.id === id);
      if (!p) return;
      const targetPlanId = p.planId ?? null;
      if (targetPlanId && resolveProposalPlan(targetPlanId, plans).kind === 'missing') return; // 参照先 Plan が削除済み
      // 1) 直前の作業をアクティブ提案へ確実に書き込んでから離れる
      await flushProposalCapture();
      // 2) 適用中は自動キャプチャを抑止
      patternStore.setApplying(true);
      try {
        if (targetPlanId !== selectedPlanId) {
          // Plan 切替を伴う場合は、各ローダーがプラン既定を読み終えた後に
          // SurfaceFinishLoader がこの提案（配置含む）を重ねる（pending 方式。spec §3）。
          patternStore.setPendingApply(p.id);
          const st = useWorkspaceStructureStore.getState();
          if (targetPlanId) st.selectPlan(targetPlanId);
          else st.selectBase(selectedBaseId!); // 躯体のみの提案 → 躯体モードへ
        } else {
          applyPattern(p);
          if (Array.isArray(p.items)) await getProposalItemsBridge()?.restoreItems(p.items);
        }
        await setActivePatternId(ctx!.projectId, ctx!.workspaceId, selectedBaseId!, id);
      } finally {
        // Plan 切替を伴う場合の実際の適用はローダー側（applying はそこでは見ない）。
        // キャプチャ抑止はここで解除してよい — 次のキャプチャは新しい activePatternId に対して走る。
        patternStore.setApplying(false);
      }
    } catch (e) {
      console.error('[useLayoutOptionActions] 提案の切替に失敗', e);
    } finally {
      setBusy(false);
    }
  }, [ready, busy, options, plans, ctx, selectedBaseId, selectedPlanId, activeOptionId]);

  /** 現在の状態（見た目＋配置＋Plan選択）から新しい提案を作り、即アクティブにする。 */
  const createOption = useCallback(async (name?: string) => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await flushProposalCapture(); // いままでの作業を旧アクティブへ確定
      const items = sanitizeItemsForSnapshot(getProposalItemsBridge()?.getItems?.() ?? null);
      const snap = {
        ...capturePattern(),
        planId: selectedPlanId,
        ...(items ? { items } : {}),
        order: optionCount,
      };
      const trimmed = (name || '').trim() || `提案 ${optionCount + 1}`;
      const id = await createPattern(ctx!.projectId, ctx!.workspaceId, selectedBaseId!, trimmed, snap);
      await setActivePatternId(ctx!.projectId, ctx!.workspaceId, selectedBaseId!, id);
    } catch (e) {
      console.error('[useLayoutOptionActions] 提案の作成に失敗', e);
    } finally {
      setBusy(false);
    }
  }, [ready, busy, optionCount, ctx, selectedBaseId, selectedPlanId]);

  /** 提案名だけを変更する（見た目/配置は変えない）。 */
  const renameOption = useCallback(async (id: string, name: string) => {
    const trimmed = (name || '').trim();
    if (!ready || !id || !trimmed) return;
    try {
      await updatePattern(ctx!.projectId, ctx!.workspaceId, selectedBaseId!, id, { name: trimmed });
    } catch (e) {
      console.error('[useLayoutOptionActions] 提案の名称変更に失敗', e);
    }
  }, [ready, ctx, selectedBaseId]);

  const removeOption = useCallback(async (id: string) => {
    if (!ready) return;
    try {
      if (activeOptionId === id) {
        // 消す提案への保留書き込みは捨てる（存在しない doc への書き込みを防ぐ）
        cancelProposalCapture();
      } else {
        // アクティブは残るので、保留中の編集は先に確定させてから削除する
        await flushProposalCapture();
      }
      await deletePattern(ctx!.projectId, ctx!.workspaceId, selectedBaseId!, id);
      if (activeOptionId === id) {
        const rest = options.filter((o) => o.id !== id);
        if (rest.length > 0) await selectOption(rest[0].id);
        else await createOption();
      }
    } catch (e) {
      console.error('[useLayoutOptionActions] 提案の削除に失敗', e);
    }
  }, [ready, ctx, selectedBaseId, activeOptionId, options, selectOption, createOption]);

  // ensure-active: patterns ロード済みで activeOptionId が無い/一覧に存在しない場合、
  // 提案が既にあれば先頭を選び、無ければ新規作成する。
  // このフックは ProposalSelector / EditorBasePlanOptionTree（左右2箇所）/ PresentationViewer で
  // 同時にマウントされるため、インスタンスローカルの ref では多重実行を防げない
  // （提案0件の Base を開くと「提案 1」が2〜3個作られる不具合があった）。
  // モジュールレベルの ensuringBases で Base 単位に in-flight を握る。
  useEffect(() => {
    if (!ready || busy || !patternsLoaded) return;
    const key = `${ctx?.projectId}/${ctx?.workspaceId}/${selectedBaseId}`;
    if (ensuringBases.has(key)) return;
    // 購読の初回配信前（patterns=[] の初期値）に走ると、空 Base に提案を誤って
    // 量産してしまうため、loaded（初回スナップショット受信済み）を必須にしている。
    const activeMissing = activeOptionId ? !options.some((o) => o.id === activeOptionId) : true;
    if (!activeMissing) return;
    if (options.length > 0) {
      // アクティブが未設定、または参照先が一覧に無い（他端末での削除等）→ 先頭をアクティブに（新規作成しない）
      ensuringBases.add(key);
      void selectOption(options[0].id).finally(() => { ensuringBases.delete(key); });
      return;
    }
    // 提案が1つも無い → 新規作成
    ensuringBases.add(key);
    void createOption().finally(() => { ensuringBases.delete(key); });
  }, [ready, busy, patternsLoaded, activeOptionId, options, selectOption, createOption, ctx, selectedBaseId]);

  return { ready, options, optionCount, activeOptionId, busy, plans, selectOption, createOption, renameOption, removeOption };
}
