// S.Slide テンプレートの verb 定義（docs/20 方式・docs/24 フェーズB-2）。
// 「毎回同じテンプレに画像/文字を差し替えて提案書を作る」をチャットから実行する。
//
// - list_presentation_templates … 自作/公開テンプレとその「差し替え枠(slot)」を列挙
// - apply_presentation_template  … テンプレの枠に値を流し込んで新規プレゼンを生成し、エディタで開く
//
// 実行体はフェーズB-1の純粋関数 fillSlots をそのまま再利用する（手動フォームと同一ロジック）。
// ※ サーバー(agentTurn)側 TOOLS[] にも同名スキーマの登録が必要（別リポ）。docs/24 §3.5 / rules draft 参照。

import type { VerbDef } from '../../../store/verb/verbTypes';
import type { PresentationContent, PresentationElement } from '../types/dsp.types';
import { collectSlots, fillSlots } from '../lib/templateSlots';
import { applyPresentationOps, type PresentationEditOp } from '../lib/presentationEdits';

/** テキストを丸めてトークンを浪費しない。 */
function trim(text: string | undefined, max = 120): string | undefined {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ─── build_slides_from_layout: レイアウト spec → PresentationContent（docs/26）───
const CANVAS_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 1280, height: 960 },
  'a3': { width: 1587, height: 1122 },
  'a4': { width: 1587, height: 1122 },
};

function layoutToPresentation(spec: any): PresentationContent {
  const canvas = CANVAS_MAP[spec?.canvas] || CANVAS_MAP['16:9'];
  const W = canvas.width, H = canvas.height;
  const fontScale: Record<string, number> = { title: 0.05, heading: 0.032, body: 0.018, caption: 0.013 };
  let seq = 0;
  const newId = () => `el-${Date.now().toString(36)}-${seq++}`;
  let slotSeq = 0;

  const slides = Array.isArray(spec?.slides) ? spec.slides : [];
  const pages = slides.map((sl: any, si: number) => {
    let z = 0;
    const elements: PresentationElement[] = (Array.isArray(sl?.elements) ? sl.elements : []).flatMap((el: any) => {
      const bb = el?.bbox || {};
      const x = Math.round((Number(bb.x) || 0) * W);
      const y = Math.round((Number(bb.y) || 0) * H);
      const w = Math.round((Number(bb.w) || 0) * W);
      const h = Math.round((Number(bb.h) || 0) * H);
      if (w <= 0 || h <= 0) return [];
      const base: any = { id: newId(), x, y, w, h, zIndex: z++, rotation: 0, opacity: 100 };
      const kind = el?.type === 'image' ? 'image' : el?.type === 'shape' ? 'shape' : 'text';

      const makeSlot = (sk: 'text' | 'image') => (el?.slot
        ? { slot: { id: `slot-${slotSeq++}`, role: String(el?.role || sk), kind: sk, label: el?.label ? String(el.label) : undefined } }
        : {});

      if (kind === 'image') {
        return [{ ...base, type: 'image', data: { src: '', alt: el?.label || el?.role || '画像枠' }, ...makeSlot('image') }];
      }
      if (kind === 'shape') {
        return [{ ...base, type: 'shape', data: { shapeType: 'rect', fill: el?.fill || 'rgba(0,0,0,0.06)' } }];
      }
      const fs = Math.max(10, Math.round(W * (fontScale[el?.fontScale] ?? fontScale.body)));
      return [{ ...base, type: 'text', data: {
        text: String(el?.text || ''), fontSize: `${fs}px`, color: el?.color || '#1d1d1f',
        textAlign: el?.align || 'left', fontWeight: el?.fontScale === 'title' || el?.fontScale === 'heading' ? '700' : '400',
      }, ...makeSlot('text') }];
    });
    return { id: `page-${Date.now().toString(36)}-${si}`, name: `スライド ${si + 1}`, elements };
  });

  if (pages.length === 0) pages.push({ id: `page-${Date.now().toString(36)}`, name: 'スライド 1', elements: [] });
  return { pages, canvasSize: { width: W, height: H, name: '画像から生成' } };
}

/** 1要素をチャット向けにコンパクトへ要約（編集対象を id で特定できる最小情報）。 */
function summarizeElement(el: PresentationElement): Record<string, any> {
  const d = el.data as any;
  const out: Record<string, any> = { id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h };
  if (el.type === 'text') {
    out.text = trim(d?.text, 80);
    if (d?.color) out.color = d.color;
    if (d?.fontSize) out.fontSize = d.fontSize;
    if (d?.textAlign) out.textAlign = d.textAlign;
    if (d?.fontWeight) out.fontWeight = d.fontWeight;
  } else if (el.type === 'image') {
    out.hasImage = !!d?.src;
    if (d?.alt) out.alt = trim(d.alt, 40);
  } else if (el.type === 'shape') {
    out.shapeType = d?.shapeType;
    if (d?.fill) out.fill = d.fill;
  }
  if (el.opacity != null && el.opacity !== 100) out.opacity = el.opacity;
  if (el.rotation) out.rotation = el.rotation;
  if (el.slot?.id) out.slot = { id: el.slot.id, role: el.slot.role, kind: el.slot.kind, label: el.slot.label };
  return out;
}

export const presentationVerbs: VerbDef[] = [
  {
    name: 'get_open_presentation',
    description:
      'S.Slide のエディタで「いま開いているプレゼンテーション」の中身を取得する。' +
      'ユーザーが開いているプレゼンをチャットで編集したいとき、edit_presentation を呼ぶ前に必ずこれで現状を把握する。' +
      '返り値: workFileId / name / canvasSize（width,height）/ pages[]（id・name・要素一覧）。' +
      '各 element は id / type(text|image|shape|…) / x,y,w,h（ピクセル座標）と、text の本文・色・文字サイズ、image の有無、shape の種別などを持つ。' +
      'この element の id を edit_presentation の各 op の elementId に、page の id を pageId に使う。' +
      'プレゼンが開かれていない場合は notOpen:true を返す（その場合はテンプレから apply_presentation_template で作るか、ユーザーに開いてもらう）。',
    input: { type: 'object', properties: {} },
    risk: 'low',
    label: '開いているプレゼンを確認しています…',
    handler: async () => {
      try {
        const { useDspStore } = await import('../store/useDspStore');
        const s = useDspStore.getState();
        const content = s.presentation;
        if (!content) {
          return JSON.stringify({
            ok: true,
            notOpen: true,
            note: 'S.Slide のエディタでプレゼンが開かれていません。テンプレートから作る場合は list_presentation_templates → apply_presentation_template を、既存を編集する場合はユーザーに対象プレゼンを開いてもらってください。',
          });
        }
        const MAX_ELEMENTS = 140;
        let budget = MAX_ELEMENTS;
        let truncated = false;
        const pages = content.pages.map((p, i) => {
          const els = p.elements || [];
          const take = els.slice(0, Math.max(0, budget));
          if (take.length < els.length) truncated = true;
          budget -= take.length;
          return {
            id: p.id,
            name: p.name,
            index: i,
            elementCount: els.length,
            elements: take.map(summarizeElement),
          };
        });
        return JSON.stringify({
          ok: true,
          workFileId: s.workFileId,
          name: s.workFileName,
          canvasSize: content.canvasSize
            ? { width: content.canvasSize.width, height: content.canvasSize.height }
            : { width: 1280, height: 720 },
          selectedPageId: s.selectedPageId,
          pageCount: content.pages.length,
          pages,
          truncated: truncated || undefined,
          note: '編集は edit_presentation に ops 配列を渡す。座標は canvasSize 基準のピクセル。変更後はエディタに即反映され、undo で元に戻せる。',
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'get_open_presentation failed' });
      }
    },
  },

  {
    name: 'edit_presentation',
    description:
      'いま S.Slide で開いているプレゼンテーションを、指定した編集操作(ops)の配列で書き換える。' +
      'テンプレートのスロットに縛られず、任意の要素・スライドを自由に編集できる（ユーザーの「こう直して」に応える本命ツール）。' +
      '必ず先に get_open_presentation で現在の element/page の id を把握してから呼ぶこと。' +
      'ops は上から順に適用され、変更はエディタに即反映＆undo一回で戻せる。座標(x,y,w,h)は canvasSize 基準のピクセル。' +
      '各 op の種類: ' +
      'set_text{elementId,text} テキスト本文を変更 / ' +
      'set_style{elementId,color?,fontSize?(px数値可),fontWeight?,textAlign?,fill?,opacity?(0-100),bgcolor?} 見た目を変更 / ' +
      'set_image{elementId,src(https画像URL),alt?} 画像を差し替え / ' +
      'move{elementId,x?,y?,w?,h?,rotation?,opacity?} 位置・サイズ・回転 / ' +
      'add_text{pageId?,text,x?,y?,w?,h?,fontSize?,color?,textAlign?,fontWeight?} テキスト追加 / ' +
      'add_shape{pageId?,shapeType?(rect|circle),fill?,x?,y?,w?,h?} 図形追加 / ' +
      'add_image{pageId?,src,alt?,x?,y?,w?,h?} 画像追加 / ' +
      'delete_element{elementId} 要素削除 / ' +
      'add_slide{afterPageId?,name?} スライド追加 / delete_slide{pageId} / duplicate_slide{pageId} スライド複製。' +
      'pageId 省略時は先頭スライド。画像URLは https のみ（data: 不可）。',
    input: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: '適用する編集操作の配列（上から順に適用）。各要素は op フィールドで種類を指定する。',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: [
                  'set_text', 'set_style', 'set_image', 'move',
                  'add_text', 'add_shape', 'add_image', 'delete_element',
                  'add_slide', 'delete_slide', 'duplicate_slide',
                ],
                description: '編集操作の種類。',
              },
              elementId: { type: 'string', description: '対象要素の id（set_*/move/delete_element）。' },
              pageId: { type: 'string', description: '対象/追加先ページの id（add_*/delete_slide/duplicate_slide）。' },
              afterPageId: { type: 'string', description: 'add_slide でこのページの直後に挿入。' },
              text: { type: 'string', description: 'set_text / add_text の本文。' },
              src: { type: 'string', description: 'set_image / add_image の画像URL(https)。' },
              alt: { type: 'string', description: '画像の代替テキスト。' },
              color: { type: 'string', description: '文字色 #rrggbb。' },
              fill: { type: 'string', description: '図形/背景の塗り色。' },
              bgcolor: { type: 'string', description: '要素の背景色。' },
              fontSize: { type: ['number', 'string'], description: '文字サイズ（px 数値または "24px"）。' },
              fontWeight: { type: 'string', description: '文字の太さ（400/700 等）。' },
              textAlign: { type: 'string', enum: ['left', 'center', 'right'], description: '文字揃え。' },
              shapeType: { type: 'string', enum: ['rect', 'circle'], description: 'add_shape の図形種別。' },
              name: { type: 'string', description: 'add_slide のスライド名。' },
              x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
              rotation: { type: 'number', description: '回転角（度）。' },
              opacity: { type: 'number', description: '不透明度 0–100。' },
            },
            required: ['op'],
          },
        },
      },
      required: ['ops'],
    },
    risk: 'medium',
    label: 'プレゼンを編集しています…',
    handler: async (ctx) => {
      try {
        const ops = Array.isArray(ctx.input?.ops) ? (ctx.input.ops as PresentationEditOp[]) : [];
        if (ops.length === 0) return JSON.stringify({ ok: false, error: 'ops が空です' });

        const { useDspStore } = await import('../store/useDspStore');
        const s = useDspStore.getState();
        const content = s.presentation;
        if (!content) {
          return JSON.stringify({
            ok: false,
            notOpen: true,
            error: 'S.Slide でプレゼンが開かれていません。先に対象プレゼンを開くか、テンプレから作成してください。',
          });
        }

        const result = applyPresentationOps(content, ops);
        if (!result.changed) {
          return JSON.stringify({
            ok: false,
            applied: 0,
            errors: result.errors,
            error: '有効な編集がありませんでした（対象IDや op を get_open_presentation で再確認してください）。',
          });
        }

        useDspStore.getState().applyAiEdit(result.content);

        return JSON.stringify({
          ok: true,
          applied: result.applied.length,
          appliedOps: result.applied,
          errors: result.errors.length ? result.errors : undefined,
          note: `${result.applied.length}件の編集を反映しました${result.errors.length ? `（${result.errors.length}件は失敗）` : ''}。エディタに即反映済み・undoで元に戻せます。`,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'edit_presentation failed' });
      }
    },
  },

  {
    name: 'list_presentation_templates',
    description:
      'S.Slide のユーザーテンプレート（提案書などの雛形）と、その「差し替え枠(slot)」の一覧を取得する。' +
      'テンプレを使って提案書を作る前に必ず呼び、どのテンプレにどんな差し替え枠があるかを把握すること。' +
      '返り値の templates[] は id / name / description / category / visibility / slideCount と ' +
      'slots[]（id=差し替えキー / role=意味づけ / kind: text|image / label=表示名 / placeholder）を持つ。' +
      'この slots の id を apply_presentation_template の slots に使って中身を流し込む。',
    input: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['mine', 'public', 'all'], description: '取得範囲。mine=自分（既定）/ public=公開テンプレ / all=両方。' },
        category: { type: 'string', enum: ['proposal', 'list', 'report', 'portfolio', 'other'], description: 'カテゴリで絞り込み（任意）。' },
      },
    },
    risk: 'low',
    label: 'テンプレートを確認しています…',
    handler: async (ctx) => {
      try {
        const scope = ['mine', 'public', 'all'].includes(ctx.input?.scope) ? ctx.input.scope : 'mine';
        const category = ctx.input?.category;
        const { dspTemplateRepository } = await import('../api/dspTemplateRepository');
        const { useAuthStore } = await import('../../../store/useAuthStore');
        const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;

        const collected: any[] = [];
        if (scope === 'mine' || scope === 'all') {
          if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });
          collected.push(...await dspTemplateRepository.listMyTemplates(uid));
        }
        if (scope === 'public' || scope === 'all') {
          collected.push(...await dspTemplateRepository.listPublicTemplates(category));
        }

        // 重複排除（all のとき自分の公開テンプレが両方に出る）
        const seen = new Set<string>();
        const templates = collected
          .filter(t => (!category || t.category === category))
          .filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)))
          .map(t => ({
            id: t.id,
            name: t.name,
            description: trim(t.description),
            category: t.category,
            visibility: t.visibility,
            slideCount: t.slideCount,
            slots: collectSlots(t.content).map(s => ({
              id: s.id, role: s.role, kind: s.kind, label: s.label, placeholder: s.placeholder,
            })),
          }));

        return JSON.stringify({ ok: true, count: templates.length, templates });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'list_presentation_templates failed' });
      }
    },
  },

  {
    name: 'apply_presentation_template',
    description:
      '指定したテンプレートの差し替え枠に値を流し込んで、新しいプレゼンテーションを生成しエディタで開く。' +
      'まず list_presentation_templates で templateId と slots を確認してから呼ぶこと。' +
      'slots は { 差し替えキー: 値 } のオブジェクト。キーは slot の id（または role）を使う。' +
      'text 枠には文字列、image 枠には画像URL（https。data: URL不可）を渡す。' +
      '空欄・未指定の枠はテンプレートの元の内容を保持する。テンプレのレイアウト・装飾は変更されない。',
    input: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: '適用するテンプレートの ID（list_presentation_templates で取得）。' },
        projectId: { type: 'string', description: '生成先プロジェクト ID（省略時はアクティブ）。' },
        name: { type: 'string', description: '新しいプレゼンテーション名（省略時はテンプレ名＋日付）。' },
        slots: {
          type: 'object',
          description: '差し替え枠に流し込む値。{ slotId(またはrole): 値 }。text=文字列 / image=画像URL(https)。省略した枠は元のまま。',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['templateId'],
    },
    risk: 'medium',
    label: 'テンプレートから提案書を作成しています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input?.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です（アクティブなプロジェクトを選択してください）' });
      const templateId = String(ctx.input?.templateId || '');
      if (!templateId) return JSON.stringify({ ok: false, error: 'templateId が必要です' });

      try {
        const [{ dspTemplateRepository }, { dspRepository }, { useAuthStore }, { useAppStore }] = await Promise.all([
          import('../api/dspTemplateRepository'),
          import('../api/dspRepository'),
          import('../../../store/useAuthStore'),
          import('../../../store/useAppStore'),
        ]);
        const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });

        const tpl = await dspTemplateRepository.getTemplate(templateId);
        if (!tpl) return JSON.stringify({ ok: false, error: 'テンプレートが見つかりません' });

        // slots を slotId キーに正規化（role で渡された場合も受け付ける）
        const rawSlots: Record<string, string> = (ctx.input?.slots && typeof ctx.input.slots === 'object') ? ctx.input.slots : {};
        const defs = collectSlots(tpl.content);
        const byId = new Set(defs.map(s => s.id));
        const roleToId = new Map(defs.filter(s => s.role).map(s => [s.role, s.id]));
        const values: Record<string, string> = {};
        const unknown: string[] = [];
        for (const [k, v] of Object.entries(rawSlots)) {
          if (typeof v !== 'string') continue;
          if (byId.has(k)) values[k] = v;
          else if (roleToId.has(k)) values[roleToId.get(k)!] = v;
          else unknown.push(k);
        }

        const filled = fillSlots(tpl.content, values);
        const name = String(ctx.input?.name || '').trim()
          || `${tpl.name} ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}`;

        const wf = await dspRepository.createPresentationWorkFile(projectId, name, uid, 'presentation', filled);
        dspTemplateRepository.incrementUsage(templateId).catch(() => {});

        // エディタへ遷移（AI が組み立てた提案書をその場で見せる）
        const store = useAppStore.getState();
        store.setActiveProjectId(projectId);
        store.setDspScope('project_presentations');
        store.setPanelSelection('presents', wf);
        store.setLastLaunchPayload({ projectId, workspaceId: 'presents', appScope: '3dsp' });
        store.setActiveWorkspaceId('presents');
        store.setCurrentMainView('workspace');
        store.setDspShellMode('editor');
        window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId } }));

        return JSON.stringify({
          ok: true,
          workFileId: wf.id,
          name,
          filledSlots: Object.keys(values),
          unknownSlots: unknown.length ? unknown : undefined,
          note: `テンプレ「${tpl.name}」から提案書「${name}」を作成し、エディタで開きました。差し替えた枠: ${Object.keys(values).length}件。`,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'apply_presentation_template failed' });
      }
    },
  },

  {
    name: 'build_slides_from_layout',
    description:
      'スライド画像（提案書・ポートフォリオ等）を解析したレイアウトから、差し替え枠つきのスライドを生成しエディタで開く。' +
      'ユーザーがスライド画像を添付して「この画像からテンプレートを作って」等と求めたときに使う。' +
      '画像をよく見て、各要素の位置を bbox（スライドに対する割合 0〜1: x,y=左上, w,h=幅高さ）で推定すること。' +
      '写真・作例画像は type=image かつ slot=true（空の差し替え枠にする＝画像自体は取り込まない）。' +
      'タイトルや案件名など可変の文字は type=text・slot=true。見出し/本文のダミー文は text に入れる。' +
      'ロゴ・ページ番号・帯や区切りなどの装飾は slot=false（固定）。type=shape は装飾矩形。' +
      'role には意味（project-title / exterior-photo / body-text 等）、label には日本語表示名（外観写真・案件名 等）を付ける。' +
      'fontScale で文字の大きさの目安（title/heading/body/caption）を示す。1スライドずつが最も正確。',
    input: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '生成先プロジェクト ID（省略時はアクティブ）。' },
        name: { type: 'string', description: '生成するプレゼン名（省略時は日付）。' },
        canvas: { type: 'string', enum: ['16:9', '4:3', 'a3', 'a4'], description: 'スライドの縦横比（既定 16:9）。画像の比率に合わせる。' },
        slides: {
          type: 'array',
          description: '生成するスライドの配列（通常は1枚）。',
          items: {
            type: 'object',
            properties: {
              elements: {
                type: 'array',
                description: 'スライド上の要素。奥（背景）→手前の順で並べる。',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['text', 'image', 'shape'], description: 'text=文字 / image=画像枠 / shape=装飾矩形。' },
                    bbox: {
                      type: 'object',
                      description: 'スライドに対する割合 0〜1。',
                      properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
                      required: ['x', 'y', 'w', 'h'],
                    },
                    text: { type: 'string', description: 'type=text の文字（ダミー文でよい）。' },
                    role: { type: 'string', description: '意味づけ（project-title / exterior-photo / body-text 等）。' },
                    slot: { type: 'boolean', description: '差し替え枠にするか。写真枠・可変テキストは true、装飾は false。' },
                    label: { type: 'string', description: 'slot の表示名（日本語可: 外観写真・案件名 等）。' },
                    align: { type: 'string', enum: ['left', 'center', 'right'], description: 'type=text の整列。' },
                    fontScale: { type: 'string', enum: ['title', 'heading', 'body', 'caption'], description: '文字サイズの目安。' },
                    fill: { type: 'string', description: 'type=shape の塗り色（#rrggbb）。' },
                  },
                  required: ['type', 'bbox'],
                },
              },
            },
            required: ['elements'],
          },
        },
      },
      required: ['slides'],
    },
    risk: 'medium',
    label: '画像からスライドを起こしています…',
    handler: async (ctx) => {
      const projectId = ctx.resolveProjectId(ctx.input?.projectId);
      if (!projectId) return JSON.stringify({ ok: false, error: 'projectId が必要です（アクティブなプロジェクトを選択してください）' });
      const slides = Array.isArray(ctx.input?.slides) ? ctx.input.slides : [];
      if (slides.length === 0) return JSON.stringify({ ok: false, error: 'slides が空です（画像からレイアウトを推定してください）' });

      try {
        const [{ dspRepository }, { useAuthStore }, { useAppStore }] = await Promise.all([
          import('../api/dspRepository'),
          import('../../../store/useAuthStore'),
          import('../../../store/useAppStore'),
        ]);
        const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });

        const content = layoutToPresentation(ctx.input);
        const name = String(ctx.input?.name || '').trim()
          || `画像から生成 ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}`;

        const wf = await dspRepository.createPresentationWorkFile(projectId, name, uid, 'presentation', content);

        const store = useAppStore.getState();
        store.setActiveProjectId(projectId);
        store.setDspScope('project_presentations');
        store.setPanelSelection('presents', wf);
        store.setLastLaunchPayload({ projectId, workspaceId: 'presents', appScope: '3dsp' });
        store.setActiveWorkspaceId('presents');
        store.setCurrentMainView('workspace');
        store.setDspShellMode('editor');
        window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId } }));

        const slotCount = content.pages.reduce((n, p) => n + p.elements.filter(e => (e as any).slot).length, 0);
        const elCount = content.pages.reduce((n, p) => n + p.elements.length, 0);
        return JSON.stringify({
          ok: true,
          workFileId: wf.id,
          name,
          slides: content.pages.length,
          elements: elCount,
          slots: slotCount,
          note: `画像から ${content.pages.length}枚・要素${elCount}個（差し替え枠${slotCount}個）を起こし、エディタで開きました。位置は概算なので必要に応じて調整し、「テンプレートとして保存」で登録できます。`,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'build_slides_from_layout failed' });
      }
    },
  },
];
