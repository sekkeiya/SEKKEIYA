const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const q='インテリア 配色';
for (const [name,url] of [
  ['Google', `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`],
  ['Bing', `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=ja&cc=jp`],
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, */*', 'Accept-Language': 'ja' } });
    const xml = r.ok ? await r.text() : '';
    const n = (xml.match(/<item>/g) || []).length;
    const first = xml ? ((/<title>(?:<!\[CDATA\[)?([^<\]]{5,70})/.exec(xml.split('<item>')[1] || '') || [])[1] || '-') : '';
    console.log(`${name}: HTTP ${r.status} items=${n} first="${first}"`);
  } catch (e) { console.log(`${name}: ERR ${e.message}`); }
}
