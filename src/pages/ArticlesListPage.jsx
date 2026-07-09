import React, { useEffect, useState, useMemo } from 'react';
import { Container, Typography, Card, CardActionArea, Chip, Box, CircularProgress, TextField, InputAdornment, Stack } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import { fetchPublishedArticles } from '@/shared/api/blog/officialArticles';
import { fetchCategoryNames } from '@/shared/api/blog/categories';
import { collection, getDocs, orderBy, query as fsQuery } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';
import { motion } from 'framer-motion';
import { BRAND } from '@/shared/ui/theme';
import { SEO } from '@/shared/components/seo/SEO';

const PURPLE      = "#7C3AED";
const PURPLE_SOFT = "rgba(124,58,237,0.12)";
const GRAD_TEXT   = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";

const GradText = ({ children }) => (
  <Box component="span" sx={{ background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
    {children}
  </Box>
);

// フォールバック（categories コレクション未整備時）。実際は Firestore から動的に読み込む。
const CATEGORIES_FALLBACK = ['すべて', 'AI News', 'SEKKEIYA', 'S.Models', 'S.Layout', 'S.Presentations', 'Desktop', 'Workflow', 'Tips / Learn'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
};

export default function ArticlesListPage() {
  const [allArticles, setAllArticles] = useState([]);
  const [categories, setCategories] = useState(CATEGORIES_FALLBACK);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam    = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'すべて';
  const sourceParam   = searchParams.get('source') === 'community' ? 'community' : 'official';

  // みんなの記事（S.Blog 公開ミラー）
  const [communityArticles, setCommunityArticles] = useState([]);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  useEffect(() => { loadArticles(); loadCategories(); }, []);

  useEffect(() => {
    if (sourceParam !== 'community' || communityLoaded) return;
    (async () => {
      try {
        const snap = await getDocs(fsQuery(collection(db, 'communityArticles'), orderBy('publishedAt', 'desc')));
        setCommunityArticles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('[Articles] community load failed', e); }
      finally { setCommunityLoaded(true); }
    })();
  }, [sourceParam, communityLoaded]);

  const handleSource = (src) => {
    setSearchParams(prev => { if (src === 'official') prev.delete('source'); else prev.set('source', src); prev.delete('category'); return prev; });
  };
  const fmtCommunityDate = (v) => { try { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleDateString('ja-JP') : ''; } catch { return ''; } };

  const filteredCommunity = useMemo(() => {
    let r = [...communityArticles];
    if (queryParam.trim()) {
      const q = queryParam.toLowerCase();
      r = r.filter(a => [a.title, a.excerpt, a.category, a.authorName, ...(a.tags || [])].some(t => t?.toLowerCase().includes(q)));
    }
    return r;
  }, [communityArticles, queryParam]);

  const loadCategories = async () => {
    try {
      const names = await fetchCategoryNames({ activeOnly: true, topLevelOnly: true });
      if (names.length) setCategories(['すべて', ...names]);
    } catch (e) { /* フォールバックを使用 */ }
  };

  const loadArticles = async () => {
    try {
      const data = await fetchPublishedArticles({ limit: 1000 });
      setAllArticles(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filteredArticles = useMemo(() => {
    let result = [...allArticles];
    if (categoryParam !== 'すべて') result = result.filter(a => a.category?.name === categoryParam);
    if (queryParam.trim()) {
      const q = queryParam.toLowerCase();
      result = result.filter(a =>
        [a.title, a.excerpt, a.category?.name, ...(a.tags || [])].some(t => t?.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => (b.publishedAt?.toMillis() || 0) - (a.publishedAt?.toMillis() || 0));
    return result;
  }, [allArticles, categoryParam, queryParam]);

  const handleSearch = (e) => {
    setSearchParams(prev => { const v = e.target.value; if (v) prev.set('q', v); else prev.delete('q'); return prev; }, { replace: true });
  };
  const handleCategory = (cat) => {
    setSearchParams(prev => { if (cat === 'すべて') prev.delete('category'); else prev.set('category', cat); return prev; });
  };

  if (loading) return (
    <Box sx={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={22} sx={{ color: PURPLE }} />
    </Box>
  );

  const featured  = filteredArticles[0] || null;
  const gridItems = filteredArticles.slice(1);

  return (
    <Box sx={{ bgcolor: '#000', minHeight: '100vh', pt: { xs: 14, md: 18 }, pb: 14 }}>
      <SEO
        title="記事一覧"
        description="SEKKEIYA の最新情報・設計ワークフロー・Rhino 連携・各アプリの使い方などをまとめた公式記事一覧。AI 空間設計 OS の活用ノウハウをお届けします。"
        path="/articles"
      />
      <Container maxWidth="lg">

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 10 }, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '80%', height: 320,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.14) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} style={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 3, px: 2, py: 0.6, borderRadius: '100px',
              border: '1px solid rgba(124,58,237,0.35)', bgcolor: PURPLE_SOFT }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PURPLE }} />
              <Typography sx={{ color: '#A78BFA', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', fontFamily: 'monospace' }}>
                OFFICIAL ARTICLES
              </Typography>
            </Box>
            <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '2.5rem', md: '4.5rem' }, letterSpacing: '-0.05em', mb: 2,
              background: 'linear-gradient(180deg, #fff 40%, rgba(255,255,255,0.5) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              <GradText>記事</GradText>とナレッジ
            </Typography>
            <Typography sx={{ color: BRAND.sub, fontWeight: 400, maxWidth: 560, mx: 'auto', lineHeight: 1.8 }}>
              SEKKEIYAの最新アップデートや開発の裏側、設計ノウハウをお届けします。
            </Typography>
          </motion.div>
        </Box>

        {/* Search + Category Chips */}
        <Box sx={{ mb: 7 }}>
          {/* ソース切替: 公式 / みんなの記事（S.Blog） */}
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            {[
              { key: 'official', label: '公式記事' },
              { key: 'community', label: 'みんなの記事' },
            ].map(t => {
              const active = sourceParam === t.key;
              return (
                <Chip key={t.key} label={t.label} onClick={() => handleSource(t.key)} sx={{
                  bgcolor: active ? '#fff' : 'transparent',
                  color: active ? '#000' : BRAND.sub,
                  border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.15)'}`,
                  fontWeight: 800, fontSize: '0.85rem', px: 1, height: 34, cursor: 'pointer',
                  '&:hover': { bgcolor: active ? '#fff' : 'rgba(255,255,255,0.08)' },
                }} />
              );
            })}
          </Stack>
          <TextField value={queryParam} onChange={handleSearch} placeholder="記事を検索..."
            variant="outlined" size="small"
            sx={{ width: { xs: '100%', sm: 380 }, mb: 3,
              '& .MuiOutlinedInput-root': {
                color: '#fff', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '100px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(124,58,237,0.4)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(124,58,237,0.6)' },
              }
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: BRAND.sub }} /></InputAdornment> }}
          />
          <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, display: sourceParam === 'community' ? 'none' : 'flex' }}>
            {categories.map(cat => {
              const active = cat === categoryParam;
              return (
                <Chip key={cat} label={cat} onClick={() => handleCategory(cat)} sx={{
                  bgcolor: active ? PURPLE : 'transparent',
                  color: active ? '#fff' : BRAND.sub,
                  border: `1px solid ${active ? PURPLE : 'rgba(255,255,255,0.1)'}`,
                  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                  '&:hover': { bgcolor: active ? '#6D28D9' : PURPLE_SOFT, borderColor: active ? '#6D28D9' : 'rgba(124,58,237,0.4)', color: active ? '#fff' : '#A78BFA' }
                }} />
              );
            })}
          </Stack>
        </Box>

        {/* Count */}
        <Typography sx={{ color: BRAND.sub2, fontSize: '0.78rem', mb: 5, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          {(sourceParam === 'community' ? filteredCommunity.length : filteredArticles.length)} ARTICLES
        </Typography>

        {/* みんなの記事（S.Blog 公開ミラー） */}
        {sourceParam === 'community' && (
          <Box>
            {!communityLoaded ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress size={22} sx={{ color: '#e57373' }} />
              </Box>
            ) : filteredCommunity.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 12 }}>
                <Typography sx={{ color: BRAND.sub2 }}>まだ公開された記事がありません。S.Blog から公開すると、ここに掲載されます。</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
                {filteredCommunity.map(a => (
                  <Card key={a.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                    bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': { borderColor: 'rgba(229,115,115,0.5)', boxShadow: '0 0 40px rgba(229,115,115,0.1)', transform: 'translateY(-4px)' } }}>
                    <CardActionArea onClick={() => navigate(`/articles/u/${a.authorUid}/${a.slug}`)}
                      sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                      <Box sx={{ overflow: 'hidden', height: 170, flexShrink: 0, bgcolor: 'rgba(0,0,0,0.4)' }}>
                        {a.coverUrl
                          ? <Box component="img" src={a.coverUrl} alt={a.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Box sx={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(229,115,115,0.12), rgba(0,0,0,0.4))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="caption" sx={{ color: BRAND.sub2 }}>No Image</Typography>
                            </Box>}
                      </Box>
                      <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                          {a.category
                            ? <Chip label={a.category} size="small" sx={{ bgcolor: 'rgba(229,115,115,0.12)', color: '#e57373', border: '1px solid rgba(229,115,115,0.3)', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                            : <Box sx={{ height: 20 }} />}
                          <Typography variant="caption" sx={{ color: BRAND.sub2 }}>{fmtCommunityDate(a.publishedAt)}</Typography>
                        </Box>
                        <Typography variant="h6" component="h2" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.02em', mb: 1.25,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {a.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: BRAND.sub, lineHeight: 1.7, mb: 'auto',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {a.excerpt}
                        </Typography>
                        {a.authorName && (
                          <Typography variant="caption" sx={{ color: BRAND.sub2, mt: 1.5 }}>✍️ {a.authorName}</Typography>
                        )}
                      </Box>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Featured */}
        {sourceParam === 'official' && featured && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mb: 8, p: { xs: 3, md: 4 },
              bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3,
              cursor: 'pointer', transition: 'all 0.3s ease',
              '&:hover': { borderColor: 'rgba(124,58,237,0.45)', boxShadow: `0 0 40px rgba(124,58,237,0.12)` }
            }} onClick={() => navigate(`/articles/${featured.slug}`)}>
              <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 320 }, height: { xs: 200, md: 220 }, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.4)' }}>
                {featured.coverUrl
                  ? <Box component="img" src={featured.coverUrl} alt={featured.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${PURPLE_SOFT}, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: BRAND.sub2 }}>No Image</Typography>
                    </Box>
                }
              </Box>
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    {featured.category && (
                      <Chip label={featured.category.name} size="small"
                        sx={{ bgcolor: PURPLE_SOFT, color: '#A78BFA', border: '1px solid rgba(124,58,237,0.3)', fontWeight: 700, height: 22, fontSize: '0.68rem' }} />
                    )}
                    <Typography variant="caption" sx={{ color: BRAND.sub2 }}>
                      {featured.publishedAt?.toDate().toLocaleDateString('ja-JP')}
                    </Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, lineHeight: 1.35, mb: 2, letterSpacing: '-0.02em' }}>
                    {featured.title}
                  </Typography>
                  <Typography sx={{ color: BRAND.sub, lineHeight: 1.75, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {featured.excerpt}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Grid */}
        {sourceParam === 'official' && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            {gridItems.map(article => (
              <motion.div key={article.id} variants={itemVariants} style={{ height: '100%' }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  '&:hover': { borderColor: 'rgba(124,58,237,0.45)', boxShadow: `0 0 40px rgba(124,58,237,0.1)`, transform: 'translateY(-4px)' }
                }}>
                  <CardActionArea onClick={() => navigate(`/articles/${article.slug}`)}
                    sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                    <Box sx={{ overflow: 'hidden', height: 190, flexShrink: 0, position: 'relative' }}>
                      {article.coverUrl
                        ? <Box component="img" src={article.coverUrl} alt={article.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease',
                              '.MuiCardActionArea-root:hover &': { transform: 'scale(1.05)' } }} />
                        : <Box sx={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${PURPLE_SOFT}, rgba(0,0,0,0.4))`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" sx={{ color: BRAND.sub2 }}>No Image</Typography>
                          </Box>
                      }
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                    </Box>
                    <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        {article.category
                          ? <Chip label={article.category.name} size="small"
                              sx={{ bgcolor: PURPLE_SOFT, color: '#A78BFA', border: '1px solid rgba(124,58,237,0.3)', fontWeight: 700, height: 20, fontSize: '0.68rem' }} />
                          : <Box sx={{ height: 20 }} />
                        }
                        <Typography variant="caption" sx={{ color: BRAND.sub2 }}>
                          {article.publishedAt?.toDate().toLocaleDateString('ja-JP')}
                        </Typography>
                      </Box>
                      <Box sx={{ minHeight: 52, mb: 1.5 }}>
                        <Typography variant="h6" component="h2"
                          sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.02em',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {article.title}
                        </Typography>
                      </Box>
                      <Typography variant="body2"
                        sx={{ color: BRAND.sub, lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 'auto' }}>
                        {article.excerpt}
                      </Typography>
                      {article.tags?.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 2 }}>
                          {article.tags.slice(0, 3).map((tag, idx) => (
                            <Chip key={idx} label={`#${tag}`} size="small"
                              sx={{ bgcolor: 'transparent', color: BRAND.sub2, border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.62rem', height: 18 }} />
                          ))}
                          {article.tags.length > 3 && (
                            <Typography variant="caption" sx={{ color: BRAND.sub2, alignSelf: 'center' }}>+{article.tags.length - 3}</Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </CardActionArea>
                </Card>
              </motion.div>
            ))}
          </Box>
          {filteredArticles.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 12 }}>
              <Typography sx={{ color: BRAND.sub2 }}>現在、公開されている記事はありません。</Typography>
            </Box>
          )}
        </motion.div>
        )}
      </Container>
    </Box>
  );
}
