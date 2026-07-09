// AIによるワークフロー自動生成。
// 「基本はAIが組む・手動は微調整」方針の中核。capability の情報＋現在の定義＋指示文を
// agentTurn（汎用LLM窓口）へ渡し、WorkflowDef 相当の JSON を生成させて取り込む。
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { AutomationCapability } from '../../global-settings/automationCatalog';
import type { WorkflowDef, WorkflowStep, WorkflowParam, WorkflowParamType } from './workflowTypes';
import { VERB_LABEL } from './workflowDefaults';

/** LLM 応答テキストから最初の JSON オブジェクトを取り出してパースする。 */
function extractJson(text: string): any {
  // ```json フェンス優先、無ければ最初の { 〜 最後の }。
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

const PARAM_TYPES: WorkflowParamType[] = ['select', 'text', 'number', 'toggle'];

/** 生成 JSON を WorkflowDef に正規化（id 付与・型/verb の検証）。 */
function normalize(capId: string, allowedVerbs: string[], data: any): WorkflowDef {
  const verbsSet = new Set(allowedVerbs);

  const steps: WorkflowStep[] = (Array.isArray(data.steps) ? data.steps : [])
    .slice(0, 12)
    .map((s: any, i: number) => {
      const verb = typeof s?.verb === 'string' && verbsSet.has(s.verb) ? s.verb : undefined;
      const branches = Array.isArray(s?.branches) && s.branches.length > 0
        ? s.branches.slice(0, 6).map((b: any, j: number) => ({ id: `opt_${i}_${j}`, label: String(b?.label ?? b ?? '選択肢') }))
        : undefined;
      return {
        id: verb ?? `step_${i}`,
        label: String(s?.label ?? (verb ? (VERB_LABEL[verb] ?? verb) : `手順 ${i + 1}`)),
        verb,
        enabled: s?.enabled !== false,
        branches,
      };
    });
  if (steps.length === 0) throw new Error('AIがステップを生成できませんでした。');

  const triggers: string[] = (Array.isArray(data.triggers) ? data.triggers : [])
    .slice(0, 8)
    .map((t: any) => String(t))
    .filter((t: string) => t.trim().length > 0);

  const params: WorkflowParam[] = (Array.isArray(data.params) ? data.params : [])
    .slice(0, 8)
    .filter((p: any) => p && typeof p.key === 'string' && PARAM_TYPES.includes(p.type))
    .map((p: any) => ({
      key: p.key,
      label: String(p.label ?? p.key),
      type: p.type as WorkflowParamType,
      options: p.type === 'select' && Array.isArray(p.options) ? p.options.map(String) : undefined,
      value: String(p.value ?? (p.type === 'toggle' ? 'off' : '')),
    }));

  // layout は構成が変わるので破棄（自動レイアウトに戻す）。
  return { capabilityId: capId, triggers, steps, params };
}

/**
 * capability と指示文からワークフローを AI 生成する。
 * instruction が空なら「この作業に最適な構成の提案」を依頼する。
 */
export async function composeWorkflowWithAI(
  cap: AutomationCapability,
  current: WorkflowDef,
  instruction: string,
): Promise<WorkflowDef> {
  const verbCatalog = cap.verbs.map((v) => `- ${v}: ${VERB_LABEL[v] ?? v}`).join('\n');

  const prompt = [
    'あなたは SEKKEIYA（建築・インテリア設計アプリ）の「AIの受け答えガイド（ワークフロー）」を設計するアシスタントです。',
    '以下の自動化作業について、チャットAIが参照するワークフロー定義を JSON で提案してください。',
    'これは厳密なルールではなく AI が参照するガイドです。手順は人が読んで分かる日本語ラベルにしてください。',
    '',
    `## 作業`,
    `タイトル: ${cap.title}`,
    `説明: ${cap.description}`,
    `例: ${cap.example}`,
    '',
    '## 使える verb（実行ステップに割り当て可。これ以外の verb 名は使わない。verb の無い手順（確認・分岐など）は verb を null に）',
    verbCatalog || '（なし — すべて verb: null で構成）',
    '',
    '## 現在の定義（参考。指示が無い部分は良い所を引き継ぐ）',
    JSON.stringify({ triggers: current.triggers, steps: current.steps, params: current.params }, null, 2),
    '',
    '## ユーザーの指示',
    instruction.trim() || '（指示なし。この作業に最適なワークフロー構成を提案してください）',
    '',
    '## 出力形式（この JSON のみを返す。ツールは使わない。説明文・前置きは不要）',
    '{',
    '  "triggers": ["起動する言い回し（2〜5件、日本語）"],',
    '  "steps": [ { "label": "手順名（日本語）", "verb": "verb名 または null", "enabled": true, "branches": [ { "label": "選択肢" } ] または省略 } ],',
    '  "params": [ { "key": "snake_case", "label": "日本語ラベル", "type": "select|text|number|toggle", "options": ["selectのみ"], "value": "既定値" } ]',
    '}',
  ].join('\n');

  const callable = httpsCallable(functions, 'agentTurn');
  // 定型JSONの生成（ツール不使用・構成の整形のみ）なので低コストな Haiku で十分。
  // agentTurn はサーバー側で model を尊重する（model || DEFAULT_MODEL）。
  const res: any = await callable({ messages: [{ role: 'user', content: prompt }], model: 'claude-haiku-4-5-20251001' });
  const text: string = res?.data?.result?.text || '';
  if (!text) throw new Error('AIが応答を返しませんでした。時間をおいて再試行してください。');

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error('AIの応答をJSONとして解釈できませんでした。もう一度お試しください。');
  }
  return normalize(cap.id, cap.verbs, parsed);
}
