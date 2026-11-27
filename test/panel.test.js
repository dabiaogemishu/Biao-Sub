import assert from 'node:assert/strict';
import test from 'node:test';
import { failureText, importPreviewState, mergeSavedResources, moveItem, patchNodeCount, subscriptionLinks } from '../src/utils/panel.js';

test('失败响应优先用服务端错误，否则带上 HTTP 状态', () => {
    assert.equal(failureText({ success: false, error: '拉取失败' }, 502), '拉取失败');
    assert.equal(failureText({}, 502), '请求失败（HTTP 502）');
    assert.equal(failureText(null, 0, '导入失败'), '导入失败');
});

test('订阅链接用 token，Base64 带 format', () => {
    const links = subscriptionLinks('https://biaosub.pages.dev/', 'abc');
    assert.equal(links.clash, 'https://biaosub.pages.dev/api/g/abc');
    assert.equal(links.base64, 'https://biaosub.pages.dev/api/g/abc?format=base64');
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

test('importPreviewState 只展示前几个节点，并说明其余仍会导入', () => {
    const many = importPreviewState([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }], '没有识别出节点');
    assert.equal(many.count, 4);
    assert.deepEqual(many.nodes.map(item => item.name), ['a', 'b', 'c']);
    assert.equal(many.hidden, 1);
    assert.equal(many.error, '');
    const empty = importPreviewState([], '内容为空');
    assert.equal(empty.count, 0);
    assert.equal(empty.hidden, 0);
    assert.equal(empty.error, '内容为空');
});
