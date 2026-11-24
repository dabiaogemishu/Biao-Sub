import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { encodeBase64, decodeBase64 } from '../functions/_lib/core/codec.js';
import { parseUri } from '../functions/_lib/uri/index.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';
import { renderClash, renderSubscription, resolveFormat } from '../functions/_lib/output/build.js';

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

test('只给序号时也筛选，空 include 表示全选', () => {
    const nodes = [node('一'), node('二', '8.8.8.8')];
    const picked = renderSubscription({ entries: [{ nodes, selectedNodes: [1] }], clashConfig: {} });
    assert.deepEqual(namesOf(picked).clashNames, ['二']);
    assert.deepEqual(namesOf(picked).uriNames, ['二']);
    const all = renderSubscription({ entries: [{ nodes, include: [] }], clashConfig: {} });
    assert.deepEqual(namesOf(all).clashNames, ['一', '二']);
});
