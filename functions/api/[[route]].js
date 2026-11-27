import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { readBearer, verifySession } from '../_lib/auth.js';
import { ALTER_TABLES, CREATE_TABLES } from '../_lib/schema.js';
import { registerAuthRoutes } from '../_lib/routes/auth.js';
import { registerSettingsRoutes } from '../_lib/routes/settings.js';
import { registerBackupRoutes } from '../_lib/routes/backup.js';
import { registerGroupRoutes } from '../_lib/routes/group.js';
import { registerOutputRoutes } from '../_lib/routes/output.js';
import { registerRemoteRoutes } from '../_lib/routes/remote.js';
import { registerSubRoutes } from '../_lib/routes/subscription.js';
import { registerTemplateRoutes } from '../_lib/routes/template.js';

const app = new Hono().basePath('/api');
let migrationDone = false;

async function migrate(db) {
    for (const sql of CREATE_TABLES) await db.prepare(sql).run();
    for (const sql of ALTER_TABLES) {
        try { await db.prepare(sql).run(); } catch { /* 列已存在 */ }
    }
}

app.use('/*', async (c, next) => {
    if (!migrationDone && c.env.DB) {
        await migrate(c.env.DB);
        migrationDone = true;
    }
    await next();
});

app.use('/*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path === '/api/login' || /^\/api\/g\/[^/]+$/.test(path)) return next();
    const secret = c.env.ADMIN_PASSWORD;
    if (!secret) return c.json({ success: false, error: '服务端未配置 ADMIN_PASSWORD' }, 500);
    const token = readBearer(c.req.header('Authorization'));
    if (!(await verifySession(token, secret))) {
        return c.json({ success: false, error: '未登录或会话已过期' }, 401);
    }
    await next();
});

app.onError((error, c) => c.json({ success: false, error: error.message }, 500));

registerOutputRoutes(app);
registerSubRoutes(app);
registerGroupRoutes(app);
registerRemoteRoutes(app);
registerTemplateRoutes(app);
registerAuthRoutes(app);
registerBackupRoutes(app);
registerSettingsRoutes(app);

export const onRequest = handle(app);
