import { readFileSync } from 'fs';
const src = readFileSync('./functions/reporter/blogDialogue.js', 'utf8');
const decodeEntities = (s) => String(s || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const extractReadableBlocks = eval('(' + src.match(/function extractReadableBlocks[\s\S]*?\n  return blocks;\n}/)[0].replace('function extractReadableBlocks', 'function') + ')');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
for (const url of [
  'https://www.designboom.com/architecture/kilometer-long-garden-ring-carlo-ratti-associati-hospital-of-the-future-milan-07-01-2026/',
  'https://architecturephoto.net/249685/',
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8' }, redirect: 'follow' });
    const html = r.ok ? await r.text() : '';
    const blocks = extractReadableBlocks(html, url);
    const ps = blocks.filter(b=>b.t==='p').length, hs = blocks.filter(b=>b.t==='h').length, imgs = blocks.filter(b=>b.t==='img').length;
    console.log(`\n== HTTP ${r.status} p=${ps} h=${hs} img=${imgs} | ${url.slice(8,50)}`);
    blocks.slice(0, 7).forEach(b => console.log(`  [${b.t}] ${(b.t==='img'?b.src:b.text).slice(0,90)}`));
  } catch(e){ console.log(url, 'ERR', e.message); }
}

// dezeen: RSSから実URLを1件取得して抽出テスト
const rss = await fetch('https://www.dezeen.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const link = (/<item>[\s\S]*?<link>([^<]+)<\/link>/.exec(rss) || [])[1];
if (link) {
  const r = await fetch(link.trim(), { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const html = r.ok ? await r.text() : '';
  const blocks = extractReadableBlocks(html, link);
  console.log(`\n== dezeen実記事 HTTP ${r.status} p=${blocks.filter(b=>b.t==='p').length} img=${blocks.filter(b=>b.t==='img').length}`);
  blocks.slice(0, 5).forEach(b => console.log(`  [${b.t}] ${(b.t==='img'?b.src:b.text).slice(0,90)}`));
}
