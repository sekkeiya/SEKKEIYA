import React, { useEffect, useState, useMemo } from 'react';
import { BlockNoteEditor } from '@blocknote/core';
import type { PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { Box } from '@mui/material';

interface JournalBlockEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
}

export const JournalBlockEditor: React.FC<JournalBlockEditorProps> = ({ 
  initialMarkdown, 
  onChange, 
  editable = true,
  onImageUpload
}) => {
  const [initialBlocks, setInitialBlocks] = useState<PartialBlock[] | "loading">("loading");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      // Use a temporary editor instance to parse the markdown
      const tempEditor = BlockNoteEditor.create();
      const blocks = await tempEditor.tryParseMarkdownToBlocks(initialMarkdown || "");
      if (isMounted) {
        setInitialBlocks(blocks);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []); // Only run on mount. Parent should control remounts using key prop.
  
  // To avoid focus loss, we should ONLY load on mount or when entry changes completely.

  return <EditorCore initialBlocks={initialBlocks} onChange={onChange} editable={editable} onImageUpload={onImageUpload} />;
};

const EditorCore = ({ 
  initialBlocks, 
  onChange, 
  editable,
  onImageUpload
}: { 
  initialBlocks: PartialBlock[] | "loading", 
  onChange: (markdown: string) => void,
  editable: boolean,
  onImageUpload?: (file: File) => Promise<string>
}) => {
  const editor = useMemo(() => {
    if (initialBlocks === "loading") return null;
    return BlockNoteEditor.create({ 
      initialContent: initialBlocks,
      uploadFile: onImageUpload
    });
  }, [initialBlocks, onImageUpload]);

  if (!editor) {
    return <Box sx={{ p: 2, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>Loading editor...</Box>;
  }

  return (
    <BlockNoteView 
      editor={editor} 
      editable={editable}
      theme="dark"
      onChange={async () => {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        onChange(markdown);
      }}
    />
  );
};
