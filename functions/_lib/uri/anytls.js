import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';

export function parseAnytls(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('anytls://')) throw new Error('不是 anytls 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('AnyTLS 链接格式无效');
    const password = decodeURIComponent(url.username || '');
    if (!password) throw new Error('AnyTLS 缺少密码');
    const params = url.searchParams;
    const alpn = params.get('alpn');
    return createNode({
        type: 'anytls',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        password,
        sni: params.get('sni') || '',
        fingerprint: params.get('fp') || 'chrome',
        skipCertVerify: ['1', 'true'].includes(params.get('insecure') || params.get('allowInsecure') || ''),
        alpn: alpn ? alpn.split(',').filter(Boolean) : ['h2', 'http/1.1'],
        tls: true,
        security: 'tls',
        udp: true
    });
}

export function generateAnytls(node) {
    if (node.password === '') throw new Error('AnyTLS 缺少密码');
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.fingerprint) params.set('fp', node.fingerprint);
    if (node.skipCertVerify) params.set('insecure', '1');
    if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
    const qs = params.toString();
    return `anytls://${encodeURIComponent(node.password)}@${formatHost(node.server, node.port)}${qs ? `?${qs}` : ''}#${encodeName(node.name)}`;
}
