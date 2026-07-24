import React from 'react';
import { Box, Typography, Chip, Tabs, Tab } from '@mui/material';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { DssMaterialPresets } from './DssMaterialPresets';
import { DssFurnitureSwap } from './DssFurnitureSwap';
import WalkthroughMetadataEditor from './WalkthroughMetadataEditor';
import type { MaterialPreviewState } from './RightPanelModelViewer';
import type { EnumeratedSlot } from '../../shared/material/applyMaterial';

export type DetailTab = 'overview' | 'material' | 'swap' | 'walkthrough';

interface Props {
  model: any;
  isAuthor: boolean;
  projectId?: string;
  glbUrl: string | null;
  title: string;
  detailTab: DetailTab;
  setDetailTab: (t: DetailTab) => void;
  walkthroughMode: 'edit' | 'preview';
  setWalkthroughMode: (m: 'edit' | 'preview') => void;
  // マテリアル：メインビューアへ委譲する配線
  setMatPreview: (s: MaterialPreviewState | null) => void;
  matPickRef: React.MutableRefObject<((meshName: string) => void) | null>;
  matSlotsRef: React.MutableRefObject<((slots: EnumeratedSlot[]) => void) | null>;
  // 家具置き換え：選択モデルをメインビューアへ委譲
  onSelectSwap: (sel: { url: string; dims: any } | null) => void;
  // ウォークスルー編集の状態（プレビューはメインビューアに表示）
  walkthroughChar: any;
  setWalkthroughChar: (v: any) => void;
  walkthroughGimmicks: any[];
  setWalkthroughGimmicks: (v: any[]) => void;
  walkthroughAnim: any;
  setWalkthroughAnim: (v: any) => void;
  walkthroughInfo: any;
  setWalkthroughInfo: (v: any) => void;
  walkthroughDirty: boolean;
  setWalkthroughDirty: (v: boolean) => void;
  isSavingWalkthrough: boolean;
  saveWalkthroughSettings: () => void;
  /** パターン保存時にメインビューアの描画をJPEGデータURLで取得する（サムネイル生成用）。 */
  captureThumb?: () => string | null;
}

/** タブ列（マテリアル/家具置き換え/アニメーション/情報）＋作成者向け 編集/プレビュー トグル。
 *  パネル上部に単独で配置し、下の DssDetailStudio 内容を切り替える。 */
export const DssStudioTabs: React.FC<{
  detailTab: DetailTab;
  setDetailTab: (t: DetailTab) => void;
  /** 表示するタブ。閲覧者には中身のあるタブだけを渡す（空タブを見せない）。 */
  visibleTabs: DetailTab[];
}> = ({ detailTab, setDetailTab, visibleTabs }) => {
  const labels: Record<DetailTab, string> = {
    overview: '概要', material: 'マテリアル', swap: '置き換え', walkthrough: 'アニメ',
  };
  // タブが1つだけ（＝概要のみ）なら、タブ列自体を出さない
  if (visibleTabs.length <= 1) return null;
  return (
    <Tabs value={detailTab} onChange={(_e, v) => setDetailTab(v)}
      variant="fullWidth"
      sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, minWidth: 0, px: 0.25, fontSize: 12, fontWeight: 700, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }, '& .Mui-selected': { color: '#fff !important' }, '& .MuiTabs-indicator': { bgcolor: '#4fc3f7' } }}>
      {visibleTabs.map((t) => <Tab key={t} value={t} label={labels[t]} />)}
    </Tabs>
  );
};

/**
 * モデル詳細の「詳細スタジオ」内容（マテリアル/家具置き換え/アニメーション/情報）。
 * タブ列は DssStudioTabs としてパネル上部に分離。各タブの3Dは上部のメインビューア1枚に集約するため
 * ここでは Canvas を持たず操作パネルのみを描画する。
 */
export const DssDetailStudio: React.FC<Props> = ({
  model, isAuthor, projectId, glbUrl,
  detailTab, walkthroughMode,
  setMatPreview, matPickRef, matSlotsRef, onSelectSwap,
  walkthroughChar, setWalkthroughChar, walkthroughGimmicks, setWalkthroughGimmicks,
  walkthroughAnim, setWalkthroughAnim, walkthroughInfo, setWalkthroughInfo,
  walkthroughDirty, setWalkthroughDirty, isSavingWalkthrough, captureThumb,
}) => {
  // 保存ボタンは廃止（設計原則 State Synchronization に合わせて自動保存）。
  // 状態だけを控えめに示す。
  const saveBtn = (isSavingWalkthrough || walkthroughDirty) ? (
    <Typography sx={{ mt: 1, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
      {isSavingWalkthrough ? '保存中…' : '変更は自動保存されます'}
    </Typography>
  ) : null;

  // 概要タブの表示（仕様/素材/タグ/説明/購入先）はパネル側の既定表示に集約。
  // 作成者の編集時のみ、ここに情報エディタ（説明・参考リンク）を出す。それ以外は何も描画しない。
  if (detailTab === 'overview' && !(isAuthor && walkthroughMode === 'edit')) return null;

  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.4)' }}>
        {/* === マテリアル === */}
        {detailTab === 'material' && (
          <DssMaterialPresets
            model={model} isAuthor={isAuthor} projectId={projectId} mode={walkthroughMode} hideToggle section="both"
            externalViewer
            onPreviewState={setMatPreview}
            pickHandlerRef={matPickRef}
            slotsHandlerRef={matSlotsRef}
            captureThumb={captureThumb}
          />
        )}

        {/* === 家具置き換え === */}
        {detailTab === 'swap' && (
          <DssFurnitureSwap model={model} isAuthor={isAuthor} mode={walkthroughMode} externalViewer onSelectSwap={onSelectSwap} />
        )}

        {/* === アニメーション（プレビューは上部メインビューアに表示） === */}
        {detailTab === 'walkthrough' && (
          <Box sx={{ p: 1.5 }}>
            {isAuthor && walkthroughMode === 'edit' ? (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 260px', minWidth: 240 }}>
                  {(() => {
                    const gms = Array.isArray(walkthroughGimmicks) ? walkthroughGimmicks : [];
                    const animLabel = walkthroughAnim?.type === 'rotate' ? '常時回転' : walkthroughAnim?.type === 'move' ? '常時往復' : null;
                    const typeJa = (t: string) => t === 'hinge' ? 'ヒンジ' : t === 'slide' ? 'スライド' : t === 'clip' ? 'アニメ' : t;
                    return (
                      <Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1 }}>アニメーションで表示されるアクション</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {gms.map((g: any) => (
                            <Chip key={g.id} size="small" label={`${g.label || typeJa(g.type)}（${typeJa(g.type)}）`}
                              sx={{ bgcolor: 'rgba(79,140,255,0.18)', color: 'var(--brand-fg)', border: '1px solid rgba(79,140,255,0.4)', fontWeight: 700 }} />
                          ))}
                          {gms.length === 0 && (
                            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontStyle: 'italic' }}>アクション未設定（右で追加）</Typography>
                          )}
                        </Box>
                        {animLabel && (
                          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 1 }}>自動：{animLabel}（ボタン操作なしで動作）</Typography>
                        )}
                        <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1 }}>※ 上の3Dビューアでモデルをクリックすると、これらのボタンが実際に表示されます。</Typography>
                      </Box>
                    );
                  })()}
                </Box>
                <Box sx={{ flex: '1 1 300px', minWidth: 280 }}>
                  <WalkthroughMetadataEditor
                    glbUrl={glbUrl || null}
                    macroCategory={model.macroCategory || model.category}
                    character={walkthroughChar}
                    gimmicks={walkthroughGimmicks}
                    anim={walkthroughAnim}
                    showInfo={false}
                    disabled={false}
                    onChange={({ character, gimmicks, anim }) => {
                      setWalkthroughChar(character);
                      setWalkthroughGimmicks(gimmicks);
                      setWalkthroughAnim(anim);
                      setWalkthroughDirty(true);
                    }}
                  />
                  {saveBtn}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                <TouchAppRoundedIcon sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: 12 }}>上の3Dビューアでモデルをクリックすると操作アイコンが表示されます。</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* === 概要（作成者の編集時のみ：説明・参考リンクの編集。読み取り表示はパネル側に集約） === */}
        {detailTab === 'overview' && isAuthor && walkthroughMode === 'edit' && (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1 }}>アイテム情報（説明・参考リンク）を編集</Typography>
            <WalkthroughMetadataEditor
              glbUrl={glbUrl || null}
              macroCategory={model.macroCategory || model.category}
              info={walkthroughInfo}
              infoOnly
              onChange={({ info }) => { setWalkthroughInfo(info); setWalkthroughDirty(true); }}
            />
            {saveBtn}
          </Box>
        )}
      </Box>
  );
};
