import { passwordMatches, signSession } from '../auth.js';
import {
    LOGIN_LOCKED_MESSAGE,
    LOGIN_PASSWORD_ERROR,
    clearLoginFailures,
    inspectLoginAttempt,
    loginSource,
    recordLoginFailure
} from '../login-limit.js';

export function registerAuthRoutes(app) {
    app.post('/login', async (c) => {
        let body = {};
        try { body = await c.req.json(); } catch { body = {}; }
        const secret = c.env.ADMIN_PASSWORD;
        if (!secret) return c.json({ success: false, error: '服务端未配置 ADMIN_PASSWORD' }, 500);
        const source = loginSource(c);
        const gate = await inspectLoginAttempt(c.env.DB, source);
        if (!gate.allowed) return c.json({ success: false, error: LOGIN_LOCKED_MESSAGE }, 401);
        const ok = await passwordMatches(body.password, secret);
        if (!ok) {
            await recordLoginFailure(c.env.DB, source);
            return c.json({ success: false, error: LOGIN_PASSWORD_ERROR }, 401);
        }
        await clearLoginFailures(c.env.DB, source);
        const token = await signSession(secret);
        return c.json({ success: true, token });
    });
}
