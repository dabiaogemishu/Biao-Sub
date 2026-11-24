import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeBase64 } from '../functions/_lib/core/codec.js';
import { parseUri } from '../functions/_lib/uri/index.js';
import { stripResources, planRemoteRefresh } from '../functions/_lib/groups/membership.js';
import { performRemoteRefresh } from '../functions/_lib/remote-service.js';
import { planRestore } from '../functions/_lib/backup.js';

function link(name, host) {
    const user = encodeBase64(`aes-256-gcm:${name}`).replace(/=+$/, '');
    return `ss://${user}@${host}:8388#${encodeURIComponent(name)}`;
}

function fakeDb(sub, groups) {
    const state = { sub: { ...sub }, groups: groups.map(group => ({ ...group })) };
    const calls = [];
    const db = {
        calls,
        state,
        prepare(sql) {
            calls.push(sql);
            const statement = (args = []) => ({
                args,
                async first() {
                    if (sql.includes('FROM subscriptions')) return state.sub;
                    return null;
                },
                async all() {
                    if (sql.includes('FROM groups')) return { results: state.groups };
                    if (sql.includes('FROM subscriptions')) return { results: [state.sub] };
                    return { results: [] };
                },
                async run() {
                    if (sql.startsWith('UPDATE subscriptions')) {
                        state.sub = { ...state.sub, url: args[0], snapshot: args[1], info: args[2] };
                    }
                    return { success: true };
                }
            });
            const bound = statement();
            return {
                ...bound,
                bind(...args) { return statement(args); }
            };
        }
    };
    return db;
}

test('远程刷新先保留快照，并且不改聚合组里的资源引用', async () => {
    const oldUrl = link('旧节点', '1.1.1.1');
    const config = JSON.stringify([{ subId: 3, include: ['旧节点'] }]);
    const clash = JSON.stringify({ mode: 'generate', resources: [], groups: [], rules: '', header: '' });
    const db = fakeDb(
        { id: 3, type: 'remote', url: oldUrl, info: '{"nodeCount":1}', params: '{}' },
        [{ id: 7, config, clash_config: clash }]
    );
    const result = await performRemoteRefresh(db, 3, link('新节点', '8.8.8.8'), { upload: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.nodeCount, 1);
    assert.equal(db.state.sub.snapshot, oldUrl);
    assert.notEqual(db.state.sub.url, oldUrl);
    assert.equal(parseUri(db.state.sub.url).name, '新节点');
    assert.equal(parseUri(db.state.sub.url).server, '8.8.8.8');
    assert.equal(db.state.groups[0].config, config);
    assert.equal(db.state.groups[0].clash_config, clash);
    assert.ok(db.calls.some(sql => sql.startsWith('UPDATE groups SET cached_yaml')));
    assert.ok(db.calls.every(sql => !/SET config/.test(sql) && !/DELETE FROM groups/.test(sql)));
});

test('刷新解析失败时不覆盖已保存的节点', async () => {
    const oldUrl = link('旧节点', '1.1.1.1');
    const db = fakeDb(
        { id: 3, type: 'remote', url: oldUrl, info: '{}', params: '{}' },
        [{ id: 7, config: '[]', clash_config: '{}' }]
    );
    const result = await performRemoteRefresh(db, 3, '这不是订阅');
    assert.equal(result.ok, false);
    assert.match(result.error, /无法识别/);
    assert.equal(db.state.sub.url, oldUrl);
    assert.equal(db.state.sub.snapshot, undefined);
    assert.ok(db.calls.every(sql => !sql.startsWith('UPDATE')));
});

test('删除资源才会从组里拿掉，刷新计划本身不动组', () => {
    const group = {
        config: [{ subId: 3, include: ['甲'] }, { subId: 4 }],
        clash_config: { resources: [{ subId: 3 }, { subId: 9 }] }
    };
    const removed = stripResources(group, [3]);
    assert.deepEqual(removed.config, [{ subId: 4 }]);
    assert.deepEqual(removed.clash_config.resources, [{ subId: 9 }]);
    const plan = planRemoteRefresh({ id: 3, url: 'old', info: {} }, { nodes: [], errors: [{ message: '空' }] });
    assert.equal(plan.ok, false);
    assert.equal(plan.subscription.url, 'old');
});

test('备份恢复默认覆盖', () => {
    const overwrite = planRestore({ items: [{ name: '新' }], groups: [], templates: [] });
    assert.equal(overwrite.mode, 'overwrite');
    assert.equal(overwrite.items.length, 1);
    const append = planRestore({ items: [{ name: '追加' }] }, 'append');
    assert.equal(append.mode, 'append');
});
