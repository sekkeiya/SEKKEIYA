// S.Layout の verb 定義（docs/20 Batch 1）。
// 既存 layout_list / layout_create / run_auto_layout を VerbDef へ移行（挙動不変）し、
// 1a の読取 verb layout_get / get_layout_outputs を追加する。
// handler は dsl/layout/services/chatLayoutBridge.ts に委譲する（orchestrator は薄く保つ）。

import type { VerbDef } from '../../../../store/verb/verbTypes';

export const layoutVerbs: VerbDef[] = [
  {
    name: 'layout_list',
    description: 'プロジェクトの間取り（BasePlan）一覧を取得する。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブなプロジェクト）。' },
      },
    },
    risk: 'low',
    label: 'レイアウト一覧を取得しています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ error: 'projectId が必要です' });
      try {
        const { listLayoutsForProject } = await import('../services/chatLayoutBridge');
        const layouts = await listLayoutsForProject(projectId);
        return JSON.stringify(layouts);
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'layout_list failed' });
      }
    },
  },

  {
    name: 'layout_get',
    description: '間取り1件の詳細（家具点数・ゾーン有無・代表サムネ・更新日時）を取得する。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        planId: { type: 'string', description: '対象プランの ID（layout_list で取得）。' },
      },
      required: ['planId'],
    },
    risk: 'low',
    label: 'レイアウトの詳細を確認しています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      if (!ctx.input.planId) return JSON.stringify({ ok: false, error: 'planId が必要です' });
      try {
        const { getLayoutDetail } = await import('../services/chatLayoutBridge');
        const detail = await getLayoutDetail(projectId, ctx.input.planId as string);
        return JSON.stringify({ ok: true, ...detail });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'layout_get failed' });
      }
    },
  },

  {
    name: 'get_layout_outputs',
    description:
      '間取りの成果物（レンダー画像・代表サムネ）を取得する。返り値の assetId は add_asset_to_section でサイトのギャラリー/レイアウトセクションに添付できる。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        planId: { type: 'string', description: '対象プランの ID（layout_list で取得）。' },
      },
      required: ['planId'],
    },
    risk: 'low',
    label: 'レイアウトの成果物を確認しています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      if (!ctx.input.planId) return JSON.stringify({ ok: false, error: 'planId が必要です' });
      try {
        const { getLayoutOutputs } = await import('../services/chatLayoutBridge');
        const out = await getLayoutOutputs(projectId, ctx.input.planId as string);
        return JSON.stringify({ ok: true, ...out });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'get_layout_outputs failed' });
      }
    },
  },

  {
    name: 'layout_create',
    description: '新しい間取り（Base + Plan）を作成して ID を返す。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        name: { type: 'string', description: '間取りの名前（省略時「新規レイアウト」）。' },
      },
    },
    risk: 'low',
    label: '新規レイアウトを作成しています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ error: 'projectId が必要です' });
      const { useAuthStore } = await import('../../../../store/useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) return JSON.stringify({ error: 'ログインが必要です' });
      const name = (ctx.input.name as string | undefined) || '新規レイアウト';
      try {
        const { createLayoutForProject } = await import('../services/chatLayoutBridge');
        const result = await createLayoutForProject(projectId, uid, name);
        return JSON.stringify({ ok: true, ...result });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'layout_create failed' });
      }
    },
  },

  {
    name: 'render_layout',
    description:
      '指定した間取り（planId）を標準品質でレンダリングし、成果物として保存する。完全にヘッドレス（裏側）で実行されるため S.Layout を開く必要はなく、複数チャットの並行作業でも使える。保存済みのアングルがあればそれを、無ければ自動アングルを使う。保存後は get_layout_outputs で取得し add_asset_to_section でサイトに添付できる。planId は layout_list で取得する。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        planId: { type: 'string', description: 'レンダリング対象プランの ID（layout_list で取得）。省略時はいま S.Layout で開いている間取り。' },
        count: { type: 'number', description: '生成する枚数（既定3・最大6）。' },
      },
    },
    risk: 'medium',
    label: 'レンダリングしています…',
    handler: async (ctx) => {
      try {
        const projectId = ctx.resolveProjectId(ctx.input.projectId);
        if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });

        // planId 未指定なら、いま開いている間取りを使う（利便性のフォールバック）。
        let planId = ctx.input.planId as string | undefined;
        if (!planId) {
          const { useEditorModeStore } = await import('../store/useEditorModeStore');
          planId = useEditorModeStore.getState().dslPlanContext?.planId;
        }
        if (!planId) {
          return JSON.stringify({ ok: false, error: 'planId が必要です。layout_list で対象の間取りを確認してから planId を指定してください。' });
        }

        const { useAuthStore } = await import('../../../../store/useAuthStore');
        const uid = useAuthStore.getState().currentUser?.uid;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });

        // Base→Plan→Option の曖昧性を解消。複数候補があれば選択を促す（黙って推測しない）。
        const { resolveRenderTarget } = await import('../services/chatLayoutBridge');
        const target = await resolveRenderTarget(projectId, planId);
        if (target.kind === 'error') return JSON.stringify({ ok: false, error: target.error });
        if (target.kind === 'choice') {
          return JSON.stringify({
            ok: false,
            needsSelection: true,
            message: 'レンダリング対象が複数あります。propose_choices で下記の candidates（id/label）を提示してユーザーに選ばせ、選ばれた id を planId にして render_layout を再実行してください。',
            candidates: target.candidates,
          });
        }

        const { renderLayoutHeadless } = await import('./headlessLayoutRenderService');
        const result = await renderLayoutHeadless(projectId, target.leafId, target.baseId, (ctx.input.count as number) || 3, uid);

        // 生成結果（画像）をチャットに画像グリッドで表示する（裏で実行 → 結果はチャット表示）。
        if (result.ok && ctx.sessionId && result.renders && result.renders.length) {
          const { useAIChatStore } = await import('../../../../store/useAIChatStore');
          useAIChatStore.getState().addMessage({
            sessionId: ctx.sessionId,
            role: 'ai',
            source: 'sidebar_chat',
            text: '',
            ui: { kind: 'render_results', planId: result.planId as string, renders: result.renders },
          });
        }
        if (!result.ok) {
          console.error('[render_layout] headless render failed:', result.error);
        }
        // モデルには要約のみ返す（画像URLは本文に並べさせない。表示はシステムが担当）。
        return JSON.stringify({
          ok: result.ok,
          planId: result.planId,
          renderCount: result.renderCount,
          rendered: !!(result.renders && result.renders.length),
          error: result.error,
          note: 'render_layout はクライアント側で実行される（サーバー不要）。エラーは error をそのまま伝えること。',
        });
      } catch (e: any) {
        console.error('[render_layout] handler threw:', e);
        return JSON.stringify({ ok: false, error: e?.message || 'render_layout failed' });
      }
    },
  },

  {
    name: 'run_auto_layout',
    description: 'ルールベースで家具を自動配置し、結果をプランに保存する。完了後 S.Layout を開く。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '対象プロジェクト ID（省略時はアクティブ）。' },
        planId: { type: 'string', description: '配置先プラン/オプションの ID。省略時はいま開いている間取り、無ければ自動解決。' },
        buildingType: { type: 'string', description: '建物種別（residential 等）。', default: 'residential' },
        furnitureSource: { type: 'string', description: '家具ソース（project 等）。', default: 'project' },
        roomWidthMm: { type: 'number', description: '部屋の幅(mm)。省略時はジオメトリから自動導出。' },
        roomDepthMm: { type: 'number', description: '部屋の奥行(mm)。省略時はジオメトリから自動導出。' },
      },
    },
    risk: 'medium',
    label: 'ルールベースで家具を自動配置しています…',
    handler: async (ctx) => {
      const { input } = ctx;
      const projectId = ctx.resolveProjectId(input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です' });
      const { useAuthStore } = await import('../../../../store/useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });

      // 家具配置は Plan の役割。配置先を Plan 単位で解決する（Option を渡されたら親 Plan へ）。
      // 曖昧（複数候補）なら needsSelection を返す（フリーテキストで尋ねさせない）。
      // 選択肢ラベルは「プロジェクト名 / Base名 / Plan名」。
      const { useAppStore } = await import('../../../../store/useAppStore');
      const projectName = useAppStore.getState().projects.find((p: any) => p.id === projectId)?.name || 'プロジェクト';
      const { resolvePlacementTarget, listPlacementPlans } = await import('../services/chatLayoutBridge');
      let planId = input.planId as string | undefined;
      if (!planId) {
        const { useEditorModeStore } = await import('../store/useEditorModeStore');
        planId = useEditorModeStore.getState().dslPlanContext?.planId;
      }
      let baseId: string | undefined;
      if (planId) {
        const t = await resolvePlacementTarget(projectId, planId, projectName);
        if (t.kind === 'error') return JSON.stringify({ ok: false, error: t.error });
        if (t.kind === 'choice') {
          return JSON.stringify({ ok: false, needsSelection: true, message: 'どのプランに家具を配置しますか？ candidates を propose_choices で提示し、選ばれた id を planId にして run_auto_layout を再実行してください。', candidates: t.candidates });
        }
        planId = t.planId; baseId = t.baseId;
      } else {
        const plans = await listPlacementPlans(projectId, projectName);
        if (plans.length === 0) return JSON.stringify({ ok: false, error: '配置先の間取り（Plan）がありません。先に間取りを作成してください。' });
        if (plans.length === 1) { planId = plans[0].id; baseId = plans[0].baseId; }
        else return JSON.stringify({ ok: false, needsSelection: true, message: 'どのプランに家具を配置しますか？ candidates を propose_choices で提示してください。', candidates: plans.map(p => ({ id: p.id, label: p.label })) });
      }

      // 部屋サイズ: 明示指定 → ジオメトリから自動導出 → 既定。ユーザーには尋ねない。
      let roomWidthMm = input.roomWidthMm as number | undefined;
      let roomDepthMm = input.roomDepthMm as number | undefined;
      if (!roomWidthMm || !roomDepthMm) {
        try {
          const { deriveRoomSizeMm } = await import('./headlessLayoutRenderService');
          const sz = await deriveRoomSizeMm(projectId, baseId || planId);
          if (sz) { roomWidthMm = roomWidthMm || sz.widthMm; roomDepthMm = roomDepthMm || sz.depthMm; }
        } catch (e) { console.warn('[run_auto_layout] room size 自動導出失敗:', e); }
      }

      const { useAutoLayoutStore } = await import('../store/useAutoLayoutStore');
      const setProgressMessage = useAutoLayoutStore.getState().setProgressMessage;

      try {
        const { runAutoLayoutFromChat } = await import('../services/chatLayoutBridge');
        const result = await runAutoLayoutFromChat(projectId, planId, {
          userId: uid,
          buildingType: (input.buildingType as any) ?? 'residential',
          furnitureSource: (input.furnitureSource as any) ?? 'project',
          roomWidthMm: roomWidthMm ?? 5000,
          roomDepthMm: roomDepthMm ?? 4000,
          onProgress: setProgressMessage,
        });

        setProgressMessage(null);

        // 完了後 S.Layout を自動で開く。
        try {
          const { useAppStore } = await import('../../../../store/useAppStore');
          useAppStore.getState().setActiveProjectId(projectId);
          const { launchWorkspace } = await import('../../../launcher/launchWorkspace');
          await launchWorkspace({ appScope: '3dsl', projectId, workspaceId: 'layout', workspaceName: 'S.Layout' });
        } catch (navErr) {
          console.warn('[run_auto_layout] S.Layout への遷移に失敗:', navErr);
        }

        return JSON.stringify({
          ok: true,
          placedCount: result.placedCount,
          sessionId: result.sessionId,
          projectId,
          planId,
          buildingType: (input.buildingType as any) ?? 'residential',
          roomWidthMm: roomWidthMm ?? 5000,
          roomDepthMm: roomDepthMm ?? 4000,
          // 0点＝配置できる家具が無い。オーケストレーターが noFurniture を検知して
          // 「S.Modelsから自動/手動で選ぶ」の分岐UIを提示する（useCoreOrchestrator 側で決定論的に処理）。
          ...(result.placedCount === 0 ? { noFurniture: true } : {}),
        });
      } catch (e: any) {
        setProgressMessage(null);
        return JSON.stringify({ ok: false, error: e?.message || 'run_auto_layout failed' });
      }
    },
  },
];
