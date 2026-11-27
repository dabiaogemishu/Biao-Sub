import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';

function queryValue(params, names) {
    for (const name of names) {
        const value = params.get(name);
        if (value) return value;
    }
    return '';
}

export function parseWireguard(uri) {
    const raw = uri.trim();
    const lower = raw.toLowerCase();
    if (!lower.startsWith('wireguard://') && !lower.startsWith('wg://')) throw new Error('不是 WireGuard 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('WireGuard 链接格式无效');
    const privateKey = decodeURIComponent(url.username || '');
    if (!privateKey) throw new Error('WireGuard 缺少私钥');
    const publicKey = queryValue(url.searchParams, ['publickey', 'publicKey', 'peer', 'peerpublickey']);
    if (!publicKey) throw new Error('WireGuard 缺少公钥');
    const port = url.port ? Number(url.port) : 51820;
    return createNode({
        type: 'wireguard',
        name: decodeHash(url.hash),
        server: url.hostname,
        port,
        privateKey,
        publicKey,
        presharedKey: queryValue(url.searchParams, ['presharedkey', 'psk', 'preSharedKey']),
        address: queryValue(url.searchParams, ['address', 'ip']) || '10.0.0.2/32',
        mtu: Number(url.searchParams.get('mtu') || 0),
        reserved: queryValue(url.searchParams, ['reserved']),
        udp: true,
        network: 'udp'
    });
}

export function generateWireguard(node) {
    if (!node.privateKey) throw new Error('WireGuard 缺少私钥');
    if (!node.publicKey) throw new Error('WireGuard 缺少公钥');
    const params = new URLSearchParams();
    params.set('publickey', node.publicKey);
    if (node.address) params.set('address', node.address);
    if (node.presharedKey) params.set('presharedkey', node.presharedKey);
    if (node.mtu) params.set('mtu', String(node.mtu));
    if (node.reserved) params.set('reserved', node.reserved);
    return `wireguard://${encodeURIComponent(node.privateKey)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}
