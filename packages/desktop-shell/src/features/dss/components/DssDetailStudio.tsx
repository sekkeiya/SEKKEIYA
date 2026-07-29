import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { DssMaterialPresets } from './DssMaterialPresets';
import { DssFurnitureSwap } from './DssFurnitureSwap';
import WalkthroughMetadataEditor from './WalkthroughMetadataEditor';
import type { MaterialPreviewState } from './RightPanelModelViewer';
import type { EnumeratedSlot } from '../../shared/material/applyMaterial';

interface Props {
  model: any;
  isAuthor: boolean;
  projectId?: string;
  glbUrl: string | null;
  /** 開いた直後にどのセクションへ注目させるか。null なら全セクションを並べる。 */
  section: 'material' | 'swap' | 'anim' | null;
  walkthroughMode: 'edit' | 'preview';
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
  /** パターン保存時にメインビューアの描画をJPEGデータURLで取得する（サムネイル生成用）。 */
  captureThumb?: () => string | null;
}

const sectionBoxSx = { borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.4)' } as const;

/**
 * 「整える」パネルの中身（マテリアル/家具置き換え/アニメーション/アイテム情報の編集）。
 * `section` が指定されていれば（ビューア下の帯の「＋」から開いた場合）そのセクションだけを、
 * `section === null`（「整える」ボタンから開いた場合）なら全セクションを縦に並べて表示する。
 * 各タブの3Dは上部のメインビューア1枚に集約するため、ここでは Canvas を持たず操作パネルのみを描画する。
 */
export const DssDetailStudio: React.FC<Props> = ({
  model, isAuthor, projectId, glbUrl,
  section, walkthroughMode,
  setMatPreview, matPickRef, matSlotsRef, onSelectSwap,
  walkthroughChar, setWalkthroughChar, walkthroughGimmicks, setWalkthroughGimmicks,
  walkthroughAnim, setWalkthroughAnim, walkthroughInfo, setWalkthroughInfo,
  walkthroughDirty, setWalkthroughDirty, isSavingWalkthrough, captureThumb,
}) => {
  // ここは作成者の編集面。閲覧者、および「閲覧者の見え方を確認」中は何も出さない
  // （呼び出し側の条件だけに頼らず、このコンポーネント自身でも閉じておく）。
  if (!isAuthor || walkthroughMode === 'preview') return null;

  // 保存ボタンは廃止（設計原則 State Synchronization に合わせて自動保存）。
  // 状態だけを控えめに示す。
  const saveBtn = (isSavingWalkthrough || walkthroughDirty) ? (
    <Typography sx={{ mt: 1, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
      {isSavingWalkthrough ? '保存中…' : '変更は自動保存されます'}
    </Typography>
  ) : null;

  return (
    <>
      {/* === マテリアル === */}
      {(section === null || section === 'material') && (
        <Box sx={sectionBoxSx}>
          <DssMaterialPresets
            model={model} isAuthor={isAuthor} projectId={projectId} mode={walkthroughMode} hideToggle section="both"
            externalViewer
            onPreviewState={setMatPreview}
            pickHandlerRef={matPickRef}
            slotsHandlerRef={matSlotsRef}
            captureThumb={captureThumb}
          />
        </Box>
      )}

      {/* === 家具置き換え === */}
      {(section === null || section === 'swap') && (
        <Box sx={sectionBoxSx}>
          <DssFurnitureSwap model={model} isAuthor={isAuthor} mode={walkthroughMode} externalViewer onSelectSwap={onSelectSwap} />
        </Box>
      )}

      {/* === アニメーション（プレビューは上部メインビューアに表示） === */}
      {(section === null || section === 'anim') && (
        <Box sx={sectionBoxSx}>
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
        </Box>
      )}

      {/* === アイテム情報（説明・参考リンク）の編集：全セクション表示のときだけ === */}
      {section === null && (
        <Box sx={sectionBoxSx}>
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
        </Box>
      )}
    </>
  );
};
