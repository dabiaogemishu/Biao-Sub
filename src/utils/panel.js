export function failureText(data, status, fallback = '请求失败') {
    const message = data && typeof data.error === 'string' ? data.error.trim() : ''
    if (message) return message
    if (status) return `请求失败（HTTP ${status}）`
    return fallback
}

export function subscriptionLinks(origin, token) {
    const base = `${String(origin || '').replace(/\/$/, '')}/api/g/${token}`
    return { clash: base, base64: `${base}?format=base64` }
}

export function moveItem(list, oldIndex, newIndex) {
    const next = Array.isArray(list) ? list.slice() : []
    if (oldIndex == null || newIndex == null || oldIndex === newIndex) return next
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= next.length || newIndex >= next.length) return next
    const [item] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, item)
    return next
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
