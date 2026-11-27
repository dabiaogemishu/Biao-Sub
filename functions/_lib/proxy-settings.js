export const PROXY_SETTING_KEY = 'socks5_proxy';
export const DEFAULT_SOCKS_PORT = 1080;

const encoder = new TextEncoder();

export function emptyProxy() {
    return { enabled: false, host: '', port: DEFAULT_SOCKS_PORT, username: '', password: '' };
}

function safeDecode(value) {
    if (!value) return '';
    try { return decodeURIComponent(value); } catch { return value; }
}

export function parseSocks5Uri(raw) {
    const text = String(raw ?? '').trim();
    if (!text) throw new Error('请粘贴 socks5:// 链接');
    let url;
    try { url = new URL(text); } catch { throw new Error('SOCKS5 链接格式不正确'); }
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();
    if (scheme !== 'socks5' && scheme !== 'socks5h') throw new Error('只支持 socks5:// 链接');
    const host = url.hostname.startsWith('[') && url.hostname.endsWith(']')
        ? url.hostname.slice(1, -1)
        : url.hostname;
    if (!host) throw new Error('SOCKS5 链接里没有主机');
    if ((url.pathname && url.pathname !== '/') || url.search || url.hash) {
        throw new Error('SOCKS5 链接只应包含主机、端口和账号');
    }
    let port = DEFAULT_SOCKS_PORT;
    if (url.port) {
        port = Number(url.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SOCKS5 端口无效');
    }
    return {
        host,
        port,
        username: safeDecode(url.username),
        password: safeDecode(url.password)
    };
}

function cleanHost(value) {
    let host = String(value ?? '').trim();
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    return host;
}

function parsePort(value) {
    if (value === '' || value == null) return { port: DEFAULT_SOCKS_PORT };
    const port = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { error: '端口必须是 1 到 65535 的整数' };
    }
    return { port };
}

export function normalizeProxy(raw) {
    const base = emptyProxy();
    if (!raw || typeof raw !== 'object') return base;
    const parsed = parsePort(raw.port);
    return {
        enabled: Boolean(raw.enabled),
        host: cleanHost(raw.host),
        port: parsed.port || DEFAULT_SOCKS_PORT,
        username: String(raw.username ?? ''),
        password: String(raw.password ?? '')
    };
}

export function validateEnabledProxy(proxy) {
    const parsed = parsePort(proxy?.port);
    if (parsed.error) return parsed.error;
    const current = normalizeProxy(proxy);
    if (!current.host) return '代理已启用，但没有填写 SOCKS5 主机';
    if (/\s/.test(current.host) || current.host.includes('://') || current.host.includes('/')) {
        return 'SOCKS5 主机格式不正确';
    }
    if (encoder.encode(current.username).length > 255) return '用户名过长';
    if (encoder.encode(current.password).length > 255) return '密码过长';
    if (current.password && !current.username) return '填写了密码就必须填写用户名';
    return null;
}

export function toPublicProxy(proxy) {
    const current = normalizeProxy(proxy);
    return {
        enabled: current.enabled,
        host: current.host,
        port: current.port,
        username: current.username,
        hasPassword: current.password.length > 0
    };
}

export function applyProxyUpdate(stored, body) {
    const current = normalizeProxy(stored);
    const input = body && typeof body === 'object' ? body : {};
    const parsed = parsePort(input.port);
    if (parsed.error) return { error: parsed.error };
    let password = current.password;
    if (input.clearPassword === true) password = '';
    if (typeof input.password === 'string' && input.password.length > 0) password = input.password;
    const proxy = {
        enabled: Boolean(input.enabled),
        host: cleanHost(input.host),
        port: parsed.port,
        username: String(input.username ?? ''),
        password
    };
    if (proxy.enabled) {
        const error = validateEnabledProxy(proxy);
        if (error) return { error };
    }
    return { proxy };
}

export async function loadProxy(db) {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(PROXY_SETTING_KEY).first();
    if (!row?.value) return emptyProxy();
    try { return normalizeProxy(JSON.parse(row.value)); } catch { return emptyProxy(); }
}

export async function saveProxy(db, proxy) {
    const current = normalizeProxy(proxy);
    const value = JSON.stringify({
        enabled: current.enabled,
        host: current.host,
        port: current.port,
        username: current.username,
        password: current.password
    });
    await db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(PROXY_SETTING_KEY, value).run();
    return current;
}
