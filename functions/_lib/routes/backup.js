import { parseJson } from '../core/model.js';
import { restoreBackup } from '../backup.js';

export function registerBackupRoutes(app) {
    app.get('/backup', async (c) => {
        const subs = (await c.env.DB.prepare('SELECT * FROM subscriptions').all()).results || [];
        const groups = (await c.env.DB.prepare('SELECT * FROM groups').all()).results || [];
        const templates = (await c.env.DB.prepare('SELECT * FROM templates').all()).results || [];
        return c.json({
            success: true,
            data: {
                items: subs.map(row => ({ ...row, info: parseJson(row.info, {}), params: parseJson(row.params, {}) })),
                groups: groups.map(row => ({
                    ...row,
                    config: parseJson(row.config, []),
                    clash_config: parseJson(row.clash_config, {})
                })),
                templates: templates.map(row => ({ ...row, groups: parseJson(row.groups, []) }))
            }
        });
    });

    app.post('/restore', async (c) => {
        const body = await c.req.json();
        try {
            const plan = await restoreBackup(c.env.DB, body, body.mode);
            return c.json({ success: true, mode: plan.mode });
        } catch (error) {
            return c.json({ success: false, error: error.message }, 500);
        }
    });
}
