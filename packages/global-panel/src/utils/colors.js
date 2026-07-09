export const COLOR_OPTIONS = [
  { id: 'white', label: 'ホワイト' },
  { id: 'black', label: 'ブラック' },
  { id: 'gray', label: 'グレー' },
  { id: 'beige', label: 'ベージュ' },
  { id: 'brown', label: 'ブラウン' },
  { id: 'wood', label: '木目・木製' },
  { id: 'red', label: 'レッド' },
  { id: 'orange', label: 'オレンジ' },
  { id: 'yellow', label: 'イエロー' },
  { id: 'green', label: 'グリーン' },
  { id: 'blue', label: 'ブルー' },
  { id: 'navy', label: 'ネイビー' },
  { id: 'pink', label: 'ピンク' },
  { id: 'purple', label: 'パープル' },
  { id: 'gold', label: 'ゴールド' },
  { id: 'silver', label: 'シルバー' },
  { id: 'multicolor', label: 'マルチカラー' },
];

export const COLOR_SYNONYMS = {
  // White
  '白': 'white', 'ホワイト': 'white', 'white': 'white', 'しろ': 'white',
  // Black
  '黒': 'black', 'ブラック': 'black', 'black': 'black', 'くろ': 'black',
  // Gray
  '灰色': 'gray', 'グレー': 'gray', 'gray': 'gray', 'grey': 'gray', 'ねずみ色': 'gray', 'シルバーグレー': 'gray',
  // Beige
  'ベージュ': 'beige', 'beige': 'beige', 'アイボリー': 'beige', '生成り': 'beige', 'クリーム色': 'beige', 'クリーム': 'beige',
  // Brown
  '茶色': 'brown', 'ブラウン': 'brown', 'brown': 'brown', 'ちゃいろ': 'brown',
  // Wood
  '木目': 'wood', '木製': 'wood', '木': 'wood', 'ウッド': 'wood', 'wood': 'wood', '木目調': 'wood',
  // Red
  '赤': 'red', 'レッド': 'red', 'red': 'red', 'あか': 'red',
  // Orange
  'オレンジ': 'orange', '橙': 'orange', 'orange': 'orange', '橙色': 'orange', 'だいたい': 'orange',
  // Yellow
  '黄': 'yellow', '黄色': 'yellow', 'イエロー': 'yellow', 'yellow': 'yellow', 'きいろ': 'yellow',
  // Green
  '緑': 'green', 'グリーン': 'green', 'green': 'green', 'みどり': 'green', 'カーキ': 'green', 'オリーブ': 'green',
  // Blue
  '青': 'blue', 'ブルー': 'blue', 'blue': 'blue', 'あお': 'blue', '水色': 'blue', 'ライトブルー': 'blue',
  // Navy
  '紺': 'navy', 'ネイビー': 'navy', 'navy': 'navy', '紺色': 'navy', 'こん': 'navy',
  // Pink
  'ピンク': 'pink', '桃色': 'pink', 'pink': 'pink', 'ももいろ': 'pink',
  // Purple
  '紫': 'purple', 'パープル': 'purple', 'purple': 'purple', 'むらさき': 'purple',
  // Gold
  'ゴールド': 'gold', '金': 'gold', 'gold': 'gold', '金色': 'gold',
  // Silver
  'シルバー': 'silver', '銀': 'silver', 'silver': 'silver', '銀色': 'silver',
  // Multicolor
  'マルチカラー': 'multicolor', 'カラフル': 'multicolor', 'multicolor': 'multicolor', '多色': 'multicolor', '柄物': 'multicolor', '柄': 'multicolor'
};

export const normalizeColors = (queries = []) => {
  if (!Array.isArray(queries)) return [];
  const resultSet = new Set();
  
  for (const query of queries) {
    if (typeof query !== 'string') continue;
    // Lowercase and trim spaces for safer matching
    const sanitized = query.trim().toLowerCase();
    
    // Check if the exact sanitized string exists in synonyms
    if (COLOR_SYNONYMS[sanitized]) {
      resultSet.add(COLOR_SYNONYMS[sanitized]);
    } else {
      for (const [synonym, id] of Object.entries(COLOR_SYNONYMS)) {
        if (sanitized.includes(synonym)) {
          resultSet.add(id);
        }
      }
    }
  }
  
  return Array.from(resultSet);
};
