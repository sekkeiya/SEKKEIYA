// 型チェックフック（.claude/hooks/）のエラー解析ロジックのテスト。
//
// 2026-07-24 に実際に壊れた箇所の再発防止テスト。
// tsc の出力は Windows では CRLF。`split('\n')` すると行末に \r が残り、
// 正規表現の `$` にマッチしなくなる（JS の `.` は \r にマッチしない）。
// その結果 **エラーを 1 件も認識せず、フックが永久に「問題なし」と報告**していた。
//
// 壊れていてもエラーが出ない典型例なので、テストで固定しておく。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signature, splitLines } from '../../../.claude/hooks/tsc-baseline.mjs';

test('splitLines: CRLF でも LF でも行に分割できる', () => {
  assert.deepEqual(splitLines('a\r\nb\r\nc'), ['a', 'b', 'c']);
  assert.deepEqual(splitLines('a\nb\nc'), ['a', 'b', 'c']);

  // 分割後の行末に \r が残っていないこと（これが残ると解析が全滅する）
  for (const line of splitLines('src/a.ts(1,1): error TS1: x\r\n')) {
    assert.ok(!line.includes('\r'), `\\r が残っている: ${JSON.stringify(line)}`);
  }
});

test('signature: tsc のエラー行から識別子を作る', () => {
  assert.equal(
    signature("src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'."),
    "src/a.ts|TS2322|Type 'string' is not assignable to type 'number'.",
  );
});

test('signature: 行末に \\r が付いていても解析できる（再発防止）', () => {
  // ここが 2026-07-24 に壊れた条件そのもの。
  const withCR = "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\r";
  const withoutCR = "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.";
  assert.equal(signature(withCR), signature(withoutCR));
  assert.notEqual(signature(withCR), null);
});

test('signature: 行番号は識別子に含めない（無関係な編集でズレるため）', () => {
  // 同じエラーが 10 行目に移動しただけで「新しいエラー」に化けてはいけない。
  const a = signature("src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.");
  const b = signature("src/a.ts(999,3): error TS2322: Type 'string' is not assignable to type 'number'.");
  assert.equal(a, b);
});

test('signature: Windows のパス区切りを / に正規化する', () => {
  assert.equal(
    signature("src\\components\\A.tsx(1,1): error TS6133: 'x' is declared but its value is never read."),
    "src/components/a.tsx|TS6133|'x' is declared but its value is never read.",
  );
});

test('signature: エラー行でなければ null を返す', () => {
  assert.equal(signature('Found 275 errors.'), null);
  assert.equal(signature(''), null);
  assert.equal(signature('src/a.ts(1,1): warning TS1234: これは warning'), null);
});
