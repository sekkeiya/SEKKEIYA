import React, { useEffect } from 'react';
import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded';

const ACCENT = '#38bdf8';

interface OfficialBodyEditorProps {
  value: string;                       // HTML 文字列
  onChange: (html: string) => void;    // HTML 文字列を返す
  placeholder?: string;
}

/**
 * 公式ブログ本文の WYSIWYG エディタ。入出力は HTML 文字列（officialArticles.body）。
 * アカウントブログの BlogBodyEditor は Markdown 入出力なので別コンポーネントにしている
 * （公開サイトが HTML として描画するため、公式は HTML のまま round-trip する）。
 */
export const OfficialBodyEditor: React.FC<OfficialBodyEditorProps> = ({ value, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? '本文を書く...' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // 外部から value が差し替わったとき（記事の切替・AI挿入など）にエディタ内容を同期する。
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('リンク先 URL', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ToolBar editor={editor} onLink={setLink} />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box
        sx={{
          flex: 1, overflowY: 'auto', mt: 1.5,
          '& .ProseMirror': {
            outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: '0.98rem', lineHeight: 1.9, minHeight: 320,
            '& h2': { color: '#fff', fontWeight: 800, fontSize: '1.35rem', mt: 3, mb: 1 },
            '& h3': { color: '#fff', fontWeight: 800, fontSize: '1.12rem', mt: 2.5, mb: 0.75 },
            '& h4': { color: '#fff', fontWeight: 700, fontSize: '1rem', mt: 2, mb: 0.5 },
            '& p': { mb: 1.5 },
            '& ul, & ol': { pl: 3, mb: 1.5 },
            '& li': { mb: 0.5 },
            '& strong': { color: '#fff' },
            '& a': { color: ACCENT, textDecoration: 'underline' },
            '& blockquote': { borderLeft: `3px solid ${ACCENT}55`, pl: 2, ml: 0, my: 1.5, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic' },
            '& img': { maxWidth: '100%', borderRadius: 6, my: 1 },
            '& hr': { border: 'none', borderTop: '1px solid rgba(255,255,255,0.14)', my: 2 },
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)', float: 'left', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', height: 0,
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};

const ToolBar: React.FC<{ editor: Editor; onLink: () => void }> = ({ editor, onLink }) => {
  const btn = (active: boolean) => ({
    color: active ? ACCENT : 'rgba(255,255,255,0.6)', p: 0.6,
    bgcolor: active ? `${ACCENT}1f` : 'transparent',
    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
  });
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap', pb: 1 }}>
      <Tooltip title="見出し H2"><IconButton size="small" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} sx={btn(editor.isActive('heading', { level: 2 }))}><TitleRoundedIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
      <Tooltip title="太字"><IconButton size="small" onClick={() => editor.chain().focus().toggleBold().run()} sx={btn(editor.isActive('bold'))}><FormatBoldRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Tooltip title="斜体"><IconButton size="small" onClick={() => editor.chain().focus().toggleItalic().run()} sx={btn(editor.isActive('italic'))}><FormatItalicRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 0.5 }} />
      <Tooltip title="箇条書き"><IconButton size="small" onClick={() => editor.chain().focus().toggleBulletList().run()} sx={btn(editor.isActive('bulletList'))}><FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Tooltip title="番号リスト"><IconButton size="small" onClick={() => editor.chain().focus().toggleOrderedList().run()} sx={btn(editor.isActive('orderedList'))}><FormatListNumberedRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Tooltip title="引用"><IconButton size="small" onClick={() => editor.chain().focus().toggleBlockquote().run()} sx={btn(editor.isActive('blockquote'))}><FormatQuoteRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 0.5 }} />
      <Tooltip title="リンク"><IconButton size="small" onClick={onLink} sx={btn(editor.isActive('link'))}><LinkRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      <Tooltip title="区切り線"><IconButton size="small" onClick={() => editor.chain().focus().setHorizontalRule().run()} sx={btn(false)}><HorizontalRuleRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
    </Box>
  );
};
