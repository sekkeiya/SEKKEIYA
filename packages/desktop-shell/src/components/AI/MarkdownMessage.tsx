import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  /** Markdown 本文。 */
  text: string;
  /** 直近に届いた新規メッセージなら 1 文字ずつタイプ表示する。 */
  isNew?: boolean;
  /** タイプ中に呼ばれる（自動スクロール用）。 */
  onType?: () => void;
}

/**
 * AI 返信を Markdown として人が読みやすい形に描画する。
 * 表・太字・箇条書き・見出し・コードなどを整形（GitHub Flavored Markdown）。
 * isNew のときは従来どおりタイプライター表示にし、伸びていく部分文字列を
 * その都度 Markdown としてレンダリングする（途中の崩れは一瞬で、完了時に整う）。
 */
const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ text, isNew = false, onType }) => {
  const [shown, setShown] = useState(isNew ? '' : text);

  useEffect(() => {
    if (!isNew) {
      setShown(text);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.substring(0, i));
      if (onType) onType();
      if (i >= text.length) clearInterval(id);
    }, 15);
    return () => clearInterval(id);
  }, [text, isNew, onType]);

  return (
    <Box
      sx={{
        // 親 Typography のタイポグラフィを踏襲
        fontSize: '0.75rem',
        fontWeight: 300,
        lineHeight: 1.6,
        wordBreak: 'break-word',
        // ブロック要素の余白を詰める
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& p': { my: 0.75 },
        '& h1, & h2, & h3, & h4': { fontWeight: 600, lineHeight: 1.3, mt: 1.5, mb: 0.75 },
        '& h1': { fontSize: '1.15rem' },
        '& h2': { fontSize: '1.05rem' },
        '& h3': { fontSize: '0.95rem' },
        '& h4': { fontSize: '0.85rem' },
        '& strong': { fontWeight: 600 },
        '& ul, & ol': { my: 0.5, pl: 2.5 },
        '& li': { my: 0.25 },
        '& li > p': { my: 0 },
        '& a': { color: 'light-dark(#0a45a4, #8ab4f8)', textDecoration: 'underline' },
        '& hr': { border: 'none', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', my: 1.25 },
        '& blockquote': {
          m: 0, my: 0.75, pl: 1.25,
          borderLeft: '2px solid rgb(var(--brand-fg-rgb) / 0.2)',
          color: 'rgb(var(--brand-fg-rgb) / 0.7)',
        },
        // インライン / ブロック コード
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '0.85em',
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
          px: 0.5, py: 0.125, borderRadius: '4px',
        },
        '& pre': {
          my: 0.75, p: 1.25, borderRadius: '6px', overflowX: 'auto',
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        },
        '& pre code': { bgcolor: 'transparent', p: 0, fontSize: '0.8rem' },
        // 表
        '& .md-table-wrap': { overflowX: 'auto', my: 1 },
        '& table': { borderCollapse: 'collapse', width: 'auto', minWidth: '100%', fontSize: '0.72rem' },
        '& th, & td': {
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
          px: 1, py: 0.5, textAlign: 'left', verticalAlign: 'top',
        },
        '& th': { fontWeight: 600, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 表は横スクロール可能なラッパで包む（狭いパネルでの崩れ防止）
          table: ({ children }) => <div className="md-table-wrap"><table>{children}</table></div>,
          // リンクは新規タブで開く
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {shown}
      </ReactMarkdown>
    </Box>
  );
};

export default MarkdownMessage;
