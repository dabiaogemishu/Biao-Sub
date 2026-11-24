import { passwordMatches, signSession } from '../auth.js';

export function registerAuthRoutes(app) {
    app.post('/login', async (c) => {
        let body = {};
        try { body = await c.req.json(); } catch { body = {}; }
        const secret = c.env.ADMIN_PASSWORD;
        if (!secret) return c.json({ success: false, error: '服务端未配置 ADMIN_PASSWORD' }, 500);
        const ok = await passwordMatches(body.password, secret);
        if (!ok) return c.json({ success: false, error: '密码错误' }, 401);
        const token = await signSession(secret);
        return c.json({ success: true, token });
    });
}
