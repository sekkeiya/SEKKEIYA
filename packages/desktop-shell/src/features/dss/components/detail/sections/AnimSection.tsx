import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, Collapse } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { DetailViewport } from '../DetailViewport';
import type { GimmickPlaybackController } from '../GimmickPlayback';
import WalkthroughMetadataEditor from '../../WalkthroughMetadataEditor';
import { isLoopAnim } from '../../../../shared/walkthrough/loopAnim';

export interface AnimWalkthroughBundle {
  char: any;
  setChar: (v: any) => void;
  gimmicks: any[];
  setGimmicks: (v: any[]) => void;
  anim: any;
  setAnim: (v: any) => void;
  info: any;
  setInfo: (v: any) => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  saving: boolean;
}

export interface AnimSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  glbUrl: string | null;
  walkthrough: AnimWalkthroughBundle;
}

const typeJa = (t: string) => (t === 'hinge' ? 'ヒンジ' : t === 'slide' ? 'スライド' : t === 'clip' ? 'アニメ' : t);

const SectionHeader: React.FC<{ variant: 'view' | 'edit' }> = ({ variant }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: variant === 'view' ? '16px' : '14px' }}>
    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
      SECTION 4
    </Typography>
    <Typography sx={{ fontSize: variant === 'view' ? 19 : 17, fontWeight: 700, color: '#fff' }}>アニメ</Typography>
    <Typography sx={{ fontSize: variant === 'view' ? 12.5 : 12, color: 'rgba(148,163,184,0.9)' }}>
      {variant === 'view' ? 'ギミックと常時アニメーション' : '扉・引出しの開閉やリクライニングなどを設定'}
    </Typography>
  </Box>
);

/** 設定済みギミック＝濃い青チップ、常時アニメ＝淡い青チップ（デザイン 324-344行に準拠）。 */
const GimmickChip: React.FC<{ label: string; muted?: boolean }> = ({ label, muted }) => (
  <Box
    sx={{
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRadius: '999px',
      fontSize: '11.5px',
      fontWeight: muted ? 400 : 700,
      whiteSpace: 'nowrap',
      bgcolor: muted ? 'rgba(79,140,255,0.12)' : 'rgba(79,140,255,0.18)',
      border: muted ? '1px solid rgba(79,140,255,0.3)' : '1px solid rgba(79,140,255,0.4)',
      color: muted ? 'rgba(255,255,255,0.8)' : '#fff',
    }}
  >
    {label}
  </Box>
);

// Finding I2: 共有 Canvas（DetailCanvasHost, zIndex:0）は DOM 上でページ本体より後にレンダー
// されるため、zIndex を持たないオーバーレイは DOM 順で Canvas に先着していても背面に回り込み、
// Canvas に隠れて見えなくなる。zIndex を明示するだけで「昇格された stacking context」として
// Canvas より確実に前面へ出る（このファイルのヒント/操作ボタン類すべてに適用）。
const overlayHintSx = {
  position: 'absolute' as const, bottom: 8, left: '50%', transform: 'translateX(-50%)',
  zIndex: 2,
  px: 1.25, py: 0.4, borderRadius: 999, pointerEvents: 'none' as const,
  bgcolor: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.75)',
  fontSize: 10.5, whiteSpace: 'nowrap' as const,
};

/** クリック前の「操作できます」ヒント（左下）。DssWalkthroughViewer の同種ヒントと同じ役割。 */
const GimmickActionHint: React.FC = () => (
  <Box sx={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2, display: 'flex', alignItems: 'center', gap: 0.5, px: 1.1, py: 0.4, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)', pointerEvents: 'none' }}>
    <TouchAppRoundedIcon sx={{ fontSize: 13 }} />
    <Typography sx={{ fontSize: 10.5 }}>クリックして操作</Typography>
  </Box>
);

/**
 * クリックで開示される操作アイコン群（右上）。DssWalkthroughViewer の同種ボタンから移植。
 * v2 はボタン文言を常に「アクション」固定にしていたが、ここでは各ギミックの label
 * （チップと同じ表示名）をそのまま出す方が複数ギミック時に分かりやすいため改善している。
 */
const GimmickActionButtons: React.FC<{ controls: GimmickPlaybackController[]; openMap: Record<string, boolean> }> = ({ controls, openMap }) => (
  <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-end' }}>
    {controls.map((c) => {
      const open = !!openMap[c.id];
      return (
        <Button
          key={c.id}
          onClick={() => c.toggle()}
          startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none', fontWeight: 800, fontSize: 11.5, px: 1.25, py: 0.5, borderRadius: 2, color: '#fff',
            bgcolor: open ? 'rgba(239,83,80,0.9)' : 'rgba(79,140,255,0.92)', backdropFilter: 'blur(4px)',
            '&:hover': { bgcolor: open ? 'rgba(239,83,80,1)' : 'rgba(79,140,255,1)' },
          }}
        >
          {c.label || '操作'}
        </Button>
      );
    })}
  </Box>
);

/**
 * S.Model 詳細画面「セクション4: アニメ」。デザイン 324-344 行（閲覧）/ 769-780 行（編集・未登録）に準拠。
 *
 * 3D側は DssWalkthroughViewer.tsx（他画面で使用中のため変更しない）の MultiGimmickRunner から
 * 「独自 Canvas・独自クローン」を除いたクリック開閉ロジックを GimmickPlayback.tsx へ移植し、
 * DetailViewport の animProps 経由でこの1枚の共有 Canvas 内の View として動かす（新規 Canvas は追加しない）。
 * v2 のキャラクター/FPS ウォークスルー操作・ⓘ情報リンクオーバーレイはスコープ外
 * （v2の詳細画面アニメタブが実際に使っていたのはギミック＋常時アニメのみ）。
 */
export const AnimSection: React.FC<AnimSectionProps> = ({ model, mode, isAuthor, glbUrl, walkthrough }) => {
  const placeholderUrl: string | undefined = model?.thumbnailUrl || model?.thumbnail || undefined;
  const gimmicksList = useMemo(() => (Array.isArray(walkthrough.gimmicks) ? walkthrough.gimmicks : []), [walkthrough.gimmicks]);
  const hasAnimContent = gimmicksList.length > 0 || isLoopAnim(walkthrough.anim);

  // セクションが画面内にあるかどうか。ここが false の間はギミックの毎フレーム更新・常時アニメを
  // 止める（スクロールで見えなくなった後も useFrame が回り続けて GPU を無駄に使わないため）。
  const sectionRootRef = useRef<HTMLDivElement>(null);
  const [sectionVisible, setSectionVisible] = useState(false);
  useEffect(() => {
    const el = sectionRootRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      setSectionVisible(!!entries[0]?.isIntersecting);
    }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [controls, setControls] = useState<GimmickPlaybackController[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const hasAnyAction = controls.length > 0;

  const handleReady = useCallback((ctls: GimmickPlaybackController[]) => setControls(ctls), []);
  const handleToggle = useCallback((id: string, open: boolean) => setOpenMap((m) => ({ ...m, [id]: open })), []);
  const handlePick = useCallback(() => setRevealed(true), []);
  const handleMissed = useCallback(() => setRevealed(false), []);

  // 「＋ ギミックを設定する」CTA を押したら、未登録でもエディタを開いたままにする
  // （押した直後はまだ gimmicks/anim が空のため hasAnimContent だけでは判定できない）。
  const [ctaClicked, setCtaClicked] = useState(false);
  const showEditor = hasAnimContent || ctaClicked;

  // 「詳細設定」折りたたみ。ギミック未設定から CTA で入った場合は最初から開いておく。
  const [advancedOpen, setAdvancedOpen] = useState(() => !hasAnimContent);

  if (mode === 'edit') {
    return (
      <Box
        ref={sectionRootRef}
        sx={showEditor
          ? { padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }
          : { padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.015)' }}
      >
        {!showEditor ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '10px' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                SECTION 4
              </Typography>
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>アニメ</Typography>
              <Box component="span" sx={{ height: '22px', display: 'inline-flex', alignItems: 'center', px: '9px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)', fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                未登録 — 閲覧者には表示されません
              </Box>
            </Box>
            {!isAuthor ? (
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Typography sx={{ flex: 1, fontSize: 12.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.5)' }}>
                  扉・引出しの開閉、リクライニング、常時回転などを設定できます。設定するとウォークスルーでも動きます。
                </Typography>
                <Button
                  onClick={() => setCtaClicked(true)}
                  startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    height: 34, borderRadius: '8px', textTransform: 'none', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                    color: '#93c5fd', border: '1px dashed rgba(96,165,250,0.5)',
                    '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
                  }}
                >
                  ギミックを設定する
                </Button>
              </Box>
            )}
          </>
        ) : (
          <>
            <SectionHeader variant="edit" />
            {!isAuthor ? (
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: '20px' }}>
                {/* ビューアは閲覧モードと同寸（360×200）にして、モード切替で構成が変わらないようにする */}
                <Box
                  onPointerDown={() => setZoomEnabled(true)}
                  sx={{ width: 360, flex: 'none', height: 200, borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
                >
                  <DetailViewport
                    glbUrl={glbUrl}
                    placeholderUrl={placeholderUrl}
                    height="100%"
                    enableZoom={zoomEnabled}
                    animProps={{
                      gimmicks: gimmicksList,
                      anim: walkthrough.anim,
                      enabled: sectionVisible,
                      onReady: handleReady,
                      onToggle: handleToggle,
                      onPick: handlePick,
                      onMissed: handleMissed,
                    }}
                  />
                  {!zoomEnabled && glbUrl && <Box sx={overlayHintSx}>クリックすると拡大縮小できます</Box>}
                  {hasAnyAction && !revealed && <GimmickActionHint />}
                  {revealed && hasAnyAction && <GimmickActionButtons controls={controls} openMap={openMap} />}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', mb: 1 }}>
                    {gimmicksList.map((g: any) => <GimmickChip key={g.id} label={g.label || typeJa(g.type)} />)}
                    {isLoopAnim(walkthrough.anim) && (
                      <GimmickChip label={walkthrough.anim.type === 'rotate' ? '常時回転' : '常時往復'} muted />
                    )}
                    {gimmicksList.length === 0 && !isLoopAnim(walkthrough.anim) && (
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>未設定（詳細設定で追加）</Typography>
                    )}
                  </Box>

                  <Box
                    component="button"
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    sx={{
                      font: 'inherit',
                      display: 'flex', alignItems: 'center', gap: '4px', mb: 1,
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 12, fontWeight: 600, color: '#93c5fd',
                    }}
                  >
                    <ExpandMoreRoundedIcon sx={{ fontSize: 17, transform: advancedOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    詳細設定（ギミック・常時アニメの追加/編集）
                  </Box>

                  <Collapse in={advancedOpen}>
                    <WalkthroughMetadataEditor
                      glbUrl={glbUrl}
                      macroCategory={model?.macroCategory || model?.category}
                      character={walkthrough.char}
                      gimmicks={walkthrough.gimmicks}
                      anim={walkthrough.anim}
                      showInfo={false}
                      disabled={false}
                      onChange={({ character, gimmicks, anim }) => {
                        // info はこのエディタ・インスタンスには渡していないため、onChange の info は
                        // 常に空扱いになる。ここで setInfo を呼ぶと既存のアイテム情報を消してしまうため
                        // 意図的に character/gimmicks/anim だけを反映する（DssDetailStudio の旧配線と同じ判断）。
                        walkthrough.setChar(character);
                        walkthrough.setGimmicks(gimmicks);
                        walkthrough.setAnim(anim);
                        walkthrough.setDirty(true);
                      }}
                    />
                  </Collapse>
                  {(walkthrough.saving || walkthrough.dirty) && (
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                      {walkthrough.saving ? '保存中…' : '変更は自動保存されます'}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  // ============================== 閲覧 ==============================
  if (!hasAnimContent) return null;

  return (
    <Box ref={sectionRootRef} sx={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionHeader variant="view" />
      <Box sx={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
        <Box
          onPointerDown={() => setZoomEnabled(true)}
          sx={{ width: 360, flex: 'none', height: 200, borderRadius: '10px', overflow: 'hidden', bgcolor: '#080b11', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}
        >
          <DetailViewport
            glbUrl={glbUrl}
            placeholderUrl={placeholderUrl}
            height="100%"
            enableZoom={zoomEnabled}
            animProps={{
              gimmicks: gimmicksList,
              anim: walkthrough.anim,
              enabled: sectionVisible,
              onReady: handleReady,
              onToggle: handleToggle,
              onPick: handlePick,
              onMissed: handleMissed,
            }}
          />
          {!zoomEnabled && glbUrl && <Box sx={overlayHintSx}>クリックすると拡大縮小できます</Box>}
          {hasAnyAction && !revealed && <GimmickActionHint />}
          {revealed && hasAnyAction && <GimmickActionButtons controls={controls} openMap={openMap} />}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {gimmicksList.map((g: any) => <GimmickChip key={g.id} label={g.label || typeJa(g.type)} />)}
            {isLoopAnim(walkthrough.anim) && (
              <GimmickChip label={walkthrough.anim.type === 'rotate' ? '常時回転' : '常時往復'} muted />
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, lineHeight: 1.9, color: 'rgba(255,255,255,0.6)' }}>
            上のビューアでモデルをクリックすると操作アイコンが表示されます。ウォークスルーでも同じギミックが動きます。
          </Typography>
          <Box sx={{ mt: 'auto', padding: '10px 12px', borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
              ギミックが未設定のモデルでは、このセクション自体が表示されません。
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
