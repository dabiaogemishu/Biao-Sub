import { parseJson } from '../core/model.js';

export function idSetOf(ids) {
    const set = new Set();
    for (const id of ids || []) {
        set.add(Number(id));
        set.add(String(id));
    }
    return set;
}

export function stripResources(group, ids) {
    const banned = idSetOf(ids);
    const config = parseJson(group.config, []).filter(item => !banned.has(item.subId) && !banned.has(Number(item.subId)));
    const clashConfig = { ...parseJson(group.clash_config, {}) };
    if (Array.isArray(clashConfig.resources)) {
        clashConfig.resources = clashConfig.resources.filter(item => !banned.has(item.subId) && !banned.has(Number(item.subId)));
    }
    return { ...group, config, clash_config: clashConfig };
}

export function planRemoteRefresh(subscription, parsed) {
    if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
        return {
            ok: false,
            error: parsed?.errors?.length ? parsed.errors.map(item => item.message).join('；') : '未能识别任何节点',
            subscription
        };
    }
    return {
        ok: true,
        subscription: {
            ...subscription,
            snapshot: subscription.url || '',
            url: parsed.links ? parsed.links.join('\n') : subscription.url,
            info: {
                ...(subscription.info || {}),
                nodeCount: parsed.nodes.length,
                format: parsed.format || ''
            }
        }
    };
}
