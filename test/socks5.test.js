import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { applyProxyUpdate, parseSocks5Uri, toPublicProxy } from '../functions/_lib/proxy-settings.js';
import { registerSettingsRoutes } from '../functions/_lib/routes/settings.js';
import { fetchSubscription } from '../functions/_lib/remote-service.js';
import { buildAuth, buildConnectRequest, buildGreeting, buildHttpRequest, fetchViaProxy, sanitizeUserAgent } from '../functions/_lib/socks5.js';
import { UNSUPPORTED_SUBSCRIPTION_URL } from '../functions/_lib/url-guard.js';

const SECRET = 'pw-test';

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

function findCrlfCrlf(bytes) {
    for (let i = 0; i <= bytes.length - 4; i++) {
        if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) return i;
    }
    return -1;
}

function mockSocksConnect(options = {}) {
    const events = { connects: [], requests: [], tlsHosts: [], options: [] };
    const responses = options.responses || ['HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello'];
    let responseIndex = 0;

    function createSocket(role) {
        let buffer = new Uint8Array(0);
        let phase = role === 'tls' ? 'http' : 'method';
        const queue = [];
        let waiter = null;
        let responseQueued = false;
        const wake = () => {
            if (!waiter) return;
            const current = waiter;
            waiter = null;
            current();
        };
        const push = (bytes) => {
            queue.push(bytes);
            wake();
        };
        const readable = new ReadableStream({
            async pull(controller) {
                while (queue.length === 0 && !responseQueued) await new Promise(resolve => { waiter = resolve; });
                if (queue.length === 0) {
                    controller.close();
                    return;
                }
                controller.enqueue(queue.shift());
            }
        });
        const writable = new WritableStream({
            write(chunk) {
                const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                buffer = concat([buffer, bytes]);
                if (phase === 'method') {
                    if (buffer.length < 2) return;
                    const need = 2 + buffer[1];
                    if (buffer.length < need) return;
                    const greeting = buffer.slice(0, need);
                    buffer = buffer.slice(need);
                    if (options.fail === 'method') {
                        push(Uint8Array.of(0x05, 0xff));
                        phase = 'dead';
                        return;
                    }
                    const method = greeting[2] === 0x02 ? 0x02 : 0x00;
                    push(Uint8Array.of(0x05, method));
                    phase = method === 0x02 ? 'auth' : 'connect';
                }
                if (phase === 'auth') {
                    if (buffer.length < 2) return;
                    const total = 2 + buffer[1] + 1 + buffer[2 + buffer[1]];
                    if (buffer.length < total) return;
                    buffer = buffer.slice(total);
                    push(Uint8Array.of(0x01, options.fail === 'auth' ? 0x01 : 0x00));
                    phase = options.fail === 'auth' ? 'dead' : 'connect';
                    if (phase === 'dead') return;
                }
                if (phase === 'connect') {
                    if (buffer.length < 4) return;
                    const atyp = buffer[3];
                    let total = 0;
                    if (atyp === 0x01) total = 10;
                    else if (atyp === 0x04) total = 22;
                    else if (atyp === 0x03) {
                        if (buffer.length < 5) return;
                        total = 7 + buffer[4];
                    } else return;
                    if (buffer.length < total) return;
                    events.connects.push(buffer.slice(0, total));
                    buffer = buffer.slice(total);
                    const rep = options.fail === 'connect' ? 0x05 : 0x00;
                    push(Uint8Array.of(0x05, rep, 0x00, 0x01, 0, 0, 0, 0, 0, 0));
                    phase = rep === 0x00 ? 'http' : 'dead';
                }
                if (phase === 'http') {
                    if (findCrlfCrlf(buffer) < 0) return;
                    events.requests.push({ role, text: new TextDecoder().decode(buffer) });
                    buffer = new Uint8Array(0);
                    const body = encoderBytes(responses[Math.min(responseIndex, responses.length - 1)]);
                    responseIndex += 1;
                    push(body);
                    responseQueued = true;
                    wake();
                }
            }
        });
        return {
            opened: Promise.resolve({}),
            readable,
            writable,
            async close() {
                responseQueued = true;
                wake();
            }
        };
    }

    function connect(address, socketOptions) {
        events.options.push({ address, socketOptions });
        return createSocket('raw');
    }
    async function upgradeTls(_transport, hostname) {
        events.tlsHosts.push(hostname);
        return createSocket('tls');
    }
    return { connect, upgradeTls, events };
}

function encoderBytes(text) {
    return new TextEncoder().encode(text);
}

const proxy = { enabled: true, host: 'landing.example', port: 1080, username: '', password: '' };

test('解析 socks5 URI：IPv4、主机名、默认端口、账号和 IPv6', () => {
    assert.deepEqual(parseSocks5Uri('socks5://1.2.3.4:1080'), {
        host: '1.2.3.4', port: 1080, username: '', password: ''
    });
    assert.deepEqual(parseSocks5Uri('socks5://example.com'), {
        host: 'example.com', port: 1080, username: '', password: ''
    });
    assert.deepEqual(parseSocks5Uri('socks5://user:pass@example.com:9050'), {
        host: 'example.com', port: 9050, username: 'user', password: 'pass'
    });
    assert.deepEqual(parseSocks5Uri('socks5://user@example.com:1080'), {
        host: 'example.com', port: 1080, username: 'user', password: ''
    });
    assert.deepEqual(parseSocks5Uri('socks5://us%65r:p%61ss@example.com'), {
        host: 'example.com', port: 1080, username: 'user', password: 'pass'
    });
    assert.deepEqual(parseSocks5Uri('socks5://[2001:db8::1]:1080'), {
        host: '2001:db8::1', port: 1080, username: '', password: ''
    });
    assert.equal(parseSocks5Uri('socks5h://example.com').port, 1080);
});

test('拒绝不是 socks5 的链接', () => {
    assert.throws(() => parseSocks5Uri('http://example.com:1080'), /只支持 socks5:\/\//);
    assert.throws(() => parseSocks5Uri('socks4://example.com:1080'), /只支持 socks5:\/\//);
    assert.throws(() => parseSocks5Uri(''), /请粘贴/);
    assert.throws(() => parseSocks5Uri('socks5://example.com:99999'), /格式不正确/);
    assert.throws(() => parseSocks5Uri('socks5://example.com/extra'), /只应包含/);
});

test('握手字节：无认证、用户名密码，以及 IPv4、域名、IPv6 的 CONNECT', () => {
    assert.deepEqual([...buildGreeting({ username: '' })], [0x05, 0x01, 0x00]);
    assert.deepEqual([...buildGreeting({ username: 'user' })], [0x05, 0x01, 0x02]);
    assert.deepEqual([...buildAuth('user', 'pass')], [0x01, 0x04, 0x75, 0x73, 0x65, 0x72, 0x04, 0x70, 0x61, 0x73, 0x73]);
    assert.deepEqual([...buildConnectRequest('1.2.3.4', 443).slice(0, 4)], [0x05, 0x01, 0x00, 0x01]);
    const domain = buildConnectRequest('example.com', 80);
    assert.equal(domain[3], 0x03);
    assert.equal(domain[4], 'example.com'.length);
    const v6 = buildConnectRequest('2001:db8::1', 1080);
    assert.equal(v6[3], 0x04);
    assert.equal(v6.length, 22);
});

test('无认证时通过代理发送 HTTP，并读回订阅流量', async () => {
    const transport = mockSocksConnect({
        responses: [
            'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nSubscription-Userinfo: upload=1; download=2; total=9; expire=0\r\n\r\n5\r\nhello\r\n0\r\n\r\n'
        ]
    });
    const result = await fetchViaProxy('http://airport.example/sub', 'ua-test', proxy, transport);
    assert.equal(result.content, 'hello');
    assert.deepEqual(result.subInfo, { upload: 1, download: 2, total: 9, expire: 0 });
    assert.equal(transport.events.tlsHosts.length, 0);
    assert.equal(transport.events.requests[0].role, 'raw');
    assert.match(transport.events.requests[0].text, /^GET \/sub HTTP\/1\.1/);
    assert.equal(transport.events.options[0].socketOptions.secureTransport, 'off');
    assert.deepEqual(transport.events.options[0].address, { hostname: 'landing.example', port: 1080 });
});

test('用户名密码握手后，HTTPS 请求写在升级后的通道上', async () => {
    const authed = { ...proxy, username: 'user', password: SECRET };
    const transport = mockSocksConnect({
        responses: ['HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nnode']
    });
    const result = await fetchViaProxy('https://airport.example/list?x=1', 'ua-test', authed, transport);
    assert.equal(result.content, 'node');
    assert.deepEqual(transport.events.tlsHosts, ['airport.example']);
    assert.equal(transport.events.requests.length, 1);
    assert.equal(transport.events.requests[0].role, 'tls');
    assert.match(transport.events.requests[0].text, /GET \/list\?x=1 HTTP\/1\.1/);
    assert.equal(transport.events.requests[0].text.includes(SECRET), false);
    assert.equal(transport.events.connects[0][3], 0x03);
});

test('HTTP 重定向仍走同一个代理', async () => {
    const transport = mockSocksConnect({
        responses: [
            'HTTP/1.1 302 Found\r\nLocation: http://airport.example/final\r\nContent-Length: 0\r\n\r\n',
            'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'
        ]
    });
    const result = await fetchViaProxy('http://airport.example/start', 'ua-test', proxy, transport);
    assert.equal(result.content, 'ok');
    assert.equal(transport.events.options.length, 2);
    assert.match(transport.events.requests[1].text, /GET \/final /);
});

test('握手失败、认证失败和目标连接失败有明确中文错误，且不包含密码', async () => {
    const authed = { ...proxy, username: 'user', password: SECRET };
    await assert.rejects(
        fetchViaProxy('https://airport.example/a', 'ua', proxy, mockSocksConnect({ fail: 'method' })),
        /不接受无认证或用户名密码/
    );
    await assert.rejects(
        fetchViaProxy('https://airport.example/a', 'ua', authed, mockSocksConnect({ fail: 'auth' })),
        (error) => {
            assert.match(error.message, /认证失败/);
            assert.equal(error.message.includes(SECRET), false);
            return true;
        }
    );
    await assert.rejects(
        fetchViaProxy('http://airport.example/a', 'ua', proxy, mockSocksConnect({ fail: 'connect' })),
        /连接被拒绝/
    );
});

test('连不上落地节点时说明 Cloudflare 的地址限制', async () => {
    const connect = () => { throw new Error('proxy request failed, cannot connect to the specified address'); };
    await assert.rejects(
        fetchViaProxy('https://airport.example/a', 'ua', proxy, { connect, upgradeTls() { throw new Error('不应升级'); } }),
        /公网落地节点/
    );
});

test('未启用或未配置代理时直接获取，不打开 SOCKS 连接', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
        seen.push(url);
        return new Response('direct', { status: 200, headers: { 'subscription-userinfo': 'upload=0; download=1; total=2; expire=3' } });
    };
    const connect = () => { throw new Error('不应连接代理'); };
    const direct = await fetchSubscription('https://airport.example/sub', 'ua', { enabled: false }, { fetch: fetchImpl, connect });
    const missing = await fetchSubscription('https://airport.example/sub', 'ua', null, { fetch: fetchImpl, connect });
    assert.equal(direct.content, 'direct');
    assert.equal(missing.subInfo.download, 1);
    assert.deepEqual(seen, ['https://airport.example/sub', 'https://airport.example/sub']);
});

test('启用但配置不完整时返回校验错误，并且不连接', async () => {
    const connect = () => { throw new Error('不应连接代理'); };
    await assert.rejects(
        fetchSubscription('https://airport.example/sub', 'ua', { enabled: true, host: '', port: 1080 }, { connect }),
        /没有填写 SOCKS5 主机/
    );
    await assert.rejects(
        fetchSubscription('https://airport.example/sub', 'ua', { enabled: true, host: 'landing.example', port: 70000 }, { connect }),
        /端口必须是 1 到 65535/
    );
    await assert.rejects(
        fetchSubscription('https://airport.example/sub', 'ua', { enabled: true, host: 'landing.example', port: 1080, username: '', password: SECRET }, { connect }),
        /必须填写用户名/
    );
});

test('保存时空密码保留原密码，清除标记会删掉密码，读取接口不返回密码', () => {
    const stored = { enabled: true, host: 'landing.example', port: 1080, username: 'user', password: SECRET };
    const kept = applyProxyUpdate(stored, { enabled: true, host: 'other.example', port: 1080, username: 'user', password: '' });
    assert.equal(kept.proxy.password, SECRET);
    assert.equal(kept.proxy.host, 'other.example');
    const cleared = applyProxyUpdate(stored, { enabled: true, host: 'landing.example', port: 1080, username: '', password: '', clearPassword: true });
    assert.equal(cleared.proxy.password, '');
    assert.equal(cleared.proxy.username, '');
    const view = toPublicProxy(stored);
    assert.equal(view.hasPassword, true);
    assert.equal('password' in view, false);
    assert.equal(JSON.stringify(view).includes(SECRET), false);
    const invalid = applyProxyUpdate(stored, { enabled: true, host: '', port: 1080, username: 'user' });
    assert.match(invalid.error, /没有填写/);
});

function memoryDb() {
    const map = new Map();
    return {
        map,
        prepare(sql) {
            return {
                bind(...args) {
                    return {
                        async first() {
                            const value = map.get(args[0]);
                            return value == null ? null : { value };
                        },
                        async run() {
                            if (sql.includes('INSERT')) map.set(args[0], args[1]);
                            return { success: true };
                        }
                    };
                }
            };
        }
    };
}

test('设置接口保存密码，但 GET 只返回已设置标记', async () => {
    const db = memoryDb();
    const app = new Hono();
    registerSettingsRoutes(app);
    const put = await app.request('/settings/proxy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, host: 'landing.example', port: 1080, username: 'user', password: SECRET })
    }, { DB: db });
    assert.equal(put.status, 200);
    const again = await app.request('/settings/proxy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, host: 'moved.example', port: 9050, username: 'user', password: '' })
    }, { DB: db });
    const saved = await again.json();
    assert.equal(saved.data.host, 'moved.example');
    assert.equal(saved.data.hasPassword, true);
    assert.equal(JSON.parse([...db.map.values()][0]).password, SECRET);
    const got = await app.request('/settings/proxy', {}, { DB: db });
    const body = await got.json();
    assert.equal(JSON.stringify(body).includes(SECRET), false);
    assert.equal(body.data.hasPassword, true);
    const cleared = await app.request('/settings/proxy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false, host: 'moved.example', port: 9050, username: '', clearPassword: true })
    }, { DB: db });
    assert.equal((await cleared.json()).data.hasPassword, false);
});

test('User-Agent 里的 CR/LF 和控制字符不会注入额外请求头', async () => {
    const payload = 'clash-verge/v1.7.7\r\nX-Injected: pwned\nHost: evil.example';
    assert.equal(sanitizeUserAgent(payload).includes('\r'), false);
    assert.equal(sanitizeUserAgent(payload).includes('\n'), false);
    const text = new TextDecoder().decode(buildHttpRequest(new URL('https://airport.example/sub?x=1'), payload));
    assert.match(text, /^GET \/sub\?x=1 HTTP\/1\.1\r\n/);
    assert.equal((text.match(/^Host:/gm) || []).length, 1);
    assert.equal(text.includes('X-Injected'), false);
    assert.equal(text.includes('evil.example'), false);
    assert.match(text, /User-Agent: clash-verge\/v1\.7\.7\r\n/);

    const transport = mockSocksConnect({
        responses: ['HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok']
    });
    const result = await fetchViaProxy('http://airport.example/sub', payload, proxy, transport);
    assert.equal(result.content, 'ok');
    const sent = transport.events.requests[0].text;
    assert.equal(sent.includes('X-Injected'), false);
    assert.equal((sent.match(/^Host:/gm) || []).length, 1);
});

test('通过代理重定向到回环地址时拒绝，并且不再发第二跳', async () => {
    const transport = mockSocksConnect({
        responses: [
            'HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/secret\r\nContent-Length: 0\r\n\r\n'
        ]
    });
    await assert.rejects(
        fetchViaProxy('http://airport.example/start', 'ua-test', proxy, transport),
        { message: UNSUPPORTED_SUBSCRIPTION_URL }
    );
    assert.equal(transport.events.requests.length, 1);
});
