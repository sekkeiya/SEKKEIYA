import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

// 画像の style / width を保持する（SVG図解スライドやAI画像を全幅で表示・保存するため）
const StyledImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute('style'),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Box, ButtonGroup, IconButton, Divider, Tooltip } from '@mui/material';
import { 
  FormatBold, FormatItalic, FormatUnderlined, FormatStrikethrough,
  FormatListBulleted, FormatListNumbered, FormatQuote,
  Code, Link as LinkIcon, Image as ImageIcon,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight
} from '@mui/icons-material';

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 0.5, 
      p: 1, 
      bgcolor: 'rgba(255, 255, 255, 0.02)', 
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      '& .MuiIconButton-root': {
        color: 'rgba(255,255,255,0.7)',
        borderRadius: 1,
        p: 1,
        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#fff' },
        '&.is-active': { bgcolor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }
      }
    }}>
      <ButtonGroup variant="text" size="small">
        <Tooltip title="Bold (Ctrl+B)">
          <IconButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
          >
            <FormatBold fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic (Ctrl+I)">
          <IconButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
          >
            <FormatItalic fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Underline (Ctrl+U)">
          <IconButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'is-active' : ''}
          >
            <FormatUnderlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Strikethrough">
          <IconButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'is-active' : ''}
          >
            <FormatStrikethrough fontSize="small" />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />

      <ButtonGroup variant="text" size="small">
        <Tooltip title="Heading 1">
          <IconButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
            sx={{ fontWeight: 'bold', fontSize: '1rem' }}
          >
            H1
          </IconButton>
        </Tooltip>
        <Tooltip title="Heading 2">
          <IconButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}
          >
            H2
          </IconButton>
        </Tooltip>
        <Tooltip title="Heading 3">
          <IconButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
            sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}
          >
            H3
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />

      <ButtonGroup variant="text" size="small">
        <Tooltip title="Align Left">
          <IconButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
          >
            <FormatAlignLeft fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Align Center">
          <IconButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
          >
            <FormatAlignCenter fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Align Right">
          <IconButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
          >
            <FormatAlignRight fontSize="small" />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />

      <ButtonGroup variant="text" size="small">
        <Tooltip title="Bullet List">
          <IconButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
          >
            <FormatListBulleted fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered List">
          <IconButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
          >
            <FormatListNumbered fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Blockquote">
          <IconButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'is-active' : ''}
          >
            <FormatQuote fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Code Block">
          <IconButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'is-active' : ''}
          >
            <Code fontSize="small" />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />

      <ButtonGroup variant="text" size="small">
        <Tooltip title="Link">
          <IconButton
            onClick={setLink}
            className={editor.isActive('link') ? 'is-active' : ''}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert Image via URL (Firebase WIP)">
          <IconButton onClick={addImage}>
            <ImageIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ButtonGroup>
    </Box>
  );
};

export default function TiptapEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      StyledImage,
      Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'ここに記事の本文を入力してください...'}),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // 外部（サーバー再読込・図解/AI画像の挿入・仕上げ）からの本文変更を反映する。
  // 編集中（フォーカス中）は上書きしない＝タイプ中のカーソルを守る。
  // emitUpdate=false で onChange を発火させず、挿入直後に本文が消えるのを防ぐ。
  React.useEffect(() => {
    if (!editor) return;
    const incoming = content || '';
    if (incoming !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(incoming, false);
    }
  }, [content, editor]);

  return (
    <Box sx={{ 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: 2, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'rgba(0,0,0,0.2)',
      minHeight: 400
    }}>
      <MenuBar editor={editor} />
      <Box sx={{ 
        p: 2, 
        flexGrow: 1, 
        cursor: 'text',
        '& .ProseMirror': {
          outline: 'none',
          minHeight: '320px',
          color: 'rgba(255,255,255,0.85)',
          typography: 'body1',
          lineHeight: 1.8,
          p: 1,
          '& p.is-editor-empty:first-of-type::before': {
            color: 'rgba(255,255,255,0.3)',
            content: 'attr(data-placeholder)',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
          '& a': { color: '#38bdf8', textDecoration: 'underline' },
          '& blockquote': {
            borderLeft: '3px solid rgba(255,255,255,0.2)',
            pl: 2,
            ml: 0,
            color: 'rgba(255,255,255,0.6)',
            fontStyle: 'italic'
          },
          '& img': { maxWidth: '100%', height: 'auto', borderRadius: 2 },
          '& pre': {
            bgcolor: '#121212',
            p: 2,
            borderRadius: 2,
            overflowX: 'auto',
            border: '1px solid rgba(255,255,255,0.05)',
            fontFamily: 'monospace',
          },
          '& code': {
            bgcolor: 'rgba(255,255,255,0.1)',
            px: 0.5,
            py: 0.2,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.9em'
          }
        }
      }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
