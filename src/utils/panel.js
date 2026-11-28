import { defaultProcess, normalizeProcess, processIsActive, processLabels, PROTOCOL_OPTIONS, typeLabel } from '../../functions/_lib/output/process.js'
import { joinSubscriptionText } from '../../functions/_lib/subscribe/store.js'

export { defaultProcess, normalizeProcess, processIsActive, processLabels, PROTOCOL_OPTIONS, typeLabel, joinSubscriptionText }

export function failureText(data, status, fallback = '请求失败') {
    const message = data && typeof data.error === 'string' ? data.error.trim() : ''
    if (message) return message
    if (status) return `请求失败（HTTP ${status}）`
    return fallback
}

export function subscriptionLinks(origin, token) {
    const base = `${String(origin || '').replace(/\/$/, '')}/api/g/${token}`
    return {
        clash: base,
        base64: `${base}?format=base64`,
        singbox: `${base}?format=singbox`,
        list: `${base}?format=list`
    }
}

export function moveItem(list, oldIndex, newIndex) {
    const next = Array.isArray(list) ? list.slice() : []
    if (oldIndex == null || newIndex == null || oldIndex === newIndex) return next
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= next.length || newIndex >= next.length) return next
    const [item] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, item)
    return next
}

// 刚写入的行可能还没出现在紧接着的列表请求里。按 id 补回，并沿用列表的 sort_order、id 顺序。
export function mergeSavedResources(current, saved) {
    const rows = (Array.isArray(saved) ? saved : []).filter(row => row && row.id != null && row.id !== '')
    const list = Array.isArray(current) ? current.map(row => ({ ...row })) : []
    if (!rows.length) return list
    const byId = new Map(rows.map(row => [String(row.id), row]))
    const seen = new Set(list.map(row => String(row.id)))
    for (let index = 0; index < list.length; index++) {
        const next = byId.get(String(list[index].id))
        if (next) list[index] = { ...list[index], ...next }
    }
    const missing = rows.filter(row => !seen.has(String(row.id)))
    for (const row of missing) {
        const order = Number(row.sort_order ?? 0)
        const id = Number(row.id)
        const index = list.findIndex(item => {
            const itemOrder = Number(item.sort_order ?? 0)
            if (itemOrder !== order) return itemOrder > order
            return Number(item.id) < id
        })
        if (index === -1) list.push(row)
        else list.splice(index, 0, row)
    }
    return list
}

export function patchNodeCount(resources, id, count) {
    const row = (resources || []).find(item => String(item.id) === String(id))
    if (!row) return false
    let info = row.info
    if (typeof info === 'string') {
        try { info = JSON.parse(info) } catch { info = {} }
    }
    row.info = { ...(info && typeof info === 'object' ? info : {}), nodeCount: count }
    return true
}

export function importPreviewState(nodes, error) {
    const list = Array.isArray(nodes) ? nodes : []
    const types = {}
    for (const node of list) {
        const key = node?.type || node?.protocol || 'other'
        types[key] = (types[key] || 0) + 1
    }
    return {
        count: list.length,
        all: list,
        types,
        error: list.length ? '' : (error || '没有识别出节点')
    }
}

export function resourceNodeCount(resource) {
    const info = resource?.info
    const raw = info && typeof info === 'object' ? info.nodeCount : undefined
    const count = Number(raw)
    return Number.isFinite(count) && count > 0 ? count : 0
}

export function withProcess(clashConfig = {}) {
    const next = clashConfig && typeof clashConfig === 'object' ? { ...clashConfig } : {}
    next.process = normalizeProcess(next.process)
    return next
}

export function nextResourceView(filter, query, saved) {
    const rows = (Array.isArray(saved) ? saved : []).filter(row => row && (row.id != null || row.type || row.name))
    const currentFilter = filter || 'all'
    const currentQuery = String(query || '')
    const needle = currentQuery.trim().toLowerCase()
    let nextFilter = currentFilter
    if (rows.length) {
        const types = [...new Set(rows.map(row => row.type).filter(Boolean))]
        if (currentFilter !== 'all' && rows.some(row => row.type && row.type !== currentFilter)) {
            nextFilter = types.length === 1 ? types[0] : 'all'
        }
    }
    let nextQuery = currentQuery
    if (needle && rows.some(row => !String(row.name || '').toLowerCase().includes(needle))) {
        nextQuery = ''
    }
    return { filter: nextFilter, query: nextQuery }
}
