import { generateToken } from '../core/token.js';
import { parseJson } from '../core/model.js';
import { buildGroupOutput } from '../output/render.js';

export function registerGroupRoutes(app) {
    app.get('/groups', async (c) => {
        const { results } = await c.env.DB.prepare('SELECT * FROM groups ORDER BY sort_order ASC, id DESC').all();
        const data = (results || []).map(row => ({
            ...row,
            config: parseJson(row.config, []),
            clash_config: parseJson(row.clash_config, { mode: 'generate', header: '', groups: [], rules: '', resources: [], raw_yaml: '' })
        }));
        return c.json({ success: true, data });
    });

    app.post('/groups', async (c) => {
        const body = await c.req.json();
        const token = generateToken();
        const clashConfig = body.clash_config || { mode: 'generate', header: '', groups: [], rules: '', resources: [], raw_yaml: '' };
        const config = body.config || [];
        await c.env.DB.prepare(
            'INSERT INTO groups (name, token, config, clash_config, status, sort_order) VALUES (?, ?, ?, ?, 1, 0)'
        ).bind(body.name || '未命名聚合', token, JSON.stringify(config), JSON.stringify(clashConfig)).run();
        const row = await c.env.DB.prepare('SELECT * FROM groups WHERE token = ?').bind(token).first();
        const built = await buildGroupOutput(c.env.DB, row);
        await c.env.DB.prepare('UPDATE groups SET cached_yaml = ? WHERE token = ?').bind(built.clash || '', token).run();
        return c.json({ success: true, token });
    });

    app.put('/groups/:id', async (c) => {
        const body = await c.req.json();
        const id = c.req.param('id');
        const sets = ['updated_at = CURRENT_TIMESTAMP'];
        const args = [];
        if (body.name !== undefined) { sets.push('name = ?'); args.push(body.name); }
        if (body.config !== undefined) { sets.push('config = ?'); args.push(JSON.stringify(body.config)); }
        if (body.clash_config !== undefined) { sets.push('clash_config = ?'); args.push(JSON.stringify(body.clash_config)); }
        if (body.status !== undefined) { sets.push('status = ?'); args.push(Number(body.status)); }
        if (body.refresh_token) { sets.push('token = ?'); args.push(generateToken()); }
        args.push(id);
        await c.env.DB.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).bind(...args).run();
        if (body.config !== undefined || body.clash_config !== undefined || body.refresh_token) {
            const row = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first();
            if (row) {
                const built = await buildGroupOutput(c.env.DB, row);
                await c.env.DB.prepare('UPDATE groups SET cached_yaml = ? WHERE id = ?').bind(built.clash || '', id).run();
            }
        }
        return c.json({ success: true });
    });

    app.delete('/groups/:id', async (c) => {
        await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    });

    app.post('/groups/reorder', async (c) => {
        const { order } = await c.req.json();
        if (!order || !Array.isArray(order)) return c.json({ success: false, error: '排序数据无效' }, 400);
        const stmt = c.env.DB.prepare('UPDATE groups SET sort_order = ? WHERE id = ?');
        await c.env.DB.batch(order.map((id, index) => stmt.bind(index, id)));
        return c.json({ success: true });
    });
}
