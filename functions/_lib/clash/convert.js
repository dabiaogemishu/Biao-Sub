import { createNode, cleanObject } from '../core/model.js';
import { hostOf } from '../uri/share.js';

const GROUP_TYPES = new Set(['selector', 'url-test', 'fallback', 'load-balance', 'direct', 'reject', 'reject-drop', 'relay', 'compatible', 'pass']);

function asBool(value) {
    return value === true || value === 'true';
}

function asList(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value) return value.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

function firstPath(value) {
    if (Array.isArray(value)) return value[0] || '/';
    return value || '/';
}

function applyTransport(node, proxy) {
    const net = String(proxy.network || 'tcp').toLowerCase();
    const ws = proxy['ws-opts'] || {};
    if (net === 'ws' && ws['v2ray-http-upgrade']) {
        node.network = 'httpupgrade';
        node.httpupgrade = { path: ws.path || '/', host: hostOf(ws.headers) };
        return;
    }
    if (net === 'httpupgrade') {
        const opts = proxy['http-upgrade-opts'] || proxy['httpupgrade-opts'] || ws;
        node.network = 'httpupgrade';
        node.httpupgrade = { path: opts.path || '/', host: opts.host || hostOf(opts.headers) };
        return;
    }
    if (net === 'ws') {
        node.network = 'ws';
        node.ws = { path: ws.path || '/', host: hostOf(ws.headers) };
        return;
    }
    if (net === 'grpc') {
        const opts = proxy['grpc-opts'] || {};
        node.network = 'grpc';
        node.grpc = { serviceName: opts['grpc-service-name'] || opts.serviceName || '', mode: opts.mode || 'gun' };
        return;
    }
    if (net === 'xhttp' || net === 'splithttp') {
        const opts = proxy['xhttp-opts'] || {};
        const extra = { ...opts };
        delete extra.path;
        delete extra.host;
        delete extra.mode;
        node.network = 'xhttp';
        node.xhttp = {
            path: opts.path || '/',
            host: opts.host || '',
            mode: opts.mode || 'auto',
            extra: Object.keys(extra).length ? extra : null
        };
        return;
    }
    if (net === 'h2') {
        const opts = proxy['h2-opts'] || {};
        const host = Array.isArray(opts.host) ? opts.host[0] : (opts.host || '');
        node.network = 'h2';
        node.http = { path: opts.path || '/', host: host || '' };
        return;
    }
    if (net === 'http') {
        const opts = proxy['http-opts'] || {};
        node.network = 'http';
        node.http = { path: firstPath(opts.path), host: hostOf(opts.headers), method: opts.method || 'GET' };
        return;
    }
    node.network = net || 'tcp';
}

function applyTls(node, proxy) {
    const reality = proxy['reality-opts'];
    if (reality && (reality['public-key'] || reality.publicKey)) {
        node.reality = {
            publicKey: reality['public-key'] || reality.publicKey,
            shortId: reality['short-id'] || reality.shortId || '',
            spiderX: reality['spider-x'] || ''
        };
        node.security = 'reality';
        node.tls = true;
    } else if (asBool(proxy.tls)) {
        node.tls = true;
        node.security = 'tls';
    }
    node.sni = proxy.sni || proxy.servername || '';
    node.fingerprint = proxy['client-fingerprint'] || proxy.fingerprint || '';
    node.flow = proxy.flow || '';
    node.alpn = asList(proxy.alpn);
    node.skipCertVerify = asBool(proxy['skip-cert-verify']);
}

function applyPlugin(node, proxy) {
    let plugin = proxy.plugin || '';
    let opts = proxy['plugin-opts'] || null;
    if (typeof plugin === 'string' && plugin.includes(';')) {
        const parts = plugin.split(';');
        plugin = parts[0];
        opts = {};
        for (const part of parts.slice(1)) {
            const eq = part.indexOf('=');
            if (eq > 0) opts[part.slice(0, eq)] = part.slice(eq + 1);
        }
    }
    if (!plugin) return;
    if (plugin === 'obfs-local' || plugin === 'simple-obfs') plugin = 'obfs';
    if (plugin === 'obfs') {
        const mode = opts?.mode || opts?.obfs || 'http';
        const host = opts?.host || opts?.['obfs-host'] || '';
        node.plugin = 'obfs';
        node.pluginOpts = { mode, host };
        return;
    }
    node.plugin = plugin;
    node.pluginOpts = opts;
}

export function clashProxyToNode(proxy) {
    if (!proxy || typeof proxy !== 'object') throw new Error('代理不是对象');
    const type = String(proxy.type || '').toLowerCase();
    if (!type) throw new Error('缺少 type');
    if (GROUP_TYPES.has(type)) return null;
    const base = {
        name: proxy.name || '',
        type,
        server: proxy.server,
        port: proxy.port,
        udp: proxy.udp !== false
    };
    if (type === 'ss') {
        if (!proxy.cipher || proxy.password == null) throw new Error('SS 缺少 cipher 或 password');
        const node = createNode({ ...base, type: 'ss', cipher: proxy.cipher, password: String(proxy.password), udp: proxy.udp !== false });
        applyPlugin(node, proxy);
        return node;
    }
    if (type === 'ssr') {
        if (!proxy.cipher || proxy.password == null || !proxy.protocol || !proxy.obfs) throw new Error('SSR 缺少 cipher、password、protocol 或 obfs');
        return createNode({
            ...base,
            type: 'ssr',
            cipher: proxy.cipher,
            password: String(proxy.password),
            protocol: proxy.protocol,
            protocolParam: proxy['protocol-param'] || '',
            obfs: proxy.obfs,
            obfsParam: proxy['obfs-param'] || ''
        });
    }
    if (type === 'vmess') {
        if (!proxy.uuid) throw new Error('VMess 缺少 uuid');
        const node = createNode({
            ...base,
            type: 'vmess',
            uuid: proxy.uuid,
            alterId: Number(proxy.alterId || 0),
            cipher: proxy.cipher || 'auto'
        });
        applyTransport(node, proxy);
        applyTls(node, proxy);
        return node;
    }
    if (type === 'vless') {
        if (!proxy.uuid) throw new Error('VLESS 缺少 uuid');
        const node = createNode({
            ...base,
            type: 'vless',
            uuid: proxy.uuid,
            encryption: proxy.encryption || 'none',
            flow: proxy.flow || ''
        });
        applyTransport(node, proxy);
        applyTls(node, proxy);
        return node;
    }
    if (type === 'trojan') {
        if (proxy.password == null || proxy.password === '') throw new Error('Trojan 缺少 password');
        const node = createNode({ ...base, type: 'trojan', password: String(proxy.password), tls: true, security: 'tls' });
        applyTransport(node, proxy);
        applyTls(node, proxy);
        if (!node.tls && node.security !== 'reality') {
            node.tls = true;
            node.security = 'tls';
        }
        return node;
    }
    if (type === 'hysteria2') {
        if (proxy.password == null || proxy.password === '') throw new Error('Hysteria2 缺少 password');
        const node = createNode({
            ...base,
            type: 'hysteria2',
            password: String(proxy.password),
            obfs: proxy.obfs || '',
            obfsPassword: proxy['obfs-password'] || '',
            ports: proxy.ports || '',
            tls: true,
            security: 'tls'
        });
        applyTls(node, proxy);
        if (!node.alpn.length) node.alpn = ['h3'];
        return node;
    }
    if (type === 'hysteria') {
        const auth = proxy['auth-str'] || proxy.auth || proxy.password || '';
        if (!auth) throw new Error('Hysteria 缺少 auth');
        const node = createNode({
            ...base,
            type: 'hysteria',
            auth: String(auth),
            password: String(auth),
            protocol: proxy.protocol || 'udp',
            up: proxy.up || '',
            down: proxy.down || '',
            obfs: proxy.obfs || '',
            tls: true,
            security: 'tls'
        });
        applyTls(node, proxy);
        return node;
    }
    if (type === 'tuic') {
        const node = createNode({
            ...base,
            type: 'tuic',
            uuid: proxy.uuid || '',
            password: proxy.password != null ? String(proxy.password) : '',
            token: proxy.token || '',
            congestion: proxy['congestion-controller'] || '',
            udpRelayMode: proxy['udp-relay-mode'] || 'native',
            tls: true,
            security: 'tls'
        });
        if (!node.uuid && !node.token) throw new Error('TUIC 缺少 uuid 或 token');
        applyTls(node, proxy);
        if (!node.alpn.length) node.alpn = ['h3'];
        return node;
    }
    if (type === 'anytls') {
        if (proxy.password == null || proxy.password === '') throw new Error('AnyTLS 缺少 password');
        const node = createNode({
            ...base,
            type: 'anytls',
            password: String(proxy.password),
            fingerprint: proxy['client-fingerprint'] || 'chrome',
            tls: true,
            security: 'tls',
            udp: true
        });
        applyTls(node, proxy);
        if (!node.fingerprint) node.fingerprint = 'chrome';
        if (!node.alpn.length) node.alpn = ['h2', 'http/1.1'];
        return node;
    }
    throw new Error(`不支持的代理类型 ${type}`);
}

function transportFields(node) {
    const fields = {};
    if (node.network === 'ws' && node.ws) {
        fields.network = 'ws';
        fields['ws-opts'] = cleanObject({ path: node.ws.path || '/', headers: node.ws.host ? { Host: node.ws.host } : undefined });
    } else if (node.network === 'httpupgrade' && node.httpupgrade) {
        // mihomo 把 V2Ray HTTPUpgrade 放在 ws-opts.v2ray-http-upgrade，没有独立的 network: httpupgrade。
        fields.network = 'ws';
        fields['ws-opts'] = cleanObject({
            path: node.httpupgrade.path || '/',
            headers: node.httpupgrade.host ? { Host: node.httpupgrade.host } : undefined,
            'v2ray-http-upgrade': true
        });
    } else if (node.network === 'grpc' && node.grpc) {
        fields.network = 'grpc';
        fields['grpc-opts'] = { 'grpc-service-name': node.grpc.serviceName || '' };
    } else if (node.network === 'xhttp' && node.xhttp) {
        fields.network = 'xhttp';
        fields['xhttp-opts'] = cleanObject({
            ...(node.xhttp.extra || {}),
            path: node.xhttp.path || '/',
            host: node.xhttp.host || undefined,
            mode: node.xhttp.mode || undefined
        });
    } else if (node.network === 'h2' && node.http) {
        fields.network = 'h2';
        fields['h2-opts'] = cleanObject({ path: node.http.path || '/', host: node.http.host ? [node.http.host] : undefined });
    } else if (node.network === 'http' && node.http) {
        fields.network = 'http';
        fields['http-opts'] = cleanObject({
            method: node.http.method || 'GET',
            path: [node.http.path || '/'],
            headers: node.http.host ? { Host: [node.http.host] } : undefined
        });
    } else if (node.network && node.network !== 'tcp') {
        fields.network = node.network;
    }
    return fields;
}

function tlsFields(node, style) {
    const fields = {};
    if (node.tls || node.security === 'tls' || node.security === 'reality') {
        if (style === 'sni') fields.sni = node.sni || undefined;
        else fields.tls = true;
        if (style !== 'sni') fields.servername = node.sni || undefined;
        if (style === 'both') fields.sni = node.sni || undefined;
    }
    if (node.fingerprint) fields['client-fingerprint'] = node.fingerprint;
    if (node.alpn?.length) fields.alpn = node.alpn;
    if (node.skipCertVerify) fields['skip-cert-verify'] = true;
    if (node.reality?.publicKey) {
        fields.tls = true;
        fields['reality-opts'] = cleanObject({
            'public-key': node.reality.publicKey,
            'short-id': node.reality.shortId || undefined,
            'spider-x': node.reality.spiderX || undefined
        });
    }
    if (node.flow) fields.flow = node.flow;
    return fields;
}

export function nodeToClashProxy(node) {
    const dialer = node._dialer || undefined;
    const base = cleanObject({
        name: node.name,
        type: node.type,
        server: node.server,
        port: node.port,
        udp: node.udp ? true : undefined,
        'dialer-proxy': dialer
    }) || {};
    if (node.type === 'ss') {
        return cleanObject({
            ...base,
            cipher: node.cipher,
            password: node.password,
            plugin: node.plugin || undefined,
            'plugin-opts': node.pluginOpts || undefined
        });
    }
    if (node.type === 'ssr') {
        return cleanObject({
            ...base,
            cipher: node.cipher,
            password: node.password,
            protocol: node.protocol,
            'protocol-param': node.protocolParam || undefined,
            obfs: node.obfs,
            'obfs-param': node.obfsParam || undefined
        });
    }
    if (node.type === 'vmess') {
        return cleanObject({
            ...base,
            uuid: node.uuid,
            alterId: node.alterId || 0,
            cipher: node.cipher || 'auto',
            ...transportFields(node),
            ...tlsFields(node, 'servername')
        });
    }
    if (node.type === 'vless') {
        return cleanObject({
            ...base,
            uuid: node.uuid,
            encryption: node.encryption && node.encryption !== 'none' ? node.encryption : undefined,
            ...transportFields(node),
            ...tlsFields(node, 'servername')
        });
    }
    if (node.type === 'trojan') {
        return cleanObject({
            ...base,
            password: node.password,
            ...transportFields(node),
            ...tlsFields(node, 'sni')
        });
    }
    if (node.type === 'hysteria2') {
        return cleanObject({
            ...base,
            password: node.password,
            sni: node.sni || undefined,
            'skip-cert-verify': node.skipCertVerify || undefined,
            alpn: node.alpn?.length ? node.alpn : ['h3'],
            obfs: node.obfs || undefined,
            'obfs-password': node.obfsPassword || undefined,
            ports: node.ports || undefined
        });
    }
    if (node.type === 'hysteria') {
        return cleanObject({
            ...base,
            'auth-str': node.auth || node.password,
            protocol: node.protocol || 'udp',
            up: node.up || undefined,
            down: node.down || undefined,
            obfs: node.obfs || undefined,
            sni: node.sni || undefined,
            'skip-cert-verify': node.skipCertVerify || undefined,
            alpn: node.alpn?.length ? node.alpn : undefined
        });
    }
    if (node.type === 'tuic') {
        return cleanObject({
            ...base,
            uuid: node.uuid || undefined,
            password: node.uuid ? (node.password ?? '') : undefined,
            token: node.token || undefined,
            sni: node.sni || undefined,
            'skip-cert-verify': node.skipCertVerify || undefined,
            alpn: node.alpn?.length ? node.alpn : ['h3'],
            'congestion-controller': node.congestion || undefined,
            'udp-relay-mode': node.udpRelayMode || 'native'
        });
    }
    if (node.type === 'anytls') {
        return cleanObject({
            ...base,
            password: node.password,
            sni: node.sni || undefined,
            'client-fingerprint': node.fingerprint || 'chrome',
            'skip-cert-verify': node.skipCertVerify || undefined,
            alpn: node.alpn?.length ? node.alpn : ['h2', 'http/1.1'],
            udp: true
        });
    }
    throw new Error(`无法输出 Clash 代理 ${node.type}`);
}
