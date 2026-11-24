import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';

function readInsecure(params) {
    const value = params.get('insecure') || params.get('allowInsecure');
    return value === '1' || value === 'true';
}

export function parseHysteria2(uri) {
    const raw = uri.trim();
    const scheme = (raw.trim().match(/^([a-z0-9]+):/i) || [])[1]?.toLowerCase() || '';
    const url = shareUrl(raw);
    if (!url) throw new Error('Hysteria2 链接格式无效');
    if (!['hysteria2', 'hy2', 'hy'].includes(scheme)) throw new Error('不是 hysteria2 链接');
    const password = decodeURIComponent(url.username || '');
    if (!password) throw new Error('Hysteria2 缺少密码');
    const params = url.searchParams;
    return createNode({
        type: 'hysteria2',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        password,
        sni: params.get('sni') || params.get('peer') || '',
        skipCertVerify: readInsecure(params),
        obfs: params.get('obfs') || '',
        obfsPassword: params.get('obfs-password') || '',
        ports: params.get('mport') || params.get('ports') || '',
        alpn: (params.get('alpn') || 'h3').split(',').filter(Boolean),
        pinSha256: params.get('pinSHA256') || '',
        tls: true,
        security: 'tls'
    });
}

export function generateHysteria2(node) {
    if (node.password === '') throw new Error('Hysteria2 缺少密码');
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.skipCertVerify) params.set('insecure', '1');
    if (node.obfs) params.set('obfs', node.obfs);
    if (node.obfsPassword) params.set('obfs-password', node.obfsPassword);
    if (node.ports) params.set('mport', node.ports);
    if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
    if (node.pinSha256) params.set('pinSHA256', node.pinSha256);
    const qs = params.toString();
    return `hysteria2://${encodeURIComponent(node.password)}@${formatHost(node.server, node.port)}${qs ? `?${qs}` : ''}#${encodeName(node.name)}`;
}

export function parseHysteria(uri) {
    const raw = uri.trim();
    const scheme = (raw.trim().match(/^([a-z0-9]+):/i) || [])[1]?.toLowerCase() || '';
    if (scheme !== 'hysteria') throw new Error('不是 hysteria 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('Hysteria 链接格式无效');
    const params = url.searchParams;
    const auth = decodeURIComponent(url.username || '') || params.get('auth') || '';
    if (!auth) throw new Error('Hysteria 缺少 auth');
    return createNode({
        type: 'hysteria',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        auth,
        password: auth,
        sni: params.get('peer') || params.get('sni') || '',
        skipCertVerify: readInsecure(params),
        obfs: params.get('obfs') || '',
        obfsParam: params.get('obfsParam') || '',
        up: params.get('upmbps') || params.get('up') || '',
        down: params.get('downmbps') || params.get('down') || '',
        alpn: params.get('alpn') ? params.get('alpn').split(',') : [],
        protocol: params.get('protocol') || 'udp',
        tls: true,
        security: 'tls'
    });
}

export function generateHysteria(node) {
    const auth = node.auth || node.password;
    if (!auth) throw new Error('Hysteria 缺少 auth');
    const params = new URLSearchParams();
    if (node.sni) params.set('peer', node.sni);
    if (node.skipCertVerify) params.set('insecure', '1');
    if (node.up) params.set('upmbps', String(node.up));
    if (node.down) params.set('downmbps', String(node.down));
    if (node.obfs) params.set('obfs', node.obfs);
    if (node.obfsParam) params.set('obfsParam', node.obfsParam);
    if (node.protocol) params.set('protocol', node.protocol);
    if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
    return `hysteria://${encodeURIComponent(auth)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}
