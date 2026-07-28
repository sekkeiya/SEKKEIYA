import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, Divider, List, ListItem, ListItemText } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { useAuthStore } from '../../../store/useAuthStore';

interface UsageLocation { optionId: string; pathName: string; count: number }
interface UsageInfo { totalCount: number; locations: UsageLocation[] }
interface Props {
  model: any;
  usage?: UsageInfo | number;
  onOpenLink: (url: string) => void;
}

const labelSx = {
  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const,
  color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 0.5,
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.4 }}>
    <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', textAlign: 'right', minWidth: 0 }}>{value}</Typography>
  </Box>
);

/**
 * 右パネルの「見る」表示（読み取り専用のスペック表）。
 * 編集は一切行わない — 作成者も閲覧者も、まずここを見る。
 * 「整える」を押したときだけ DssModelInfoPanel（編集フォーム）が開く。
 *
 * フィールドは DssRightPanel.tsx の DssModelInfoPanel（実際の読み書き元）に合わせてある:
 * - カテゴリは macroCategory / mainCategory / subCategory の3階層（microCategory は実在しない）。
 *   sub は「独自カテゴリ」保存時に userCategory へ入る（DssRightPanel.tsx 554/627行目と同じ優先順位）。
 * - materials は常に配列（カンマ区切り文字列で保存されることは無い）。
 * - description は extendedMetadata.info.description（ウォークスルー設定の「情報」タブが書く）。
 *   モデル直下の description フィールドを書く場所はコード上どこにも無い。
 * - 購入先リンクは relatedLinks 配列が本線だが、無ければ旧 sourceUrls（配列）→ 旧 sourceUrl（単数）
 *   の順でフォールバックする（DssRightPanel.tsx の parseRelatedLinks と同じ優先順位）。
 */
export const DssSpecSheet: React.FC<Props> = ({ model, usage, onOpenLink }) => {
  const currentUser = useAuthStore((s: any) => s.currentUser);

  const title = model?.title || model?.name || 'Untitled';

  // 作成者名の解決: DssModelCardActionBar と同じ優先順位に揃える
  // （自分の投稿なら自分の最新の表示名を優先し、無ければキャッシュ済みの名前、
  //   それも無ければユーザードキュメントを引く）。
  const modelOwnerId = model?.ownerId || model?.authorId;
  const isOwner = Boolean(currentUser && modelOwnerId && currentUser.uid === modelOwnerId);
  const cachedAuthor = model?.handle || model?.ownerName || model?.authorName;
  const [resolvedAuthor, setResolvedAuthor] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!modelOwnerId || cachedAuthor) return;
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase/client');
        const snap = await getDoc(doc(db, 'users', modelOwnerId));
        if (isMounted && snap.exists()) {
          const data = snap.data();
          if (data.displayName) setResolvedAuthor(data.displayName);
        }
      } catch {
        /* noop: 表示名が引けなくても既定文言にフォールバックする */
      }
    })();
    return () => { isMounted = false; };
  }, [modelOwnerId, cachedAuthor]);

  const author = isOwner && currentUser?.displayName
    ? currentUser.displayName
    : (resolvedAuthor || cachedAuthor || 'SEKKEIYA Creator');

  const category = useMemo(() => {
    const subCategory = model?.userCategory || model?.subCategory;
    const parts = [model?.macroCategory, model?.mainCategory, subCategory]
      .filter((v) => v && String(v).trim());
    return parts.join(' / ');
  }, [model]);

  const dimensions = useMemo(() => {
    const d = model?.dimensions;
    if (!d) return null;
    const w = Number(d.width) || 0, dp = Number(d.depth) || 0, h = Number(d.height) || 0;
    if (!w && !dp && !h) return null;
    return `W ${w} × D ${dp} × H ${h} mm`;
  }, [model]);

  const price = useMemo(() => {
    const p = model?.price;
    if (p == null || p === '' || Number(p) === 0) return null;
    const n = Number(p);
    return Number.isFinite(n) ? `¥${n.toLocaleString('ja-JP')}` : String(p);
  }, [model]);

  const materials: string[] = Array.isArray(model?.materials) ? model.materials : [];
  const tags: string[] = Array.isArray(model?.tags) ? model.tags : [];
  const description: string = model?.extendedMetadata?.info?.description || '';

  const links = useMemo<{ title: string; url: string }[]>(() => {
    const cl = Array.isArray(model?.catalogLinks) ? model.catalogLinks : [];
    // relatedLinks が無い旧データは sourceUrls（配列）→ sourceUrl（単数）の順でフォールバックする。
    let rl: { title?: string; url: string }[];
    if (Array.isArray(model?.relatedLinks)) {
      rl = model.relatedLinks;
    } else if (Array.isArray(model?.sourceUrls)) {
      rl = model.sourceUrls.filter((u: unknown) => typeof u === 'string').map((url: string) => ({ title: '関連リンク', url }));
    } else if (model?.sourceUrl) {
      rl = [{ title: '関連リンク', url: model.sourceUrl }];
    } else {
      rl = [];
    }
    return [...cl, ...rl]
      .filter((l: any) => l && l.url)
      .slice(0, 3)
      .map((l: any) => ({ title: l.title || l.source || l.url, url: l.url }));
  }, [model]);

  const usageObj = typeof usage === 'object' && usage !== null ? usage : null;
  const usageTotal = typeof usage === 'number' ? usage : (usageObj?.totalCount ?? 0);
  const usageLayoutCount = usageObj?.locations?.length || (usageTotal > 0 ? 1 : 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.85)', mt: 0.25 }}>{author}</Typography>
        {category && (
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.25 }}>{category}</Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />

      <Box>
        {dimensions && <Row label="寸法" value={dimensions} />}
        {price && <Row label="価格" value={price} />}
        {materials.length > 0 && <Row label="素材" value={materials.join('、')} />}
        {!dimensions && !price && materials.length === 0 && (
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            寸法・価格・素材は未登録です。
          </Typography>
        )}
      </Box>

      {tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map((t) => (
            <Chip key={t} label={t} size="small"
              sx={{ height: 20, fontSize: 10, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
          ))}
        </Box>
      )}

      {description && (
        <Box>
          <Typography sx={labelSx}>説明</Typography>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.75)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {description}
          </Typography>
        </Box>
      )}

      {links.length > 0 && (
        <Box>
          <Typography sx={labelSx}>購入先</Typography>
          {links.map((l, i) => (
            <Box key={i} onClick={() => onOpenLink(l.url)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.4, cursor: 'pointer', color: 'light-dark(#0352aa, #93c5fd)', '&:hover': { textDecoration: 'underline' } }}>
              <LaunchRoundedIcon sx={{ fontSize: 13, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11.5, minWidth: 0 }} noWrap>{l.title}</Typography>
            </Box>
          ))}
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.25 }}>
            すべては下の「似ている商品・購入先」に表示されます。
          </Typography>
        </Box>
      )}

      {usageTotal > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PlaceRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#aa8804, #facc15)' }} />
            <Typography sx={{ ...labelSx, mb: 0, color: 'light-dark(#aa8804, #facc15)' }}>Used in layouts</Typography>
            <Chip size="small" label={`${usageLayoutCount} layout${usageLayoutCount !== 1 ? 's' : ''} / ${usageTotal} item${usageTotal !== 1 ? 's' : ''}`}
              sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(234,179,8,0.15)', color: 'light-dark(#aa8804, #facc15)', border: '1px solid rgba(234,179,8,0.3)' }} />
          </Box>
          {usageObj && usageObj.locations.length > 0 && (
            <List dense disablePadding>
              {usageObj.locations.map((loc) => (
                <ListItem key={loc.optionId} disableGutters sx={{ py: 0.3 }}>
                  <ListItemText
                    primary={<Typography sx={{ fontSize: 10.5, color: 'light-dark(rgba(31,41,55,0.8), rgba(226,232,240,0.8))' }}>{loc.pathName}</Typography>}
                    secondary={<Typography sx={{ fontSize: 10, fontWeight: 600, color: 'light-dark(rgba(172,144,2,0.7), rgba(253,224,71,0.7))' }}>{loc.count}個</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
};
