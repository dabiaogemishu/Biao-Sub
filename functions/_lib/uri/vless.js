import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';
import { applyShareParams, writeShareParams } from './share.js';

export function parseVless(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('vless://')) throw new Error('不是 vless 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('VLESS 链接格式无效');
    const uuid = decodeURIComponent(url.username || '');
    if (!uuid) throw new Error('VLESS 缺少 UUID');
    const node = createNode({
        type: 'vless',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        uuid,
        encryption: 'none',
        network: 'tcp'
    });
    applyShareParams(node, url.searchParams);
    if (!node.encryption) node.encryption = 'none';
    return node;
}

export function generateVless(node) {
    if (!node.uuid) throw new Error('VLESS 缺少 UUID');
    const params = new URLSearchParams();
    params.set('encryption', node.encryption || 'none');
    writeShareParams(params, node);
    return `vless://${encodeURIComponent(node.uuid)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}
