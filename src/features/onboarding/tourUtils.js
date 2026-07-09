// ツアーエンジン用 DOM 操作ヘルパー。
// desktop-shell 側のソースを極力変えずに、テキスト/プレースホルダ/属性で
// 実要素を掴んでクリック・入力できるようにする。

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isVisible = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && el.offsetParent !== null;
};

// セレクタ or {text} or {placeholder} or 関数 を実要素に解決
export function resolveTarget(target) {
  if (!target) return null;
  if (typeof target === "function") {
    try { return target() || null; } catch { return null; }
  }
  if (typeof target === "string") {
    const el = document.querySelector(target);
    return el && isVisible(el) ? el : el || null;
  }
  if (typeof target === "object") {
    if (target.placeholder) {
      const el = document.querySelector(`[placeholder*="${target.placeholder}"]`);
      if (el) return el;
    }
    if (target.title) {
      const el = document.querySelector(`[title*="${target.title}"],[aria-label*="${target.title}"]`);
      if (el) return el;
    }
    if (target.text) {
      return findByText(target.text, target.tag);
    }
    if (target.selector) {
      return document.querySelector(target.selector);
    }
  }
  return null;
}

// 可視テキストで要素を探す。tag で絞り込み可。最も内側の一致を返す。
export function findByText(text, tag) {
  const tags = tag ? [tag] : ["button", "a", "[role='button']", "div", "span", "p", "h1", "h2", "h3"];
  for (const t of tags) {
    const nodes = [...document.querySelectorAll(t)];
    // テキスト完全一致を優先
    const exact = nodes.find(
      (n) => isVisible(n) && n.textContent.trim() === text
    );
    if (exact) return exact;
  }
  for (const t of tags) {
    const nodes = [...document.querySelectorAll(t)];
    const partial = nodes.find(
      (n) => isVisible(n) && n.textContent.trim().includes(text)
    );
    if (partial) {
      // できるだけ末端の要素を返す（巨大コンテナを避ける）
      const inner = partial.querySelector(
        ["button", "a", "[role='button']"].join(",")
      );
      return inner && inner.textContent.includes(text) ? inner : partial;
    }
  }
  return null;
}

// 要素が現れるまでポーリング待機
export async function waitFor(target, timeout = 3000, interval = 80) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = resolveTarget(target);
    if (el && isVisible(el)) return el;
    await sleep(interval);
  }
  return resolveTarget(target); // 最後の試行（不可視でも返す）
}

// クリック（MUI でも .click() で発火する）
export function clickEl(el) {
  if (!el) return false;
  el.click();
  return true;
}

export async function clickTarget(target, timeout = 3000) {
  const el = await waitFor(target, timeout);
  return clickEl(el);
}

// タブ切り替え（[data-tour="3dsl"] 等）
export async function switchTab(scope) {
  return clickTarget(`[data-tour="${scope}"]`, 2000);
}

// React 制御の input/textarea に値を流し込む（native setter + input イベント）
export function reactType(el, text) {
  if (!el) return false;
  const isTextarea = el.tagName === "TEXTAREA";
  const proto = isTextarea
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = desc && desc.set;
  el.focus();
  if (setter) setter.call(el, text);
  else el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// プレースホルダ等で入力欄を探して文字を流す（1文字ずつでタイプ風に）
export async function typeInto(target, text, { perChar = 28 } = {}) {
  const el = await waitFor(target, 2500);
  if (!el) return false;
  el.focus();
  if (perChar > 0) {
    for (let i = 1; i <= text.length; i++) {
      reactType(el, text.slice(0, i));
      await sleep(perChar);
    }
  } else {
    reactType(el, text);
  }
  return true;
}

// 入力欄をクリア
export async function clearInput(target) {
  const el = resolveTarget(target);
  if (el) reactType(el, "");
}
