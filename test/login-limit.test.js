import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { signSession, verifySession } from '../functions/_lib/auth.js';
import {
    LOGIN_FAIL_LIMIT,
    LOGIN_LOCK_BASE_MS,
    LOGIN_LOCKED_MESSAGE,
    LOGIN_PASSWORD_ERROR,
    LOGIN_WINDOW_MS,
    clearLoginFailures,
    inspectLoginAttempt,
    loginSource,
    recordLoginFailure
} from '../functions/_lib/login-limit.js';
import { registerAuthRoutes } from '../functions/_lib/routes/auth.js';

function memoryDb() {
    const rows = new Map();
    return {
        rows,
        prepare(sql) {
            return {
                bind(...args) {
                    return {
                        async first() {
                            if (sql.includes('FROM login_attempts')) {
                                const row = rows.get(args[0]);
                                return row ? { ...row } : null;
                            }
                            return null;
                        },
                        async run() {
                            if (sql.includes('DELETE FROM login_attempts WHERE source')) {
                                rows.delete(args[0]);
                                return { success: true };
                            }
                            if (sql.includes('DELETE FROM login_attempts')) {
                                const cutoff = args[0];
                                const now = args[1];
                                for (const [key, row] of [...rows]) {
                                    if (row.updated_at < cutoff && row.lock_until < now) rows.delete(key);
                                }
                                return { success: true };
                            }
                            if (sql.includes('INSERT INTO login_attempts')) {
                                rows.set(args[0], {
                                    source: args[0],
                                    fail_count: args[1],
                                    lock_until: args[2],
                                    updated_at: args[3]
                                });
                                return { success: true };
                            }
                            return { success: true };
                        }
                    };
                }
            };
        }
    };
}

test('loginSource 优先使用 CF-Connecting-IP', () => {
    const c = { req: { header(name) { return name === 'CF-Connecting-IP' ? '203.0.113.9' : '198.51.100.1'; } } };
    assert.equal(loginSource(c), 'ip:203.0.113.9');
});

test('失败次数达到上限后短期锁定，成功登录会清掉计数', async () => {
    const db = memoryDb();
    const source = 'ip:203.0.113.10';
    const now = 1_700_000_000_000;
    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) {
        const result = await recordLoginFailure(db, source, now + i);
        assert.equal(result.failCount, i + 1);
        if (i + 1 < LOGIN_FAIL_LIMIT) assert.equal(result.lockUntil, 0);
    }
    const afterLast = now + LOGIN_FAIL_LIMIT + 1;
    const locked = await inspectLoginAttempt(db, source, afterLast);
    assert.equal(locked.allowed, false);
    assert.ok(locked.lockUntil >= afterLast);

    const stillLocked = await inspectLoginAttempt(db, source, locked.lockUntil - 1);
    assert.equal(stillLocked.allowed, false);

    const after = await inspectLoginAttempt(db, source, locked.lockUntil + 1);
    assert.equal(after.allowed, true);

    await clearLoginFailures(db, source);
    const cleared = await inspectLoginAttempt(db, source, locked.lockUntil + 2);
    assert.equal(cleared.failCount, 0);
    assert.equal(cleared.allowed, true);
});

test('窗口过期后失败计数会重置', async () => {
    const db = memoryDb();
    const source = 'ip:203.0.113.11';
    const now = 2_000_000_000_000;
    await recordLoginFailure(db, source, now);
    await recordLoginFailure(db, source, now + 1);
    const later = await inspectLoginAttempt(db, source, now + LOGIN_WINDOW_MS + 10);
    assert.equal(later.allowed, true);
    assert.equal(later.failCount, 0);
});

test('登录路由在锁定时返回 401 且文案不区分密码对错', async () => {
    const db = memoryDb();
    const app = new Hono();
    registerAuthRoutes(app);
    const secret = 'local-test-password';
    const env = { DB: db, ADMIN_PASSWORD: secret };
    const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.12' };

    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) {
        const res = await app.request('/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ password: 'wrong' })
        }, env);
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error, LOGIN_PASSWORD_ERROR);
        assert.equal(JSON.stringify(body).includes(secret), false);
    }

    const lockedWrong = await app.request('/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: 'wrong' })
    }, env);
    const lockedWrongBody = await lockedWrong.json();
    assert.equal(lockedWrong.status, 401);
    assert.equal(lockedWrongBody.error, LOGIN_LOCKED_MESSAGE);

    const lockedRight = await app.request('/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: secret })
    }, env);
    const lockedRightBody = await lockedRight.json();
    assert.equal(lockedRight.status, 401);
    assert.equal(lockedRightBody.error, LOGIN_LOCKED_MESSAGE);
    assert.equal('token' in lockedRightBody, false);
});

test('未锁定时正确密码可以拿到会话令牌', async () => {
    const db = memoryDb();
    const app = new Hono();
    registerAuthRoutes(app);
    const secret = 'local-test-password';
    const res = await app.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.13' },
        body: JSON.stringify({ password: secret })
    }, { DB: db, ADMIN_PASSWORD: secret });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(await verifySession(body.token, secret), true);
    assert.equal(body.token.includes(secret), false);
    assert.notEqual(body.token, await signSession(secret, 1));
});
