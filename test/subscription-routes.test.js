import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { registerSubRoutes } from '../functions/_lib/routes/subscription.js';
import { canonicalize, joinSubscriptionText } from '../functions/_lib/subscribe/store.js';

function ss(name, host) {
    const userinfo = Buffer.from('aes-256-gcm:secret', 'utf8').toString('base64url');
    return `ss://${userinfo}@${host}:8388#${encodeURIComponent(name)}`;
}

function createDb(subs, groups = []) {
    return {
        prepare(sql) {
            return {
                bind(...args) {
                    return {
                        async first() {
                            if (sql.includes('FROM subscriptions') && sql.includes('WHERE id')) {
                                return (subs || []).find(item => String(item.id) === String(args[0])) || null;
                            }
                            return null;
                        },
                        async run() {
                            if (sql.startsWith('UPDATE subscriptions SET')) {
                                const id = args[args.length - 1];
                                const row = (subs || []).find(item => String(item.id) === String(id));
                                if (!row) return { success: true };
                                const columns = [...sql.matchAll(/([A-Za-z_]+)\s*=\s*\?/g)].map(match => match[1]);
                                columns.forEach((column, index) => {
                                    if (column !== 'updated_at') row[column] = args[index];
                                });
                            }
                            return { success: true };
                        },
                        async all() {
                            return { results: [] };
                        }
                    };
                },
                async all() {
                    if (sql.includes('FROM groups')) return { results: groups };
                    return { results: [] };
                }
            };
        },
        async batch(statements) {
            for (const statement of statements) await statement.run();
        }
    };
}

function appWith(db) {
    const app = new Hono();
    registerSubRoutes(app);
    return {
        request(path, init) {
            return app.request(path, init, { DB: db });
        }
    };
}

test('追加节点链接时保留组内原有节点，普通保存仍是覆盖', async () => {
    const oldLink = ss('旧节点', '203.0.113.10');
    const newLink = ss('新节点', '203.0.113.11');
    const otherLink = ss('替换后', '203.0.113.12');
    const rows = [{
        id: 7,
        name: '测试节点组',
        url: canonicalize(oldLink).url,
        type: 'group',
        params: '{}',
        info: JSON.stringify({ nodeCount: 1 }),
        sort_order: 9999,
        status: 1
    }];
    const app = appWith(createDb(rows));

    const appended = await app.request('/subs/7', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newLink, append: true })
    });
    const appendedBody = await appended.json();
    assert.equal(appended.status, 200);
    assert.equal(appendedBody.success, true);
    assert.equal(appendedBody.count, 2);
    assert.deepEqual(canonicalize(rows[0].url).parsed.nodes.map(node => node.name), ['旧节点', '新节点']);
    assert.ok(String(rows[0].url).includes('203.0.113.10'));
    assert.ok(String(rows[0].url).includes('203.0.113.11'));

    const replaced = await app.request('/subs/7', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: otherLink })
    });
    const replacedBody = await replaced.json();
    assert.equal(replaced.status, 200);
    assert.equal(replacedBody.success, true);
    assert.equal(replacedBody.count, 1);
    assert.deepEqual(canonicalize(rows[0].url).parsed.nodes.map(node => node.name), ['替换后']);
});

test('只改名称时不改节点内容，追加到不存在的资源会 404', async () => {
    const link = ss('保留', '203.0.113.13');
    const rows = [{
        id: 3,
        name: '原名',
        url: canonicalize(link).url,
        type: 'group',
        params: '{}',
        info: JSON.stringify({ nodeCount: 1 }),
        sort_order: 9999,
        status: 1
    }];
    const originalUrl = rows[0].url;
    const app = appWith(createDb(rows));

    const renamed = await app.request('/subs/3', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新名字' })
    });
    const renamedBody = await renamed.json();
    assert.equal(renamed.status, 200);
    assert.equal(renamedBody.success, true);
    assert.equal(rows[0].name, '新名字');
    assert.equal(rows[0].url, originalUrl);

    const missing = await app.request('/subs/99', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, append: true })
    });
    const missingBody = await missing.json();
    assert.equal(missing.status, 404);
    assert.equal(missingBody.success, false);
});

test('joinSubscriptionText 拼出的内容能被 canonicalize 解析成全部节点', () => {
    const combined = joinSubscriptionText(ss('甲', '203.0.113.14'), ss('乙', '203.0.113.15'));
    const stored = canonicalize(combined);
    assert.equal(stored.ok, true);
    assert.deepEqual(stored.parsed.nodes.map(node => node.name), ['甲', '乙']);
});
