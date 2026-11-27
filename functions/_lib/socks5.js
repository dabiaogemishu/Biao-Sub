const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_BODY = 8 * 1024 * 1024;
const CRLF = [13, 10];
const HEADER_END = [13, 10, 13, 10];

const REP_TEXT = {
    0x01: '常规失败',
    0x02: '规则不允许连接',
    0x03: '网络不可达',
    0x04: '主机不可达',
    0x05: '连接被拒绝',
    0x06: 'TTL 超时',
    0x07: '不支持该命令',
    0x08: '不支持该地址类型'
};

function concat(parts) {
    const list = parts.filter(part => part && part.length);
    const out = new Uint8Array(list.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of list) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function findSequence(haystack, needle, from = 0) {
    if (!needle.length || haystack.length < needle.length) return -1;
    outer: for (let i = from; i <= haystack.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
}

export function isIPv4(host) {
    const parts = String(host).split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255 && String(Number(part)) === part);
}

export function isIPv6(host) {
    return String(host).includes(':');
}

export function ipv6ToBytes(host) {
    const zone = String(host).split('%')[0];
    const halves = zone.split('::');
    if (halves.length > 2) throw new Error('目标 IPv6 地址无效');
    const parseSide = (part) => {
        if (!part) return [];
        return part.split(':').map(piece => {
            if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) throw new Error('目标 IPv6 地址无效');
            return Number.parseInt(piece, 16);
        });
    };
    const head = parseSide(halves[0]);
    const tail = halves.length === 2 ? parseSide(halves[1]) : [];
    if (halves.length === 1 && head.length !== 8) throw new Error('目标 IPv6 地址无效');
    const missing = 8 - head.length - tail.length;
    if (missing < 0) throw new Error('目标 IPv6 地址无效');
    const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill(0), ...tail];
    const out = new Uint8Array(16);
    groups.forEach((group, index) => {
        out[index * 2] = (group >> 8) & 0xff;
        out[index * 2 + 1] = group & 0xff;
    });
    return out;
}

export function buildGreeting(proxy) {
    return proxy.username ? Uint8Array.of(0x05, 0x01, 0x02) : Uint8Array.of(0x05, 0x01, 0x00);
}

export function buildAuth(username, password) {
    const user = encoder.encode(username);
    const pass = encoder.encode(password || '');
    if (user.length < 1 || user.length > 255) throw new Error('SOCKS5 用户名长度无效');
    if (pass.length > 255) throw new Error('SOCKS5 密码长度无效');
    return concat([Uint8Array.of(0x01, user.length), user, Uint8Array.of(pass.length), pass]);
}

export function buildConnectRequest(host, port) {
    const portBytes = Uint8Array.of((port >> 8) & 0xff, port & 0xff);
    if (isIPv4(host)) {
        const parts = host.split('.').map(part => Number(part));
        return concat([Uint8Array.of(0x05, 0x01, 0x00, 0x01), Uint8Array.from(parts), portBytes]);
    }
    if (isIPv6(host)) {
        return concat([Uint8Array.of(0x05, 0x01, 0x00, 0x04), ipv6ToBytes(host), portBytes]);
    }
    const name = encoder.encode(host);
    if (name.length < 1 || name.length > 255) throw new Error('目标主机名过长');
    return concat([Uint8Array.of(0x05, 0x01, 0x00, 0x03, name.length), name, portBytes]);
}

export function buildHttpRequest(target, ua) {
    const path = `${target.pathname || '/'}${target.search}`;
    const lines = [
        `GET ${path} HTTP/1.1`,
        `Host: ${target.host}`,
        `User-Agent: ${ua || 'clash-verge/v1.7.7'}`,
        'Accept: */*',
        'Connection: close',
        '',
        ''
    ];
    return encoder.encode(lines.join('\r\n'));
}

class BytePipe {
    constructor(socket) {
        this.socket = socket;
        this.reader = socket.readable.getReader();
        this.writer = socket.writable.getWriter();
        this.extra = new Uint8Array(0);
    }

    async write(bytes) {
        await this.writer.write(bytes);
    }

    async read() {
        if (this.extra.length) {
            const value = this.extra;
            this.extra = new Uint8Array(0);
            return { done: false, value };
        }
        return this.reader.read();
    }

    async readExactly(size) {
        const parts = [];
        let got = 0;
        while (got < size) {
            const { done, value } = await this.read();
            if (done || !value?.length) throw new Error('SOCKS5 连接被提前关闭');
            parts.push(value);
            got += value.length;
        }
        const all = concat(parts);
        this.extra = all.slice(size);
        return all.slice(0, size);
    }

    releaseWriter() {
        this.writer.releaseLock();
    }
}

function explainConnectError(error) {
    const text = String(error?.message || error || '');
    if (/cannot connect to the specified address/i.test(text)) {
        return '无法连接 SOCKS5 节点。Cloudflare 不能连接内网、本机或 Cloudflare 自己的地址，请换一个公网落地节点。';
    }
    return `无法连接 SOCKS5 节点：${text || '连接失败'}`;
}

async function discardBindAddress(pipe, atyp) {
    if (atyp === 0x01) {
        await pipe.readExactly(6);
        return;
    }
    if (atyp === 0x04) {
        await pipe.readExactly(18);
        return;
    }
    if (atyp === 0x03) {
        const len = (await pipe.readExactly(1))[0];
        await pipe.readExactly(len + 2);
        return;
    }
    throw new Error('SOCKS5 连接目标失败：无法识别绑定地址');
}

async function handshake(pipe, proxy, host, port) {
    await pipe.write(buildGreeting(proxy));
    const chosen = await pipe.readExactly(2);
    if (chosen[0] !== 0x05) throw new Error('SOCKS5 握手失败：服务器不是 SOCKS5');
    if (chosen[1] === 0xff) throw new Error('SOCKS5 握手失败：服务器不接受无认证或用户名密码');
    if (chosen[1] === 0x02) {
        if (!proxy.username) throw new Error('SOCKS5 服务器要求用户名密码，但没有配置');
        await pipe.write(buildAuth(proxy.username, proxy.password || ''));
        const auth = await pipe.readExactly(2);
        if (auth[0] !== 0x01 || auth[1] !== 0x00) throw new Error('SOCKS5 认证失败，请检查用户名和密码');
    } else if (chosen[1] !== 0x00) {
        throw new Error('SOCKS5 握手失败：不支持该认证方式');
    }
    await pipe.write(buildConnectRequest(host, port));
    const head = await pipe.readExactly(4);
    if (head[0] !== 0x05) throw new Error('SOCKS5 连接目标失败：服务器不是 SOCKS5');
    if (head[1] !== 0x00) throw new Error(`SOCKS5 连接目标失败：${REP_TEXT[head[1]] || '未知错误'}`);
    await discardBindAddress(pipe, head[3]);
}

function decodeChunked(body) {
    const parts = [];
    let offset = 0;
    while (offset <= body.length) {
        const lineEnd = findSequence(body, CRLF, offset);
        if (lineEnd < 0) return { complete: false };
        const line = decoder.decode(body.slice(offset, lineEnd)).trim();
        const size = Number.parseInt(line.split(';')[0], 16);
        if (!Number.isFinite(size) || size < 0) throw new Error('通过代理获取订阅失败：分块编码无效');
        const dataStart = lineEnd + 2;
        if (size === 0) {
            if (findSequence(body, CRLF, dataStart) < 0) return { complete: false };
            return { complete: true, data: concat(parts) };
        }
        if (body.length < dataStart + size + 2) return { complete: false };
        parts.push(body.slice(dataStart, dataStart + size));
        offset = dataStart + size + 2;
    }
    return { complete: false };
}

function headerMap(lines) {
    const headers = {};
    for (const line of lines) {
        const index = line.indexOf(':');
        if (index <= 0) continue;
        const key = line.slice(0, index).trim().toLowerCase();
        const value = line.slice(index + 1).trim();
        headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
    }
    return headers;
}

function tryParseHttp(bytes, ended) {
    const split = findSequence(bytes, HEADER_END);
    if (split < 0) return null;
    const headerText = decoder.decode(bytes.slice(0, split));
    const lines = headerText.split('\r\n');
    const status = Number(lines[0]?.split(' ')[1]);
    if (!Number.isInteger(status)) throw new Error('通过代理获取订阅失败：无法识别 HTTP 响应');
    const headers = headerMap(lines.slice(1));
    const rawBody = bytes.slice(split + 4);
    const chunked = (headers['transfer-encoding'] || '').toLowerCase().includes('chunked');
    if (chunked) {
        const decoded = decodeChunked(rawBody);
        if (!decoded.complete) return null;
        return { status, headers, body: decoded.data };
    }
    if (headers['content-length'] != null) {
        const length = Number(headers['content-length']);
        if (!Number.isInteger(length) || length < 0) throw new Error('通过代理获取订阅失败：Content-Length 无效');
        if (rawBody.length < length) return null;
        return { status, headers, body: rawBody.slice(0, length) };
    }
    if (!ended) return null;
    return { status, headers, body: rawBody };
}

async function readHttpMessage(pipe) {
    const chunks = [];
    let total = 0;
    while (total <= MAX_BODY) {
        const { done, value } = await pipe.read();
        if (value?.length) {
            total += value.length;
            if (total > MAX_BODY) throw new Error('通过代理获取订阅失败：响应过大');
            chunks.push(value);
        }
        const parsed = tryParseHttp(concat(chunks), done);
        if (parsed) return parsed;
        if (done) throw new Error('通过代理获取订阅失败：响应不完整');
    }
    throw new Error('通过代理获取订阅失败：响应过大');
}

async function inflate(body, encoding) {
    const kind = String(encoding || '').toLowerCase();
    if (!kind || kind === 'identity') return body;
    const format = kind.includes('gzip') ? 'gzip' : kind.includes('deflate') ? 'deflate' : '';
    if (!format || typeof DecompressionStream === 'undefined') {
        throw new Error('通过代理获取订阅失败：无法解压响应');
    }
    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function handoff(pipe) {
    let prefix = pipe.extra;
    pipe.extra = new Uint8Array(0);
    const reader = pipe.reader;
    pipe.releaseWriter();
    return {
        readable: new ReadableStream({
            async pull(controller) {
                if (prefix.length) {
                    controller.enqueue(prefix);
                    prefix = new Uint8Array(0);
                    return;
                }
                const { done, value } = await reader.read();
                if (done) controller.close();
                else controller.enqueue(value);
            }
        }),
        writable: pipe.socket.writable,
        close: () => pipe.socket.close?.()
    };
}

async function defaultConnect(address, options) {
    let connect;
    try {
        ({ connect } = await import('cloudflare:sockets'));
    } catch {
        throw new Error('当前环境不支持出站 TCP，无法使用 SOCKS5 代理');
    }
    return connect(address, options);
}

// 生产环境的 socket.startTls() 不会按订阅域名发送 SNI，隧道里的 HTTPS 会校验失败。
// 到落地节点只走明文 TCP；订阅的 HTTPS 在隧道内用用户态 TLS 完成。
export async function defaultUpgradeTls(transport, hostname) {
    const { connectTls } = await import('tunnelfetch/tls');
    const { verifyChain } = await import('tunnelfetch/trust');
    return connectTls({
        transport,
        hostname,
        verifyPeer: (chain, host, details) => verifyChain({
            chain,
            hostname: host,
            ocspResponse: details?.ocspResponse ?? null
        }),
        options: { alpn: ['http/1.1'] }
    });
}

async function openSocket(connect, proxy) {
    let socket;
    try {
        socket = await connect(
            { hostname: proxy.host, port: Number(proxy.port) },
            { secureTransport: 'off', allowHalfOpen: true }
        );
        if (socket?.opened) await socket.opened;
    } catch (error) {
        throw new Error(explainConnectError(error));
    }
    return socket;
}

async function closeQuietly(socket) {
    try { await socket?.close?.(); } catch { /* 已经关掉 */ }
}

async function requestOnce(target, ua, proxy, deps, arm) {
    const socket = await openSocket(deps.connect, proxy);
    arm(socket);
    const pipe = new BytePipe(socket);
    const opened = [socket];
    try {
        await handshake(pipe, proxy, target.hostname, Number(target.port || (target.protocol === 'https:' ? 443 : 80)));
        let io = pipe;
        if (target.protocol === 'https:') {
            let tls;
            try {
                tls = await deps.upgradeTls(handoff(pipe), target.hostname);
            } catch (error) {
                throw new Error(`通过代理建立 HTTPS 失败：${error?.message || '握手失败'}`);
            }
            opened.push(tls);
            arm(tls);
            io = new BytePipe(tls);
        }
        await io.write(buildHttpRequest(target, ua));
        const message = await readHttpMessage(io);
        message.body = await inflate(message.body, message.headers['content-encoding']);
        return message;
    } finally {
        for (const item of opened) await closeQuietly(item);
    }
}

function parseSubInfo(headers) {
    const subInfo = {};
    const userinfo = headers['subscription-userinfo'];
    if (!userinfo) return subInfo;
    for (const part of userinfo.split(';')) {
        const [key, value] = part.split('=').map(item => item.trim());
        if (key && value) subInfo[key] = Number.isNaN(Number(value)) ? value : Number(value);
    }
    return subInfo;
}

export async function fetchViaProxy(url, ua, proxy, deps = {}) {
    let target;
    try { target = new URL(url); } catch { throw new Error('订阅链接格式不正确'); }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error('只支持通过代理获取 http 或 https 订阅');
    }
    const connect = deps.connect || defaultConnect;
    const upgradeTls = deps.upgradeTls || defaultUpgradeTls;
    const timeoutMs = deps.timeoutMs || 15000;
    let timedOut = false;
    let active = null;
    let timer;
    const arm = (socket) => { active = socket; };
    const attempt = (async () => {
        let current = target;
        for (let hop = 0; hop < 5; hop++) {
            const message = await requestOnce(current, ua, proxy, { connect, upgradeTls }, arm);
            if ([301, 302, 303, 307, 308].includes(message.status)) {
                if (!message.headers.location) throw new Error('通过代理获取订阅失败：重定向没有 Location');
                const next = new URL(message.headers.location, current);
                if (next.protocol !== 'http:' && next.protocol !== 'https:') {
                    throw new Error('通过代理获取订阅失败：重定向协议不受支持');
                }
                current = next;
                continue;
            }
            if (message.status === 401 || message.status === 403) {
                throw new Error(`远程服务器拒绝访问（${message.status}）。已通过 SOCKS5 代理访问，请检查订阅链接或代理是否可用。`);
            }
            if (message.status < 200 || message.status >= 300) {
                throw new Error(`通过代理获取订阅失败：远程订阅返回 HTTP ${message.status}`);
            }
            return { content: decoder.decode(message.body), subInfo: parseSubInfo(message.headers) };
        }
        throw new Error('通过代理获取订阅失败：重定向次数过多');
    })().catch(error => {
        if (timedOut) return new Promise(() => {});
        throw error;
    });
    try {
        return await Promise.race([
            attempt,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    timedOut = true;
                    active?.close?.();
                    reject(new Error('请求超时（15秒）'));
                }, timeoutMs);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}
