import { parseJson, summarizeErrors } from './core/model.js';
import { parseSubscription } from './subscribe/parse.js';
import { toUri } from './uri/index.js';
import { planRemoteRefresh } from './groups/membership.js';
import { rebuildCachesFor } from './output/render.js';
import { validateEnabledProxy } from './proxy-settings.js';
import { DEFAULT_UA, fetchViaProxy, sanitizeUserAgent } from './socks5.js';
import { GENERIC_REMOTE_ERROR, REMOTE_DENIED_ERROR, REMOTE_REDIRECT_LIMIT_ERROR, REMOTE_TIMEOUT_ERROR } from './safe-error.js';
import { assertSafeHttpUrl } from './url-guard.js';

export function rowToSubscription(row) {
    return {
        ...row,
        info: parseJson(row.info, {}),
        params: parseJson(row.params, {})
    };
}

export async function performRemoteRefresh(db, id, text, subInfo = {}) {
    const row = await db.prepare("SELECT * FROM subscriptions WHERE id = ? AND type = 'remote'").bind(id).first();
    if (!row) return { ok: false, status: 404, error: '资源不存在或不是远程订阅' };
    const current = rowToSubscription(row);
    const parsed = parseSubscription(text);
    if (!parsed.nodes.length) {
        return { ok: false, status: 422, error: summarizeErrors(parsed.errors), subscription: current };
    }
    let links;
    try {
        links = parsed.nodes.map(node => toUri(node));
    } catch {
        return { ok: false, status: 422, error: '节点无法导出', subscription: current };
    }
    const plan = planRemoteRefresh(current, { ...parsed, links });
    const info = { ...(plan.subscription.info || {}), ...(subInfo || {}) };
    await db.prepare(
        'UPDATE subscriptions SET url = ?, snapshot = ?, info = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(plan.subscription.url, plan.subscription.snapshot || '', JSON.stringify(info), id).run();
    await rebuildCachesFor(db, [id]);
    return { ok: true, nodeCount: links.length, subInfo: info, warnings: parsed.errors };
}

function readSubInfo(headers) {
    const subInfo = {};
    const userinfo = headers?.get?.('Subscription-Userinfo') || headers?.get?.('subscription-userinfo');
    if (!userinfo) return subInfo;
    for (const part of userinfo.split(';')) {
        const [key, value] = part.split('=').map(item => item.trim());
        if (key && value) subInfo[key] = Number.isNaN(Number(value)) ? value : Number(value);
    }
    return subInfo;
}

export async function fetchSubscription(url, ua, proxy, deps) {
    const safeUa = sanitizeUserAgent(ua || DEFAULT_UA);
    if (proxy?.enabled) {
        const problem = validateEnabledProxy(proxy);
        if (problem) throw new Error(problem);
        return fetchViaProxy(url, safeUa, proxy, deps);
    }
    let current = assertSafeHttpUrl(url);
    const doFetch = deps?.fetch || fetch;
    const timeoutMs = deps?.timeoutMs || 15000;
    for (let hop = 0; hop < 5; hop++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await doFetch(current.href, {
                signal: controller.signal,
                headers: {
                    'User-Agent': safeUa,
                    'Accept': '*/*'
                },
                redirect: 'manual'
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location') || response.headers.get('Location');
                if (!location) throw new Error(GENERIC_REMOTE_ERROR);
                current = assertSafeHttpUrl(location, current);
                continue;
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(REMOTE_DENIED_ERROR);
            }
            if (!response.ok) throw new Error(GENERIC_REMOTE_ERROR);
            return { content: await response.text(), subInfo: readSubInfo(response.headers) };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error(REMOTE_TIMEOUT_ERROR);
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error(REMOTE_REDIRECT_LIMIT_ERROR);
}
