import { defaultProcess } from '../../functions/_lib/output/process.js'

export function emptyResourceForm() {
    return { name: '', url: '', type: 'node' }
}

export function emptyGroupForm() {
    return {
        id: null,
        name: '',
        config: [],
        clash_config: {
            mode: 'generate',
            header: '',
            groups: [],
            rules: '',
            resources: [],
            raw_yaml: '',
            process: defaultProcess()
        }
    }
}

export function clearPanelState(store) {
    store.resources = []
    store.groups = []
    store.userTemplates = []
    store.resourcesReady = false
    store.resourcesFailed = false
    store.loginPassword = ''
    store.batchMode = false
    store.selectedResources = []
    store.highlightedResourceIds = []
    store.highlightedGroupIds = []
    store.submitting = false
    store.resourceForm = emptyResourceForm()
    store.groupForm = emptyGroupForm()
    store.groupNameError = false
    store.resourceModal.show = false
    store.resourceModal.isEdit = false
    store.groupModal.show = false
    store.groupModal.isEdit = false
    store.groupModal.tab = 'base'
    store.templateModal.show = false
    store.templateModal.showMyTemplates = false
    store.settingsModal.show = false
    store.settingsModal.newPassword = ''
    store.settingsModal.confirmPassword = ''
    Object.assign(store.previewModal, {
        show: false,
        nodes: [],
        originalNodes: [],
        sortMode: false,
        editMode: false,
        appendOpen: false,
        loading: false,
        resourceId: null,
        resourceItem: null
    })
    Object.assign(store.nodeSelector, {
        show: false,
        loading: false,
        resourceId: null,
        resourceName: '',
        nodes: [],
        selected: 'all',
        tempSelected: []
    })
    Object.assign(store.clashNodeSelector, {
        show: false,
        loading: false,
        currentGroup: null,
        allResourceNames: [],
        allGroupNames: [],
        allNodeNames: [],
        nodesByResource: [],
        tempSelected: []
    })
    Object.assign(store.remoteModal, {
        show: false,
        loading: false,
        mode: 'auto',
        url: '',
        name: '',
        ua: 'clash-verge/v1.7.7',
        error: ''
    })
}

export function groupFormSignature(form) {
    return JSON.stringify({
        name: form?.name || '',
        config: form?.config || [],
        clash_config: form?.clash_config || {}
    })
}

export function groupFormIsDirty(form, snapshot) {
    if (!snapshot) return false
    return groupFormSignature(form) !== snapshot
}

export function listsLoadedSuccessfully(results) {
    return Array.isArray(results) && results.length > 0 && results.every(item => item === true)
}
