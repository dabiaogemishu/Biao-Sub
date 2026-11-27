import { parseJson } from '../core/model.js';
import { loadProxy } from '../proxy-settings.js';
import { fetchSubscription, performRemoteRefresh } from '../remote-service.js';
import { canonicalize } from '../subscribe/store.js';
import { createdResource } from './subscription.js';

export function registerRemoteRoutes(app) {
    app.post('/remote', async (c) => {
        const body = await c.req.json();
        const sourceUrl = (body.url || '').trim();
        if (!sourceUrl) return c.json({ success: false, error: '请输入订阅链接' }, 400);
        const ua = body.ua || 'clash-verge/v1.7.7';
        try {
            const proxy = await loadProxy(c.env.DB);
            const { content, subInfo } = await fetchSubscription(sourceUrl, ua, proxy);
            const stored = canonicalize(content);
            if (!stored.ok) return c.json({ success: false, error: stored.error }, 422);
            const name = body.name || subInfo.fileName || `远程订阅 (${stored.parsed.nodes.length}个节点)`;
            const info = { ...subInfo, nodeCount: stored.parsed.nodes.length, format: stored.parsed.format };
            const inserted = await c.env.DB.prepare(
                'INSERT INTO subscriptions (name, url, source_url, type, params, info, snapshot, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, 9999, 1)'
            ).bind(name, stored.url, sourceUrl, 'remote', JSON.stringify({ ua }), JSON.stringify(info), '').run();
            const resources = [createdResource(
                inserted?.meta?.last_row_id,
                name,
                stored.url,
                'remote',
                JSON.stringify(info),
                9999,
                { source_url: sourceUrl, params: JSON.stringify({ ua }) }
            )].filter(Boolean);
            return c.json({ success: true, data: { name, nodeCount: stored.parsed.nodes.length, subInfo: info }, warnings: stored.warnings, resources });
        } catch (error) {
            return c.json({ success: false, error: error.message }, 502);
        }
    });

    app.post('/remote/refresh/:id', async (c) => {
        const id = c.req.param('id');
        try {
            const row = await c.env.DB.prepare("SELECT source_url, params FROM subscriptions WHERE id = ? AND type = 'remote'").bind(id).first();
            if (!row) return c.json({ success: false, error: '资源不存在或不是远程订阅' }, 404);
            if (!row.source_url) return c.json({ success: false, error: '这条远程订阅没有来源地址' }, 400);
            const params = parseJson(row.params, {});
            const proxy = await loadProxy(c.env.DB);
            const { content, subInfo } = await fetchSubscription(row.source_url, params.ua, proxy);
            const result = await performRemoteRefresh(c.env.DB, id, content, subInfo);
            if (!result.ok) return c.json({ success: false, error: result.error }, result.status || 422);
            return c.json({ success: true, data: { nodeCount: result.nodeCount, subInfo: result.subInfo }, warnings: result.warnings || [] });
        } catch (error) {
            return c.json({ success: false, error: error.message }, 502);
        }
    });
}
