import React, { useEffect, useState } from 'react';
import { Box, Divider, Tooltip, IconButton } from '@mui/material';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded';
import PermMediaRoundedIcon from '@mui/icons-material/PermMediaRounded';
import { BlogVideo } from './BlogVideo';
import { uploadBlogMedia } from './lib/blogMediaUpload';
import { MediaPickerDialog } from '../media-picker/MediaPickerDialog';
import type { MediaPickerItem } from '../media-picker/types';

const ACCENT = '#e57373';

interface BlogBodyEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** メディアアップロード先のユーザー。未指定だと画像/動画挿入は無効になる。 */
  uid?: string;
  /** プロジェクト記事のとき、その成果物もピッカーに含める。 */
  projectId?: string | null;
}

/**
 * S.Blog 本文の WYSIWYG（見たまま編集）エディタ。
 * 入出力は Markdown 文字列（draft.bodyMarkdown）で、サイト/検索連携はそのまま使える。
 */
export const BlogBodyEditor: React.FC<BlogBodyEditorProps> = ({ value, onChange, placeholder, uid, projectId }) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: false }),
      BlogVideo,
      Placeholder.configure({ placeholder: placeholder ?? '本文を書く...' }),
      // 動画は生 HTML(<video>) で round-trip するため html:true。
      Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const md = editor.storage.markdown.getMarkdown();
      onChange(md);
    },
  });

  // ピッカーで選んだ/アップロードしたメディアを本文へ挿入する。
  const insertItem = (item: MediaPickerItem) => {
    if (!editor) return;
    if (item.kind === 'video') {
      editor.chain().focus().setBlogVideo({ src: item.url }).run();
    } else {
      editor.chain().focus().setImage({ src: item.url }).run();
    }
  };

  // ピッカーのアップロードタブ：Firebase Storage へ上げて MediaPickerItem を返す。
  const handleUpload = async (file: File): Promise<MediaPickerItem> => {
    if (!uid) throw new Error('ログインが必要です');
    const { url, kind } = await uploadBlogMedia(uid, file);
    return { id: `upload:${url}`, url, thumbnailUrl: url, kind, source: 'drive', authorId: uid, title: file.name };
  };

  // 外部から value が差し替わったとき（下書きの読み込み・別記事への切替）にエディタを同期する。
  // 自分の onUpdate による更新ではループしないよう、現在の Markdown と一致する場合はスキップ。
  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown.getMarkdown();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <EditorToolbar
        editor={editor}
        canInsertMedia={!!uid}
        onOpenMediaPicker={() => setPickerOpen(true)}
      />
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={insertItem}
        uid={uid}
        projectId={projectId}
        accept={['image', 'video']}
        onUpload={uid ? handleUpload : undefined}
      />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          mt: 2,
          // ProseMirror 本体のダークテーマ・タイポグラフィ
          '& .ProseMirror': {
            outline: 'none',
            color: 'rgba(255,255,255,0.9)',
            fontSize: 15,
            lineHeight: 1.85,
            minHeight: '100%',
            '& > * + *': { marginTop: '0.85em' },
            '& h1': { fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginTop: '1.2em' },
            '& h2': { fontSize: 21, fontWeight: 700, color: '#fff', lineHeight: 1.35, marginTop: '1.1em' },
            '& h3': { fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginTop: '1em' },
            '& p': { margin: 0 },
            '& ul, & ol': { paddingLeft: '1.4em' },
            '& li': { marginTop: '0.25em' },
            '& li p': { margin: 0 },
            '& a': { color: ACCENT, textDecoration: 'underline' },
            '& blockquote': {
              borderLeft: `3px solid ${ACCENT}`,
              paddingLeft: '1em',
              margin: 0,
              color: 'rgba(255,255,255,0.6)',
              fontStyle: 'italic',
            },
            '& code': {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              bgcolor: 'rgba(255,255,255,0.08)',
              padding: '0.1em 0.35em',
              borderRadius: '4px',
            },
            '& pre': {
              bgcolor: 'rgba(0,0,0,0.35)',
              borderRadius: 2,
              padding: '0.9em 1em',
              overflowX: 'auto',
              '& code': { bgcolor: 'transparent', padding: 0, fontSize: 13 },
            },
            '& hr': { border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '1.4em 0' },
            '& img, & video': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
              display: 'block',
              margin: '0.5em 0',
            },
            // 選択中のメディア（atom ノード）に枠線
            '& .ProseMirror-selectednode': { outline: `2px solid ${ACCENT}`, outlineOffset: 2, borderRadius: '8px' },
            // プレースホルダ（空のとき）
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              float: 'left',
              color: 'rgba(255,255,255,0.3)',
              pointerEvents: 'none',
              height: 0,
            },
          },
        }}
      >
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </Box>
    </Box>
  );
};

// ── 整形ツールバー ──────────────────────────────────────
interface EditorToolbarProps {
  editor: Editor | null;
  canInsertMedia: boolean;
  onOpenMediaPicker: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, canInsertMedia, onOpenMediaPicker }) => {
  if (!editor) return null;

  const btnSx = (active: boolean) => ({
    color: active ? ACCENT : 'rgba(255,255,255,0.55)',
    bgcolor: active ? `${ACCENT}1f` : 'transparent',
    borderRadius: 1,
    p: 0.6,
    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
  });

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('リンク先 URL', prev ?? 'https://');
    if (url === null) return; // キャンセル
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <Box
      sx={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25,
        pb: 1.5,
      }}
    >
      <Tooltip title="見出し1"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><TitleRoundedIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
      <Tooltip title="見出し2"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><TitleRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      <Tooltip title="見出し3"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><TitleRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title="太字"><IconButton size="small" sx={btnSx(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><FormatBoldRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="斜体"><IconButton size="small" sx={btnSx(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><FormatItalicRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="コード"><IconButton size="small" sx={btnSx(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}><CodeRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="リンク"><IconButton size="small" sx={btnSx(editor.isActive('link'))} onClick={setLink}><LinkRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title="箇条書き"><IconButton size="small" sx={btnSx(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><FormatListBulletedRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="番号付きリスト"><IconButton size="small" sx={btnSx(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FormatListNumberedRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="引用"><IconButton size="small" sx={btnSx(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FormatQuoteRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="区切り線"><IconButton size="small" sx={btnSx(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}><HorizontalRuleRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title={canInsertMedia ? '画像・動画を挿入（AI Drive / 公開 / アップロード）' : 'ログインするとメディアを挿入できます'}>
        <span>
          <IconButton size="small" sx={btnSx(false)} disabled={!canInsertMedia} onClick={onOpenMediaPicker}>
            <PermMediaRoundedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
