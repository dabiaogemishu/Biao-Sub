import { fetchSubscription } from '../remote-service.js';
import { applyProxyUpdate, loadProxy, saveProxy, toPublicProxy } from '../proxy-settings.js';

const TEST_URL = 'https://cloudflare.com/cdn-cgi/trace';

export function registerSettingsRoutes(app) {
    app.get('/settings/proxy', async (c) => {
        const proxy = await loadProxy(c.env.DB);
        return c.json({ success: true, data: toPublicProxy(proxy) });
    });

    app.put('/settings/proxy', async (c) => {
        const body = await c.req.json().catch(() => null);
        if (!body || typeof body !== 'object') return c.json({ success: false, error: '请求格式不正确' }, 400);
        const stored = await loadProxy(c.env.DB);
        const result = applyProxyUpdate(stored, body);
        if (result.error) return c.json({ success: false, error: result.error }, 400);
        const saved = await saveProxy(c.env.DB, result.proxy);
        return c.json({ success: true, data: toPublicProxy(saved) });
    });

    app.post('/settings/proxy/test', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const stored = await loadProxy(c.env.DB);
        const result = applyProxyUpdate(stored, { ...(body || {}), enabled: true });
        if (result.error) return c.json({ success: false, error: result.error }, 400);
        try {
            const { content } = await fetchSubscription(TEST_URL, 'BiaoSUB-proxy-check', result.proxy);
            const ip = String(content || '').match(/(?:^|\n)ip=([^\s]+)/)?.[1] || '';
            return c.json({
                success: true,
                data: { message: ip ? `代理连接成功，出口 IP：${ip}` : '代理连接成功' }
            });
        } catch (error) {
            return c.json({ success: false, error: error.message }, 502);
        }
    });
}
