import assert from 'node:assert/strict';
import test from 'node:test';
import { failureText, importPreviewState, joinSubscriptionText, mergeSavedResources, moveItem, nextResourceView, patchNodeCount, resourceNodeCount, subscriptionLinks } from '../src/utils/panel.js';

test('失败响应优先用服务端错误，否则带上 HTTP 状态', () => {
    assert.equal(failureText({ success: false, error: '拉取失败' }, 502), '拉取失败');
    assert.equal(failureText({}, 502), '请求失败（HTTP 502）');
    assert.equal(failureText(null, 0, '导入失败'), '导入失败');
});

test('订阅链接用 token，Base64 带 format', () => {
    const links = subscriptionLinks('https://biaosub.pages.dev/', 'abc');
    assert.equal(links.clash, 'https://biaosub.pages.dev/api/g/abc');
    assert.equal(links.base64, 'https://biaosub.pages.dev/api/g/abc?format=base64');
    assert.equal(links.singbox, 'https://biaosub.pages.dev/api/g/abc?format=singbox');
    assert.equal(links.list, 'https://biaosub.pages.dev/api/g/abc?format=list');
});

test('拖拽按索引重排，越界时保持原顺序', () => {
    assert.deepEqual(moveItem([{ id: 1 }, { id: 2 }, { id: 3 }], 0, 2).map(item => item.id), [2, 3, 1]);
    assert.deepEqual(moveItem([{ id: 1 }, { id: 2 }], 5, 0).map(item => item.id), [1, 2]);
});

test('添加成功后，列表刷新没带上新行时仍把它补回来', () => {
    const current = [{ id: 2, name: '旧的', type: 'node', sort_order: 0 }];
    const saved = [{ id: 9, name: '新的', type: 'node', sort_order: 0, info: { nodeCount: 1 } }];
    const merged = mergeSavedResources([], saved);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].name, '新的');
    const withOld = mergeSavedResources(current, saved);
    assert.deepEqual(withOld.map(item => item.id), [9, 2]);
    const fresh = mergeSavedResources([{ id: 9, name: '新的', type: 'node', sort_order: 0 }, current[0]], saved);
    assert.deepEqual(fresh.map(item => item.id), [9, 2]);
    assert.equal(fresh[0].info.nodeCount, 1);
});

test('保存后立刻改资源上的节点数', () => {
    const resources = [{ id: '4', info: '{"nodeCount":2}' }];
    assert.equal(patchNodeCount(resources, 4, 1), true);
    assert.equal(resources[0].info.nodeCount, 1);
});

test('importPreviewState 汇总全部节点名和协议，不再截取预览详情', () => {
    const many = importPreviewState([
        { name: 'a', type: 'ss' },
        { name: 'b', type: 'ss' },
        { name: 'c', protocol: 'vmess' },
        { name: 'd', type: 'trojan' }
    ], '没有识别出节点');
    assert.equal(many.count, 4);
    assert.deepEqual(many.all.map(item => item.name), ['a', 'b', 'c', 'd']);
    assert.deepEqual(many.types, { ss: 2, vmess: 1, trojan: 1 });
    assert.equal(many.error, '');
    const empty = importPreviewState([], '内容为空');
    assert.equal(empty.count, 0);
    assert.equal(empty.error, '内容为空');
});

test('追加文本接在原有节点内容后面，空段会被丢掉', () => {
    assert.equal(joinSubscriptionText('ss://a#旧', '', 'ss://b#新'), 'ss://a#旧\nss://b#新');
    assert.equal(joinSubscriptionText('  ', ''), '');
});

test('resourceNodeCount 读取资源上的节点数', () => {
    assert.equal(resourceNodeCount({ info: { nodeCount: 3 } }), 3);
    assert.equal(resourceNodeCount({ info: { nodeCount: '0' } }), 0);
    assert.equal(resourceNodeCount({}), 0);
});

test('nextResourceView 在新资源会被筛选或搜索挡住时自动放开', () => {
    const saved = [{ id: 8, name: '机场A', type: 'remote' }];
    assert.deepEqual(nextResourceView('node', '', saved), { filter: 'remote', query: '' });
    assert.deepEqual(nextResourceView('remote', '机场', saved), { filter: 'remote', query: '机场' });
    assert.deepEqual(nextResourceView('all', '家里', saved), { filter: 'all', query: '' });
    const mixed = [{ id: 1, name: '自建', type: 'node' }, { id: 2, name: '一组', type: 'group' }];
    assert.deepEqual(nextResourceView('remote', '', mixed), { filter: 'all', query: '' });
});
