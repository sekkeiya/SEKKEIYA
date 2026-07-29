import { describe, it, expect } from 'vitest';
import { PLUGIN_IFRAME_SANDBOX } from './sandboxAttribute';

// このテストがある理由: allow-same-origin を足すと iframe が本体と同一オリジン扱いになり、
// 本体の localStorage（Firebase Auth のセッションを含む）に到達できてしまい、プラグインの
// 隔離が壊れる。「動かないから」という理由で誰かが後から足す事故を機械的に止めるための
// 最終防御として、sandbox 属性の文字列を機械的に検証する。
describe('PLUGIN_IFRAME_SANDBOX', () => {
  const tokens = PLUGIN_IFRAME_SANDBOX.split(/\s+/).filter(Boolean);

  it('allow-same-origin を含まない', () => {
    expect(tokens).not.toContain('allow-same-origin');
  });

  it('allow-scripts を含む（プラグインが動くために必要）', () => {
    expect(tokens).toContain('allow-scripts');
  });

  it.each([
    'allow-top-navigation',
    'allow-top-navigation-by-user-activation',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
    'allow-modals',
    'allow-forms',
  ])('危険な値 %s を含まない', (dangerous) => {
    expect(tokens).not.toContain(dangerous);
  });
});
