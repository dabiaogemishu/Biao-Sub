import { decodeBase64, encodeBase64Url, decodeHash, encodeName } from '../core/codec.js';
import { createNode, formatHost, parseHostPort } from '../core/model.js';

function splitMethodPassword(user) {
    const idx = user.indexOf(':');
    if (idx <= 0) throw new Error('SS 用户信息缺少加密方法');
    const cipher = user.slice(0, idx);
    const password = user.slice(idx + 1);
    if (!cipher || password === '') throw new Error('SS 缺少密码');
    return { cipher, password };
}

function decodeUserInfo(user) {
    const decoded = tryURIDecode(user);
    if (decoded.includes(':')) return decoded;
    try {
        const text = decodeBase64(decoded);
        if (text.includes(':')) return text;
    } catch { /* 继续按明文报错 */ }
    return decoded;
}

function tryURIDecode(value) {
    try { return decodeURIComponent(value); } catch { return value; }
}

function applyPlugin(node, query) {
    if (!query) return;
    const params = new URLSearchParams(query);
    const plugin = params.get('plugin');
    if (!plugin) return;
    const parts = plugin.split(';').filter(Boolean);
    const name = parts[0];
    const opts = {};
    for (const part of parts.slice(1)) {
        const eq = part.indexOf('=');
        if (eq > 0) opts[part.slice(0, eq)] = part.slice(eq + 1);
        else opts[part] = true;
    }
    if (name === 'obfs-local' || name === 'simple-obfs' || name === 'obfs') {
        node.plugin = 'obfs';
        node.pluginOpts = {
            mode: opts.obfs || opts.mode || 'http',
            host: opts['obfs-host'] || opts.host || ''
        };
        return;
    }
    if (name === 'v2ray-plugin') {
        node.plugin = 'v2ray-plugin';
        node.pluginOpts = {
            mode: opts.mode || 'websocket',
            host: opts.host || '',
            path: opts.path || '',
            tls: opts.tls === true || opts.tls === 'tls' || opts.tls === 'true'
        };
        return;
    }
    node.plugin = name;
    node.pluginOpts = opts;
}

function pluginQuery(node) {
    if (!node.plugin) return '';
    const opts = node.pluginOpts || {};
    if (node.plugin === 'obfs') {
        let text = `obfs-local;obfs=${opts.mode || 'http'}`;
        if (opts.host) text += `;obfs-host=${opts.host}`;
        return `plugin=${encodeURIComponent(text)}`;
    }
    if (node.plugin === 'v2ray-plugin') {
        let text = `v2ray-plugin;mode=${opts.mode || 'websocket'}`;
        if (opts.host) text += `;host=${opts.host}`;
        if (opts.path) text += `;path=${opts.path}`;
        if (opts.tls) text += ';tls';
        return `plugin=${encodeURIComponent(text)}`;
    }
    const extra = Object.entries(opts).map(([k, v]) => (v === true ? k : `${k}=${v}`)).join(';');
    const text = extra ? `${node.plugin};${extra}` : node.plugin;
    return `plugin=${encodeURIComponent(text)}`;
}

export function parseSs(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('ss://')) throw new Error('不是 ss 链接');
    const hashAt = raw.indexOf('#');
    const name = hashAt >= 0 ? decodeHash(raw.slice(hashAt + 1)) : '';
    let body = (hashAt >= 0 ? raw.slice(5, hashAt) : raw.slice(5)).trim();
    let query = '';
    const q = body.indexOf('?');
    if (q >= 0) {
        query = body.slice(q + 1);
        body = body.slice(0, q);
    }
    let cipher, password, server, port;
    if (body.includes('@')) {
        const at = body.lastIndexOf('@');
        const user = decodeUserInfo(body.slice(0, at));
        ({ cipher, password } = splitMethodPassword(user));
        ({ server, port } = parseHostPort(body.slice(at + 1)));
    } else {
        let decoded;
        try { decoded = decodeBase64(body); } catch { throw new Error('SS 旧版链接 Base64 无法解码'); }
        const at = decoded.lastIndexOf('@');
        if (at < 0) throw new Error('无法识别的 SS 链接');
        ({ cipher, password } = splitMethodPassword(decoded.slice(0, at)));
        ({ server, port } = parseHostPort(decoded.slice(at + 1)));
    }
    const node = createNode({ type: 'ss', name, server, port, cipher, password });
    applyPlugin(node, query);
    return node;
}

export function generateSs(node) {
    if (!node.cipher || node.password === '') throw new Error('SS 缺少加密方法或密码');
    const user = encodeBase64Url(`${node.cipher}:${node.password}`);
    const query = pluginQuery(node);
    const qs = query ? `?${query}` : '';
    return `ss://${user}@${formatHost(node.server, node.port)}${qs}#${encodeName(node.name)}`;
}
