import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Button,
  Chip,
  Divider,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { getArticleBySlug } from '@/shared/api/blog/officialArticles';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { SEO } from '@/shared/components/seo/SEO';
import { SchemaTypes } from '@/shared/components/seo/SchemaTypes';
import { SITE_URL } from '@/config/seoConfig';
import { motion } from 'framer-motion';

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo(0, 0);
    const fetchArticle = async () => {
      try {
        const data = await getArticleBySlug(slug);
        setArticle(data);
      } catch (err) {
        console.error("Error fetching article:", err);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchArticle();
  }, [slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!article) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, color: '#fff' }}>404 - Article Not Found</Typography>
          <Typography variant="body1" sx={{ mb: 4, color: 'rgba(255,255,255,0.6)' }}>
            お探しの記事は見つかりませんでした。
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/articles')}
            sx={{ 
              borderColor: 'rgba(255,255,255,0.2)', 
              color: '#fff',
              '&:hover': { borderColor: '#fff' }
            }}
          >
            Back to Articles
          </Button>
        </Container>
      </Box>
    );
  }

  const url = `${SITE_URL}/articles/${article.slug}`;
  const isoDate = article.publishedAt?.toDate().toISOString();

  // JSON-LD Generation
  const jsonLd = SchemaTypes.getArticle(
    article.title,
    article.excerpt,
    url,
    article.coverUrl,
    isoDate,
    article.author?.displayName
  );

  // パンくず構造化データ（ホーム › 記事 › 記事名）
  const breadcrumbLd = SchemaTypes.getBreadcrumbList([
    { name: "ホーム", url: `${SITE_URL}/` },
    { name: "記事", url: `${SITE_URL}/articles` },
    { name: article.title, url },
  ]);

  return (
    <Box sx={{ bgcolor: '#0a0a0a', minHeight: '100vh', pb: 16 }}>
      <SEO
        title={`${article.title} | SEKKEIYA Articles`}
        description={article.excerpt || `${article.title}について`}
        canonical={url}
        ogImage={article.coverUrl}
        ogType="article"
      >
        <script type="application/ld+json">
          {JSON.stringify([jsonLd, breadcrumbLd])}
        </script>
      </SEO>

      {/* Hero Section */}
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%', 
          height: { xs: '60vh', md: '70vh' },
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          pb: 8,
          pt: 12
        }}
      >
        {/* Background Image / Blur */}
        {article.coverUrl && (
          <>
            <Box 
              sx={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `url(${article.coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 0
              }}
            />
            {/* Gradient Overlay */}
            <Box 
              sx={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.8) 50%, #0a0a0a 100%)',
                zIndex: 1
              }}
            />
          </>
        )}
        
        {/* Without Cover Image Fallback */}
        {!article.coverUrl && (
          <Box 
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(180deg, #1A1A1A 0%, #0a0a0a 100%)',
              zIndex: 1
            }}
          />
        )}

        {/* Hero Content */}
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            
            {/* Back Button */}
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/articles')}
              sx={{
                color: 'rgba(255,255,255,0.7)',
                mb: 4,
                textTransform: 'none',
                '&:hover': { color: '#fff', background: 'transparent' }
              }}
            >
              Back to Articles
            </Button>

            {/* Meta Tags */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              {article.category && (
                <Chip 
                  label={article.category.name} 
                  sx={{ 
                    bgcolor: 'rgba(56, 189, 248, 0.15)', 
                    color: '#38bdf8', 
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontWeight: 600,
                  }} 
                />
              )}
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                {article.publishedAt?.toDate().toLocaleDateString('ja-JP')}
              </Typography>
            </Box>

            {/* Title */}
            <Typography 
              variant="h1" 
              sx={{ 
                fontWeight: 800, 
                fontSize: { xs: '2rem', sm: '3rem', md: '3.5rem' },
                lineHeight: 1.2,
                color: '#fff',
                mb: 3
              }}
            >
              {article.title}
            </Typography>

            {/* Author */}
            {article.author?.displayName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box 
                  sx={{ 
                    w: 32, 
                    h: 32, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}
                >
                  {article.author.displayName.charAt(0).toUpperCase()}
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  By {article.author.displayName}
                </Typography>
              </Box>
            )}

          </motion.div>
        </Container>
      </Box>

          {/* Main Content Area */}
      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 3, mt: { xs: 4, md: 8 } }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          
          {/* Article Excerpt Box */}
          {article.excerpt && (
            <Box 
              sx={{ 
                p: { xs: 3, md: 4 }, 
                mb: 6,
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                borderLeft: '4px solid #38bdf8'
              }}
            >
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500, lineHeight: 1.8 }}>
                {article.excerpt}
              </Typography>
            </Box>
          )}

          {/* Content Render (HTML or Markdown) */}
          <Box 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.85)',
              typography: 'body1', 
              lineHeight: 1.9,
              fontSize: '1.05rem',
              
              /* Headers */
              '& h1, & h2, & h3, & h4, & h5, & h6': { 
                fontWeight: 800, 
                color: '#fff', 
                mt: 8, 
                mb: 3,
                letterSpacing: '-0.01em'
              },
              '& h1': { fontSize: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 },
              '& h2': { fontSize: '2rem' },
              '& h3': { fontSize: '1.5rem' },
              '& h4': { fontSize: '1.25rem' },

              /* Paragraphs & Lists */
              '& p': { mb: 3 },
              '& ul, & ol': { mb: 3, pl: 3 },
              '& li': { mb: 1 },

              /* Links */
              '& a': { 
                color: '#38bdf8', 
                textDecoration: 'none', 
                borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
                paddingBottom: '1px',
                transition: 'all 0.2s',
                '&:hover': { 
                  color: '#fff',
                  borderBottomColor: '#fff' 
                } 
              },

              /* Images */
              '& img': { 
                maxWidth: '100%', 
                height: 'auto', 
                borderRadius: 3,
                my: 4,
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'block'
              },

              /* Blockquotes */
              '& blockquote': {
                borderLeft: '3px solid rgba(255,255,255,0.2)',
                pl: 3,
                ml: 0,
                my: 4,
                color: 'rgba(255,255,255,0.6)',
                fontStyle: 'italic'
              },

              /* Horizontal Rule */
              '& hr': {
                borderColor: 'rgba(255,255,255,0.1)',
                my: 6
              },

              /* Inline Code & Blocks */
              '& code': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.9em'
              },
              '& pre': {
                bgcolor: '#121212',
                p: 3,
                borderRadius: 3,
                overflowX: 'auto',
                border: '1px solid rgba(255,255,255,0.05)',
                my: 4,
                '& code': {
                  bgcolor: 'transparent',
                  p: 0,
                  color: 'inherit'
                }
              },
              /* WYSIWYG Specific */
              '& .is-empty::before': {
                color: 'rgba(255,255,255,0.3)',
                content: 'attr(data-placeholder)',
                float: 'left',
                height: 0,
                pointerEvents: 'none',
              }
            }}
          >
            {article.contentFormat === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.body || '') }} />
            ) : (
              <ReactMarkdown>
                {article.body || ''}
              </ReactMarkdown>
            )}
          </Box>
          
        </motion.div>
      </Container>
    </Box>
  );
}

