import { parseSubscription } from '../subscribe/parse.js';
import { toPublicNode } from '../uri/index.js';
import { canonicalize } from '../subscribe/store.js';
import { summarizeErrors } from '../core/model.js';
import { rebuildCachesFor } from '../output/render.js';
import { detachResources } from '../groups/persist.js';

function infoWithCount(info, count, format) {
    const base = info && typeof info === 'object' ? info : {};
    return JSON.stringify({ ...base, nodeCount: count, format: format || base.format || '' });
}

function createdResource(id, name, url, type, infoText, sortOrder) {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    let info = {};
    try { info = JSON.parse(infoText || '{}'); } catch { info = {}; }
    return {
        id: numeric,
        name,
        url,
        type,
        params: '{}',
        info,
        status: 1,
        sort_order: sortOrder
    };
}

export function registerSubRoutes(app) {
    app.get('/subs', async (c) => {
        const { results } = await c.env.DB.prepare('SELECT * FROM subscriptions ORDER BY sort_order ASC, id DESC').all();
        const data = (results || []).map(row => {
            let info = {};
            try { info = JSON.parse(row.info || '{}'); } catch { info = {}; }
            return { ...row, info };
        });
        return c.json({ success: true, data });
    });

    app.post('/subs', async (c) => {
        const body = await c.req.json();
        const type = body.type || 'node';
        const stored = canonicalize(body.url || '', body.names);
        if (!stored.ok) return c.json({ success: false, error: stored.error, warnings: stored.warnings || [] }, 400);
        if (type === 'node' && stored.parsed.nodes.length > 1) {
            const stmt = c.env.DB.prepare(
                'INSERT INTO subscriptions (name, url, type, params, info, sort_order, status) VALUES (?, ?, ?, ?, ?, 0, 1)'
            );
            const prepared = stored.links.map((link, index) => {
                const name = body.name ? `${body.name} ${index + 1}` : stored.parsed.nodes[index].name;
                const single = canonicalize(link, [name]);
                const url = single.ok ? single.url : link;
                const info = infoWithCount({}, 1, stored.parsed.format);
                return { name, url, info, stmt: stmt.bind(name, url, 'node', '{}', info) };
            });
            const inserted = await c.env.DB.batch(prepared.map(item => item.stmt));
            const resources = prepared.map((item, index) => createdResource(
                inserted[index]?.meta?.last_row_id,
                item.name,
                item.url,
                'node',
                item.info,
                0
            )).filter(Boolean);
            return c.json({ success: true, count: stored.parsed.nodes.length, warnings: stored.warnings, resources });
        }
        let name = body.name || stored.parsed.nodes[0].name || '未命名资源';
        if (type === 'node' && stored.parsed.nodes.length === 1 && body.name) {
            stored.parsed.nodes[0].name = body.name;
            const renamed = canonicalize(stored.url, [body.name]);
            if (renamed.ok) stored.url = renamed.url;
            name = body.name;
        }
        const sortOrder = type === 'node' ? 0 : 9999;
        const info = infoWithCount(body.info, stored.parsed.nodes.length, stored.parsed.format);
        const inserted = await c.env.DB.prepare(
            'INSERT INTO subscriptions (name, url, type, params, info, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, 1)'
        ).bind(name, stored.url, type, '{}', info, sortOrder).run();
        const resources = [createdResource(inserted?.meta?.last_row_id, name, stored.url, type, info, sortOrder)].filter(Boolean);
        return c.json({ success: true, warnings: stored.warnings, count: stored.parsed.nodes.length, resources });
    });

    app.put('/subs/:id', async (c) => {
        const body = await c.req.json();
        const id = c.req.param('id');
        const sets = ['updated_at = CURRENT_TIMESTAMP'];
        const args = [];
        if (body.url !== undefined) {
            const stored = canonicalize(body.url, body.names);
            if (!stored.ok) return c.json({ success: false, error: stored.error, warnings: stored.warnings || [] }, 400);
            if (body.name && stored.parsed.nodes.length === 1) {
                const renamed = canonicalize(stored.url, [body.name]);
                if (renamed.ok) stored.url = renamed.url;
            }
            sets.push('url = ?');
            args.push(stored.url);
            const info = body.info && typeof body.info === 'object' ? body.info : {};
            sets.push('info = ?');
            args.push(infoWithCount(info, stored.parsed.nodes.length, stored.parsed.format));
        } else if (body.info) {
            sets.push('info = ?');
            args.push(JSON.stringify(body.info));
        }
        if (body.name !== undefined) { sets.push('name = ?'); args.push(body.name); }
        if (body.type !== undefined) { sets.push('type = ?'); args.push(body.type); }
        if (body.status !== undefined) { sets.push('status = ?'); args.push(Number(body.status)); }
        args.push(id);
        await c.env.DB.prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ?`).bind(...args).run();
        if (body.url !== undefined) await rebuildCachesFor(c.env.DB, [id]);
        return c.json({ success: true });
    });

    app.delete('/subs/:id', async (c) => {
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
        await detachResources(c.env.DB, [id]);
        return c.json({ success: true });
    });

    app.post('/subs/delete', async (c) => {
        const { ids } = await c.req.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) return c.json({ success: true });
        const stmt = c.env.DB.prepare('DELETE FROM subscriptions WHERE id = ?');
        for (let i = 0; i < ids.length; i += 40) {
            await c.env.DB.batch(ids.slice(i, i + 40).map(id => stmt.bind(id)));
        }
        await detachResources(c.env.DB, ids);
        return c.json({ success: true });
    });

    app.post('/sort', async (c) => {
        const { ids } = await c.req.json();
        const stmt = c.env.DB.prepare('UPDATE subscriptions SET sort_order = ? WHERE id = ?');
        await c.env.DB.batch((ids || []).map((id, index) => stmt.bind(index, id)));
        return c.json({ success: true });
    });

    app.post('/subs/reorder', async (c) => {
        const { order } = await c.req.json();
        const stmt = c.env.DB.prepare('UPDATE subscriptions SET sort_order = ? WHERE id = ?');
        await c.env.DB.batch((order || []).map((id, index) => stmt.bind(index, id)));
        return c.json({ success: true });
    });

    app.post('/check', async (c) => {
        const body = await c.req.json();
        const parsed = parseSubscription(body.url || '');
        const nodes = parsed.nodes.map(toPublicNode);
        if (!nodes.length) {
            return c.json({
                success: false,
                error: summarizeErrors(parsed.errors),
                data: { valid: false, nodeCount: 0, nodes: [], errors: parsed.errors, format: parsed.format }
            });
        }
        return c.json({
            success: true,
            data: { valid: true, nodeCount: nodes.length, nodes, errors: parsed.errors, format: parsed.format }
        });
    });
}
