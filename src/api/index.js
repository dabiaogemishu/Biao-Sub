import { useMainStore } from '../stores/main.js'
import { API } from './config.js'

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
    if (res.status === 401) {
        store.isLoggedIn = false
        writeSession('')
        throw new Error(data.error || '未登录或会话已过期')
    }
    return data
}

// 加载资源列表
export async function loadResources() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/subs`)
        if (data.success) store.resources = data.data
    } catch (e) { console.error('loadResources failed:', e) }
}

// 加载聚合组
export async function loadGroups() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/groups`)
        if (data.success) store.groups = data.data
    } catch (e) { console.error('loadGroups failed:', e) }
}

// 加载模板
export async function loadTemplates() {
    const store = useMainStore()
    try {
        const data = await authFetch(`${API}/templates`)
        if (data.success) store.userTemplates = data.data
    } catch (e) { console.error('loadTemplates failed:', e) }
}

// 检查资源节点数
export async function checkResource(url) {
    const data = await authFetch(`${API}/check`, {
        method: 'POST',
        body: { url }
    })
    return data
}
