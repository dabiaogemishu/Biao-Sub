import { parseJson, summarizeErrors } from './core/model.js';
import { parseSubscription } from './subscribe/parse.js';
import { toUri } from './uri/index.js';
import { planRemoteRefresh } from './groups/membership.js';
import { rebuildCachesFor } from './output/render.js';
import { validateEnabledProxy } from './proxy-settings.js';
import { fetchViaProxy } from './socks5.js';

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
    } catch (error) {
        return { ok: false, status: 422, error: `节点无法导出：${error.message}`, subscription: current };
    }
    const plan = planRemoteRefresh(current, { ...parsed, links });
    const info = { ...(plan.subscription.info || {}), ...(subInfo || {}) };
    await db.prepare(
        'UPDATE subscriptions SET url = ?, snapshot = ?, info = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(plan.subscription.url, plan.subscription.snapshot || '', JSON.stringify(info), id).run();
    await rebuildCachesFor(db, [id]);
    return { ok: true, nodeCount: links.length, subInfo: info, warnings: parsed.errors };
}

export async function fetchSubscription(url, ua, proxy, deps) {
    if (proxy?.enabled) {
        const problem = validateEnabledProxy(proxy);
        if (problem) throw new Error(problem);
        return fetchViaProxy(url, ua, proxy, deps);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const doFetch = deps?.fetch || fetch;
    try {
        const response = await doFetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': ua || 'clash-verge/v1.7.7',
                'Accept': '*/*'
            },
            redirect: 'follow'
        });
        if (response.status === 401 || response.status === 403) {
            throw new Error(`远程服务器拒绝访问（${response.status}）。机场可能屏蔽了 Cloudflare 出口，可在系统设置里启用 SOCKS5 代理，或改用手动粘贴订阅内容。`);
        }
        if (!response.ok) throw new Error(`远程订阅返回 HTTP ${response.status}`);
        const content = await response.text();
        const subInfo = {};
        const userinfo = response.headers.get('Subscription-Userinfo') || response.headers.get('subscription-userinfo');
        if (userinfo) {
            for (const part of userinfo.split(';')) {
                const [key, value] = part.split('=').map(item => item.trim());
                if (key && value) subInfo[key] = Number.isNaN(Number(value)) ? value : Number(value);
            }
        }
        return { content, subInfo };
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('请求超时（15秒）');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
