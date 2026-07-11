/**
 * imageVerbs — SEKKEIYA Chat（司令塔）から画像を生成する汎用 verb。
 *
 * 2層構成の②: チャットは単発生成・複数案の一括出しを担い、生成物は必ず
 * プロジェクトの S.Image に保存する（共通サービス generateProjectImage 経由）。
 * 反復編集は S.Image エディタ（専門工房）へ誘導する。
 * リサーチボードへの配置が目的の場合は research_board_generate_image を使う。
 */
import type { VerbDef } from '../../../store/verb/verbTypes';

export const imageVerbs: VerbDef[] = [
  {
    name: 'generate_image',
    description:
      '画像を AI で生成し、プロジェクトの S.Image に自動保存する（内観パース・コンセプトイメージ・素材イメージなど）。' +
      'プロンプトには空間の用途・素材・光・時間帯・アングルを具体的に含めること。' +
      '1枚のときは完成を待って url を返すので、応答では必ず Markdown 画像 `![キャプション](url)` としてユーザーに見せること。' +
      '複数案（最大4枚）は prompts[] に1回の呼び出しでまとめる（バックグラウンド生成・完成次第 S.Image に保存）。' +
      '生成後にユーザーが「もっと調整したい・編集したい」場合は S.Image の該当画像から「AI編集」で続きができると案内する。' +
      'リサーチボードに並べたい場合はこの verb ではなく research_board_generate_image を使う。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '保存先プロジェクト ID（省略時はアクティブ）。' },
        prompt: { type: 'string', description: '1枚だけ生成する場合のプロンプト（複数枚は prompts を使う）。' },
        caption: { type: 'string', description: 'prompt 用のタイトル/キャプション（省略時はプロンプト冒頭）。' },
        prompts: {
          type: 'array',
          description: '複数案の一括生成（最大4件）。案出し・比較にはこちらを使う。',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: '生成プロンプト（日本語可）。' },
              caption: { type: 'string', description: 'タイトル/キャプション（省略時はプロンプト冒頭）。' },
            },
            required: ['prompt'],
          },
        },
      },
    },
    risk: 'medium',
    label: '画像を生成しています…（完成後 S.Image に保存）',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です（プロジェクトを選択してください）' });

      const MAX_BATCH = 4;
      const rawSpecs: Array<{ prompt: string; caption?: string }> = Array.isArray(ctx.input.prompts) && ctx.input.prompts.length > 0
        ? ctx.input.prompts
        : (ctx.input.prompt ? [{ prompt: ctx.input.prompt, caption: ctx.input.caption }] : []);
      const specs = rawSpecs
        .map((s) => ({ prompt: String(s?.prompt || '').trim(), caption: String(s?.caption || '').trim() }))
        .filter((s) => s.prompt)
        .slice(0, MAX_BATCH);
      if (specs.length === 0) return JSON.stringify({ ok: false, error: 'prompt または prompts が必要です' });
      const truncated = rawSpecs.length > MAX_BATCH ? rawSpecs.length - MAX_BATCH : 0;

      const { generateProjectImage } = await import('../../dsi/imageGenService');

      try {
        if (specs.length === 1) {
          // 1枚: 完成まで待って URL を返す（ローカル約30秒〜/クラウド約10秒〜1分）。
          const { url, provider } = await generateProjectImage({
            prompt: specs[0].prompt,
            projectId,
            title: specs[0].caption || undefined,
            extraTags: ['chat'],
          });
          return JSON.stringify({
            ok: true,
            url,
            provider,
            savedTo: 'S.Image（プロジェクト）',
            note:
              '生成が完了し、プロジェクトの S.Image に保存しました。' +
              '応答では必ず Markdown 画像 ![キャプション](url) で表示すること。' +
              'さらに調整したい場合は S.Image でこの画像を選び「AI編集」から続けられる、と一言添える。',
          });
        }

        // 複数案: バックグラウンドで並列生成し、完成し次第 S.Image に保存。
        for (const spec of specs) {
          void generateProjectImage({ prompt: spec.prompt, projectId, title: spec.caption || undefined, extraTags: ['chat'] })
            .catch((e) => console.warn('[generate_image] background generation failed:', spec.caption || spec.prompt.slice(0, 30), e));
        }
        return JSON.stringify({
          ok: true,
          started: specs.map((s) => s.caption || s.prompt.slice(0, 30)),
          skipped: truncated ? `${truncated}件は上限（${MAX_BATCH}枚/回）を超えたため未実行` : undefined,
          note:
            `${specs.length}枚の生成をバックグラウンドで開始しました。完成し次第プロジェクトの S.Image に保存されます（目安1〜2分）。` +
            '生成を待たずにその旨をユーザーへ伝え、対話を続けること。',
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'generate_image failed' });
      }
    },
  },
];
