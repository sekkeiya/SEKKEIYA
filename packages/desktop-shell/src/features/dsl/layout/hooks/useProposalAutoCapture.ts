import { useEffect, useRef } from 'react';
import { useLayoutPatternStore } from '../store/useLayoutPatternStore';
import { updatePattern } from '../api/layoutPatternsApi';
import { capturePattern } from '../services/patternSnapshot';
import { sanitizeItemsForSnapshot } from '../utils/layoutPatterns';
import { getProposalItemsBridge } from '../services/proposalItemsBridge';
import { useSurfaceFinishStore } from '../store/useSurfaceFinishStore';
import { useSurfacePatternStore } from '../store/useSurfacePatternStore';
import { useDrawnFinishStore } from '../store/useDrawnFinishStore';
import { useLightingStore } from '../store/useLightingStore';
import { usePatternOverrideStore } from '../store/patternOverrideStore';

const DEBOUNCE_MS = 2000;

// フラッシュを外（切替処理）から呼べるよう、実行体を module に持つ。
// LayoutShell は1つしかマウントされないので単一スロットでよい。
let flushImpl: (() => Promise<void>) | null = null;
// 保留中のキャプチャを「書き込まずに」破棄する実行体（削除直前に呼ぶ）。
let cancelImpl: (() => void) | null = null;

/** デバウンス待ちのキャプチャを即時書き込みする（無ければ何もしない）。提案切替の直前に呼ぶ。 */
export async function flushProposalCapture(): Promise<void> {
  if (flushImpl) await flushImpl();
}

/**
 * 保留中のキャプチャタイマーを破棄するだけ（書き込まない）。
 * 提案を削除する直前に呼ぶ — 消える doc へ無駄な書き込みをしないため。
 */
export function cancelProposalCapture(): void {
  if (cancelImpl) cancelImpl();
}

/**
 * アクティブ提案への自動保存（v2 の中核）。
 * 見た目ストア＋配置（itemsSignal 経由で変化を検知）をデバウンスで
 * `layouts/{baseId}/patterns/{activeId}` へ書き込む。
 * 適用（復元）中は applying フラグで抑止する。
 */
export function useProposalAutoCapture(
  projectId?: string | null,
  workspaceId?: string | null,
  baseId?: string | null,
  planId?: string | null,
  /** 配置の変化検知用シグナル（layoutDraft を渡す。参照が変われば再デバウンス）。 */
  itemsSignal?: unknown,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // itemsSignal 用 effect から見た目ストア用 effect の schedule を共有するための橋渡し。
  const scheduleRef = useRef<() => void>(() => {});
  // planId を ref で保持し、cleanup で無条件破棄されないようにする。購読は baseId スコープなので変更で再張りは不要。
  const planIdRef = useRef<string | null>(planId ?? null);
  // schedule() 時点の activePatternId を控えておく（doCapture 実行時のフォールバック用）。
  // LayoutShell では useLayoutPatternsSync（activePatternId を管理）がこのフックより先に
  // 宣言されており、cleanup は宣言順に走るため、アンマウント/Base 切替時は
  // sync 側の clear()（activePatternId=null）が先に実行されてしまう。その後に走る
  // このフックの cleanup 内 doCapture が st.activePatternId だけを見ると、アクティブ無しで
  // 無音 return してしまい、直前の編集がフラッシュされないまま失われる。
  const lastActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || !workspaceId || !baseId) return;

    const doCapture = async () => {
      timerRef.current = null;
      const st = useLayoutPatternStore.getState();
      // applying 中は復元処理中（すぐに再開する）。
      if (st.applying) return;
      // pendingApplyId 中はローダーの適用完了待ち（I3）。
      // 万一 pendingApplyId がクリアされず残った場合、ここで無限に待つのではなく
      // 再デバウンスして適用完了を待つ — 自動保存が恒久停止するのを防ぐ。
      if (st.pendingApplyId) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { void doCapture(); }, DEBOUNCE_MS);
        return;
      }
      // 通常は st.activePatternId を使うが、cleanup 時は sync 側の clear() が
      // 先に走って null 化されている場合があるため、schedule() 時点の値へフォールバックする。
      const activeId = st.activePatternId ?? lastActiveIdRef.current;
      if (!activeId) return; // アクティブ無し（ensure前）は書かない
      try {
        const bridge = getProposalItemsBridge();
        const items = sanitizeItemsForSnapshot(bridge?.getItems?.() ?? null);
        await updatePattern(projectId, workspaceId, baseId, activeId, {
          ...capturePattern(),
          planId: planIdRef.current,
          ...(items ? { items } : {}),
        });
        lastActiveIdRef.current = null;
      } catch (e) {
        console.warn('[useProposalAutoCapture] 提案への自動保存に失敗:', e);
      }
    };

    const schedule = () => {
      const st = useLayoutPatternStore.getState();
      // applying 中は復元処理中（タイマーを張らない）。
      if (st.applying) return;
      // pendingApplyId 中でもタイマーは張る — doCapture 側で再デバウンスして待つ。
      lastActiveIdRef.current = st.activePatternId;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void doCapture(); }, DEBOUNCE_MS);
    };
    scheduleRef.current = schedule;

    flushImpl = async () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        await doCapture();
      }
    };

    cancelImpl = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastActiveIdRef.current = null;
    };

    // 見た目ストアの変化はここでまとめて購読する（capturePattern が読む4系統＋家具オーバーライド）。
    // 個別 selector ではなくストア全体の変化で schedule（デバウンスがまとめる）。
    const unsubs = [
      useSurfaceFinishStore.subscribe(schedule),
      useSurfacePatternStore.subscribe(schedule),
      useDrawnFinishStore.subscribe(schedule),
      useLightingStore.subscribe(schedule),
      usePatternOverrideStore.subscribe(schedule),
    ];

    return () => {
      flushImpl = null;
      cancelImpl = null;
      scheduleRef.current = () => {};
      // タイマーが保留中なら、cleanup 直前に書き込みを発火させる。
      // LayoutShell では useLayoutPatternsSync が本フックより先に宣言されており、cleanup は
      // 宣言順に走るため、sync 側の clear()（activePatternId=null）がこの cleanup より先に
      // 実行される。doCapture は st.activePatternId が null でも lastActiveIdRef のフォールバックで
      // 旧 Base のアクティブへ正しく書き込む。
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void doCapture();
      }
      for (const u of unsubs) u();
    };
  }, [projectId, workspaceId, baseId]);

  // planId の変化を ref へ同期し、applying 中でなければ再デバウンスを予約する。
  useEffect(() => {
    planIdRef.current = planId ?? null;
    if (useLayoutPatternStore.getState().applying) return;
    scheduleRef.current?.();
  }, [planId]);

  // 配置の変化（layoutDraft の参照変化）で再デバウンス。
  // 見た目ストア用 effect と同じ schedule（デバウンス）に乗せる。
  useEffect(() => {
    if (!projectId || !workspaceId || !baseId) return;
    scheduleRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignal]);
}
