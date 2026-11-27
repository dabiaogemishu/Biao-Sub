import { decodeHash, encodeName, shareUrl } from '../core/codec.js';
import { createNode, formatHost } from '../core/model.js';

function userPass(url) {
    return {
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || '')
    };
}

function rejectPath(url, message) {
    if (String(url.hostname || '').includes('/')) throw new Error(message);
}

export function parseSocks(uri) {
    const raw = uri.trim();
    const lower = raw.toLowerCase();
    let version = '5';
    if (lower.startsWith('socks4a://') || lower.startsWith('socks4://')) version = '4';
    else if (!lower.startsWith('socks5://') && !lower.startsWith('socks://')) throw new Error('不是 SOCKS 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('SOCKS 链接格式无效');
    rejectPath(url, 'SOCKS 链接格式无效');
    const port = url.port ? Number(url.port) : 1080;
    const account = userPass(url);
    return createNode({
        type: 'socks',
        name: decodeHash(url.hash),
        server: url.hostname,
        port,
        username: account.username,
        password: account.password,
        version,
        udp: url.searchParams.get('udp') !== '0',
        network: 'tcp'
    });
}

export function generateSocks(node) {
    const version = String(node.version || '5');
    const scheme = version === '4' ? 'socks4' : 'socks5';
    const auth = node.username
        ? `${encodeURIComponent(node.username)}${node.password ? `:${encodeURIComponent(node.password)}` : ''}@`
        : '';
    return `${scheme}://${auth}${formatHost(node.server, node.port)}#${encodeName(node.name)}`;
}

export function parseHttpProxy(uri) {
    const raw = uri.trim();
    const lower = raw.toLowerCase();
    const tls = lower.startsWith('https://');
    if (!tls && !lower.startsWith('http://')) throw new Error('不是 HTTP 代理链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('HTTP 代理链接格式无效');
    if (String(url.hostname).includes('/')) {
        throw new Error('这不是 HTTP 代理节点。带路径的地址请当作订阅链接，用远程导入');
    }
    const account = userPass(url);
    if (!url.port && !account.username) throw new Error('HTTP 代理需要端口或账号');
    const port = url.port ? Number(url.port) : (tls ? 443 : 80);
    return createNode({
        type: 'http',
        name: decodeHash(url.hash),
        server: url.hostname,
        port,
        username: account.username,
        password: account.password,
        tls,
        security: tls ? 'tls' : 'none',
        sni: url.searchParams.get('sni') || '',
        skipCertVerify: url.searchParams.get('insecure') === '1' || url.searchParams.get('allowInsecure') === '1',
        network: 'tcp'
    });
}

export function generateHttpProxy(node) {
    const scheme = node.tls || node.security === 'tls' ? 'https' : 'http';
    const auth = node.username
        ? `${encodeURIComponent(node.username)}${node.password ? `:${encodeURIComponent(node.password)}` : ''}@`
        : '';
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.skipCertVerify) params.set('allowInsecure', '1');
    const query = params.toString();
    return `${scheme}://${auth}${formatHost(node.server, node.port)}${query ? `?${query}` : ''}#${encodeName(node.name)}`;
}

export function parseSsh(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('ssh://')) throw new Error('不是 SSH 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('SSH 链接格式无效');
    const account = userPass(url);
    if (!account.username) throw new Error('SSH 缺少用户名');
    const privateKey = url.searchParams.get('private-key') || url.searchParams.get('privateKey') || '';
    if (!account.password && !privateKey) throw new Error('SSH 缺少密码或私钥');
    return createNode({
        type: 'ssh',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 22,
        username: account.username,
        password: account.password,
        privateKey,
        hostKey: url.searchParams.get('host-key') || url.searchParams.get('hostKey') || '',
        network: 'tcp'
    });
}

export function generateSsh(node) {
    if (!node.username) throw new Error('SSH 缺少用户名');
    const params = new URLSearchParams();
    if (node.privateKey) params.set('private-key', node.privateKey);
    if (node.hostKey) params.set('host-key', node.hostKey);
    const auth = `${encodeURIComponent(node.username)}${node.password ? `:${encodeURIComponent(node.password)}` : ''}@`;
    const query = params.toString();
    return `ssh://${auth}${formatHost(node.server, node.port || 22)}${query ? `?${query}` : ''}#${encodeName(node.name)}`;
}

export function parseSnell(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('snell://')) throw new Error('不是 Snell 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('Snell 链接格式无效');
    const psk = decodeURIComponent(url.username || '');
    if (!psk) throw new Error('Snell 缺少 psk');
    const version = url.searchParams.get('version') || '4';
    if (version !== '4' && version !== '6') throw new Error('Snell 只支持 version 4 或 6');
    return createNode({
        type: 'snell',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        password: psk,
        version,
        obfs: url.searchParams.get('obfs') || '',
        obfsParam: url.searchParams.get('obfs-host') || url.searchParams.get('host') || '',
        protocol: url.searchParams.get('mode') || '',
        network: 'tcp'
    });
}

export function generateSnell(node) {
    if (!node.password) throw new Error('Snell 缺少 psk');
    const params = new URLSearchParams();
    params.set('version', node.version || '4');
    if (node.obfs) params.set('obfs', node.obfs);
    if (node.obfsParam) params.set('obfs-host', node.obfsParam);
    if (node.protocol) params.set('mode', node.protocol);
    return `snell://${encodeURIComponent(node.password)}@${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}

export function parseShadowtls(uri) {
    const raw = uri.trim();
    if (!raw.toLowerCase().startsWith('shadowtls://')) throw new Error('不是 ShadowTLS 链接');
    const url = shareUrl(raw);
    if (!url) throw new Error('ShadowTLS 链接格式无效');
    const password = decodeURIComponent(url.password || url.username || '');
    const version = url.searchParams.get('version') || (password ? '3' : '1');
    if ((version === '2' || version === '3') && !password) throw new Error('ShadowTLS v2/v3 缺少密码');
    return createNode({
        type: 'shadowtls',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        password,
        version,
        sni: url.searchParams.get('sni') || url.hostname,
        fingerprint: url.searchParams.get('fp') || '',
        tls: true,
        security: 'tls',
        network: 'tcp'
    });
}

export function generateShadowtls(node) {
    const params = new URLSearchParams();
    params.set('version', node.version || '3');
    if (node.sni) params.set('sni', node.sni);
    if (node.fingerprint) params.set('fp', node.fingerprint);
    const password = node.password ? `${encodeURIComponent(node.password)}@` : '';
    return `shadowtls://${password}${formatHost(node.server, node.port)}?${params.toString()}#${encodeName(node.name)}`;
}

export function parseNaive(uri) {
    const raw = uri.trim();
    const lower = raw.toLowerCase();
    const quic = lower.startsWith('naive+quic://');
    if (!quic && !lower.startsWith('naive+https://')) throw new Error('不是 NaiveProxy 链接');
    const normalized = raw.replace(/^naive\+(https|quic):\/\//i, 'naive://');
    const url = shareUrl(normalized);
    if (!url) throw new Error('NaiveProxy 链接格式无效');
    const account = userPass(url);
    if (!account.username || !account.password) throw new Error('NaiveProxy 缺少用户名或密码');
    return createNode({
        type: 'naive',
        name: decodeHash(url.hash),
        server: url.hostname,
        port: url.port ? Number(url.port) : 443,
        username: account.username,
        password: account.password,
        network: quic ? 'quic' : 'https',
        sni: url.searchParams.get('sni') || '',
        tls: true,
        security: 'tls'
    });
}

export function generateNaive(node) {
    if (!node.username || !node.password) throw new Error('NaiveProxy 缺少用户名或密码');
    const scheme = node.network === 'quic' ? 'naive+quic' : 'naive+https';
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    const query = params.toString();
    const auth = `${encodeURIComponent(node.username)}:${encodeURIComponent(node.password)}@`;
    return `${scheme}://${auth}${formatHost(node.server, node.port)}${query ? `?${query}` : ''}#${encodeName(node.name)}`;
}
