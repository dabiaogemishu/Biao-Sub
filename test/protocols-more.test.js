import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUri, toUri, toPublicNode } from '../functions/_lib/uri/index.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';
import { renderBase64, renderClash } from '../functions/_lib/output/build.js';

const PRIVATE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PUBLIC_KEY = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

function uriRoundtrip(uri) {
    const first = parseUri(uri);
    const second = parseUri(toUri(first));
    assert.equal(second.type, first.type);
    assert.equal(second.server, first.server);
    assert.equal(second.port, first.port);
    assert.equal(second.password, first.password);
    assert.equal(second.username, first.username);
    assert.equal(second.privateKey, first.privateKey);
    assert.equal(second.publicKey, first.publicKey);
    assert.equal(second.version, first.version);
    assert.equal(second.network, first.network);
    return first;
}

function clashRoundtrip(uri) {
    const first = uriRoundtrip(uri);
    const yaml = renderClash([first], {});
    const parsed = parseSubscription(yaml);
    assert.equal(parsed.errors.length, 0, parsed.errors.map(item => item.message).join(';'));
    assert.equal(parsed.nodes.length, 1);
    assert.equal(parsed.nodes[0].type, first.type);
    assert.equal(parsed.nodes[0].server, first.server);
    assert.equal(parsed.nodes[0].port, first.port);
    return first;
}

test('WireGuard 分享链接和 Clash 来回', () => {
    const uri = `wireguard://${encodeURIComponent(PRIVATE_KEY)}@203.0.113.10:51820?publickey=${encodeURIComponent(PUBLIC_KEY)}&address=10.0.0.2%2F32&mtu=1420&reserved=0,0,0#wg`;
    const node = clashRoundtrip(uri);
    assert.equal(node.privateKey, PRIVATE_KEY);
    assert.equal(node.publicKey, PUBLIC_KEY);
    assert.equal(node.address, '10.0.0.2/32');
    assert.equal(node.mtu, 1420);
    assert.equal(node.reserved, '0,0,0');
    const alias = parseUri(`wg://${encodeURIComponent(PRIVATE_KEY)}@203.0.113.10:51820?publickey=${encodeURIComponent(PUBLIC_KEY)}#alias`);
    assert.equal(alias.type, 'wireguard');
    assert.match(toUri(alias), /^wireguard:\/\//);
    const view = toPublicNode(node);
    assert.equal(view.yamlLabel, 'Clash Meta YAML');
    assert.match(view.yaml, /wireguard/);
    assert.equal(view.jsonLabel, 'sing-box 端点 JSON');
    assert.match(view.json, /"type": "wireguard"/);
    assert.throws(() => parseUri('wireguard://203.0.113.10:1'), /缺少私钥/);
});

test('SOCKS5、HTTP 代理、Snell 和 SSH 可以进 Clash', () => {
    const socks = clashRoundtrip('socks5://user:pass@203.0.113.8:1080#socks');
    assert.equal(socks.type, 'socks');
    assert.equal(socks.version, '5');
    assert.equal(socks.username, 'user');
    assert.match(renderClash([socks], {}), /socks5/);

    const http = clashRoundtrip('https://user:pass@203.0.113.8:443?sni=proxy.example#https');
    assert.equal(http.type, 'http');
    assert.equal(http.tls, true);
    assert.equal(http.sni, 'proxy.example');
    clashRoundtrip('http://203.0.113.9:8080#plain');

    const snell = clashRoundtrip('snell://psk-value@203.0.113.8:443?version=4&obfs=http&obfs-host=bing.com#snell');
    assert.equal(snell.password, 'psk-value');
    assert.equal(snell.obfs, 'http');
    assert.equal(snell.obfsParam, 'bing.com');

    const ssh = clashRoundtrip('ssh://user:pass@203.0.113.8:22#ssh');
    assert.equal(ssh.username, 'user');
    assert.equal(ssh.password, 'pass');
});

test('SOCKS4、ShadowTLS 和 Naive 保留链接，Clash 会跳过', () => {
    const socks4 = uriRoundtrip('socks4://user@203.0.113.8:1080#s4');
    assert.equal(socks4.version, '4');
    assert.match(renderClash([socks4], {}), /SOCKS4 无法写入 Clash Meta/);
    assert.match(renderBase64([socks4]).links[0], /^socks4:\/\//);

    const shadow = uriRoundtrip('shadowtls://pass@203.0.113.8:443?version=3&sni=example.com&fp=chrome#st');
    assert.equal(shadow.version, '3');
    assert.equal(shadow.sni, 'example.com');
    assert.match(renderClash([shadow], {}), /ShadowTLS 无法写入 Clash Meta/);
    const view = toPublicNode(shadow);
    assert.match(view.yamlLabel, /无法完整表达/);
    assert.match(view.json, /"type": "shadowtls"/);

    const naive = uriRoundtrip('naive+https://user:pass@203.0.113.8:443#naive');
    assert.equal(naive.network, 'https');
    const quic = uriRoundtrip('naive+quic://user:pass@203.0.113.8:443#quic');
    assert.equal(quic.network, 'quic');
    assert.match(renderClash([naive], {}), /NaiveProxy 无法写入 Clash Meta/);
    assert.match(renderBase64([naive]).links[0], /^naive\+https:\/\//);
});

test('VLESS 加密原文、XHTTP 的 JSON 标签，以及残缺输入', () => {
    const node = parseUri('vless://b831381d-6324-4d53-ad4f-8cda48b30811@203.0.113.8:443?encryption=mlkem768x25519plus.native.example&security=tls&type=tcp&sni=example.com#enc');
    assert.equal(node.encryption, 'mlkem768x25519plus.native.example');
    assert.match(toUri(node), /encryption=mlkem768x25519plus\.native\.example/);
    assert.match(toPublicNode(node).json, /"encryption": "mlkem768x25519plus\.native\.example"/);
    const tuic = toPublicNode(parseUri('tuic://v4-token@203.0.113.8:443#tuic4'));
    assert.match(tuic.json, /"token": "v4-token"/);
    const carried = parseUri('vless://b831381d-6324-4d53-ad4f-8cda48b30811@203.0.113.8:443?encryption=none&security=tls&type=hysteria&auth=hy-auth&up=100&down=200&hysteriaVersion=2&sni=example.com#hytr');
    assert.equal(carried.auth, 'hy-auth');
    assert.equal(carried.up, '100');
    assert.equal(carried.down, '200');
    assert.equal(carried.version, '2');
    const again = parseUri(toUri(carried));
    assert.equal(again.auth, 'hy-auth');
    assert.equal(again.version, '2');
    const hyJson = toPublicNode(carried).json;
    assert.match(hyJson, /hysteriaSettings/);
    assert.match(hyJson, /"auth": "hy-auth"/);
    assert.match(hyJson, /"version": 2/);
    const xhttp = toPublicNode(parseUri('vless://b831381d-6324-4d53-ad4f-8cda48b30811@203.0.113.8:443?encryption=none&security=tls&type=xhttp&path=%2Fx&mode=stream-one&sni=example.com#x'));
    assert.equal(xhttp.jsonLabel, 'Xray 出站 JSON');
    assert.match(xhttp.json, /xhttpSettings/);

    assert.throws(() => parseUri('wireguard://only-private@203.0.113.8:51820'), /缺少公钥/);
    assert.throws(() => parseUri('snell://psk@203.0.113.8:443?version=5'), /只支持 version 4 或 6/);
    assert.throws(() => parseUri('https://example.com/sub/path'), /远程导入/);
    assert.throws(() => parseUri('socks5://'), /格式无效|无法识别/);
    assert.throws(() => parseUri('unknown://203.0.113.8:1'), /无法识别的协议链接/);
});

test('parseSubscription 能识别新增分享链接，带路径的 http 会提示远程导入', () => {
    const lines = [
        `wireguard://${encodeURIComponent(PRIVATE_KEY)}@203.0.113.21:51820?publickey=${encodeURIComponent(PUBLIC_KEY)}#wg`,
        `wg://${encodeURIComponent(PRIVATE_KEY)}@203.0.113.21:51820?publickey=${encodeURIComponent(PUBLIC_KEY)}#alias`,
        'socks5://user:pass@203.0.113.8:1080#s5',
        'socks://user:pass@203.0.113.8:1080#socks',
        'socks4://user@203.0.113.8:1080#s4',
        'http://203.0.113.9:8080#http',
        'https://user:pass@203.0.113.8:443?sni=proxy.example#https',
        'snell://psk-value@203.0.113.8:443?version=4#snell4',
        'snell://psk-value@203.0.113.8:443?version=6&mode=default#snell6',
        'ssh://user:pass@203.0.113.8:22#ssh',
        'shadowtls://pass@203.0.113.8:443?version=3&sni=example.com#st',
        'naive+https://user:pass@203.0.113.8:443#naive',
        'naive+quic://user:pass@203.0.113.8:443#quic'
    ];
    const parsed = parseSubscription(lines.join('\n'));
    assert.equal(parsed.format, 'uri');
    assert.equal(parsed.errors.length, 0, parsed.errors.map(item => item.message).join(';'));
    assert.deepEqual(parsed.nodes.map(node => node.type), [
        'wireguard', 'wireguard', 'socks', 'socks', 'socks', 'http', 'http', 'snell', 'snell', 'ssh', 'shadowtls', 'naive', 'naive'
    ]);
    assert.equal(parsed.nodes[4].version, '4');
    assert.equal(parsed.nodes[8].version, '6');
    assert.equal(parsed.nodes[12].network, 'quic');

    for (const line of ['https://example.com/sub/path', 'http://example.com/sub/path', 'https://example.com:443/api/sub']) {
        const rejected = parseSubscription(line);
        assert.equal(rejected.nodes.length, 0);
        assert.match(rejected.errors[0].message, /这不是 HTTP 代理节点。带路径的地址请当作订阅链接，用远程导入/);
    }
});
