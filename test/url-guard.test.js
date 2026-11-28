import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSubscription } from '../functions/_lib/remote-service.js';
import { fetchViaProxy } from '../functions/_lib/socks5.js';
import { UNSUPPORTED_SUBSCRIPTION_URL, assertSafeHttpUrl } from '../functions/_lib/url-guard.js';

const proxy = { enabled: true, host: 'landing.example', port: 1080, username: '', password: '' };

function blocked(url) {
    assert.throws(() => assertSafeHttpUrl(url), { message: UNSUPPORTED_SUBSCRIPTION_URL });
}

test('允许普通公网 http(s) 订阅地址', () => {
    assert.equal(assertSafeHttpUrl('https://airport.example/sub?token=1').href, 'https://airport.example/sub?token=1');
    assert.equal(assertSafeHttpUrl('http://cdn.example.com/clash.yaml').protocol, 'http:');
});

test('拒绝非 http(s)、回环、私网、链路本地和元数据地址', () => {
    const urls = [
        'file:///etc/passwd',
        'ftp://example.com/sub',
        'gopher://example.com/1',
        'http://127.0.0.1/secret',
        'http://127.1/secret',
        'http://2130706433/',
        'http://0x7f000001/',
        'http://0177.0.0.1/',
        'http://localhost/admin',
        'http://localhost.localdomain/',
        'http://[::1]/',
        'http://[::ffff:127.0.0.1]/',
        'http://[::ffff:7f00:1]/',
        'http://[::]/',
        'http://0.0.0.0/',
        'http://10.0.0.8/sub',
        'http://172.16.1.1/sub',
        'http://172.31.255.255/sub',
        'http://192.168.1.1/sub',
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.1.1/',
        'http://100.64.0.1/',
        'http://168.63.129.16/',
        'http://metadata.google.internal/',
        'http://metadata.google.internal./',
        'http://metadata.goog/',
        'http://instance-data/latest/meta-data/',
        'http://[fc00::1]/',
        'http://[fe80::1]/',
        'http://panel.localhost/sub',
        'https://127.0.0.1.nip.io/sub'
    ];
    for (const url of urls) blocked(url);
    assert.doesNotThrow(() => assertSafeHttpUrl('http://172.15.0.1/sub'));
    assert.doesNotThrow(() => assertSafeHttpUrl('http://[2001:db8::1]/sub'));
});

test('直连拉取会拦截目标，并检查重定向目标', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
        seen.push(url);
        throw new Error('不应发出这个请求');
    };
    await assert.rejects(
        fetchSubscription('http://127.0.0.1/sub', 'ua', { enabled: false }, { fetch: fetchImpl }),
        { message: UNSUPPORTED_SUBSCRIPTION_URL }
    );
    assert.deepEqual(seen, []);

    const hops = [];
    const redirecting = async (url) => {
        hops.push(url);
        if (String(url).includes('/start')) {
            return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data/' } });
        }
        throw new Error('不应跟随到元数据地址');
    };
    await assert.rejects(
        fetchSubscription('https://airport.example/start', 'ua', null, { fetch: redirecting }),
        { message: UNSUPPORTED_SUBSCRIPTION_URL }
    );
    assert.deepEqual(hops, ['https://airport.example/start']);
});

test('代理拉取同样拒绝私网目标和私网重定向，且不会去连接代理', async () => {
    const connect = () => { throw new Error('不应连接代理'); };
    await assert.rejects(
        fetchViaProxy('http://192.168.0.20/sub', 'ua', proxy, { connect, upgradeTls() { throw new Error('不应升级'); } }),
        { message: UNSUPPORTED_SUBSCRIPTION_URL }
    );
    await assert.rejects(
        fetchSubscription('http://10.1.2.3/sub', 'ua', proxy, { connect }),
        { message: UNSUPPORTED_SUBSCRIPTION_URL }
    );
});
