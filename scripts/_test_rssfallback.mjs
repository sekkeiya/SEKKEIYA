import { readFileSync } from 'fs';
const src = readFileSync('./functions/reporter/blogDialogue.js', 'utf8');
const decodeEntities = (s) => String(s || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const extractReadableBlocks = eval('(' + src.match(/function extractReadableBlocks[\s\S]*?\n  return blocks;\n}/)[0].replace('function extractReadableBlocks', 'function') + ')');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const rss = await fetch('https://www.dezeen.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const url = (/<item>[\s\S]*?<link>([^<]+)<\/link>/.exec(rss) || [])[1].trim();
const item = rss.split(/<item[\s>]/).find((it) => it.includes(url.replace(/\/$/, '')));
const enc = item ? (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(item) || [])[1] : '';
const inner = enc ? enc.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '') : '';
const blocks = extractReadableBlocks(inner, url);
console.log(`dezeen RSS fallback: p=${blocks.filter(b=>b.t==='p').length} h=${blocks.filter(b=>b.t==='h').length} img=${blocks.filter(b=>b.t==='img').length}`);
blocks.slice(0, 5).forEach(b => console.log(`  [${b.t}] ${(b.t==='img'?b.src:b.text).slice(0,90)}`));
