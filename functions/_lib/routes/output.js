import { resolveFormat } from '../output/build.js';
import { buildGroupOutput } from '../output/render.js';

export function registerOutputRoutes(app) {
    app.get('/g/:token', async (c) => {
        const token = c.req.param('token');
        const format = resolveFormat(c.req.query('format'));
        const group = await c.env.DB.prepare('SELECT * FROM groups WHERE token = ? AND status = 1').bind(token).first();
        if (!group) return c.text('订阅不存在', 404);
        const touch = c.env.DB.prepare(
            "UPDATE groups SET access_count = COALESCE(access_count, 0) + 1, last_accessed = datetime('now') WHERE token = ?"
        ).bind(token).run();
        if (c.executionCtx) c.executionCtx.waitUntil(touch);
        else await touch;

        const built = await buildGroupOutput(c.env.DB, group);
        const filename = encodeURIComponent(group.name || 'BiaoSUB');
        const extension = format === 'base64' ? 'txt' : format === 'singbox' ? 'json' : 'yaml';
        c.header('Content-Disposition', `attachment; filename*=UTF-8''${filename}.${extension}`);
        c.header('Profile-Update-Interval', '24');
        if (format === 'base64') {
            return c.text(built.base64 || '', 200, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        if (format === 'singbox') {
            return c.text(built.singbox || '', 200, { 'Content-Type': 'application/json; charset=utf-8' });
        }
        if (format === 'list') {
            return c.text(built.list || '', 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        }
        const save = c.env.DB.prepare('UPDATE groups SET cached_yaml = ? WHERE id = ?').bind(built.clash || '', group.id).run();
        if (c.executionCtx) c.executionCtx.waitUntil(save);
        else await save;
        return c.text(built.clash || '', 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
    });
}
