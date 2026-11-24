import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { registerGroupRoutes } from '../functions/_lib/routes/group.js';

const UUID = 'b831381d-6324-4d53-ad4f-8cda48b30811';

function createDb(subs) {
    const rows = [];
    let seq = 1;
    return {
        rows,
        prepare(sql) {
            return {
                bind(...args) {
                    return {
                        async run() {
                            if (sql.startsWith('INSERT INTO groups')) {
                                rows.push({
                                    id: seq++,
                                    name: args[0],
                                    token: args[1],
                                    config: args[2],
                                    clash_config: args[3],
                                    status: 1,
                                    cached_yaml: ''
                                });
                                return { success: true };
                            }
                            if (sql.startsWith('UPDATE groups SET cached_yaml') && sql.includes('WHERE token')) {
                                const row = rows.find(item => item.token === args[1]);
                                if (row) row.cached_yaml = args[0];
                                return { success: true };
                            }
                            if (sql.startsWith('UPDATE groups SET cached_yaml')) {
                                const row = rows.find(item => String(item.id) === String(args[1]));
                                if (row) row.cached_yaml = args[0];
                                return { success: true };
                            }
                            if (sql.startsWith('UPDATE groups SET')) {
                                const id = args[args.length - 1];
                                const row = rows.find(item => String(item.id) === String(id));
                                const columns = [...sql.matchAll(/([A-Za-z_]+)\s*=\s*\?/g)].map(match => match[1]);
                                columns.forEach((column, index) => { row[column] = args[index]; });
                                return { success: true };
                            }
                            return { success: true };
                        },
                        async first() {
                            if (sql.includes('WHERE token')) return rows.find(item => item.token === args[0]) || null;
                            if (sql.includes('WHERE id')) return rows.find(item => String(item.id) === String(args[0])) || null;
                            return null;
                        },
                        async all() {
                            if (sql.includes('FROM subscriptions')) {
                                const ids = new Set(args.map(Number));
                                return { results: subs.filter(sub => ids.has(Number(sub.id))) };
                            }
                            return { results: rows };
                        }
                    };
                }
            };
        }
    };
}

function appWith(db) {
    const app = new Hono();
    registerGroupRoutes(app);
    return {
        request(path, init) {
            return app.request(path, init, { DB: db });
        }
    };
}

test('保存把 resources 对齐到 config，空白组写入最小 Proxy', async () => {
    const url = `vless://${UUID}@1.1.1.1:443?encryption=none&security=tls&type=tcp#${encodeURIComponent('甲')}`;
    const db = createDb([{ id: 1, name: '甲', url }]);
    const app = appWith(db);
    const response = await app.request('/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: '空白',
            config: [{ subId: 1, dialerProxy: { enabled: false, group: '' } }],
            clash_config: { mode: 'generate', header: '', groups: [], rules: '', resources: [{ subId: 99 }] }
        })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    const stored = JSON.parse(db.rows[0].clash_config);
    assert.deepEqual(stored.resources, [{ subId: 1, dialerProxy: { enabled: false, group: '' } }]);
    assert.equal(stored.groups[0].name, 'Proxy');
    assert.equal(stored.rules, 'MATCH,Proxy');
});

test('刷新 TOKEN 的响应带上新 token', async () => {
    const db = createDb([]);
    const app = appWith(db);
    const created = await app.request('/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '链接', config: [], clash_config: { mode: 'generate', groups: [], rules: '' } })
    });
    const first = await created.json();
    const refreshed = await app.request('/groups/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: true })
    });
    const body = await refreshed.json();
    assert.equal(refreshed.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.id, 1);
    assert.equal(body.name, '链接');
    assert.equal(typeof body.token, 'string');
    assert.notEqual(body.token, first.token);
    assert.equal(db.rows[0].token, body.token);
});

test('保存拒绝无效链式目标和自链', async () => {
    const url = `vless://${UUID}@1.1.1.1:443?encryption=none&security=tls&type=tcp#${encodeURIComponent('甲')}`;
    const other = `vless://${UUID}@2.2.2.2:443?encryption=none&security=tls&type=tcp#${encodeURIComponent('乙')}`;
    const db = createDb([{ id: 1, name: '甲', url }, { id: 2, name: '乙', url: other }]);
    const app = appWith(db);
    await app.request('/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: '链',
            config: [{ subId: 1 }, { subId: 2 }],
            clash_config: { mode: 'generate', groups: [{ name: 'Proxy', type: 'select', useAllProxies: true }], rules: 'MATCH,Proxy' }
        })
    });
    const before = db.rows[0].config;
    const missing = await app.request('/groups/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: [{ subId: 1, dialerProxy: { enabled: true, group: '' } }, { subId: 2 }]
        })
    });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /请选择链式代理目标/);
    assert.equal(db.rows[0].config, before);

    const invalid = await app.request('/groups/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: [{ subId: 1, dialerProxy: { enabled: true, group: '没有' } }, { subId: 2 }]
        })
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /链式代理目标不存在/);

    const self = await app.request('/groups/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: [{ subId: 1, dialerProxy: { enabled: true, group: '甲' } }, { subId: 2 }]
        })
    });
    assert.equal(self.status, 400);
    assert.match((await self.json()).error, /不能指向自身/);
    assert.equal(db.rows[0].config, before);

    const ok = await app.request('/groups/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            config: [{ subId: 1 }, { subId: 2, dialerProxy: { enabled: true, group: '甲' } }]
        })
    });
    assert.equal(ok.status, 200);
    const stored = JSON.parse(db.rows[0].config);
    assert.equal(stored[1].dialerProxy.group, '甲');
    assert.equal(JSON.parse(db.rows[0].clash_config).resources[1].dialerProxy.group, '甲');
});
