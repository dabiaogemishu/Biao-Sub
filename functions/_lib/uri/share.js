import { decodeBase64, encodeBase64 } from '../core/codec.js';

function hostOf(headers) {
    if (!headers) return '';
    const value = headers.Host ?? headers.host ?? '';
    if (Array.isArray(value)) return String(value[0] || '');
    return String(value || '');
}

export function applyShareParams(node, params) {
    let net = (params.get('type') || params.get('network') || node.network || 'tcp').toLowerCase();
    if (net === 'splithttp') net = 'xhttp';
    node.network = net;

    const security = (params.get('security') || '').toLowerCase();
    if (security === 'reality' || params.get('pbk')) {
        node.security = 'reality';
        node.tls = true;
        node.reality = {
            publicKey: params.get('pbk') || node.reality?.publicKey || '',
            shortId: params.get('sid') || node.reality?.shortId || '',
            spiderX: params.get('spx') || node.reality?.spiderX || ''
        };
    } else if (security === 'tls') {
        node.security = 'tls';
        node.tls = true;
    } else if (security === 'none') {
        node.security = 'none';
        node.tls = false;
    }

    if (params.get('sni')) node.sni = params.get('sni');
    else if (params.get('peer') && !node.sni) node.sni = params.get('peer');
    if (params.get('fp')) node.fingerprint = params.get('fp');
    if (params.get('flow')) node.flow = params.get('flow');
    if (params.get('alpn')) node.alpn = params.get('alpn').split(',').map(s => s.trim()).filter(Boolean);
    if (params.get('encryption')) node.encryption = params.get('encryption');
    const insecure = params.get('insecure') || params.get('allowInsecure') || params.get('allow_insecure');
    if (insecure === '1' || insecure === 'true') node.skipCertVerify = true;

    const path = params.get('path') || '/';
    const host = params.get('host') || '';
    if (net === 'ws') node.ws = { path, host };
    else if (net === 'httpupgrade') node.httpupgrade = { path, host };
    else if (net === 'grpc') {
        node.grpc = {
            serviceName: params.get('serviceName') || params.get('service_name') || '',
            mode: params.get('mode') || 'gun'
        };
    } else if (net === 'xhttp') {
        let extra = null;
        const rawExtra = params.get('extra');
        if (rawExtra) {
            try {
                const text = rawExtra.trim().startsWith('{') ? rawExtra : decodeBase64(rawExtra);
                extra = JSON.parse(text);
            } catch {
                throw new Error('xhttp extra 不是合法 JSON');
            }
        }
        node.xhttp = {
            path,
            host,
            mode: params.get('mode') || extra?.mode || 'auto',
            extra: extra && typeof extra === 'object' ? stripXhttpKnown(extra) : null
        };
    } else if (net === 'h2' || net === 'http') {
        node.http = { path, host, method: params.get('method') || 'GET' };
    } else if (net === 'kcp' || net === 'mkcp') {
        node.network = 'kcp';
        node.kcp = {
            headerType: params.get('headerType') || params.get('header') || 'none',
            seed: params.get('seed') || ''
        };
    } else if (net === 'hysteria') {
        node.network = 'hysteria';
        const auth = params.get('auth') || params.get('password') || '';
        if (auth) node.auth = auth;
        const up = params.get('up') || params.get('upmbps') || '';
        const down = params.get('down') || params.get('downmbps') || '';
        if (up) node.up = up;
        if (down) node.down = down;
        const version = params.get('hysteriaVersion') || params.get('hyver') || '';
        if (version === '1' || version === '2') node.version = version;
    }
    return node;
}

function stripXhttpKnown(extra) {
    const clone = { ...extra };
    delete clone.path;
    delete clone.host;
    delete clone.mode;
    return Object.keys(clone).length ? clone : null;
}

export function writeShareParams(params, node) {
    const net = node.network || 'tcp';
    params.set('type', net);
    if (node.security === 'reality' || node.reality?.publicKey) {
        params.set('security', 'reality');
        if (node.reality?.publicKey) params.set('pbk', node.reality.publicKey);
        if (node.reality?.shortId) params.set('sid', node.reality.shortId);
        if (node.reality?.spiderX) params.set('spx', node.reality.spiderX);
    } else if (node.tls || node.security === 'tls') {
        params.set('security', 'tls');
    } else {
        params.set('security', 'none');
    }
    if (node.sni) params.set('sni', node.sni);
    if (node.fingerprint) params.set('fp', node.fingerprint);
    if (node.flow) params.set('flow', node.flow);
    if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
    if (node.skipCertVerify) params.set('allowInsecure', '1');

    if (net === 'ws' && node.ws) {
        if (node.ws.path) params.set('path', node.ws.path);
        if (node.ws.host) params.set('host', node.ws.host);
    } else if (net === 'httpupgrade' && node.httpupgrade) {
        if (node.httpupgrade.path) params.set('path', node.httpupgrade.path);
        if (node.httpupgrade.host) params.set('host', node.httpupgrade.host);
    } else if (net === 'grpc' && node.grpc) {
        if (node.grpc.serviceName) params.set('serviceName', node.grpc.serviceName);
        if (node.grpc.mode) params.set('mode', node.grpc.mode);
    } else if (net === 'xhttp' && node.xhttp) {
        if (node.xhttp.path) params.set('path', node.xhttp.path);
        if (node.xhttp.host) params.set('host', node.xhttp.host);
        if (node.xhttp.mode) params.set('mode', node.xhttp.mode);
        if (node.xhttp.extra && Object.keys(node.xhttp.extra).length) {
            params.set('extra', encodeBase64(JSON.stringify(node.xhttp.extra)).replace(/=+$/, ''));
        }
    } else if ((net === 'http' || net === 'h2') && node.http) {
        if (node.http.path) params.set('path', node.http.path);
        if (node.http.host) params.set('host', node.http.host);
    } else if (net === 'kcp') {
        if (node.kcp?.headerType) params.set('headerType', node.kcp.headerType);
        if (node.kcp?.seed) params.set('seed', node.kcp.seed);
    } else if (net === 'hysteria') {
        if (node.auth) params.set('auth', node.auth);
        if (node.up) params.set('up', node.up);
        if (node.down) params.set('down', node.down);
        if (node.version === '1' || node.version === '2') params.set('hysteriaVersion', node.version);
    }
}

export { hostOf };
