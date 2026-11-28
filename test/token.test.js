import assert from 'node:assert/strict';
import test from 'node:test';
import { generateToken } from '../functions/_lib/core/token.js';

test('generateToken 只使用字母数字，并用拒绝采样生成固定长度', () => {
    const tokens = new Set();
    for (let i = 0; i < 200; i++) {
        const token = generateToken();
        assert.match(token, /^[A-Za-z0-9]{16}$/);
        tokens.add(token);
    }
    assert.ok(tokens.size > 190);
    assert.equal(generateToken(32).length, 32);
});
