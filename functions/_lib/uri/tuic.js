import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';

export function parseTuic(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('tuic://')) throw new Error('不是 tuic 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('TUIC 链接格式无效');
    const params = url.searchParams;
    let uuid = '';
    let password = '';
    let token = '';
    if (url.password) {
        uuid = decodeURIComponent(url.username || '');
        password = decodeURIComponent(url.password);
    } else {
        const user = decodeURIComponent(url.username || '');
        const idx = user.indexOf(':');
        if (idx >= 0) {
            uuid = user.slice(0, idx);
            password = user.slice(idx + 1);
        } else if (user) {
            token = user;
        }
    }
    if (!uuid && !token) throw new Error('TUIC 缺少 UUID 或 token');
    const alpn = params.get('alpn');
    return createNode({
        type: 'tuic',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        uuid,
        password,
        token,
        sni: params.get('sni') || '',
        skipCertVerify: ['1', 'true'].includes(params.get('allow_insecure') || params.get('insecure') || ''),
        congestion: params.get('congestion_control') || '',
        udpRelayMode: params.get('udp_relay_mode') || 'native',
        alpn: alpn ? alpn.split(',').filter(Boolean) : ['h3'],
        tls: true,
        security: 'tls'
    });
}

export function generateTuic(node) {
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.skipCertVerify) params.set('allow_insecure', '1');
    if (node.congestion) params.set('congestion_control', node.congestion);
    if (node.udpRelayMode) params.set('udp_relay_mode', node.udpRelayMode);
    if (node.alpn?.length) params.set('alpn', node.alpn.join(','));
    const qs = params.toString();
    const user = node.uuid
        ? `${encodeURIComponent(node.uuid)}:${encodeURIComponent(node.password ?? '')}`
        : encodeURIComponent(node.token || '');
    if (!user) throw new Error('TUIC 缺少 UUID 或 token');
    return `tuic://${user}@${formatHost(node.server, node.port)}${qs ? `?${qs}` : ''}#${encodeName(node.name)}`;
}
