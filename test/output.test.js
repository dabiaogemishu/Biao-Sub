import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { encodeBase64, decodeBase64 } from '../functions/_lib/core/codec.js';
import { parseUri } from '../functions/_lib/uri/index.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';
import { defaultRules } from '../src/api/config.js';
import { chainRejection, renderClash, renderHostedSubscription, renderSubscription, resolveFormat } from '../functions/_lib/output/build.js';
import { buildGroupFromRows } from '../functions/_lib/output/render.js';

const UUID = 'b831381d-6324-4d53-ad4f-8cda48b30811';

function node(name, server = '1.1.1.1') {
    return parseUri(`vless://${UUID}@${server}:443?encryption=none&security=tls&type=tcp&sni=example.com#${encodeURIComponent(name)}`);
}

function namesOf(built) {
    const clashNames = parseYaml(built.clash).proxies.map(proxy => proxy.name);
    const links = decodeBase64(built.base64).split('\n').filter(Boolean);
    const uriNames = links.map(link => parseUri(link).name);
    return { clashNames, uriNames, links };
}

test('裸链接默认 Clash，base64 使用标准字符集和填充', () => {
    assert.equal(resolveFormat(undefined), 'clash');
    assert.equal(resolveFormat(''), 'clash');
    assert.equal(resolveFormat('clash'), 'clash');
    assert.equal(resolveFormat('yaml'), 'clash');
    assert.equal(resolveFormat('base64'), 'base64');

    const built = renderSubscription({
        entries: [{ nodes: [node('甲'), node('乙', '2.2.2.2')], resourceName: '自建' }],
        clashConfig: {}
    });
    assert.match(built.base64, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(built.base64.length % 4, 0);
    assert.equal(built.base64.includes('-'), false);
    assert.equal(built.base64.includes('_'), false);
    assert.equal(built.base64, encodeBase64(built.links.join('\n')));
    const { clashNames, uriNames } = namesOf(built);
    assert.deepEqual(clashNames, ['甲', '乙']);
    assert.deepEqual(uriNames, clashNames);
});

test('Clash 与 Base64 使用同一套 include 筛选和重名去重', () => {
    const hongkong = node('香港');
    const japan = node('日本', '3.3.3.3');
    const built = renderSubscription({
        entries: [
            { nodes: [hongkong, japan], include: ['香港'], resourceName: '甲组' },
            { nodes: [node('香港', '4.4.4.4'), node('新加坡', '5.5.5.5')], resourceName: '乙组' }
        ],
        clashConfig: { groups: [{ name: '代理', type: 'select', useAllProxies: true }] }
    });
    const { clashNames, uriNames } = namesOf(built);
    assert.deepEqual(clashNames, ['香港', '香港 1', '新加坡']);
    assert.deepEqual(uriNames, clashNames);
    assert.equal(parseYaml(built.clash).proxies[0].server, '1.1.1.1');
    assert.equal(parseYaml(built.clash).proxies[1].server, '4.4.4.4');
    const servers = uriNames.map((name, index) => parseUri(built.links[index]).server);
    assert.deepEqual(servers, ['1.1.1.1', '4.4.4.4', '5.5.5.5']);
    assert.deepEqual(parseYaml(built.clash)['proxy-groups'][0].proxies, clashNames);
});

test('Clash 规则输出为 rules 列表，整份文档可以解析', () => {
    const clashConfig = { groups: [{ name: '代理', type: 'select', proxies: ['甲'] }] };
    const single = renderClash([node('甲')], { ...clashConfig, rules: 'MATCH,代理' });
    const singleDoc = parseYaml(single);
    assert.deepEqual(singleDoc.rules, ['MATCH,代理']);
    assert.equal(singleDoc['proxy-groups'][0].name, '代理');
    assert.equal(singleDoc['proxy-groups'][0].proxies[0], '甲');

    const multi = renderClash([node('甲')], { ...clashConfig, rules: 'GEOIP,CN,DIRECT\nMATCH,代理' });
    assert.deepEqual(parseYaml(multi).rules, ['GEOIP,CN,DIRECT', 'MATCH,代理']);

    const wrapped = renderClash([node('甲')], {
        ...clashConfig,
        rules: 'rules:\n  - GEOIP,CN,DIRECT\n  # 末尾兜底\n  - MATCH,代理\n'
    });
    assert.deepEqual(parseYaml(wrapped).rules, ['GEOIP,CN,DIRECT', 'MATCH,代理']);
    assert.equal((wrapped.match(/^rules:/gm) || []).length, 1);
});

test('默认模板的 Proxy 组包含已选节点，显式列表保持不变', () => {
    const built = renderSubscription({
        entries: [{
            nodes: [node('香港'), node('日本', '8.8.8.8')],
            include: ['香港', '日本'],
            resourceName: '自建'
        }],
        clashConfig: {
            groups: [{ name: 'Proxy', type: 'select', proxies: [], useAllProxies: false }],
            rules: defaultRules
        }
    });
    const doc = parseYaml(built.clash);
    assert.deepEqual(doc.proxies.map(proxy => proxy.name), ['香港', '日本']);
    const proxyGroup = doc['proxy-groups'].find(group => group.name === 'Proxy');
    assert.deepEqual(proxyGroup.proxies, ['香港', '日本']);
    assert.equal(doc.rules.includes('MATCH,Proxy'), true);

    const custom = renderSubscription({
        entries: [{ nodes: [node('香港'), node('日本', '8.8.8.8')], resourceName: '自建' }],
        clashConfig: {
            groups: [{ name: 'Proxy', type: 'select', proxies: ['日本', 'DIRECT'] }],
            rules: 'MATCH,Proxy'
        }
    });
    assert.deepEqual(parseYaml(custom.clash)['proxy-groups'][0].proxies, ['日本', 'DIRECT']);
});

test('空白模板补上 Proxy 组和 MATCH 规则', () => {
    const built = renderSubscription({
        entries: [{ subId: 1, nodes: [node('甲'), node('乙', '8.8.8.8')] }],
        clashConfig: { mode: 'generate', header: '', groups: [], rules: '', resources: [] }
    });
    const doc = parseYaml(built.clash);
    assert.deepEqual(doc.proxies.map(proxy => proxy.name), ['甲', '乙']);
    assert.equal(doc['proxy-groups'][0].name, 'Proxy');
    assert.deepEqual(doc['proxy-groups'][0].proxies, ['甲', '乙']);
    assert.deepEqual(doc.rules, ['MATCH,Proxy']);
});

test('成员顺序以 config 为准，resources 不能覆盖链式', () => {
    const subs = [1, 2, 3].map(id => ({
        id,
        name: `资源${id}`,
        url: `vless://${UUID}@${id}.${id}.${id}.${id}:443?encryption=none&security=tls&type=tcp#${encodeURIComponent(['甲', '乙', '丙'][id - 1])}`
    }));
    const built = buildGroupFromRows({
        config: [
            { subId: 3 },
            { subId: 1 },
            { subId: 2, dialerProxy: { enabled: true, group: '甲' } }
        ],
        clash_config: {
            mode: 'generate',
            groups: [{ name: 'Proxy', type: 'select', useAllProxies: true }],
            rules: 'MATCH,Proxy',
            resources: [{ subId: 3 }]
        }
    }, subs);
    const doc = parseYaml(built.clash);
    assert.deepEqual(doc.proxies.map(proxy => proxy.name), ['丙', '甲', '乙']);
    assert.equal(doc.proxies[2]['dialer-proxy'], '甲');
    assert.deepEqual(doc['proxy-groups'][0].proxies, ['丙', '甲', '乙']);
});

test('链式节点保持保存顺序，Base64 不含 dialer-proxy', () => {
    const built = renderSubscription({
        entries: [
            { subId: 1, nodes: [node('甲')] },
            { subId: 2, nodes: [node('乙', '2.2.2.2')], dialerProxy: { enabled: true, group: 'Relay' } },
            { subId: 3, nodes: [node('丙', '3.3.3.3')] }
        ],
        clashConfig: { groups: [{ name: 'Relay', type: 'select', proxies: ['甲'] }], rules: 'MATCH,Relay' }
    });
    const doc = parseYaml(built.clash);
    assert.deepEqual(doc.proxies.map(proxy => proxy.name), ['甲', '乙', '丙']);
    assert.equal(doc.proxies[1]['dialer-proxy'], 'Relay');
    assert.equal(doc.proxies[0]['dialer-proxy'], undefined);
    const text = decodeBase64(built.base64);
    assert.equal(text.includes('dialer'), false);
    assert.deepEqual(text.split('\n').filter(Boolean).map(link => parseUri(link).name), ['甲', '乙', '丙']);
});

test('链式目标必须存在，且不能指向自身', () => {
    const entries = [
        { subId: 1, nodes: [node('甲')], dialerProxy: { enabled: true, group: '' } },
        { subId: 2, nodes: [node('乙', '2.2.2.2')] }
    ];
    assert.equal(chainRejection(entries, ['Proxy']), '请选择链式代理目标');
    entries[0].dialerProxy.group = '不存在';
    assert.match(chainRejection(entries, ['Proxy']), /链式代理目标不存在/);
    entries[0].dialerProxy.group = '甲';
    assert.equal(chainRejection(entries, ['Proxy']), '链式代理不能指向自身');
    entries[0].dialerProxy.group = '乙';
    assert.equal(chainRejection(entries, ['Proxy']), '');
    entries[0].dialerProxy.group = 'Proxy';
    assert.equal(chainRejection(entries, ['Proxy']), '');
});

test('托管 YAML 注入已选节点，同名代理用已选节点替换', () => {
    const raw = `mixed-port: 7890
proxies:
  - name: hosted-ss
    type: ss
    server: 9.9.9.9
    port: 8388
    cipher: aes-256-gcm
    password: hosted-pass
  - name: 甲
    type: ss
    server: 1.1.1.1
    port: 8388
    cipher: aes-256-gcm
    password: old-pass
proxy-groups:
  - name: Proxy
    type: select
    proxies: []
  - name: Manual
    type: select
    proxies:
      - hosted-ss
      - DIRECT
  - name: All
    type: select
    include-all: true
    proxies:
      - DIRECT
rules:
  - MATCH,Proxy
`;
    const built = renderHostedSubscription(raw, [node('甲', '8.8.8.8'), { ...node('乙', '2.2.2.2'), _dialer: '甲' }]);
    const doc = parseYaml(built.clash);
    assert.equal(doc['mixed-port'], 7890);
    assert.deepEqual(doc.rules, ['MATCH,Proxy']);
    assert.deepEqual(doc.proxies.map(proxy => proxy.name), ['hosted-ss', '甲', '乙']);
    assert.equal(doc.proxies[0].server, '9.9.9.9');
    assert.equal(doc.proxies[0].password, 'hosted-pass');
    assert.equal(doc.proxies[1].type, 'vless');
    assert.equal(doc.proxies[1].server, '8.8.8.8');
    assert.equal(doc.proxies[2]['dialer-proxy'], '甲');
    assert.deepEqual(doc['proxy-groups'].find(group => group.name === 'Proxy').proxies, ['甲', '乙']);
    assert.deepEqual(doc['proxy-groups'].find(group => group.name === 'Manual').proxies, ['hosted-ss', 'DIRECT']);
    const all = doc['proxy-groups'].find(group => group.name === 'All');
    assert.deepEqual(all.proxies, ['甲', '乙']);
    assert.equal(all['include-all'], undefined);
    const links = decodeBase64(built.base64).split('\n').filter(Boolean);
    assert.deepEqual(links.map(link => parseUri(link).name), ['hosted-ss', '甲', '乙']);
    assert.equal(built.base64.includes('dialer') || decodeBase64(built.base64).includes('dialer'), false);
});

test('只给序号时也筛选，空 include 表示全选', () => {
    const nodes = [node('一'), node('二', '8.8.8.8')];
    const picked = renderSubscription({ entries: [{ nodes, selectedNodes: [1] }], clashConfig: {} });
    assert.deepEqual(namesOf(picked).clashNames, ['二']);
    assert.deepEqual(namesOf(picked).uriNames, ['二']);
    const all = renderSubscription({ entries: [{ nodes, include: [] }], clashConfig: {} });
    assert.deepEqual(namesOf(all).clashNames, ['一', '二']);
});
