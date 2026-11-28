import { useMainStore } from '../stores/main.js'
import { API } from './config.js'
import { failureText } from '../utils/panel.js'
import { showToast } from '../utils/helpers.js'
import { clearPanelState } from '../utils/session.js'

// 封装授权请求
const SESSION_KEY = 'biaosub_session'

export function readSession() {
    return sessionStorage.getItem(SESSION_KEY) || ''
}

export function writeSession(token) {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('auth_token')
}

export async function authFetch(url, options = {}) {
    const store = useMainStore()
    const headers = { ...options.headers }
    const token = readSession()
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(options.body)
    }
    const res = await fetch(url, { ...options, headers })
    const data = await res.json().catch(() => ({ success: false, error: '响应不是 JSON' }))
    if (!data || typeof data !== 'object') {
        return { success: false, error: failureText(null, res.status), status: res.status }
    }
    if (res.status === 401) {
        store.isLoggedIn = false
        writeSession('')
        clearPanelState(store)
        throw new Error(data.error || '未登录或会话已过期')
    }
    if (!res.ok) {
        data.success = false
        data.error = failureText(data, res.status)
        data.status = res.status
    }
    return data
}

// 加载资源列表
export async function loadResources() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/subs`)
        if (data.success && Array.isArray(data.data)) {
            store.resources = data.data
            store.resourcesFailed = false
            return true
        }
        store.resourcesFailed = true
        return false
    } catch (e) {
        store.resourcesFailed = true
        console.error('loadResources failed:', e)
        return false
    } finally {
        store.resourcesReady = true
    }
}

// 加载聚合组
export async function loadGroups() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/groups`)
        if (data.success && Array.isArray(data.data)) {
            store.groups = data.data
            return true
        }
        return false
    } catch (e) {
        console.error('loadGroups failed:', e)
        return false
    }
}

// 加载模板
export async function loadTemplates() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/templates`)
        if (data.success && Array.isArray(data.data)) {
            store.userTemplates = data.data
            return true
        }
        return false
    } catch (e) {
        console.error('loadTemplates failed:', e)
        return false
    }
}

// 检查资源节点数
export async function checkResource(url) {
    const data = await authFetch(`${API}/check`, {
        method: 'POST',
        body: { url }
    })
    return data
}

export async function openResourcePreview(resource, options = {}) {
    const store = useMainStore()
    if (!resource) return
    store.previewModal.resourceId = resource.id
    store.previewModal.resourceItem = resource
    store.previewModal.sortMode = false
    store.previewModal.editMode = false
    store.previewModal.appendOpen = !!options.append
    store.previewModal.nodes = []
    store.previewModal.originalNodes = []
    store.previewModal.loading = true
    store.previewModal.show = true
    try {
        const res = await checkResource(resource.url)
        if (res.success) {
            store.previewModal.nodes = res.data.nodes || []
            store.previewModal.originalNodes = JSON.parse(JSON.stringify(res.data.nodes || []))
            if (res.data.errors?.length) showToast(res.data.errors[0].message, 'error')
        } else {
            store.previewModal.nodes = []
            showToast(res.error || '没有识别到节点，请检查这份资源的内容', 'error')
        }
    } catch (e) {
        store.previewModal.nodes = []
        showToast(e.message || '没有识别到节点，请检查这份资源的内容', 'error')
    } finally {
        store.previewModal.loading = false
    }
}
