// Mermaid ソースを SVG に描画するプレビュー。mermaid は重い（>1MB）ため動的 import し、
// 初期化はモジュール内で 1 回だけ行う。
// 注意: mermaid の initialize はグローバル設定。ai-canvas の MermaidShapeUtil が theme:'default' で
// 再初期化する可能性があるが、同時使用時の実害は配色のみ（描画は壊れない）。
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

let mermaidLoading: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  if (!mermaidLoading) {
    mermaidLoading = import('mermaid').then((m) => {
      // ダークシェル前提のテーマ。securityLevel strict で script 混入を遮断（AI 生成テキストを描画するため必須）。
      m.default.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      return m.default;
    }).catch((e) => {
      // 失敗した Promise を残すと以後ずっと同じエラーを返すため、キャッシュを捨てて次回再試行できるようにする。
      mermaidLoading = null;
      throw e;
    });
  }
  return mermaidLoading;
}

let renderSeq = 0; // mermaid.render の要素 id 衝突防止

export default function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    void (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: rendered } = await mermaid.render(`skcode-diagram-${++renderSeq}`, code);
        if (alive) { setSvg(rendered); setError(null); }
      } catch (e) {
        // パースエラーでも画面全体を壊さない（Discrete fetch block の思想）。ソースは親側で見える。
        if (alive) { setSvg(''); setError(e instanceof Error ? e.message : String(e)); }
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [code]);

  if (busy) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={24} /></Box>;
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>Mermaid の描画に失敗しました</Typography>
        <Typography variant="caption" component="pre" sx={{ color: 'error.main', whiteSpace: 'pre-wrap', mt: 0.5 }}>{error}</Typography>
      </Box>
    );
  }
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2, '& svg': { maxWidth: '100%', height: 'auto' } }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
