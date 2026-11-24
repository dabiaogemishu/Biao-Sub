import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';
import { applyShareParams, writeShareParams } from './share.js';

export function parseTrojan(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('trojan://')) throw new Error('不是 trojan 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('Trojan 链接格式无效');
    const password = decodeURIComponent(url.username || '');
    if (!password) throw new Error('Trojan 缺少密码');
    const node = createNode({
        type: 'trojan',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        password,
        tls: true,
        security: 'tls',
        network: 'tcp'
    });
    applyShareParams(node, url.searchParams);
    if (!url.searchParams.get('security') && !url.searchParams.get('pbk')) {
        node.tls = true;
        node.security = 'tls';
    }
    return node;
}

export function generateTrojan(node) {
    if (node.password === '') throw new Error('Trojan 缺少密码');
    const params = new URLSearchParams();
    writeShareParams(params, node);
    if (!params.get('security')) params.set('security', 'tls');
    return `trojan://${encodeURIComponent(node.password)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}
