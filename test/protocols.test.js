import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeBase64 } from '../functions/_lib/core/codec.js';
import { parseUri, toUri } from '../functions/_lib/uri/index.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';
import { renderClash } from '../functions/_lib/output/build.js';

const UUID = 'b831381d-6324-4d53-ad4f-8cda48b30811';

function pick(node) {
    return {
        name: node.name,
        type: node.type,
        server: node.server,
        port: node.port,
        uuid: node.uuid,
        password: node.password,
        cipher: node.cipher,
        alterId: node.alterId,
        network: node.network,
        security: node.security,
        tls: node.tls,
        sni: node.sni,
        alpn: node.alpn,
        fingerprint: node.fingerprint,
        flow: node.flow,
        skipCertVerify: node.skipCertVerify,
        reality: node.reality,
        ws: node.ws,
        grpc: node.grpc,
        http: node.http,
        httpupgrade: node.httpupgrade,
        xhttp: node.xhttp,
        plugin: node.plugin,
        pluginOpts: node.pluginOpts,
        protocol: node.protocol,
        protocolParam: node.protocolParam,
        obfs: node.obfs,
        obfsParam: node.obfsParam,
        obfsPassword: node.obfsPassword,
        ports: node.ports,
        congestion: node.congestion,
        udpRelayMode: node.udpRelayMode,
        token: node.token,
        auth: node.auth,
        up: node.up,
        down: node.down
    };
}

function roundtrip(uri) {
    const first = parseUri(uri);
    const second = parseUri(toUri(first));
    assert.deepEqual(pick(second), pick(first));
    const yaml = renderClash([first], {});
    const fromClash = parseSubscription(yaml);
    assert.equal(fromClash.errors.length, 0, fromClash.errors.map(item => item.message).join(';'));
    assert.equal(fromClash.nodes.length, 1);
    assert.deepEqual(pick(fromClash.nodes[0]), pick(first));
    return first;
}

test('ss SIP002、旧版 Base64 和插件', () => {
    const user = encodeBase64('aes-256-gcm:p@ss word').replace(/=+$/, '');
    const sip = parseUri(`ss://${user}@example.com:8388#实验室`);
    assert.equal(sip.cipher, 'aes-256-gcm');
    assert.equal(sip.password, 'p@ss word');
    assert.equal(sip.name, '实验室');
    roundtrip(`ss://${user}@example.com:8388#实验室`);

    const legacy = `ss://${encodeBase64('chacha20-ietf-poly1305:secret@8.8.8.8:8443')}#legacy`;
    const legacyNode = parseUri(legacy);
    assert.equal(legacyNode.cipher, 'chacha20-ietf-poly1305');
    assert.equal(legacyNode.server, '8.8.8.8');
    assert.equal(legacyNode.port, 8443);
    roundtrip(legacy);

    const plugin = roundtrip('ss://' + encodeBase64('2022-blake3-aes-128-gcm:aaaa').replace(/=+$/, '') + '@1.2.3.4:8388?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dwww.example.com#obfs');
    assert.equal(plugin.plugin, 'obfs');
    assert.equal(plugin.pluginOpts.mode, 'http');
    assert.equal(plugin.pluginOpts.host, 'www.example.com');
});

test('ssr', () => {
    const node = roundtrip(buildSsr());
    assert.equal(node.type, 'ssr');
    assert.equal(node.protocol, 'auth_aes128_md5');
    assert.equal(node.obfs, 'tls1.2_ticket_auth');
    assert.equal(node.password, 'ssr-pass');
    assert.equal(node.obfsParam, 'example.com');
});

test('vmess ws 与 grpc', () => {
    const ws = {
        v: '2', ps: '麦斯', add: '1.2.3.4', port: '443', id: UUID, aid: '0', scy: 'auto',
        net: 'ws', type: 'none', host: 'www.example.com', path: '/ws', tls: 'tls', sni: 'www.example.com', fp: 'chrome'
    };
    const wsNode = roundtrip(`vmess://${encodeBase64(JSON.stringify(ws))}`);
    assert.equal(wsNode.network, 'ws');
    assert.equal(wsNode.ws.path, '/ws');
    assert.equal(wsNode.ws.host, 'www.example.com');
    assert.equal(wsNode.tls, true);
    assert.equal(wsNode.sni, 'www.example.com');

    const grpc = { ...ws, ps: 'grpc', net: 'grpc', path: 'GunService', host: '', sni: 'grpc.example.com' };
    const grpcNode = roundtrip(`vmess://${encodeBase64(JSON.stringify(grpc))}`);
    assert.equal(grpcNode.network, 'grpc');
    assert.equal(grpcNode.grpc.serviceName, 'GunService');
});

test('vless reality、ws、grpc、httpupgrade、xhttp 和 IPv6', () => {
    const reality = roundtrip(`vless://${UUID}@1.2.3.4:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.microsoft.com&fp=chrome&pbk=abc%2Bdef%2Fghi&sid=0123456789abcdef&spx=%2Ffoo&type=tcp#Reality`);
    assert.equal(reality.security, 'reality');
    assert.equal(reality.flow, 'xtls-rprx-vision');
    assert.equal(reality.reality.publicKey, 'abc+def/ghi');
    assert.equal(reality.reality.shortId, '0123456789abcdef');
    assert.equal(reality.reality.spiderX, '/foo');
    assert.equal(reality.fingerprint, 'chrome');

    const ws = roundtrip(`vless://${UUID}@1.2.3.4:443?encryption=none&security=tls&type=ws&path=%2Fws%3Fed%3D2560&host=example.com&sni=example.com#ws`);
    assert.equal(ws.network, 'ws');
    assert.equal(ws.ws.path, '/ws?ed=2560');
    assert.equal(ws.ws.host, 'example.com');

    const grpc = roundtrip(`vless://${UUID}@1.2.3.4:443?encryption=none&security=tls&type=grpc&serviceName=GunService&mode=gun&sni=example.com#grpc`);
    assert.equal(grpc.grpc.serviceName, 'GunService');

    const upgrade = roundtrip(`vless://${UUID}@1.2.3.4:443?encryption=none&security=tls&type=httpupgrade&path=%2Fupgrade&host=example.com&sni=example.com#upgrade`);
    assert.equal(upgrade.network, 'httpupgrade');
    assert.equal(upgrade.httpupgrade.path, '/upgrade');
    assert.equal(upgrade.httpupgrade.host, 'example.com');

    const xhttp = roundtrip(`vless://${UUID}@1.2.3.4:443?encryption=none&security=tls&type=xhttp&path=%2Fxhttp&host=example.com&mode=stream-one&sni=example.com&alpn=h2#xhttp`);
    assert.equal(xhttp.network, 'xhttp');
    assert.equal(xhttp.xhttp.mode, 'stream-one');
    assert.equal(xhttp.xhttp.path, '/xhttp');

    const v6 = roundtrip(`vless://${UUID}@[2001:db8::1]:8443?encryption=none&security=none&type=tcp#v6`);
    assert.equal(v6.server, '2001:db8::1');
    assert.equal(v6.port, 8443);
});

test('trojan、hysteria2、hysteria、tuic、anytls', () => {
    const trojan = roundtrip('trojan://s%40cret@1.2.3.4:8443?security=tls&sni=example.com&type=ws&path=%2Ftj&host=example.com#tj');
    assert.equal(trojan.password, 's@cret');
    assert.equal(trojan.network, 'ws');

    const hy2 = roundtrip('hy2://authpass@1.2.3.4:443?sni=example.com&obfs=salamander&obfs-password=obfs-pass&mport=20000-40000&insecure=1#hy2');
    assert.equal(hy2.type, 'hysteria2');
    assert.equal(hy2.obfs, 'salamander');
    assert.equal(hy2.obfsPassword, 'obfs-pass');
    assert.equal(hy2.ports, '20000-40000');
    assert.equal(hy2.skipCertVerify, true);

    const hy1 = roundtrip('hysteria://authpass@1.2.3.4:443?peer=example.com&upmbps=100&downmbps=50&protocol=udp#hy1');
    assert.equal(hy1.type, 'hysteria');
    assert.equal(hy1.auth, 'authpass');
    assert.equal(hy1.up, '100');

    const tuic = roundtrip(`tuic://${UUID}:tuic-pass@1.2.3.4:443?congestion_control=bbr&udp_relay_mode=native&sni=example.com&alpn=h3#tuic`);
    assert.equal(tuic.uuid, UUID);
    assert.equal(tuic.password, 'tuic-pass');
    assert.equal(tuic.congestion, 'bbr');

    const token = roundtrip('tuic://only-token@1.2.3.4:443?sni=example.com&alpn=h3#v4');
    assert.equal(token.token, 'only-token');
    assert.equal(token.uuid, '');

    const any = roundtrip('anytls://secret@1.2.3.4:443?sni=example.com&insecure=1#any');
    assert.equal(any.type, 'anytls');
    assert.equal(any.fingerprint, 'chrome');
    assert.equal(any.skipCertVerify, true);
});

function buildSsr() {
    const password = encodeBase64('ssr-pass').replace(/=+$/, '');
    const remarks = encodeBase64('机场 SSR').replace(/=+$/, '');
    const obfsParam = encodeBase64('example.com').replace(/=+$/, '');
    const main = `1.2.3.4:1234:auth_aes128_md5:aes-256-cfb:tls1.2_ticket_auth:${password}/?remarks=${remarks}&obfsparam=${obfsParam}`;
    return `ssr://${encodeBase64(main).replace(/=+$/, '')}`;
}
