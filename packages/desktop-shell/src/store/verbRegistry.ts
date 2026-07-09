// Verb 中央レジストリ（docs/20 §1.2）。
// 全子アプリの VerbDef を集約する。dispatchAgentTool は VERB_MAP を優先実行し、
// 未移行の verb は従来の switch にフォールバックする（段階移行）。
//
// 新しい verb を足すときは、子アプリの chat/*Verbs.ts に VerbDef を追加し、
// ここで spread するだけ。schema は同一定義から Web 版 TOOLS[] へ生成同期する（gen-agent-tools、phase 2）。

import type { VerbDef } from './verb/verbTypes';
import { layoutVerbs } from '../features/dsl/layout/chat/layoutVerbs';
import { researchVerbs } from '../features/projects/chat/researchVerbs';
import { presentationVerbs } from '../features/dsp/chat/presentationVerbs';
import { driveVerbs } from '../features/drive/chat/driveVerbs';

export const ALL_VERBS: VerbDef[] = [
  ...layoutVerbs,
  ...researchVerbs,
  ...presentationVerbs,
  ...driveVerbs,
];

export const VERB_MAP: Map<string, VerbDef> = new Map(ALL_VERBS.map(v => [v.name, v]));

/** レジストリに登録（＝新方式で実行）されている verb 名か。 */
export function isRegisteredVerb(name: string): boolean {
  return VERB_MAP.has(name);
}
