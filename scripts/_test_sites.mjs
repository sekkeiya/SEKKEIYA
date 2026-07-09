const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sites = [
  ['architecturephoto', 'https://architecturephoto.net/feed/'],
  ['TECTURE MAG',       'https://mag.tecture.jp/feed'],
  ['BAUS',              'https://baus.jp/feed/'],
  ['Casa BRUTUS',       'https://casabrutus.com/rss'],
  ['Casa BRUTUS feed',  'https://casabrutus.com/feed'],
  ['Pen',               'https://www.pen-online.com/feed/'],
  ['AXIS',              'https://www.axismag.jp/feed/'],
  ['JDN',               'https://www.japandesign.ne.jp/feed/'],
  ['homify',            'https://www.homify.jp/rss'],
  ['RoomClip mag',      'https://roomclip.jp/mag/feed'],
  ['SUUMOジャーナル',    'https://suumo.jp/journal/feed/'],
  ['LIFULL HOMES PRESS','https://www.homes.co.jp/cont/feed/'],
  ['goodrooms',         'https://www.goodrooms.jp/journal/feed/'],
  ['dezeen',            'https://www.dezeen.com/feed/'],
  ['ArchDaily',         'https://www.archdaily.com/rss/'],
  ['designboom',        'https://www.designboom.com/feed/'],
];
function firstTitle(xml) {
  const parts = xml.split(/<item|<entry/);
  if (parts.length < 2) return '';
  const m = /<title[^>]*>\s*(?:<!\[CDATA\[)?\s*([^<\]]{4,70})/.exec(parts[1]);
  return m ? m[1].trim() : '';
}
const results = await Promise.all(sites.map(async (pair) => {
  const name = pair[0], url = pair[1];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, */*' }, redirect: 'follow' });
    clearTimeout(t);
    const xml = r.ok ? await r.text() : '';
    const n = (xml.match(/<item|<entry/g) || []).length;
    const ok = r.ok && n > 0;
    return (ok ? 'OK ' : 'NG ') + name.padEnd(20) + ' HTTP ' + r.status + ' items=' + n + '  ' + (firstTitle(xml) ? '| ' + firstTitle(xml) : '');
  } catch (e) { return 'NG ' + name.padEnd(20) + ' ' + e.message; }
}));
console.log(results.join('\n'));
