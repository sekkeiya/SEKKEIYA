import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';

export interface AuthorSectionProps {
  model: any;
  mode: 'view' | 'edit';
  allItems?: any[];
  onSelect: (m: any) => void;
  onBack: () => void;
  onAuthorClick: () => void;
}

// グリッドに出す最大件数（デザイン通り最大12件）。
const SUGGEST_CAP = 12;
// 「関連 N+」の N はこの上限で切り詰めた候補数（DssRelatedModels の SUGGEST_CAP と揃える）。
const RELATED_CAP = 24;

/** 表示件数が候補の全件を切り詰めたものであれば「24+」のように示し、実数と誤認されないようにする。 */
const formatCount = (shown: number, total: number) => (total > shown ? `${shown}+` : `${shown}`);

const MiniModelCard: React.FC<{ model: any; onClick: () => void }> = ({ model, onClick }) => {
  const thumb = model?.thumbnailUrl || model?.thumbnail?.url || model?.thumbnail || '';
  const name = model?.title || model?.name || 'Untitled';
  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: 'rgba(255,255,255,0.25)', transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ aspectRatio: '4/3', bgcolor: '#0e1219', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {thumb ? (
          <Box component="img" src={thumb} alt={name} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ViewInArRoundedIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.18)' }} />
        )}
      </Box>
      <Box sx={{ p: '9px' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }} noWrap>{name}</Typography>
      </Box>
    </Box>
  );
};

/**
 * S.Model 詳細画面「セクション6: 同じ作者の別モデル」。デザイン 415-453 行（閲覧）/ 829-835 行（編集）に準拠。
 *
 * 旧 `DssRelatedModels`（下スクロールの「関連/同じ作者/このリスト」タブ切替）のうち
 * 「同じ作者」タブの絞り込みロジック（`ownerId`/`authorId` 一致・自分を除外）だけを流用する。
 * この画面には「関連」タブの候補一覧は無く、フッターの「関連 N+」件数表示にのみ同じロジックを使う。
 *
 * 編集: 自動生成のため編集項目は無い（デザイン通り、淡色ヘッダー＋バッジのみ）。
 */
export const AuthorSection: React.FC<AuthorSectionProps> = ({ model, mode, allItems, onSelect, onBack, onAuthorClick }) => {
  const list = useMemo<any[]>(() => (Array.isArray(allItems) ? allItems : []), [allItems]);
  const ownerId = model?.ownerId || model?.authorId;

  const byAuthorAll = useMemo(
    () => (ownerId ? list.filter((it) => it && it.id !== model.id && (it.ownerId || it.authorId) === ownerId) : []),
    [list, model, ownerId]
  );
  const byAuthor = useMemo(() => byAuthorAll.slice(0, SUGGEST_CAP), [byAuthorAll]);

  const relatedAllCount = useMemo(
    () => list.filter((it) => it && it.id !== model.id && (it.category === model.category || it.ownerId === model.ownerId)).length,
    [list, model]
  );
  const relatedShownCount = Math.min(relatedAllCount, RELATED_CAP);

  const authorName = model?.handle || model?.ownerName || model?.authorName || 'SEKKEIYA Creator';

  if (mode === 'edit') {
    return (
      <Box sx={{ padding: '20px 28px 30px', bgcolor: 'rgba(255,255,255,0.015)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            SECTION 6
          </Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>同じ作者の別モデル</Typography>
          <Box
            sx={{
              height: '22px', display: 'flex', alignItems: 'center', padding: '0 9px', borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.18)', fontSize: 10.5, color: 'rgba(255,255,255,0.5)',
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}
          >
            自動生成 — 編集項目なし
          </Box>
        </Box>
      </Box>
    );
  }

  // ============================== 閲覧 ==============================
  if (byAuthor.length === 0) return null;

  return (
    <Box sx={{ padding: '24px 28px 36px' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: '16px' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          SECTION 6
        </Typography>
        <Typography sx={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>同じ作者の別モデル</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'rgba(148,163,184,0.9)' }}>{authorName} のモデル {byAuthorAll.length} 件</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          onClick={onAuthorClick}
          sx={{ fontSize: 12.5, fontWeight: 600, color: '#93c5fd', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
        >
          作者ページへ →
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '14px' }}>
        {byAuthor.map((m) => (
          <MiniModelCard key={m.id || m.entityId} model={m} onClick={() => onSelect(m)} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: '14px', mt: '18px', pt: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          関連 {formatCount(relatedShownCount, relatedAllCount)} ・ このリスト {list.length} 件
        </Typography>
        <Typography
          onClick={onBack}
          sx={{ fontSize: 12, color: '#93c5fd', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
        >
          グリッドで全 {list.length} 件を見る →
        </Typography>
      </Box>
    </Box>
  );
};
