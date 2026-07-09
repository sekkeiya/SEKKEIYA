import { readFileSync } from 'fs';
const src = readFileSync('./functions/reporter/blogDialogue.js', 'utf8');
const decodeEntities = (s) => String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function fetchRss(url){ const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/rss+xml, application/xml, */*','Accept-Language':'ja'}}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.text(); }
const m = src.match(/async function fetchSiteFeed[\s\S]*?\n}/);
const fetchSiteFeed = eval('(' + m[0].replace('async function fetchSiteFeed','async function') + ')');
for (const [name,url] of [['architecturephoto','https://architecturephoto.net/feed/'],['ArchDaily(Atom?)','https://www.archdaily.com/rss/'],['dezeen','https://www.dezeen.com/feed/'],['RoomClip','https://roomclip.jp/mag/feed']]) {
  try { const items = await fetchSiteFeed(url, 4); console.log(`\n== ${name}: ${items.length}件 ==`); items.slice(0,2).forEach(it=>console.log(`  - ${it.title.slice(0,50)}\n    ${it.url.slice(0,70)}`)); }
  catch(e){ console.log(`\n== ${name}: ERR ${e.message}`); }
}
