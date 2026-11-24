import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeBase64 } from '../functions/_lib/core/codec.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';

const UUID = 'b831381d-6324-4d53-ad4f-8cda48b30811';

test('Clash YAML 入参识别 Reality、传输和 SS 插件', () => {
    const yaml = `
mixed-port: 7890
proxies:
  - name: 现实
    type: vless
    server: 1.2.3.4
    port: 443
    uuid: ${UUID}
    udp: true
    tls: true
    flow: xtls-rprx-vision
    servername: www.microsoft.com
    client-fingerprint: chrome
    reality-opts:
      public-key: PUBLICKEY
      short-id: abcd
  - name: 升级
    type: vless
    server: 1.2.3.4
    port: 443
    uuid: ${UUID}
    tls: true
    servername: example.com
    network: ws
    ws-opts:
      path: /upgrade
      headers:
        Host: example.com
      v2ray-http-upgrade: true
  - name: 分流
    type: vless
    server: 1.2.3.4
    port: 443
    uuid: ${UUID}
    tls: true
    servername: example.com
    network: xhttp
    xhttp-opts:
      path: /xhttp
      host: example.com
      mode: packet-up
  - name: 插件
    type: ss
    server: example.com
    port: 8388
    cipher: aes-256-gcm
    password: secret
    plugin: obfs
    plugin-opts:
      mode: tls
      host: cdn.example.com
`;
    const parsed = parseSubscription(yaml);
    assert.equal(parsed.format, 'clash');
    assert.equal(parsed.errors.length, 0, parsed.errors.map(item => item.message).join(';'));
    assert.deepEqual(parsed.nodes.map(node => node.name), ['现实', '升级', '分流', '插件']);
    assert.equal(parsed.nodes[0].security, 'reality');
    assert.equal(parsed.nodes[0].reality.publicKey, 'PUBLICKEY');
    assert.equal(parsed.nodes[1].network, 'httpupgrade');
    assert.equal(parsed.nodes[1].httpupgrade.host, 'example.com');
    assert.equal(parsed.nodes[2].network, 'xhttp');
    assert.equal(parsed.nodes[2].xhttp.mode, 'packet-up');
    assert.equal(parsed.nodes[3].plugin, 'obfs');
    assert.equal(parsed.nodes[3].pluginOpts.mode, 'tls');
    assert.equal(parsed.nodes[3].pluginOpts.host, 'cdn.example.com');
});

test('标准 Base64 和 URL-safe 无填充的节点列表都能识别', () => {
    const list = [
        `vless://${UUID}@1.1.1.1:443?encryption=none&security=tls&type=tcp&sni=a.example#甲`,
        'trojan://secret@2.2.2.2:443?security=tls&sni=b.example#乙'
    ].join('\n');
    const standard = encodeBase64(list);
    assert.match(standard, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(standard.length % 4, 0);
    assert.equal(standard.includes('-'), false);
    assert.equal(standard.includes('_'), false);
    const parsed = parseSubscription(standard);
    assert.equal(parsed.format, 'base64');
    assert.equal(parsed.nodes.length, 2);
    assert.deepEqual(parsed.nodes.map(node => node.name), ['甲', '乙']);

    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const again = parseSubscription(urlSafe);
    assert.equal(again.nodes.length, 2);
    assert.equal(again.nodes[1].type, 'trojan');
});

test('Base64 包裹的 Clash YAML 也能识别节点', () => {
    const yaml = `proxies:\n  - name: 包裹\n    type: ss\n    server: 1.2.3.4\n    port: 8388\n    cipher: aes-128-gcm\n    password: secret\n`;
    const parsed = parseSubscription(encodeBase64(yaml));
    assert.equal(parsed.nodes.length, 1);
    assert.equal(parsed.nodes[0].cipher, 'aes-128-gcm');
    assert.equal(parsed.nodes[0].name, '包裹');
});

test('原始 URI 列表，以及解不了时给出明确错误', () => {
    const mixed = parseSubscription([
        `ss://${encodeBase64('aes-128-gcm:secret').replace(/=+$/, '')}@9.9.9.9:8388#好的`,
        'vless://@@@',
        'wireguard://not-a-share'
    ].join('\n'));
    assert.equal(mixed.nodes.length, 1);
    assert.equal(mixed.nodes[0].name, '好的');
    assert.ok(mixed.errors.some(item => /vless/i.test(item.message)));

    const broken = parseSubscription('vless://@@@');
    assert.equal(broken.nodes.length, 0);
    assert.match(broken.errors[0].message, /vless|VLESS|无法识别/);

    const yaml = parseSubscription(`proxies:\n  - name: 坏的\n    type: trojan\n    server: 1.2.3.4\n    port: 443\n`);
    assert.equal(yaml.nodes.length, 0);
    assert.match(yaml.errors[0].message, /Trojan 缺少 password/);

    const unknown = parseSubscription(`proxies:\n  - {name: wg, type: wireguard, server: 1.1.1.1, port: 51820}\n`);
    assert.equal(unknown.nodes.length, 0);
    assert.match(unknown.errors[0].message, /wireguard/);

    assert.match(parseSubscription('').errors[0].message, /内容为空/);
    assert.match(parseSubscription('这不是订阅').errors[0].message, /无法识别/);
});
