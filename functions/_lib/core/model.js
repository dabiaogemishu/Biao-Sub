export function createNode(partial) {
    const port = Number(partial.port);
    let server = String(partial.server || '').trim();
    if (server.startsWith('[') && server.endsWith(']')) server = server.slice(1, -1);
    if (!server) throw new Error('服务器地址为空');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口无效');
    const type = partial.type;
    if (!type) throw new Error('缺少协议类型');
    const name = String(partial.name || '').trim() || `${type}-${server}:${port}`;
    return {
        name,
        type,
        server,
        port,
        udp: partial.udp !== false,
        uuid: partial.uuid == null ? '' : String(partial.uuid),
        password: partial.password == null ? '' : String(partial.password),
        cipher: partial.cipher == null ? '' : String(partial.cipher),
        alterId: partial.alterId ?? 0,
        network: partial.network || 'tcp',
        security: partial.security || (partial.tls ? 'tls' : 'none'),
        tls: partial.tls === true || partial.security === 'tls' || partial.security === 'reality',
        sni: partial.sni || '',
        alpn: Array.isArray(partial.alpn) ? partial.alpn.filter(Boolean) : [],
        fingerprint: partial.fingerprint || '',
        flow: partial.flow || '',
        skipCertVerify: partial.skipCertVerify === true,
        reality: partial.reality || null,
        ws: partial.ws || null,
        grpc: partial.grpc || null,
        http: partial.http || null,
        httpupgrade: partial.httpupgrade || null,
        xhttp: partial.xhttp || null,
        plugin: partial.plugin || '',
        pluginOpts: partial.pluginOpts || null,
        protocol: partial.protocol || '',
        protocolParam: partial.protocolParam || '',
        obfs: partial.obfs || '',
        obfsParam: partial.obfsParam || '',
        obfsPassword: partial.obfsPassword || '',
        ports: partial.ports || '',
        up: partial.up || '',
        down: partial.down || '',
        congestion: partial.congestion || '',
        udpRelayMode: partial.udpRelayMode || '',
        token: partial.token || '',
        encryption: partial.encryption || '',
        pinSha256: partial.pinSha256 || '',
        auth: partial.auth || ''
    };
}

export function formatHost(server, port) {
    let host = String(server || '');
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    if (host.includes(':')) host = `[${host}]`;
    return `${host}:${port}`;
}

export function parseHostPort(hostport, defaultPort) {
    const text = String(hostport || '').trim();
    if (!text) throw new Error('服务器地址为空');
    if (text.startsWith('[')) {
        const end = text.indexOf(']');
        if (end < 0) throw new Error('IPv6 地址缺少 ]');
        const server = text.slice(1, end);
        const rest = text.slice(end + 1);
        const port = rest.startsWith(':') ? Number(rest.slice(1)) : defaultPort;
        if (!server) throw new Error('服务器地址为空');
        if (!port) throw new Error('缺少端口');
        return { server, port: Number(port) };
    }
    const idx = text.lastIndexOf(':');
    if (idx < 0) {
        if (!defaultPort) throw new Error('缺少端口');
        return { server: text, port: Number(defaultPort) };
    }
    const port = Number(text.slice(idx + 1));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口无效');
    return { server: text.slice(0, idx), port };
}

export function cleanObject(value) {
    if (Array.isArray(value)) {
        const arr = value.map(cleanObject).filter(v => v !== undefined);
        return arr.length ? arr : undefined;
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined || item === null || item === '') continue;
            const next = cleanObject(item);
            if (next === undefined) continue;
            out[key] = next;
        }
        return Object.keys(out).length ? out : undefined;
    }
    return value;
}

export function summarizeErrors(errors) {
    if (!errors || errors.length === 0) return '未能识别任何节点';
    const lines = errors.slice(0, 8).map(e => e.message).filter(Boolean);
    const extra = errors.length > 8 ? `；另有 ${errors.length - 8} 条` : '';
    return lines.join('；') + extra;
}

export function parseJson(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}
