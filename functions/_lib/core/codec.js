// 标准 Base64（RFC 4648）：字符集 A-Za-z0-9+/，按需保留 '=' 填充。
// 解码同时接受 URL-safe 和无填充，方便吃进机场订阅；编码绝不改成 URL-safe。

const CHUNK = 0x8000;

export function encodeBase64(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

export function decodeBase64(str) {
    if (str == null) return '';
    let clean = String(str).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!clean) return '';
    const pad = clean.length % 4;
    if (pad === 1) throw new Error('Base64 长度无效');
    if (pad) clean += '='.repeat(4 - pad);
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

export function tryDecodeBase64(str) {
    if (!str || typeof str !== 'string') return null;
    const compact = str.replace(/\s/g, '');
    if (compact.length < 16 || compact.length % 4 === 1) return null;
    if (/[^A-Za-z0-9+/=\-_]/i.test(compact)) return null;
    try {
        const text = decodeBase64(compact);
        if (!text || /[\x00-\x08]/.test(text)) return null;
        return text;
    } catch {
        return null;
    }
}

export function encodeBase64Url(input) {
    return encodeBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeHash(hash) {
    if (!hash) return '';
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    try { return decodeURIComponent(raw); } catch { return raw; }
}

export function encodeName(name) {
    return encodeURIComponent(name || '');
}

// 自行拆 userinfo、主机和端口。运行时的 URL 解析器会把 IPv6 端口丢掉，并在 hostname 里留下方括号。
export function shareUrl(uri) {
    const trimmed = String(uri || '').trim();
    const scheme = trimmed.match(/^[a-z0-9]+:\/\//i);
    if (!scheme) return null;
    let rest = trimmed.slice(scheme[0].length);
    let fragment = '';
    const hashAt = rest.indexOf('#');
    if (hashAt >= 0) {
        fragment = rest.slice(hashAt + 1);
        rest = rest.slice(0, hashAt);
    }
    let query = '';
    const queryAt = rest.indexOf('?');
    if (queryAt >= 0) {
        query = rest.slice(queryAt + 1);
        rest = rest.slice(0, queryAt);
    }
    let userinfo = '';
    const at = rest.lastIndexOf('@');
    if (at >= 0) {
        userinfo = rest.slice(0, at);
        rest = rest.slice(at + 1);
    }
    if (!rest) return null;
    let hostname = '';
    let port = '';
    let pathname = '';
    if (rest.startsWith('[')) {
        const end = rest.indexOf(']');
        if (end < 0) return null;
        hostname = rest.slice(1, end);
        const tail = rest.slice(end + 1);
        if (tail.startsWith(':')) {
            const portAndPath = tail.slice(1);
            const slash = portAndPath.indexOf('/');
            if (slash >= 0) {
                port = portAndPath.slice(0, slash);
                pathname = portAndPath.slice(slash);
            } else {
                port = portAndPath;
            }
        } else if (tail.startsWith('/')) {
            pathname = tail;
        } else if (tail) return null;
    } else {
        const slash = rest.indexOf('/');
        let hostport = rest;
        if (slash >= 0) {
            pathname = rest.slice(slash);
            hostport = rest.slice(0, slash);
        }
        const colon = hostport.lastIndexOf(':');
        if (colon > 0 && /^\d+$/.test(hostport.slice(colon + 1))) {
            hostname = hostport.slice(0, colon);
            port = hostport.slice(colon + 1);
        } else hostname = hostport;
    }
    if (!hostname) return null;
    if (port && !/^\d+$/.test(port)) return null;
    const colon = userinfo.indexOf(':');
    const username = colon >= 0 ? userinfo.slice(0, colon) : userinfo;
    const password = colon >= 0 ? userinfo.slice(colon + 1) : '';
    return {
        username,
        password,
        hostname,
        port,
        pathname,
        searchParams: new URLSearchParams(query),
        hash: fragment ? `#${fragment}` : ''
    };
}
