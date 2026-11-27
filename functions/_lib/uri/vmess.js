import { decodeBase64, encodeBase64, decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';
import { applyShareParams, writeShareParams } from './share.js';

function applyNet(node, config) {
    const net = String(config.net || 'tcp').toLowerCase();
    const host = config.host || '';
    const path = config.path || '';
    if (net === 'ws') {
        node.network = 'ws';
        node.ws = { path: path || '/', host };
    } else if (net === 'grpc') {
        node.network = 'grpc';
        node.grpc = { serviceName: config.path || config.serviceName || '', mode: 'gun' };
    } else if (net === 'httpupgrade') {
        node.network = 'httpupgrade';
        node.httpupgrade = { path: path || '/', host };
    } else if (net === 'xhttp' || net === 'splithttp') {
        node.network = 'xhttp';
        node.xhttp = { path: path || '/', host, mode: config.type && config.type !== 'none' ? config.type : 'auto', extra: null };
    } else if (net === 'h2') {
        node.network = 'h2';
        node.http = { path: path || '/', host };
    } else if (net === 'http') {
        node.network = 'http';
        node.http = { path: path || '/', host, method: 'GET' };
    } else if (net === 'kcp' || net === 'mkcp') {
        node.network = 'kcp';
        node.kcp = { headerType: config.type && config.type !== 'none' ? config.type : 'none', seed: path || config.seed || '' };
    } else if (net === 'hysteria') {
        node.network = 'hysteria';
    } else {
        node.network = 'tcp';
    }
    const tlsOn = config.tls === 'tls' || config.tls === true || config.tls === 'true';
    if (tlsOn) {
        node.tls = true;
        node.security = 'tls';
    }
    node.sni = config.sni || (tlsOn ? (config.sni || host) : '') || '';
    if (config.fp) node.fingerprint = config.fp;
    if (config.alpn) node.alpn = String(config.alpn).split(',').map(s => s.trim()).filter(Boolean);
    if (config.insecure === '1' || config.insecure === 1 || config.insecure === true) node.skipCertVerify = true;
}

function parseJson(body, nameHint) {
    let config;
    try { config = JSON.parse(decodeBase64(body)); } catch { throw new Error('VMess JSON 无法解码'); }
    if (!config || typeof config !== 'object' || !config.add || !config.id) throw new Error('VMess 缺少地址或 UUID');
    const node = createNode({
        type: 'vmess',
        name: config.ps || nameHint || '',
        server: config.add,
        port: Number(config.port) || 443,
        uuid: config.id,
        alterId: Number(config.aid || 0),
        cipher: config.scy || 'auto',
        network: 'tcp'
    });
    applyNet(node, config);
    return node;
}

export function parseVmess(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('vmess://')) throw new Error('不是 vmess 链接');
    const hashAt = raw.indexOf('#');
    const nameHint = hashAt >= 0 ? decodeHash(raw.slice(hashAt + 1)) : '';
    const body = (hashAt >= 0 ? raw.slice(8, hashAt) : raw.slice(8)).trim();
    if (body.includes('@') && !body.trim().startsWith('{') && !looksLikeBase64Json(body)) {
        const url = shareUrl(raw);
        if (!url) throw new Error('VMess 链接格式无效');
        const uuid = decodeURIComponent(url.username || '');
        if (!uuid) throw new Error('VMess 缺少 UUID');
        const node = createNode({
            type: 'vmess',
            name: nameHint,
            server: url.hostname,
            port: url.port ? Number(url.port) : 443,
            uuid,
            alterId: Number(url.searchParams.get('aid') || url.searchParams.get('alterId') || 0),
            cipher: url.searchParams.get('encryption') || url.searchParams.get('scy') || 'auto'
        });
        applyShareParams(node, url.searchParams);
        return node;
    }
    return parseJson(body, nameHint);
}

function looksLikeBase64Json(body) {
    if (body.includes('?')) return false;
    try {
        const text = decodeBase64(body);
        return text.trim().startsWith('{');
    } catch { return false; }
}

function vmessNet(node) {
    if (node.network === 'httpupgrade') return 'httpupgrade';
    if (node.network === 'xhttp') return 'xhttp';
    if (node.network === 'kcp') return 'kcp';
    if (node.network === 'hysteria') return 'hysteria';
    return node.network || 'tcp';
}

function vmessHost(node) {
    if (node.network === 'ws') return node.ws?.host || node.sni || '';
    if (node.network === 'httpupgrade') return node.httpupgrade?.host || node.sni || '';
    if (node.network === 'grpc') return node.sni || '';
    if (node.network === 'h2' || node.network === 'http') return node.http?.host || node.sni || '';
    if (node.network === 'xhttp') return node.xhttp?.host || node.sni || '';
    return node.sni || '';
}

function vmessPath(node) {
    if (node.network === 'ws') return node.ws?.path || '/';
    if (node.network === 'httpupgrade') return node.httpupgrade?.path || '/';
    if (node.network === 'grpc') return node.grpc?.serviceName || '';
    if (node.network === 'h2' || node.network === 'http') return node.http?.path || '/';
    if (node.network === 'xhttp') return node.xhttp?.path || '/';
    if (node.network === 'kcp') return node.kcp?.seed || '';
    return '';
}

export function generateVmess(node) {
    if (!node.uuid) throw new Error('VMess 缺少 UUID');
    if (node.security === 'reality') {
        const params = new URLSearchParams();
        params.set('encryption', node.cipher || 'auto');
        writeShareParams(params, node);
        return `vmess://${encodeURIComponent(node.uuid)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
    }
    const payload = {
        v: '2',
        ps: node.name,
        add: node.server,
        port: String(node.port),
        id: node.uuid,
        aid: String(node.alterId || 0),
        scy: node.cipher || 'auto',
        net: vmessNet(node),
        type: node.network === 'xhttp'
            ? (node.xhttp?.mode || 'auto')
            : node.network === 'kcp'
                ? (node.kcp?.headerType || 'none')
                : 'none',
        host: vmessHost(node),
        path: vmessPath(node),
        tls: node.tls ? 'tls' : '',
        sni: node.sni || '',
        fp: node.fingerprint || '',
        alpn: (node.alpn || []).join(','),
        insecure: node.skipCertVerify ? '1' : '0'
    };
    return `vmess://${encodeBase64(JSON.stringify(payload))}`;
}
