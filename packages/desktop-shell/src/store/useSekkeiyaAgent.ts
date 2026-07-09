// SEKKEIYA Chat - クライアント主導の tool-calling ループランナー。
// 仕様: docs/10_sekkeiya_chat_spec.md §7.0（ループ位相）/ §5（risk と承認）
//
// 役割:
//   - backend `agentTurn`（ステートレス1往復）を STEP_CAP まで反復。
//   - tool_use をクライアント側（useProjectSiteStore / siteSnapshot / gallery）で実行し tool_result を返す。
//   - 破壊的操作（medium/high）は計画カードでユーザー承認を挟む。
//   - ターン終端で 1 回だけ save()（バッチ保存）。

import { create } from 'zustand';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase/client';
import { useProjectSiteStore } from './useProjectSiteStore';
import { useAIChatStore } from './useAIChatStore';
import { buildSiteSnapshot } from '../features/sites/siteSnapshot';
import { listProjectAssets } from '../features/sites/projectAssetsApi';
import type { SiteSection, SiteSectionType, SiteAssetRef } from '../features/projects/types';

const STEP_CAP = 8;

type RiskLevel = 'low' | 'medium' | 'high';

interface NeutralMsg {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  text?: string;
  toolCalls?: Array<{ id: string; name: string; input: any }>;
  results?: Array<{ tool_use_id: string; content: string; is_error?: boolean }>;
}

interface PendingApproval {
  title: string;
  lines: string[];
}

interface SekkeiyaAgentState {
  running: boolean;
  pendingApproval: PendingApproval | null;
  runAgent: (text: string, sessionId?: string) => Promise<void>;
  approve: () => void;
  reject: () => void;
}

// 承認待ちの resolver（ストア外保持。zustand state には関数を載せない）
let approvalResolver: ((ok: boolean) => void) | null = null;
// 直近の gallery_query 結果（assetId → ref 解決用）
let lastGalleryRefs: SiteAssetRef[] = [];

const SECTION_TYPES: SiteSectionType[] = [
  'hero', 'overview', 'concept', 'layout', 'presentation', 'walkthrough', 'diagram',
  'drawing', 'gallery', 'portfolio', 'spec', 'research', 'target', 'regulation',
  'process', 'zoning', 'flow', 'itemspec', 'comparison', 'custom',
];

/** §5: 実行時のデータ損失フットプリントで risk を判定する。 */
function classifyRisk(name: string, input: any): RiskLevel {
  const st = useProjectSiteStore.getState();
  const site = st.site;
  const page = site?.pages.find(p => p.id === st.activePageId) ?? site?.pages[0];
  switch (name) {
    case 'site_snapshot':
    case 'gallery_query':
      return 'low';
    case 'add_section':
    case 'reorder_sections':
    case 'add_asset_to_section':
    case 'set_theme':
      return 'low';
    case 'create_site_from_template':
      return site ? 'high' : 'low'; // 既存サイト上書きは高、初回は低
    case 'remove_section':
      return 'medium';
    case 'update_section': {
      // 既存のユーザー記述本文を上書きするなら medium、空欄への記入は low
      const sec = page?.sections.find(s => s.id === input?.sectionId);
      const overwritingBody = !!(input?.body && sec?.body && sec.body.trim());
      return overwritingBody ? 'medium' : 'low';
    }
    default:
      return 'low';
  }
}

const WRITE_TOOLS = new Set([
  'create_site_from_template', 'add_section', 'update_section', 'remove_section',
  'reorder_sections', 'add_asset_to_section', 'set_theme',
]);

/** ツールを実行し、tool_result の content（文字列）を返す。 */
async function executeTool(name: string, input: any): Promise<{ content: string; isError?: boolean }> {
  const store = useProjectSiteStore.getState();

  try {
    switch (name) {
      case 'site_snapshot':
        return { content: JSON.stringify(buildSiteSnapshot()) };

      case 'gallery_query': {
        const projectId = store.source?.id;
        if (!projectId) return { content: 'プロジェクトが特定できません。', isError: true };
        const items = await listProjectAssets(projectId);
        lastGalleryRefs = items.map(i => i.ref);
        let refs = lastGalleryRefs;
        if (input?.sourceApp) refs = refs.filter(r => r.sourceApp === input.sourceApp);
        if (input?.kind) refs = refs.filter(r => r.kind === input.kind);
        const compact = refs.slice(0, 40).map(r => ({ id: r.id, sourceApp: r.sourceApp, kind: r.kind, title: r.title }));
        return { content: JSON.stringify({ count: compact.length, assets: compact }) };
      }

      case 'create_site_from_template': {
        const family = input?.family;
        if (!['proposal', 'record', 'portfolio'].includes(family)) {
          return { content: '不正な family です。', isError: true };
        }
        await store.createFromTemplate(family);
        return { content: `テンプレ「${family}」でサイトを作成しました。` };
      }

      case 'add_section': {
        if (!store.site) return { content: 'サイトが未作成です。先に create_site_from_template を呼んでください。', isError: true };
        const type = SECTION_TYPES.includes(input?.type) ? input.type : 'custom';
        store.addSection(type);
        const newId = useProjectSiteStore.getState().selectedSectionId;
        const patch: Partial<SiteSection> = {};
        if (input?.title) patch.title = input.title;
        if (input?.body) patch.body = input.body;
        if (input?.variant) patch.variant = input.variant;
        if (newId && Object.keys(patch).length) useProjectSiteStore.getState().updateSection(newId, patch);
        return { content: `${type} セクションを追加しました（id=${newId}）。` };
      }

      case 'update_section': {
        if (!input?.sectionId) return { content: 'sectionId が必要です。', isError: true };
        const patch: Partial<SiteSection> = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.body !== undefined) patch.body = input.body;
        if (input.variant !== undefined) patch.variant = input.variant;
        store.updateSection(input.sectionId, patch);
        return { content: `セクション(${input.sectionId})を更新しました。` };
      }

      case 'remove_section':
        if (!input?.sectionId) return { content: 'sectionId が必要です。', isError: true };
        store.removeSection(input.sectionId);
        return { content: `セクション(${input.sectionId})を削除しました。` };

      case 'reorder_sections':
        if (!Array.isArray(input?.orderedIds)) return { content: 'orderedIds が必要です。', isError: true };
        store.reorderSections(input.orderedIds);
        return { content: '並び順を更新しました。' };

      case 'add_asset_to_section': {
        const ref = lastGalleryRefs.find(r => r.id === input?.assetId);
        if (!ref) return { content: 'assetId が gallery_query 結果に見つかりません。先に gallery_query を呼んでください。', isError: true };
        store.addAssetToSection(input.sectionId, ref);
        return { content: `アセット(${ref.id})を section(${input.sectionId})に追加しました。` };
      }

      case 'set_theme':
        store.setPersonality(input?.personality);
        return { content: `テーマを ${input?.personality} に設定しました。` };

      default:
        return { content: `未知のツール: ${name}`, isError: true };
    }
  } catch (e: any) {
    return { content: `ツール実行エラー: ${e?.message || e}`, isError: true };
  }
}

/** 計画カードに出す human-readable な要約行。 */
function describeToolCall(name: string, input: any): string {
  switch (name) {
    case 'create_site_from_template': return `サイトをテンプレ「${input?.family}」で生成（既存があれば上書き）`;
    case 'add_section': return `「${input?.title || input?.type}」セクションを追加`;
    case 'update_section': return `セクション(${input?.sectionId})の本文/見出しを更新`;
    case 'remove_section': return `セクション(${input?.sectionId})を削除`;
    case 'reorder_sections': return `セクションの並び替え`;
    case 'add_asset_to_section': return `アセットを section に追加`;
    case 'set_theme': return `テーマを ${input?.personality} に変更`;
    default: return name;
  }
}

export const useSekkeiyaAgent = create<SekkeiyaAgentState>((set) => ({
  running: false,
  pendingApproval: null,

  approve: () => { approvalResolver?.(true); approvalResolver = null; set({ pendingApproval: null }); },
  reject: () => { approvalResolver?.(false); approvalResolver = null; set({ pendingApproval: null }); },

  runAgent: async (text, sessionId) => {
    const chat = useAIChatStore.getState();
    if (sessionId) chat.addMessage({ sessionId, role: 'user', text, source: 'sidebar_chat' });

    set({ running: true });
    const messages: NeutralMsg[] = [{ role: 'user', content: text }];
    let finalText = '';

    try {
      const callable = httpsCallable(functions, 'agentTurn');

      for (let step = 0; step < STEP_CAP; step++) {
        const res: any = await callable({ messages });
        const result = res.data?.result;
        if (!result) throw new Error('agentTurn が空の結果を返しました。');

        const assistantText: string = result.text || '';
        const toolCalls: Array<{ id: string; name: string; input: any }> = result.toolCalls || [];
        if (assistantText) finalText = assistantText;

        // assistant ターンを履歴へ
        messages.push({ role: 'assistant', text: assistantText, toolCalls });

        if (result.stopReason !== 'tool_use' || toolCalls.length === 0) break;

        // 破壊的操作（medium/high）の承認: このターンの write tool をまとめて 1 枚のカードで確認
        const writeCalls = toolCalls.filter(tc => WRITE_TOOLS.has(tc.name));
        const risky = writeCalls.filter(tc => classifyRisk(tc.name, tc.input) !== 'low');
        let approvedRisky = true;
        if (risky.length > 0) {
          approvedRisky = await new Promise<boolean>((resolve) => {
            approvalResolver = resolve;
            set({
              pendingApproval: {
                title: '次の変更を適用しますか？',
                lines: risky.map(tc => '・' + describeToolCall(tc.name, tc.input)),
              },
            });
          });
        }

        // 実行 → tool_result 収集
        const results: NeutralMsg['results'] = [];
        for (const tc of toolCalls) {
          const isRisky = WRITE_TOOLS.has(tc.name) && classifyRisk(tc.name, tc.input) !== 'low';
          if (isRisky && !approvedRisky) {
            results!.push({ tool_use_id: tc.id, content: 'ユーザーが変更を却下しました。別の方法を提案してください。', is_error: true });
            continue;
          }
          const r = await executeTool(tc.name, tc.input);
          results!.push({ tool_use_id: tc.id, content: r.content, is_error: r.isError });
        }
        messages.push({ role: 'tool', results });
      }

      // バッチ保存（dirty なら）
      await useProjectSiteStore.getState().save();

      if (sessionId) {
        chat.addMessage({ sessionId, role: 'ai', text: finalText || '完了しました。', source: 'sidebar_chat' });
      }
    } catch (e: any) {
      console.error('[SekkeiyaAgent] failed:', e);
      if (sessionId) {
        chat.addMessage({ sessionId, role: 'ai', text: `エラー: ${e?.message || 'agentTurn 呼び出しに失敗しました。'}`, source: 'sidebar_chat' });
      }
      throw e;
    } finally {
      approvalResolver = null;
      set({ running: false, pendingApproval: null });
    }
  },
}));
