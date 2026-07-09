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
import type { BlogStyle } from './types';
import { DEFAULT_BLOG_STYLE } from './types';
import { buildArticleProseSx, getArticlePalette, ARTICLE_MEASURE } from './articleTheme';

const ACCENT = '#e57373';

interface BlogBodyEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** メディアアップロード先のユーザー。未指定だと画像/動画挿入は無効になる。 */
  uid?: string;
  /** プロジェクト記事のとき、その成果物もピッカーに含める。 */
  projectId?: string | null;
  /** ブログのスタイル設定（🎨）。誌面テーマ（articleTheme）でエディタの見た目に反映する。 */
  blogStyle?: BlogStyle;
  /** 紙面の先頭（本文の上）に載せる要素。タイトル入力を渡すと本文と一緒にスクロールする誌面になる。 */
  header?: React.ReactNode;
  /** 本文中の画像クリック時（右サイドバーの差し替え/再生成パネルを開く用） */
  onImageClick?: (src: string, alt: string) => void;
}

/**
 * S.Blog 本文の WYSIWYG（見たまま編集）エディタ。
 * 入出力は Markdown 文字列（draft.bodyMarkdown）で、サイト/検索連携はそのまま使える。
 */
export const BlogBodyEditor: React.FC<BlogBodyEditorProps> = ({ value, onChange, placeholder, uid, projectId, blogStyle, header, onImageClick }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const style = blogStyle ?? DEFAULT_BLOG_STYLE;
  const pal = getArticlePalette(style.preset);

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
      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }} />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          // 紙面 — プリセットの紙色。アプリテーマに依存せず、公開ページと同じ色味で執筆する。
          bgcolor: pal.bg,
          // 誌面カラム: 最適行長（measure）に収めて中央寄せ。Webマガジンの本文組みと同じ。
          '& .tiptap-article-column': {
            width: '100%', maxWidth: ARTICLE_MEASURE, mx: 'auto', px: 3, pt: 5, pb: 12,
          },
          // ProseMirror 本体 — タイポグラフィは articleTheme（プリセット＋アクセント色）が決める
          '& .ProseMirror': {
            outline: 'none',
            minHeight: '55vh',
            ...buildArticleProseSx(style),
            // 選択中のメディア（atom ノード）に枠線
            '& .ProseMirror-selectednode': { outline: `2px solid ${ACCENT}`, outlineOffset: 2, borderRadius: '8px' },
            // プレースホルダ（空のとき）
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              float: 'left',
              color: pal.sub,
              opacity: 0.7,
              pointerEvents: 'none',
              height: 0,
            },
          },
        }}
      >
        <Box
          className="tiptap-article-column"
          onClick={(e) => {
            // 本文中の画像クリック → 差し替え/再生成パネル（DsbEditor側）を開く
            const t = e.target as HTMLElement;
            if (onImageClick && t?.tagName === 'IMG') {
              const img = t as HTMLImageElement;
              onImageClick(img.getAttribute('src') || img.src, img.getAttribute('alt') || '');
            }
          }}
        >
          {header}
          <EditorContent editor={editor} />
        </Box>
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
    color: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.55)',
    bgcolor: active ? `${ACCENT}1f` : 'transparent',
    borderRadius: 1,
    p: 0.6,
    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
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
        px: 2.5, pb: 1.5,
      }}
    >
      <Tooltip title="見出し1"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><TitleRoundedIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
      <Tooltip title="見出し2"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><TitleRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      <Tooltip title="見出し3"><IconButton size="small" sx={btnSx(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><TitleRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title="太字"><IconButton size="small" sx={btnSx(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><FormatBoldRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="斜体"><IconButton size="small" sx={btnSx(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><FormatItalicRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="コード"><IconButton size="small" sx={btnSx(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}><CodeRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="リンク"><IconButton size="small" sx={btnSx(editor.isActive('link'))} onClick={setLink}><LinkRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title="箇条書き"><IconButton size="small" sx={btnSx(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><FormatListBulletedRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="番号付きリスト"><IconButton size="small" sx={btnSx(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FormatListNumberedRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="引用"><IconButton size="small" sx={btnSx(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FormatQuoteRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="区切り線"><IconButton size="small" sx={btnSx(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}><HorizontalRuleRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', mx: 0.5, my: 0.75 }} />

      <Tooltip title={canInsertMedia ? '画像・動画を挿入（SEKKEIYA Drive / 公開 / アップロード）' : 'ログインするとメディアを挿入できます'}>
        <span>
          <IconButton size="small" sx={btnSx(false)} disabled={!canInsertMedia} onClick={onOpenMediaPicker}>
            <PermMediaRoundedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
