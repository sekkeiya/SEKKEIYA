// backlog/RequirementRow.tsx — テーブルの「要件」行（＋要修正の修正チェックリスト行）を
// React.memo でラップした行コンポーネント。元 DevStatusPanel.renderRequirementRow / renderFixRows と
// 描画・挙動は同一。パネルの state/関数はすべて props 経由（クロージャ捕捉なし）で受け取るため、
// props が referentially 安定なら列幅ドラッグ等の高頻度再描画で行を再レンダーしない。
import React, { useMemo } from 'react';
import {
  Box, Tooltip, Chip, TableRow, TableCell, Checkbox, IconButton,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { statusOf } from '../devStatusLogic';
import { keyOf, type Platform } from './rowConstants';
import {
  InlineText, InlineAddInput, KindSelect, PlatformSelect, CategorySelect, ScreenSelect, StatusSelect, SprintSelect, AttachCell,
  KindDisplay, PlatformDisplay, ToolDisplay, ScreenDisplay, StatusDisplay, SprintDisplay,
} from './rowFields';
import { EditableCell } from './EditableCell';
import type { BacklogItem, Sprint } from '../DevStatusPanel';

export interface RequirementRowProps {
  item: BacklogItem;
  indented: boolean;
  sprints: Sprint[];
  parentPlatform: Platform | null;   // 親要求からの継承（PF）。孤立要件は null。
  parentCategory: string | null;     // 親要求からの継承（ツール）。孤立要件は null。
  toolOptions: string[];
  screenOptions: string[];
  checked: boolean;                  // この要件自身が実装/テスト依頼で選択されているか（プリミティブ）
  // 修正項目ごとのチェック状態を item.fixes と同じ並びのビット文字列で渡す（'1'=選択中）。
  // 呼び出し側（DevStatusPanel / RequestRow）が checked セットから都度その場で作る、この行専用の値。
  // Set をそのまま渡すと参照が毎回変わり React.memo が効かなくなるため、値比較できるプリミティブにする。
  fixCheckedBits: string;
  fixCollapsed: boolean;
  /** 非表示の列キー（CSV）。React.memo を効かせるため Set ではなく primitive で受け取る。 */
  hiddenColsCsv: string;
  /** colSpan 用の総列数（チェック+開閉+表示中の列+削除）。 */
  colCount: number;             // この要件の修正チェックリストを畳んでいるか
  // 履歴モード（過去スプリント閲覧）: 追加しても filterItemsBySprint に落とされ無反応に見えるため、
  // 「修正項目を追加」行を隠す。プリミティブ boolean のまま渡し、React.memo の効きを維持する。
  historical?: boolean;
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
}

const RequirementRowImpl: React.FC<RequirementRowProps> = ({
  item, indented, sprints, parentPlatform, parentCategory, toolOptions, screenOptions,
  checked, fixCheckedBits, fixCollapsed, hiddenColsCsv, colCount, historical, onToggleCheck, onToggleFixCollapse, onPatch, onRemove,
  onOpenDetail, onOpenAttach, onAddFix, onToggleFix, onUpdateFixText, onRemoveFix,
}) => {
  const st = statusOf(item);
  const done = st === 'done';
  const showFixes = st === 'rework' || (item.fixes?.length ?? 0) > 0;
  const fixes = item.fixes ?? [];
  // 非表示の列。show('reason') のように各セルの描画を判定する。
  const hiddenSet = useMemo(() => new Set(hiddenColsCsv ? hiddenColsCsv.split(',') : []), [hiddenColsCsv]);
  const show = (k: string) => !hiddenSet.has(k);
  const pl = indented ? 4.5 : 3;
  return (
    <>
      <TableRow hover sx={{ opacity: done ? 0.6 : 1, '& td': { py: 0.25 }, '& .row-del': { opacity: 0, transition: 'opacity .12s' }, '&:hover .row-del': { opacity: 1 } }}>
        <TableCell padding="none" align="center">
          <Checkbox size="small" checked={checked} onChange={() => onToggleCheck(item.id)} sx={{ p: 0.25 }} />
        </TableCell>
        <TableCell padding="none" align="center">
          {showFixes && (
            <IconButton size="small" onClick={() => onToggleFixCollapse(item.id)} sx={{ p: 0 }}>
              {fixCollapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        {show('content') && <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, pl: indented ? 1.25 : 0, minWidth: 0 }}>
            <Tooltip title={item.notes ? `詳細・メモ: ${item.notes}` : '詳細・メモを開く'} arrow>
              <Chip
                label={keyOf(item)} size="small" variant="outlined" onClick={() => onOpenDetail(item)}
                sx={{ fontFamily: 'monospace', fontSize: 11, height: 20, flexShrink: 0, mt: 0.25, cursor: 'pointer', borderColor: item.notes ? 'warning.main' : undefined, '&:hover': { borderColor: 'light-dark(#0875a6, #4fc3f7)' } }}
              />
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* 要件8: 内容はダイアログを開かずインライン編集 */}
              <InlineText value={item.title} required strike={done} onCommit={(v) => { if (v) onPatch(item.id, { title: v }); }} />
            </Box>
            {item.queue && (
              <Chip
                label={item.queue === 'implement' ? '実装待ち' : 'テスト待ち'}
                size="small"
                sx={{ height: 18, fontSize: 10, flexShrink: 0, mt: 0.25,
                  bgcolor: item.queue === 'implement' ? 'light-dark(rgba(8,117,166,0.16), rgba(79,195,247,0.2))' : 'light-dark(rgba(173,103,0,0.16), rgba(255,183,77,0.22))' }}
              />
            )}
          </Box>
        </TableCell>}
        {/* 要件9: 理由列 */}
        {show('reason') && <TableCell><InlineText value={item.reason} placeholder="理由…" onCommit={(v) => onPatch(item.id, { reason: v })} /></TableCell>}
        {/* Task 7（性能）: 分類系セルは非編集時＝軽量な表示ノード、クリック（Enter/Space）で
            初めて実コントロールをマウントし autoOpen で即プルダウンを開く。onClose で表示へ戻る。 */}
        {show('kind') && <TableCell>
          <EditableCell display={<KindDisplay value={item.kind} />}>
            {(close) => <KindSelect value={item.kind} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { kind: v })} />}
          </EditableCell>
        </TableCell>}
        {show('platform') && <TableCell>
          <EditableCell display={<PlatformDisplay value={item.platform} inherited={parentPlatform} />}>
            {(close) => <PlatformSelect value={item.platform} inherited={parentPlatform} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { platform: v })} />}
          </EditableCell>
        </TableCell>}
        {show('category') && <TableCell>
          <EditableCell display={<ToolDisplay value={item.category} inherited={parentCategory} />}>
            {(close) => <CategorySelect value={item.category} inherited={parentCategory} options={toolOptions} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { category: v })} />}
          </EditableCell>
        </TableCell>}
        {show('screen') && <TableCell>
          <EditableCell display={<ScreenDisplay value={item.screen} />}>
            {(close) => <ScreenSelect value={item.screen} options={screenOptions} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { screen: v })} />}
          </EditableCell>
        </TableCell>}
        {show('status') && <TableCell>
          <EditableCell display={<StatusDisplay value={st} />}>
            {(close) => <StatusSelect value={st} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { status: v, done: v === 'done' })} />}
          </EditableCell>
        </TableCell>}
        {show('sprint') && <TableCell>
          <EditableCell display={<SprintDisplay value={item.sprintId} sprints={sprints} />}>
            {(close) => <SprintSelect value={item.sprintId} sprints={sprints} autoOpen onClose={close} onChange={(v) => onPatch(item.id, { sprintId: v })} />}
          </EditableCell>
        </TableCell>}
        {show('attach') && <AttachCell item={item} onOpen={onOpenAttach} />}
        {/* 要件62: テスト結果（手動テストの合否/所見。notes とは別列） */}
        {show('testResult') && <TableCell><InlineText value={item.testResult} placeholder="テスト結果…" onCommit={(v) => onPatch(item.id, { testResult: v })} /></TableCell>}
        <TableCell padding="none" align="center">
          <IconButton className="row-del" size="small" onClick={() => onRemove(item)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
        </TableCell>
      </TableRow>
      {/* 修正項目のチェックリスト行（要修正の要件の下に表示。元 renderFixRows と同一） */}
      {showFixes && !fixCollapsed && (
        <>
          {fixes.map((fix, i) => (
            <TableRow key={fix.id} sx={{ '& td': { py: 0, borderBottom: 'none' }, '& .row-del': { opacity: 0, transition: 'opacity .12s' }, '&:hover .row-del': { opacity: 1 } }}>
              {/* 要件23: 左＝実装/テスト実行の選択（四角チェック） */}
              <TableCell padding="none" align="center">
                <Checkbox size="small" checked={fixCheckedBits[i] === '1'} onChange={() => onToggleCheck(fix.id)} sx={{ p: 0.25 }} />
              </TableCell>
              <TableCell padding="none" />
              <TableCell colSpan={colCount - 2}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, pl }}>
                  <Chip label={`修正${item.seq ?? '?'}-${i + 1}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 10, height: 18, flexShrink: 0, mt: 0.25 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <InlineText value={fix.text} required strike={fix.done} onCommit={(v) => { if (v) onUpdateFixText(item, fix.id, v); }} />
                  </Box>
                  {/* 要件23: 右＝完了（丸チェックで選択と区別） */}
                  <Tooltip title={fix.done ? '完了' : '未完了にする'} arrow>
                    <Checkbox
                      size="small" checked={fix.done} onChange={() => onToggleFix(item, fix.id)}
                      icon={<CheckCircleOutlineRoundedIcon fontSize="small" />} checkedIcon={<CheckCircleOutlineRoundedIcon fontSize="small" />}
                      sx={{ p: 0.25, color: 'text.disabled', '&.Mui-checked': { color: 'success.main' } }}
                    />
                  </Tooltip>
                  <IconButton className="row-del" size="small" onClick={() => onRemoveFix(item, fix.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {!historical && (
            <TableRow sx={{ '& td': { py: 0, borderBottom: 'none' } }}>
              <TableCell padding="none" />
              <TableCell padding="none" />
              <TableCell colSpan={colCount - 2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl }}>
                  <AddRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  <InlineAddInput placeholder="修正項目を追加…" fontSize={12} maxWidth={400} onAdd={(t) => onAddFix(item, t)} />
                </Box>
              </TableCell>
            </TableRow>
          )}
        </>
      )}
    </>
  );
};

export const RequirementRow = React.memo(RequirementRowImpl);
