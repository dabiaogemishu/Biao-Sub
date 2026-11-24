export function registerTemplateRoutes(app) {
    app.get('/templates', async (c) => {
        const { results } = await c.env.DB.prepare('SELECT * FROM templates ORDER BY id DESC').all();
        return c.json({
            success: true,
            data: (results || []).map(row => {
                let groups = [];
                try { groups = JSON.parse(row.groups || '[]'); } catch { groups = []; }
                return { ...row, groups };
            })
        });
    });

    app.post('/templates', async (c) => {
        const body = await c.req.json();
        if (!body.name) return c.json({ success: false, error: '请填写模板名称' }, 400);
        await c.env.DB.prepare('INSERT INTO templates (name, header, groups, rules) VALUES (?, ?, ?, ?)')
            .bind(body.name, body.header || '', JSON.stringify(body.groups || []), body.rules || '').run();
        return c.json({ success: true });
    });

    app.put('/templates/:id', async (c) => {
        const body = await c.req.json();
        await c.env.DB.prepare('UPDATE templates SET name = ?, header = ?, groups = ?, rules = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(body.name, body.header || '', JSON.stringify(body.groups || []), body.rules || '', c.req.param('id')).run();
        return c.json({ success: true });
    });

    app.delete('/templates/:id', async (c) => {
        await c.env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    });
}
