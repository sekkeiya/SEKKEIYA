import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Snackbar } from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { getCanonicalModelId } from '../../../utils/modelUtils';
import { persistAssetPatch } from '../../../utils/persistAssetPatch';
import type { DetailActions } from '../types';

export interface ProductsSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  detailActions?: DetailActions;
  onOpenLink: (url: string) => void;
  /** 編集モードのみ: プロジェクトへ複製されたアイテムの書き込み先分岐に使う（persistAssetPatch 経由。Finding I5）。 */
  activeProjectId?: string | null;
  /** 削除が成功したら呼ぶ（親のレール件数などの再計算トリガ。Finding I6）。 */
  onModelChanged?: () => void;
}

const hostOf = (u: string): string => {
  try {
    return new URL(/^https?:\/\//.test(u) ? u : 'https://' + u).host;
  } catch {
    return '';
  }
};

const CountPill: React.FC<{ label: string; color: string; borderColor: string }> = ({ label, color, borderColor }) => (
  <Box
    sx={{
      height: '24px', display: 'flex', alignItems: 'center', padding: '0 9px',
      borderRadius: '999px', border: `1px solid ${borderColor}`, fontSize: 11, color,
    }}
  >
    {label}
  </Box>
);

/** サムネ画像が無いリンクカードの中身。ドメイン頭文字＋ホスト名で「どこのリンクか」を見せる。 */
const LinkPlaceholder: React.FC<{ url: string; color: string }> = ({ url, color }) => {
  const host = hostOf(url);
  const initial = (host.replace(/^www\./, '').charAt(0) || '?').toUpperCase();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', px: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.06)', fontSize: 20, fontWeight: 700, color,
        }}
      >
        {initial}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', maxWidth: '100%' }} noWrap>{host}</Typography>
    </Box>
  );
};

const DeleteBadge: React.FC<{ onClick: (e: React.MouseEvent) => void }> = ({ onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%',
      bgcolor: 'rgba(2,6,23,0.7)', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316',
    }}
  >
    <CloseRoundedIcon sx={{ fontSize: 14 }} />
  </Box>
);

/**
 * S.Model 詳細画面「セクション5: 実在商品・購入先」。デザイン 346-413 行（閲覧）/ 782-827 行（編集）に準拠。
 *
 * カタログ商品（`model.catalogLinks`）と Web 関連リンク（`model.relatedLinks`、無ければ `sourceUrl`
 * を1件として扱う旧フォールバック）を 6 列の統合グリッドに並べる。カタログサムネイル補完
 * （S.Library ローカル索引からの cropDataUrl 引き当て）は v2 の DssModelDetailView 実装から移設。
 *
 * 編集: 各カードに削除×（対応する配列から除去して自動保存）＋自動収集パネル（関連URL自動登録/
 * カタログ照合＝detailActions、レールの「情報を充実させる」と同じアクションをここでも提供する）。
 */
export const ProductsSection: React.FC<ProductsSectionProps> = ({ model, mode, isAuthor, detailActions, onOpenLink, activeProjectId, onModelChanged }) => {
  // カタログ登録のサムネ補完: 保存済み thumbnail が無いものは、ローカルの S.Library
  // カタログ索引（cropDataUrl）から商品URLをキーに引く（ダイアログと同じ画像を表示）。v2 実装から移設。
  const [catalogThumbMap, setCatalogThumbMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const cl = Array.isArray(model.catalogLinks) ? model.catalogLinks : [];
    if (cl.length === 0 || !cl.some((l: any) => l && l.url && !l.thumbnail)) return;
    let mounted = true;
    import('../../../../dsk/catalog/catalogVisionStore')
      .then(async (mod) => {
        try {
          const items = await mod.getAllItems();
          if (!mounted) return;
          const map: Record<string, string> = {};
          for (const it of items) {
            if (it.productUrl && it.cropDataUrl) map[it.productUrl] = it.cropDataUrl;
          }
          setCatalogThumbMap(map);
        } catch { /* noop */ }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [model.catalogLinks]);

  const catalogList = useMemo<any[]>(
    () => (Array.isArray(model.catalogLinks) ? model.catalogLinks.filter((l: any) => l && l.url) : []),
    [model.catalogLinks]
  );
  const webList = useMemo<any[]>(
    () => (Array.isArray(model.relatedLinks)
      ? model.relatedLinks.filter((l: any) => l && l.url)
      : (model.sourceUrl ? [{ title: '関連リンク', url: model.sourceUrl }] : [])),
    [model.relatedLinks, model.sourceUrl]
  );

  const [busy, setBusy] = useState(false);
  // 削除失敗の表示（Finding I5）。以前は console.error のみで、ユーザーには何も伝わらず、
  // かつ書き込み先も無条件で assets/{canonical}（プロジェクト複製アイテムでは非所有のグローバル
  // 資産への書き込みが rules に拒否されうる）だった。
  const [actionError, setActionError] = useState<string | null>(null);

  const removeCatalogLink = async (url: string) => {
    if (busy) return;
    const canonicalId = getCanonicalModelId(model) || model?.id;
    if (!canonicalId) return;
    setBusy(true);
    try {
      const next = catalogList.filter((l) => l.url !== url);
      await persistAssetPatch(model, activeProjectId, { catalogLinks: next });
      // 画面上のモデルにも即時反映（await が失敗した場合はここに来ないため、ローカル一覧から
      // 消えたように見えることはない）。
      model.catalogLinks = next;
      setActionError(null);
      onModelChanged?.();
    } catch (e) {
      console.error('[ProductsSection] catalogLinks の削除に失敗', e);
      setActionError('削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const removeWebLink = async (url: string) => {
    if (busy) return;
    const canonicalId = getCanonicalModelId(model) || model?.id;
    if (!canonicalId) return;
    setBusy(true);
    try {
      const next = webList.filter((l) => l.url !== url);
      const nextSourceUrl = next[0]?.url || '';
      await persistAssetPatch(model, activeProjectId, { relatedLinks: next, sourceUrl: nextSourceUrl });
      model.relatedLinks = next;
      model.sourceUrl = nextSourceUrl;
      setActionError(null);
      onModelChanged?.();
    } catch (e) {
      console.error('[ProductsSection] relatedLinks の削除に失敗', e);
      setActionError('削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const total = catalogList.length + webList.length;
  if (mode === 'view' && total === 0) return null;

  const canRegister = !!detailActions?.canRegister;

  return (
    <Box sx={{ padding: mode === 'view' ? '24px 28px' : '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: mode === 'view' ? '6px' : '14px' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#86efac', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          SECTION 5
        </Typography>
        <StorefrontRoundedIcon sx={{ fontSize: mode === 'view' ? 19 : 17, color: '#86efac' }} />
        <Typography sx={{ fontSize: mode === 'view' ? 19 : 17, fontWeight: 700, color: '#fff' }}>実在商品・購入先</Typography>
        {mode === 'edit' && (
          <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>自動収集の結果を整理する</Typography>
        )}
        {mode === 'view' && (
          <>
            <Box sx={{ flex: 1 }} />
            {catalogList.length > 0 && <CountPill label={`カタログ ${catalogList.length}`} color="#86efac" borderColor="rgba(134,239,172,0.35)" />}
            {webList.length > 0 && <CountPill label={`Web ${webList.length}`} color="#7dd3fc" borderColor="rgba(56,189,248,0.35)" />}
          </>
        )}
      </Box>

      {mode === 'view' && (
        <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.85)', mb: '16px' }}>
          S.Library カタログで照合した商品と、画像検索で見つかった関連リンク。
        </Typography>
      )}

      {mode === 'edit' && !isAuthor ? (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: mode === 'view' ? '14px' : '12px' }}>
          {total === 0 && mode === 'view' && (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1' }}>まだ登録されていません。</Typography>
          )}

          {catalogList.map((l: any, i: number) => {
            const thumb = l.thumbnail || catalogThumbMap[l.url] || '';
            return (
              <Box
                key={`catalog-${i}`}
                onClick={() => onOpenLink(l.url)}
                sx={{
                  position: 'relative', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(134,239,172,0.25)',
                  transition: 'border-color 0.15s, transform 0.15s',
                  '&:hover': { borderColor: 'rgba(134,239,172,0.7)', transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: '#0b0f16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {thumb
                    ? <Box component="img" src={thumb} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <LinkPlaceholder url={l.url} color="rgba(134,239,172,0.8)" />}
                </Box>
                {mode === 'edit' && (
                  <DeleteBadge onClick={(e) => { e.stopPropagation(); void removeCatalogLink(l.url); }} />
                )}
                <Box sx={{ p: mode === 'view' ? '9px' : '8px' }}>
                  <Typography sx={{ fontSize: mode === 'view' ? 12 : 11.5, fontWeight: 600, color: '#fff' }} noWrap>{l.title || 'カタログ商品'}</Typography>
                  {mode === 'view' ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '3px' }}>
                      <Typography sx={{ fontSize: 10.5, color: 'rgba(148,163,184,0.9)' }} noWrap>{l.source || ''}</Typography>
                      {l.price && <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#86efac', flexShrink: 0 }}>{l.price}</Typography>}
                    </Box>
                  ) : (
                    l.price && <Typography sx={{ fontSize: 10.5, color: '#86efac', mt: '3px' }}>{l.price}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}

          {webList.map((l: any, i: number) => (
            <Box
              key={`web-${i}`}
              onClick={() => onOpenLink(l.url)}
              sx={{
                position: 'relative', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,189,248,0.25)',
                transition: 'border-color 0.15s, transform 0.15s',
                '&:hover': { borderColor: 'rgba(56,189,248,0.7)', transform: 'translateY(-2px)' },
              }}
            >
              <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: '#0b0f16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.thumbnail
                  ? <Box component="img" src={l.thumbnail} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <LinkPlaceholder url={l.url} color="rgba(125,211,252,0.85)" />}
              </Box>
              {mode === 'edit' && (
                <DeleteBadge onClick={(e) => { e.stopPropagation(); void removeWebLink(l.url); }} />
              )}
              <Box sx={{ p: mode === 'view' ? '9px' : '8px' }}>
                <Typography sx={{ fontSize: mode === 'view' ? 12 : 11.5, fontWeight: 600, color: '#fff' }} noWrap>{l.title || l.url}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', mt: '3px' }}>
                  <Typography sx={{ fontSize: 10.5, color: '#7dd3fc' }} noWrap>{l.source || hostOf(l.url)}</Typography>
                  {mode === 'view' && <OpenInNewRoundedIcon sx={{ fontSize: 12, color: '#7dd3fc' }} />}
                </Box>
              </Box>
            </Box>
          ))}

          {mode === 'edit' && isAuthor && (
            <Box
              sx={{
                gridColumn: 'span 3', borderRadius: '10px', padding: '12px',
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}
            >
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
                自動収集を実行すると、ここに候補が追加されます。不要なものは削除アイコンで外せます。
              </Typography>
              <Box sx={{ display: 'flex', gap: '8px' }}>
                <Box
                  component="button"
                  type="button"
                  disabled={!canRegister}
                  onClick={() => detailActions?.onRegisterLinks?.()}
                  sx={{
                    font: 'inherit', // CSS ショートハンドのため先頭に置く（後続の fontSize/fontWeight を潰さないように）
                    height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px',
                    bgcolor: '#2563eb', color: '#fff', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    opacity: canRegister ? 1 : 0.5,
                  }}
                >
                  関連URLを自動登録
                </Box>
                <Box
                  component="button"
                  type="button"
                  disabled={!canRegister}
                  onClick={() => detailActions?.onCatalog?.()}
                  sx={{
                    font: 'inherit',
                    height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px',
                    bgcolor: '#16a34a', color: '#fff', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                    opacity: canRegister ? 1 : 0.5,
                  }}
                >
                  カタログ照合
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Snackbar open={!!actionError} autoHideDuration={4000} onClose={() => setActionError(null)} message={actionError || ''} />
    </Box>
  );
};
