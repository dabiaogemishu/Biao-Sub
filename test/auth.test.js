import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordMatches, signSession, verifySession } from '../functions/_lib/auth.js';

test('会话令牌不是明文密码，过期后失效', async () => {
    const secret = 'panel-secret';
    const token = await signSession(secret, 1_000);
    assert.equal(token.includes(secret), false);
    assert.equal(await verifySession(token, secret, 1_000), true);
    assert.equal(await verifySession(token, 'other-secret', 1_000), false);
    assert.equal(await verifySession(token, secret, 1_000 + 12 * 60 * 60 * 1000), false);
    assert.equal(await passwordMatches('panel-secret', secret), true);
    assert.equal(await passwordMatches('nope', secret), false);
});
