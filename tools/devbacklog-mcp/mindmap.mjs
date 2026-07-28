// マインドマップの木の操作（Firestore・MCP に非依存の純粋関数）。
//
// ⚠ 意味論の写し元: sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts と
//    sekkeiya-desktop/src/features/projects/chat/mindmapBridge.ts。
//    rank の採番規則・中心トピックの扱い・削除が部分木ごとである点を変えるときは、
//    両方を揃えて直すこと（ランタイムが違うためコードは共有できない）。

export const CENTER_TEXT = '中心トピック';

const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const trimOrUndef = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** 中心トピック（parentId===null）を返す。無ければ作って nodes に足したものを返す。 */
export function ensureCenter(nodes, now, newId) {
  const found = nodes.find((n) => n.parentId === null || n.parentId === undefined);
  if (found) return { nodes, center: found };
  const center = { id: newId(), parentId: null, rank: 0, text: CENTER_TEXT, createdAt: now, updatedAt: now };
  return { nodes: [...nodes, center], center };
}

/** 親ごとの rank 採番。呼ぶたびに進む。既存の兄弟の最大+1、兄弟が無ければ 0。 */
export function nextRankOf(nodes) {
  const next = new Map();
  return (parentId) => {
    if (!next.has(parentId)) {
      const sib = nodes.filter((n) => n.parentId === parentId);
      next.set(parentId, sib.length ? Math.max(...sib.map((s) => s.rank ?? 0)) + 1 : 0);
    }
    const r = next.get(parentId);
    next.set(parentId, r + 1);
    return r;
  };
}

/** 指定 id とその全子孫の id を集める。 */
export function collectSubtree(nodes, ids) {
  const byParent = new Map();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) || [];
    list.push(n.id);
    byParent.set(n.parentId, list);
  }
  const out = new Set();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    for (const child of byParent.get(id) || []) stack.push(child);
  }
  return out;
}

/**
 * トピックを追加する。parent には既存 id か "#N"（topics 配列の添字）を使える。
 * text が空・image が data: URL・parent が解決できないものは追加せず errors に理由を積む。
 */
export function addTopics({ nodes, topics, now, newId }) {
  const seeded = ensureCenter(nodes, now, newId);
  let working = seeded.nodes;
  const center = seeded.center;
  const takeRank = nextRankOf(working);
  const existingIds = new Set(working.map((n) => n.id));
  const batchIds = new Map(); // "#N" -> 実 id
  const created = [];
  const errors = [];

  topics.forEach((t, idx) => {
    const text = trimOrUndef(t?.text);
    if (!text) { errors.push(`topics[${idx}]: text が必要です`); return; }
    if (typeof t.image === 'string' && /^data:/i.test(t.image)) {
      errors.push(`topics[${idx}]: data: URL は使えません。https の実URLを使ってください`);
      return;
    }
    let parentId = center.id;
    if (typeof t.parent === 'string' && t.parent) {
      if (t.parent.startsWith('#')) {
        const resolved = batchIds.get(t.parent);
        if (!resolved) { errors.push(`topics[${idx}]: parent ${t.parent} は未作成です（自分より前の添字のみ指せます）`); return; }
        parentId = resolved;
      } else if (existingIds.has(t.parent)) {
        parentId = t.parent;
      } else {
        errors.push(`topics[${idx}]: parent が見つかりません: ${t.parent}`);
        return;
      }
    }
    const node = compact({
      id: newId(), parentId, rank: takeRank(parentId), text,
      note: trimOrUndef(t.note), link: trimOrUndef(t.link), image: trimOrUndef(t.image),
      refType: t.refType === 'library' || t.refType === 'article' ? t.refType : undefined,
      refId: trimOrUndef(t.refId), refTitle: trimOrUndef(t.refTitle),
      createdAt: now, updatedAt: now,
    });
    working = [...working, node];
    existingIds.add(node.id);
    batchIds.set(`#${idx}`, node.id);
    created.push(node);
  });

  return { nodes: working, created, errors, batchIds };
}

/** 関係線を張る。resolve は参照文字列を実 id か null に解決する関数。 */
export function addRelations({ relations, inputs, resolve, now, newId }) {
  const key = (r) => `${r.source}->${r.target}`;
  const seen = new Set(relations.map(key));
  const created = [];
  const skipped = [];
  for (const r of inputs) {
    const source = resolve(r.source);
    const target = resolve(r.target);
    if (!source) { skipped.push(`source が見つかりません: ${r.source}`); continue; }
    if (!target) { skipped.push(`target が見つかりません: ${r.target}`); continue; }
    if (source === target) { skipped.push(`自己ループは張れません: ${source}`); continue; }
    if (seen.has(`${source}->${target}`)) { skipped.push(`既に接続済み: ${source}->${target}`); continue; }
    seen.add(`${source}->${target}`);
    created.push(compact({ id: newId(), source, target, text: trimOrUndef(r.text), createdAt: now, updatedAt: now }));
  }
  return { relations: [...relations, ...created], created, skipped };
}

/**
 * トピックを1件更新する。patch は { text, note, link, parent, collapsed }。
 * note / link は空文字を渡すと削除。parent は自分の子孫へは移せない（循環防止）。
 */
export function updateTopic({ nodes, id, patch, now }) {
  const target = nodes.find((n) => n.id === id);
  if (!target) return { nodes, updated: null, error: `トピックが見つかりません: ${id}` };

  const next = { ...target, updatedAt: now };

  if (patch.text !== undefined) {
    const text = trimOrUndef(patch.text);
    if (!text) return { nodes, updated: null, error: 'text を空にはできません' };
    next.text = text;
  }
  for (const field of ['note', 'link']) {
    if (patch[field] === undefined) continue;
    const v = trimOrUndef(patch[field]);
    if (v) next[field] = v; else delete next[field];
  }
  if (patch.collapsed !== undefined) {
    if (patch.collapsed) next.collapsed = true; else delete next.collapsed;
  }
  let moved = false;
  if (patch.parent !== undefined) {
    if (target.parentId === null || target.parentId === undefined) {
      return { nodes, updated: null, error: '中心トピックの親は変えられません' };
    }
    if (!nodes.some((n) => n.id === patch.parent)) {
      return { nodes, updated: null, error: `移動先の親が見つかりません: ${patch.parent}` };
    }
    if (collectSubtree(nodes, [id]).has(patch.parent)) {
      return { nodes, updated: null, error: '自分の子孫へは移動できません' };
    }
    next.parentId = patch.parent;
    moved = true;
  }

  let working = nodes.map((n) => (n.id === id ? next : n));
  if (moved) {
    // 移動先の末尾に付ける
    next.rank = nextRankOf(working.filter((n) => n.id !== id))(next.parentId);
    working = working.map((n) => (n.id === id ? next : n));
  }
  return { nodes: working, updated: next, error: null };
}

/** 指定 id を部分木ごと削除する。中心トピックは削除できない。関わる関係線も消える。 */
export function removeTopics({ nodes, relations, ids }) {
  const errors = [];
  const targets = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (!n) { errors.push(`トピックが見つかりません: ${id}`); continue; }
    if (n.parentId === null || n.parentId === undefined) { errors.push('中心トピックは削除できません'); continue; }
    targets.push(id);
  }
  if (targets.length === 0) return { nodes, relations, removed: [], errors };

  const doomed = collectSubtree(nodes, targets);
  return {
    nodes: nodes.filter((n) => !doomed.has(n.id)),
    relations: relations.filter((r) => !doomed.has(r.source) && !doomed.has(r.target)),
    removed: [...doomed],
    errors,
  };
}

export const topicSummary = (n) => compact({
  id: n.id, parentId: n.parentId, rank: n.rank, text: n.text,
  note: n.note, link: n.link, icons: n.icons, collapsed: n.collapsed,
  refTitle: n.refTitle, childBoardId: n.childBoardId,
});

export const relationSummary = (r) => compact({ id: r.id, source: r.source, target: r.target, text: r.text });
