// backlog/RequestRow.tsx — テーブルの「要求」グループ（親見出し行 ＋ 子要件行 ＋ 追加行）を
// React.memo でラップした行コンポーネント。元 DevStatusPanel.renderRequestRows と描画・挙動は同一。
// 子要件は RequirementRow を直接描画する（親要求の PF/ツールを継承値として渡す）。
// パネルの派生配列（allKids / kids）は親側で useMemo 済みの安定参照を受け取り、列幅ドラッグ等の
// 高頻度再描画で本行と子行が再レンダーしないようにする。
import React, { useMemo } from 'react';
import {
  Box, Typography, Tooltip, Chip, TableRow, TableCell, Checkbox, IconButton,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { isDone } from '../devStatusLogic';
import { keyOf, COL_COUNT } from './rowConstants';
import { InlineText, InlineAddInput, PlatformSelect, CategorySelect, PlatformDisplay, ToolDisplay, Dash, AttachCell } from './rowFields';
import { EditableCell } from './EditableCell';
import { RequirementRow } from './RequirementRow';
import type { BacklogItem, Sprint } from '../DevStatusPanel';

export interface RequestRowProps {
  req: BacklogItem;
  allKids: BacklogItem[];              // 進捗カウント用（全件・安定参照）
  kids: BacklogItem[];                 // 表示用（ソート/フィルタ適用済み・安定参照）
  expanded: boolean;
  sprints: Sprint[];
  usedTools: string[];
  usedScreens: string[];
  // 要求チェックボックスの tri-state（autoCheckIds ∩ checked セットから DevStatusPanel 側で算出済み）。
  // プリミティブにすることで checked セット全体の参照変化がこの行の再描画を引き起こさないようにする。
  csChecked: boolean;
  csIndeterminate: boolean;
  // 子要件（kids）の選択/修正チェック状態を「この要求に関係する id だけ」のカンマ区切り文字列で受け取る。
  // Set をそのまま渡すと参照が毎回変わり React.memo が効かなくなるため、DevStatusPanel 側で
  // kids + その fixes の id に絞ってその場で作った値を渡す（無関係な行の切替では内容が変わらない）。
  checkedIdsCsv: string;
  fixCollapsedIdsCsv: string;
  onToggleRequestCheck: (reqId: string) => void;
  onToggleCollapse: (reqId: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleFixCollapse: (id: string) => void;
  onPatch: (id: string, data: Record<string, unknown>) => void;
  onRemove: (item: BacklogItem) => void;
  onOpenDetail: (item: BacklogItem) => void;
  onOpenAttach: (id: string) => void;
  onAddFix: (item: BacklogItem, text: string) => void;
  onToggleFix: (item: BacklogItem, id: string) => void;
  onUpdateFixText: (item: BacklogItem, id: string, text: string) => void;
  onRemoveFix: (item: BacklogItem, id: string) => void;
  onAddChild: (req: BacklogItem, text: string) => void;
}

const RequestRowImpl: React.FC<RequestRowProps> = ({
  req, allKids, kids, expanded, sprints, usedTools, usedScreens,
  csChecked, csIndeterminate, checkedIdsCsv, fixCollapsedIdsCsv, onToggleRequestCheck, onToggleCollapse, onToggleCheck,
  onToggleFixCollapse, onPatch, onRemove, onOpenDetail, onOpenAttach,
  onAddFix, onToggleFix, onUpdateFixText, onRemoveFix, onAddChild,
}) => {
  const doneCount = allKids.filter(isDone).length;
  const allDone = allKids.length > 0 && doneCount === allKids.length;
  // 要求チェックボックスの tri-state は DevStatusPanel 側で算出済みのプリミティブをそのまま使う。
  const cs = { checked: csChecked, indeterminate: csIndeterminate };
  // kids（表示対象の子要件）＋その修正項目に絞った選択/畳み状態を、この行の中でだけ Set に戻す。
  // csv はこの要求に関係する id だけを含むので、無関係な行の切替では内容が変わらずここも走らない。
  const checkedSet = useMemo(() => new Set(checkedIdsCsv ? checkedIdsCsv.split(',') : []), [checkedIdsCsv]);
  const fixCollapsedSet = useMemo(() => new Set(fixCollapsedIdsCsv ? fixCollapsedIdsCsv.split(',') : []), [fixCollapsedIdsCsv]);
  // 子要件は親要求の PF/ツールを継承する（元 renderRequirementRow の parentOf(item) は req）。
  const parentPlatform = req.platform ?? null;
  const parentCategory = req.category ?? null;
  return (
    <>
      <TableRow sx={{ bgcolor: 'action.hover', '& td': { py: 0.5, borderBottom: 'none' }, '& .row-del': { opacity: 0, transition: 'opacity .12s' }, '&:hover .row-del': { opacity: 1 } }}>
        <TableCell padding="none" align="center">
          <Checkbox size="small" checked={cs.checked} indeterminate={cs.indeterminate} onChange={() => onToggleRequestCheck(req.id)} sx={{ p: 0.25 }} />
        </TableCell>
        <TableCell padding="none" align="center">
          <IconButton size="small" onClick={() => onToggleCollapse(req.id)}>
            {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Tooltip title="詳細・要件を開く" arrow>
              <Chip
                label={keyOf(req)} size="small" variant="outlined" onClick={() => onOpenDetail(req)}
                sx={{ fontFamily: 'monospace', fontSize: 11, height: 22, flexShrink: 0, cursor: 'pointer', '&:hover': { borderColor: 'light-dark(#0875a6, #4fc3f7)' } }}
              />
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* 要件15: 要求の内容もダイアログを開かずインライン編集 */}
              <InlineText value={req.title} required bold strike={allDone} onCommit={(v) => { if (v) onPatch(req.id, { title: v }); }} />
            </Box>
            {allKids.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>{doneCount}/{allKids.length}</Typography>
            )}
          </Box>
        </TableCell>
        <TableCell><Dash /></TableCell>{/* 理由 */}
        <TableCell><Dash /></TableCell>{/* 種別 */}
        {/* Task 7（性能）: 要求行の既定 PF / 既定ツールも表示⇄編集を分離（クリックで即オープン）。 */}
        <TableCell>
          <EditableCell display={<PlatformDisplay value={req.platform} placeholder="既定PF" />}>
            {(close) => <PlatformSelect value={req.platform} placeholder="既定PF" autoOpen onClose={close} onChange={(v) => onPatch(req.id, { platform: v })} />}
          </EditableCell>
        </TableCell>
        <TableCell>
          <EditableCell display={<ToolDisplay value={req.category} placeholder="既定ツール" />}>
            {(close) => <CategorySelect value={req.category} options={usedTools} placeholder="既定ツール" autoOpen onClose={close} onChange={(v) => onPatch(req.id, { category: v })} />}
          </EditableCell>
        </TableCell>
        <TableCell><Dash /></TableCell>
        <TableCell>
          {allDone
            ? <Chip label="完了" size="small" color="success" sx={{ height: 20 }} />
            : (allKids.length ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{Math.round((doneCount / allKids.length) * 100)}%</Typography> : <Dash />)}
        </TableCell>
        <TableCell><Dash />{/* スプリント */}</TableCell>
        <AttachCell item={req} onOpen={onOpenAttach} />
        <TableCell><Dash />{/* テスト結果は要件のみ */}</TableCell>
        <TableCell padding="none" align="center">
          <IconButton className="row-del" size="small" onClick={() => onRemove(req)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
        </TableCell>
      </TableRow>
      {expanded && kids.map(k => (
        <RequirementRow
          key={k.id}
          item={k}
          indented
          sprints={sprints}
          parentPlatform={parentPlatform}
          parentCategory={parentCategory}
          usedTools={usedTools}
          usedScreens={usedScreens}
          checked={checkedSet.has(k.id)}
          fixCheckedBits={(k.fixes ?? []).map(f => checkedSet.has(f.id) ? '1' : '0').join('')}
          fixCollapsed={fixCollapsedSet.has(k.id)}
          onToggleCheck={onToggleCheck}
          onToggleFixCollapse={onToggleFixCollapse}
          onPatch={onPatch}
          onRemove={onRemove}
          onOpenDetail={onOpenDetail}
          onOpenAttach={onOpenAttach}
          onAddFix={onAddFix}
          onToggleFix={onToggleFix}
          onUpdateFixText={onUpdateFixText}
          onRemoveFix={onRemoveFix}
        />
      ))}
      {expanded && (
        <TableRow sx={{ '& td': { py: 0.25, borderBottom: 'none' } }}>
          <TableCell padding="none" />
          <TableCell colSpan={COL_COUNT - 1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2.5 }}>
              <AddRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              <InlineAddInput placeholder={`${keyOf(req)} に要件を追加…（親のPF/アプリを継承）`} maxWidth={460} onAdd={(t) => onAddChild(req, t)} />
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export const RequestRow = React.memo(RequestRowImpl);
