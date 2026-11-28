import { useMainStore } from '../stores/main.js'
import { nextResourceView } from './panel.js'

let toastSeq = 0
const highlightTimers = {}

// Toast 通知
export function showToast(message, type = 'success') {
    const store = useMainStore()
    const ticket = ++toastSeq
    store.toast.show = true
    store.toast.message = message
    store.toast.type = type
    const ms = String(message || '').length > 22 ? 4000 : 2500
    setTimeout(() => { if (ticket === toastSeq) store.toast.show = false }, ms)
}

export function setHighlight(kind, ids, ms = 6000) {
    const store = useMainStore()
    const key = kind === 'groups' ? 'highlightedGroupIds' : 'highlightedResourceIds'
    store[key] = (Array.isArray(ids) ? ids : [ids]).map(id => String(id)).filter(id => id && id !== 'undefined' && id !== 'null')
    clearTimeout(highlightTimers[key])
    highlightTimers[key] = setTimeout(() => { store[key] = [] }, ms)
}

export function revealResources(saved) {
    const store = useMainStore()
    const rows = (Array.isArray(saved) ? saved : [saved]).filter(row => row && row.id != null && row.id !== '')
    const next = nextResourceView(store.resourceFilter, store.resourceQuery, rows)
    store.resourceFilter = next.filter
    store.resourceQuery = next.query
    store.currentTab = 'resources'
    if (rows.length) setHighlight('resources', rows.map(row => row.id))
}

export function revealGroups(ids) {
    const store = useMainStore()
    store.currentTab = 'groups'
    setHighlight('groups', ids)
}

// 复制到剪贴板
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text)
        showToast('已复制，可以直接粘贴')
    } catch (e) {
        showToast('复制失败', 'error')
    }
}

// 进度条颜色
export function getProgressClass(count) {
    if (count >= 50) return 'progress-success'
    if (count >= 20) return 'progress-info'
    if (count >= 5) return 'progress-warning'
    return 'progress-error'
}

// 判断是否过期
export function isExpired(dateStr) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
}

// 格式化时间
export function formatTime(dateStr) {
    if (!dateStr) return '从未'
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return d.toLocaleDateString('zh-CN')
}

// 从链接提取名称
export function getNameFromLink(link) {
    if (!link) return ''
    try {
        if (link.startsWith('vmess://')) {
            const json = JSON.parse(atob(link.replace('vmess://', '')))
            return json.ps || ''
        }
        const hashIdx = link.indexOf('#')
        if (hashIdx !== -1) return decodeURIComponent(link.slice(hashIdx + 1))
    } catch (e) { }
    return ''
}

// 更新链接名称
export function updateLinkName(link, newName) {
    if (!link || !newName) return link
    try {
        if (link.startsWith('vmess://')) {
            const json = JSON.parse(atob(link.replace('vmess://', '')))
            json.ps = newName
            return 'vmess://' + btoa(JSON.stringify(json))
        }
        const hashIdx = link.indexOf('#')
        const base = hashIdx !== -1 ? link.slice(0, hashIdx) : link
        return base + '#' + encodeURIComponent(newName)
    } catch (e) { return link }
}
