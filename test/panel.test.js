import assert from 'node:assert/strict';
import test from 'node:test';
import { failureText, moveItem, patchNodeCount, subscriptionLinks } from '../src/utils/panel.js';

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

test('保存后立刻改资源上的节点数', () => {
    const resources = [{ id: '4', info: '{"nodeCount":2}' }];
    assert.equal(patchNodeCount(resources, 4, 1), true);
    assert.equal(resources[0].info.nodeCount, 1);
});
