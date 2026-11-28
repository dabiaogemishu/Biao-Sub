import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearPanelState,
    emptyGroupForm,
    emptyResourceForm,
    groupFormIsDirty,
    groupFormSignature,
    listsLoadedSuccessfully
} from '../src/utils/session.js';

function sampleStore() {
    return {
        resources: [{ id: 1, name: '节点A', url: 'ss://example' }],
        groups: [{ id: 2, name: '组', token: 'abc' }],
        userTemplates: [{ id: 3, name: '模板' }],
        resourcesReady: true,
        resourcesFailed: false,
        loginPassword: 'should-clear',
        batchMode: true,
        selectedResources: [1],
        highlightedResourceIds: [1],
        highlightedGroupIds: [2],
        submitting: true,
        resourceForm: { name: 'x', url: 'ss://secret', type: 'node' },
        groupForm: { id: 2, name: '组', config: [{ subId: 1 }], clash_config: { raw_yaml: 'secret' } },
        groupNameError: true,
        resourceModal: { show: true, isEdit: true },
        groupModal: { show: true, isEdit: true, tab: 'clash' },
        templateModal: { show: true, showMyTemplates: true },
        settingsModal: { show: true, newPassword: 'x', confirmPassword: 'y' },
        previewModal: {
            show: true,
            nodes: [{ name: 'n', link: 'ss://secret' }],
            originalNodes: [{ name: 'n', link: 'ss://secret' }],
            sortMode: true,
            editMode: true,
            appendOpen: true,
            loading: true,
            resourceId: 1,
            resourceItem: { url: 'ss://secret' }
        },
        nodeSelector: { show: true, loading: false, resourceId: 1, resourceName: 'A', nodes: [{ name: 'n' }], selected: 'custom', tempSelected: [0] },
        clashNodeSelector: { show: true, loading: false, currentGroup: 0, allResourceNames: ['A'], allGroupNames: ['G'], allNodeNames: ['n'], nodesByResource: [{ nodes: ['n'] }], tempSelected: ['n'] },
        remoteModal: { show: true, loading: false, mode: 'manual', url: 'https://example/sub', name: 'r', ua: 'x', error: 'e' }
    };
}

test('退出登录会清空资源、聚合组和预览里的节点内容', () => {
    const store = sampleStore();
    clearPanelState(store);
    assert.deepEqual(store.resources, []);
    assert.deepEqual(store.groups, []);
    assert.deepEqual(store.userTemplates, []);
    assert.equal(store.loginPassword, '');
    assert.deepEqual(store.resourceForm, emptyResourceForm());
    assert.equal(store.groupForm.name, emptyGroupForm().name);
    assert.deepEqual(store.groupForm.config, []);
    assert.equal(store.previewModal.show, false);
    assert.deepEqual(store.previewModal.nodes, []);
    assert.deepEqual(store.previewModal.originalNodes, []);
    assert.equal(store.previewModal.resourceItem, null);
    assert.deepEqual(store.nodeSelector.nodes, []);
    assert.equal(store.remoteModal.url, '');
    assert.equal(store.resourceModal.show, false);
    assert.equal(store.groupModal.show, false);
    assert.equal(JSON.stringify(store).includes('ss://'), false);
});

test('只有全部列表接口成功才视为已登录', () => {
    assert.equal(listsLoadedSuccessfully([true, true, true]), true);
    assert.equal(listsLoadedSuccessfully([true, false, true]), false);
    assert.equal(listsLoadedSuccessfully([true, true]), true);
    assert.equal(listsLoadedSuccessfully([]), false);
    assert.equal(listsLoadedSuccessfully(undefined), false);
});

test('聚合组表单能识别未保存修改', () => {
    const form = { name: '家用', config: [{ subId: 1 }], clash_config: { mode: 'generate', groups: [] } };
    const snapshot = groupFormSignature(form);
    assert.equal(groupFormIsDirty(form, snapshot), false);
    assert.equal(groupFormIsDirty({ ...form, name: '办公' }, snapshot), true);
    assert.equal(groupFormIsDirty(form, ''), false);
});
