import React, { useState } from 'react';
import { Box, Typography, Button, TextField } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { ChatUi } from '../../store/useAIChatStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import { useAIChatStore } from '../../store/useAIChatStore';
import { useImagePickerStore } from '../../store/useImagePickerStore';
import { useBatchGenStore } from '../../store/useBatchGenStore';
import { useAppStore } from '../../store/useAppStore';
import { useFurniturePickerStore } from '../../store/useFurniturePickerStore';
import { MaterialSourcePickerDialog } from '../../features/dsmt/components/MaterialSourcePickerDialog';
import { ProductResultGrid } from '../../features/search/ProductResultGrid';
import { useChatProductResultsStore } from '../../store/useChatProductResultsStore';
import { useLightboxStore } from '../../store/useLightboxStore';
import { DEFAULT_CATEGORY_MAP } from '../../store/useUserSettingsStore';

// 検索語から S.Model 正典カテゴリの「詳細サブタイプ」を絞り込み候補として返す（非ブロッキングのチップ用）。
function refineSuggestions(query: string): string[] {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  for (const macro of Object.values(DEFAULT_CATEGORY_MAP)) {
    for (const [sub, details] of Object.entries(macro)) {
      const subL = sub.toLowerCase();
      const synChair = sub === 'チェア' && (q.includes('椅子') || q.includes('いす') || q.includes('chair'));
      const hit = q.includes(subL) || subL.includes(q) || (details as string[]).some((d) => q.includes(d.toLowerCase()));
      if (hit || synChair) return (details as string[]).slice(0, 7);
    }
  }
  return [];
}

const ACCENT = '#ffd740';

/** Claude Code 風の選択肢1行（番号/チェック + ラベル + 説明、フル幅のカード行）。 */
const OptionRow: React.FC<{
  index: number;
  label: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ index, label, description, selected, disabled, onClick }) => (
  <Box
    onClick={disabled ? undefined : onClick}
    sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1,
      p: 1, borderRadius: 1.5,
      border: `1px solid ${selected ? 'rgba(255,215,64,0.6)' : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
      bgcolor: selected ? 'rgba(255,215,64,0.1)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled && !selected ? 0.45 : 1,
      transition: 'all 0.12s',
      '&:hover': disabled ? {} : { borderColor: 'rgba(255,215,64,0.5)', bgcolor: 'rgba(255,215,64,0.08)' },
    }}
  >
    <Box sx={{
      flexShrink: 0, width: 18, height: 18, mt: '1px', borderRadius: '4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: selected ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.08)',
      color: selected ? '#1a1f2b' : 'rgb(var(--brand-fg-rgb) / 0.6)',
      fontSize: '0.6rem', fontWeight: 700,
    }}>
      {selected ? <CheckRoundedIcon sx={{ fontSize: '0.8rem' }} /> : index + 1}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-fg)', lineHeight: 1.3 }}>{label}</Typography>
      {description && (
        <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.4, mt: 0.25 }}>
          {description}
        </Typography>
      )}
    </Box>
  </Box>
);

/** 選択肢末尾の「その他（自由入力）」欄。Enter または送信ボタンで確定。 */
const OtherRow: React.FC<{
  index: number;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}> = ({ index, value, onChange, onSubmit }) => (
  <Box sx={{
    display: 'flex', alignItems: 'flex-start', gap: 1,
    p: 1, borderRadius: 1.5,
    border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
  }}>
    <Box sx={{
      flexShrink: 0, width: 18, height: 18, mt: '1px', borderRadius: '4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.6rem', fontWeight: 700,
    }}>
      {index + 1}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-fg)', lineHeight: 1.3, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <EditRoundedIcon sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
        その他（自由入力）
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
          placeholder="自由に入力して送信…"
          variant="standard"
          fullWidth
          multiline
          maxRows={3}
          InputProps={{ disableUnderline: false, sx: { fontSize: '0.72rem', color: 'var(--brand-fg)', '&:before': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover:not(.Mui-disabled):before': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&:after': { borderColor: ACCENT } } }}
        />
        <Button
          size="small" variant="contained" disabled={!value.trim()} onClick={onSubmit}
          sx={{ minWidth: 'auto', px: 1, py: 0.4, bgcolor: ACCENT, color: '#1a1f2b', '&:hover': { bgcolor: '#ffe082' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.35)' } }}
        >
          <SendRoundedIcon sx={{ fontSize: '0.85rem' }} />
        </Button>
      </Box>
    </Box>
  </Box>
);

/** チャット内マテリアルソース選択ボタン（open_material_source_picker yield ツール用）。 */
const MaterialSourcePickerInChat: React.FC<{
  toolUseId: string;
  currentProjectId?: string;
  resolved: boolean;
  resolvedData?: { created: number; skipped: number };
}> = ({ toolUseId, currentProjectId, resolved, resolvedData }) => {
  const [open, setOpen] = useState(false);
  if (resolved) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
        <CheckCircleRoundedIcon sx={{ fontSize: '0.85rem', color: '#66bb6a' }} />
        ソース選択済み
        {resolvedData && <Typography component="span" sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>（生成: {resolvedData.created}件）</Typography>}
      </Box>
    );
  }
  return (
    <>
      <Button size="small" variant="outlined" startIcon={<TextureRoundedIcon sx={{ fontSize: '0.9rem' }} />}
        onClick={() => setOpen(true)}
        sx={{ fontSize: '0.68rem', textTransform: 'none', color: '#ec407a', borderColor: 'rgba(236,64,122,0.5)', '&:hover': { borderColor: '#ec407a', bgcolor: 'rgba(236,64,122,0.08)' } }}>
        ソースと保存先を選ぶ
      </Button>
      <MaterialSourcePickerDialog
        open={open}
        currentProjectId={currentProjectId}
        toolUseId={toolUseId}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
};

/** AIメッセージに付随するクリック可能UI（選択肢 / 画像ピッカー / バッチ開始）を描画する。 */
export const ChatUiRenderer: React.FC<{ ui: ChatUi }> = ({ ui }) => {
  const resumeWithChoice = useCoreOrchestrator(s => s.resumeWithChoice);
  const sendMessage = useCoreOrchestrator(s => s.sendMessageToOrchestrator);
  const [multiSel, setMultiSel] = React.useState<string[]>([]);
  const [otherText, setOtherText] = React.useState('');
  const productResultsById = useChatProductResultsStore(s => s.byId);

  // 家具/商品検索の結果を共有グリッド（ProductResultGrid）でチャット内に表示。
  if (ui.kind === 'product_results') {
    const items = productResultsById[ui.resultId];
    const refine = refineSuggestions(ui.query);
    const searchRefine = (label: string) => {
      const sid = useAIChatStore.getState().activeSessionId || undefined;
      sendMessage(`${label}を探して`, { source: 'sidebar_chat', sessionId: sid });
    };
    return (
      <Box sx={{ width: '100%', mt: 0.75 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.75 }}>
          「{ui.query}」の検索結果 {ui.count} 件
        </Typography>
        {refine.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {refine.map((r) => (
              <Box key={r} onClick={() => searchRefine(r)}
                sx={{ px: 1, py: 0.35, borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(125,211,252,0.4)', color: 'light-dark(#0474a9, #7dd3fc)', fontSize: '0.66rem', fontWeight: 700, '&:hover': { bgcolor: 'rgba(125,211,252,0.12)' } }}>
                {r}
              </Box>
            ))}
          </Box>
        )}
        {items && items.length > 0 ? (
          <ProductResultGrid items={items} minTile={108} />
        ) : (
          <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            （結果はセッション内のみ保持されます。もう一度検索すると再表示できます）
          </Typography>
        )}
      </Box>
    );
  }

  if (ui.kind === 'choices') {
    const resolved = !!ui.resolved;
    const resolvedIds = ui.resolved?.ids ?? [];
    const resolvedText = ui.resolved?.text;

    const prefix = ui.prompt ? `${ui.prompt} ` : '';

    // 単一選択クリック → 即送信。pending がロスト（リロード等）なら新規メッセージで流れを復元。
    const pickOne = async (id: string, label: string) => {
      // 特別分岐: 家具ソース選択は LLM に流さず orchestrator が決定論的に処理（堂々巡り防止）。
      if (ui.intent === 'furniture_source') {
        useAIChatStore.getState().resolveMessageUi(ui.toolUseId, { resolved: { ids: [id] } });
        await useCoreOrchestrator.getState().resolveFurnitureSourceChoice(id, ui.context ?? {});
        return;
      }
      // 特別分岐: 「ボード」種別の確認。選択後に種別を明示した発話で通常フローへ流す
      // （プレゼンへの誤誘導を避けるため、モデルには曖昧なまま渡さない）。
      if (ui.intent === 'board_type') {
        useAIChatStore.getState().resolveMessageUi(ui.toolUseId, { resolved: { ids: [id] } });
        const followUp = id === 'research_board'
          ? 'Research & Memo の新しいボードを作成してください。'
          : '新しいプレゼンボード（S.Slide）を作成してください。';
        sendMessage(followUp, { source: 'sidebar_chat' });
        return;
      }
      const ok = await resumeWithChoice(ui.toolUseId, [id]);
      if (!ok) {
        useAIChatStore.getState().resolveMessageUi(ui.toolUseId, { resolved: { ids: [id] } });
        sendMessage(`${prefix}「${label}」`, { source: 'sidebar_chat' });
      }
    };

    // 「その他」自由入力を送信（単一・複数 共通）。
    const submitOther = async (text: string) => {
      const t = text.trim();
      if (!t) return;
      useAIChatStore.getState().resolveMessageUi(ui.toolUseId, { resolved: { ids: [], text: t } });
      const ok = await useCoreOrchestrator.getState().resumeWithToolResult(ui.toolUseId, JSON.stringify({ selected: [], custom: t }));
      if (!ok) sendMessage(t, { source: 'sidebar_chat' });
    };

    // 確定後の表示（行は無効化、自由入力なら回答を表示）。
    if (resolved) {
      return (
        <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
          {ui.prompt && (
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgb(var(--brand-fg-rgb) / 0.85)', mb: 0.75 }}>
              {ui.prompt}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {ui.choices.map((c, idx) => (
              <OptionRow key={c.id} index={idx} label={c.label} description={c.description}
                selected={resolvedIds.includes(c.id)} disabled />
            ))}
          </Box>
          {resolvedText && (
            <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
              <CheckCircleRoundedIcon sx={{ fontSize: '0.85rem', color: ACCENT }} />
              「{resolvedText}」と回答
            </Box>
          )}
        </Box>
      );
    }

    // 複数選択（各行トグル → 決定。その他も含めて送信可）
    if (ui.multiSelect) {
      const toggle = (id: string) =>
        setMultiSel(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
      const submitMulti = async () => {
        const t = otherText.trim();
        useAIChatStore.getState().resolveMessageUi(ui.toolUseId, { resolved: { ids: multiSel, text: t || undefined } });
        const ok = await useCoreOrchestrator.getState().resumeWithToolResult(
          ui.toolUseId,
          JSON.stringify({ selected: multiSel, ...(t ? { custom: t } : {}) }),
        );
        if (!ok) {
          const labels = ui.choices.filter(c => multiSel.includes(c.id)).map(c => c.label);
          const parts = [...labels, ...(t ? [t] : [])];
          sendMessage(`${prefix}${parts.map(p => `「${p}」`).join(' ')}`, { source: 'sidebar_chat' });
        }
      };
      return (
        <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
          {ui.prompt && (
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgb(var(--brand-fg-rgb) / 0.85)', mb: 0.75 }}>
              {ui.prompt}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {ui.choices.map((c, idx) => (
              <OptionRow key={c.id} index={idx} label={c.label} description={c.description}
                selected={multiSel.includes(c.id)} onClick={() => toggle(c.id)} />
            ))}
            <OtherRow index={ui.choices.length} value={otherText} onChange={setOtherText} onSubmit={submitMulti} />
          </Box>
          <Button
            size="small" variant="contained" disabled={multiSel.length === 0 && !otherText.trim()}
            onClick={submitMulti}
            sx={{ mt: 0.75, fontSize: '0.68rem', textTransform: 'none', bgcolor: ACCENT, color: '#1a1f2b', '&:hover': { bgcolor: '#ffe082' } }}
          >
            決定（{multiSel.length}件{otherText.trim() ? ' + 自由入力' : ''}）
          </Button>
        </Box>
      );
    }

    // 単一選択（クリックで即送信）＋ 末尾に「その他」自由入力
    return (
      <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
        {ui.prompt && (
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgb(var(--brand-fg-rgb) / 0.85)', mb: 0.75 }}>
            {ui.prompt}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {ui.choices.map((c, idx) => (
            <OptionRow
              key={c.id} index={idx} label={c.label} description={c.description}
              selected={false}
              onClick={() => pickOne(c.id, c.label)}
            />
          ))}
          <OtherRow index={ui.choices.length} value={otherText} onChange={setOtherText} onSubmit={() => submitOther(otherText)} />
        </Box>
      </Box>
    );
  }

  if (ui.kind === 'image_picker') {
    const resolved = !!ui.resolved;
    return (
      <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
        {resolved ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: '0.85rem', color: '#66bb6a' }} />
            {ui.resolved?.count ?? 0} 枚選択済み
          </Box>
        ) : (
          <Button
            size="small" variant="outlined" startIcon={<PhotoLibraryRoundedIcon sx={{ fontSize: '0.9rem' }} />}
            onClick={() => useImagePickerStore.getState().openPicker({ toolUseId: ui.toolUseId, purpose: ui.purpose, max: ui.max })}
            sx={{ fontSize: '0.68rem', textTransform: 'none', color: '#ec407a', borderColor: 'rgba(236,64,122,0.5)', '&:hover': { borderColor: '#ec407a', bgcolor: 'rgba(236,64,122,0.08)' } }}
          >
            S.Imageから画像を選ぶ
          </Button>
        )}
      </Box>
    );
  }

  if (ui.kind === 'batch_started') {
    return (
      <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgba(102,187,106,0.06)', border: '1px solid rgba(102,187,106,0.25)',
          borderRadius: 2, px: 1.25, py: 0.75,
        }}>
          <ViewInArRoundedIcon sx={{ fontSize: '1rem', color: '#66bb6a', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
              {ui.total - ui.skipped} 件の3D生成を開始しました（バックグラウンド）
            </Typography>
            {ui.skipped > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'light-dark(#ad6700, #ffb74d)' }}>
                  あと {ui.skipped} 件は今月の上限により実行できません
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => useAppStore.getState().openUserSettings(2)}
                  sx={{ fontSize: '0.58rem', textTransform: 'none', color: 'light-dark(#ad6700, #ffb74d)', p: '1px 4px', minWidth: 0, textDecoration: 'underline', lineHeight: 1.2 }}
                >
                  プランを確認
                </Button>
              </Box>
            )}
          </Box>
          <Button
            size="small" variant="text"
            onClick={() => useBatchGenStore.getState().setPanelOpen(true)}
            sx={{ fontSize: '0.6rem', textTransform: 'none', color: '#66bb6a', flexShrink: 0 }}
          >
            進捗を見る
          </Button>
        </Box>
      </Box>
    );
  }

  if (ui.kind === 'furniture_picker') {
    const resolved = !!ui.resolved;
    const pickerIsOpen = useFurniturePickerStore.getState().isOpen;
    return (
      <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
        {resolved ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: '0.85rem', color: '#66bb6a' }} />
            {ui.resolved?.count ?? 0} 件選択済み
          </Box>
        ) : (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: 'rgba(255,215,64,0.06)', border: '1px solid rgba(255,215,64,0.3)',
            borderRadius: 2, px: 1.25, py: 0.75,
          }}>
            <ViewInArRoundedIcon sx={{ fontSize: '1rem', color: 'light-dark(#ad8900, #ffd740)', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
                S.Model で家具を選択してください（候補 {ui.candidateCount} 件）
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.25 }}>
                カードにチェックを入れ「プロジェクトに追加」を押すと完了します
              </Typography>
            </Box>
            {!pickerIsOpen && (
              <Button
                size="small" variant="outlined"
                onClick={() => {
                  const activeProject = useAppStore.getState().getActiveProject();
                  if (activeProject) {
                    useAppStore.getState().setModelsScope('global_models');
                    import('../../features/launcher/launchWorkspace').then(({ launchWorkspace }) => {
                      launchWorkspace({ appScope: '3dss', projectId: activeProject.id, workspaceId: 'models', workspaceName: 'S.Model' });
                    });
                  }
                }}
                sx={{ fontSize: '0.65rem', textTransform: 'none', color: 'light-dark(#ad8900, #ffd740)', borderColor: 'rgba(255,215,64,0.4)', flexShrink: 0, '&:hover': { borderColor: '#ffd740' } }}
              >
                S.Model を開く
              </Button>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // ── material_source_picker: マテリアル生成ソース選択 ──────────────────────
  if (ui.kind === 'material_source_picker') {
    const resolved = !!ui.resolved;
    return (
      <MaterialSourcePickerInChat
        toolUseId={ui.toolUseId}
        currentProjectId={ui.currentProjectId}
        resolved={resolved}
        resolvedData={ui.resolved}
      />
    );
  }

  // ── material_gen_done: マテリアル生成完了カード ────────────────────────────
  if (ui.kind === 'material_gen_done') {
    return (
      <Box sx={{ width: '100%', maxWidth: '92%', mt: 0.75 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgba(236,64,122,0.06)', border: '1px solid rgba(236,64,122,0.25)',
          borderRadius: 2, px: 1.25, py: 0.75,
        }}>
          <TextureRoundedIcon sx={{ fontSize: '1rem', color: '#ec407a', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
              {ui.created} 件のマテリアルを生成しました
            </Typography>
            {ui.skipped > 0 && (
              <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.25 }}>
                重複スキップ: {ui.skipped} 件
              </Typography>
            )}
          </Box>
          <Button size="small" variant="text"
            onClick={() => import('../../features/launcher/launchWorkspace').then(({ launchWorkspace }) => {
              const projectId = useAppStore.getState().getActiveProject()?.id;
              if (projectId) launchWorkspace({ appScope: '3dsmt', projectId, workspaceId: 'material', workspaceName: 'S.Material' });
            })}
            sx={{ fontSize: '0.6rem', textTransform: 'none', color: '#ec407a', flexShrink: 0 }}>
            S.Materialを開く
          </Button>
        </Box>
      </Box>
    );
  }

  // ── render_results: S.Layout のレンダー結果を画像グリッドで表示 ─────────────
  if (ui.kind === 'render_results') {
    const renders = ui.renders ?? [];
    return (
      <Box sx={{ width: '100%', mt: 0.75 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.75 }}>
          レンダリング結果 {renders.length} 枚
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 0.75 }}>
          {renders.map((r, i) => (
            <Box
              key={r.id}
              component="img"
              src={r.url}
              loading="lazy"
              onClick={() => useLightboxStore.getState().show(
                renders.map((x, idx) => ({ url: x.url, caption: `レンダー ${idx + 1}` })),
                i,
              )}
              sx={{
                width: '100%', aspectRatio: '16 / 10', objectFit: 'cover',
                borderRadius: 1.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
                cursor: 'pointer', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
                transition: 'transform 0.12s, border-color 0.12s',
                '&:hover': { transform: 'scale(1.02)', borderColor: 'rgba(125,211,252,0.6)' },
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // ── navigate_result: ツール実行結果への遷移ボタン ──────────────────────────
  if (ui.kind === 'navigate_result') {
    const { setPendingProjectTab, setActiveProjectId } = useAppStore.getState();
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(67,233,123,0.07)', border: '1px solid rgba(67,233,123,0.2)', borderRadius: 2 }}>
        <Typography sx={{ fontSize: '0.75rem', color: '#43e97b', fontWeight: 700, mb: 1 }}>
          ✅ {ui.summary}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {ui.items.map((item, i) => {
            const Icon = item.action === 'open_schedule_tab' ? CalendarMonthRoundedIcon
                       : item.action === 'open_task_tab'     ? FactCheckRoundedIcon
                       : OpenInNewRoundedIcon;
            return (
              <Button key={i} size="small" startIcon={<Icon sx={{ fontSize: '13px !important' }}/>}
                onClick={() => {
                  if (item.projectId) {
                    // 'home' を指定して activeWorkspaceId=null（ProjectHome）に戻す
                    setActiveProjectId(item.projectId, 'home');
                  }
                  // ProjectHome の schedule タブに切り替え
                  setPendingProjectTab('schedule');
                }}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1.25, py: 0.375,
                  bgcolor: 'rgba(67,233,123,0.12)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.3)', borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(67,233,123,0.22)' } }}>
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Box>
    );
  }

  return null;
};
