import { decodeBase64, encodeBase64, encodeName } from '../core/codec.js';
import { createNode } from '../core/model.js';

function b64(value) {
    return encodeBase64(value || '').replace(/=+$/, '');
}

export function parseSsr(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('ssr://')) throw new Error('不是 ssr 链接');
    let body = raw.slice(6);
    const hash = body.indexOf('#');
    if (hash >= 0) body = body.slice(0, hash);
    let decoded;
    try { decoded = decodeBase64(body); } catch { throw new Error('SSR 链接 Base64 无法解码'); }
    const slash = decoded.indexOf('/?');
    const main = slash >= 0 ? decoded.slice(0, slash) : decoded;
    const query = slash >= 0 ? decoded.slice(slash + 2) : '';
    const parts = main.split(':');
    if (parts.length < 6) throw new Error('SSR 字段不足');
    const server = parts[0];
    const port = Number(parts[1]);
    const protocol = parts[2];
    const cipher = parts[3];
    const obfs = parts[4];
    let password = '';
    try { password = decodeBase64(parts.slice(5).join(':')); } catch { throw new Error('SSR 密码无法解码'); }
    const params = new URLSearchParams(query);
    const remarks = params.get('remarks');
    const obfsParam = params.get('obfsparam');
    const protoParam = params.get('protoparam');
    let name = '';
    if (remarks) {
        try { name = decodeBase64(remarks); } catch { throw new Error('SSR 备注无法解码'); }
    }
    return createNode({
        type: 'ssr',
        name,
        server,
        port,
        cipher,
        password,
        protocol,
        obfs,
        obfsParam: obfsParam ? decodeBase64(obfsParam) : '',
        protocolParam: protoParam ? decodeBase64(protoParam) : ''
    });
}

export function generateSsr(node) {
    if (!node.cipher || !node.protocol || !node.obfs) throw new Error('SSR 缺少加密、协议或混淆');
    const main = [
        node.server,
        node.port,
        node.protocol,
        node.cipher,
        node.obfs,
        b64(node.password ?? '')
    ].join(':');
    const params = new URLSearchParams();
    params.set('remarks', b64(node.name || ''));
    if (node.obfsParam) params.set('obfsparam', b64(node.obfsParam));
    if (node.protocolParam) params.set('protoparam', b64(node.protocolParam));
    return `ssr://${b64(`${main}/?${params.toString()}`)}#${encodeName(node.name)}`;
}
