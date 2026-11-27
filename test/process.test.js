import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { parseUri } from '../functions/_lib/uri/index.js';
import { renderSubscription, resolveFormat } from '../functions/_lib/output/build.js';
import {
    applyProcess, compileRegex, detectRegion, normalizeProcess, processLabels,
    uniquifyNames, validateProcess
} from '../functions/_lib/output/process.js';

const UUID = 'b831381d-6324-4d53-ad4f-8cda48b30811';

function node(name, server = '1.1.1.1', type = 'vless') {
    if (type === 'ss') {
        return {
            name,
            type: 'ss',
            server,
            port: 8388,
            cipher: 'aes-256-gcm',
            password: 'secret'
        };
    }
    return parseUri(`vless://${UUID}@${server}:443?encryption=none&security=tls&type=tcp&sni=example.com#${encodeURIComponent(name)}`);
}

test('空处理配置保持原顺序和名称', () => {
    const nodes = [node('香港'), node('日本', '2.2.2.2')];
    const result = applyProcess(nodes, undefined);
    assert.deepEqual(result.map(item => item.name), ['香港', '日本']);
    assert.equal(validateProcess(undefined), '');
    assert.deepEqual(processLabels({}), []);
});

test('保留、排除、协议筛选和说明节点过滤', () => {
    const nodes = [
        node('香港 01'),
        node('日本 01', '2.2.2.2'),
        node('剩余流量 100G', '3.3.3.3'),
        { ...node('美国 SS', '4.4.4.4'), type: 'ss', password: 'secret', cipher: 'aes-256-gcm', uuid: '' }
    ];
    const dropped = applyProcess(nodes, { dropUseless: true });
    assert.deepEqual(dropped.map(item => item.name), ['香港 01', '日本 01', '美国 SS']);

    const included = applyProcess(nodes, { include: '香港|美国' });
    assert.deepEqual(included.map(item => item.name), ['香港 01', '美国 SS']);

    const excluded = applyProcess(nodes, { exclude: '(?i)日本' });
    assert.ok(!excluded.some(item => item.name.includes('日本')));

    const protocols = applyProcess(nodes, { protocols: ['ss'] });
    assert.deepEqual(protocols.map(item => item.name), ['美国 SS']);
});

test('按服务器去重，保留先出现的节点', () => {
    const nodes = [
        node('香港 A', '1.1.1.1'),
        node('香港 B', '1.1.1.1'),
        node('日本', '2.2.2.2')
    ];
    const result = applyProcess(nodes, { dedup: true });
    assert.deepEqual(result.map(item => item.name), ['香港 A', '日本']);
});

test('重命名、地区旗帜、协议前缀和排序', () => {
    const nodes = [
        node('日本专线', '2.2.2.2'),
        node('香港专线', '1.1.1.1')
    ];
    const result = applyProcess(nodes, {
        sort: 'name',
        rename: {
            prefix: '家宽-',
            appendType: true,
            emoji: true,
            rules: [{ pattern: '专线', replacement: '' }]
        }
    });
    assert.deepEqual(result.map(item => item.name), ['🇭🇰 [VLESS] 家宽-香港', '🇯🇵 [VLESS] 家宽-日本']);
    assert.equal(detectRegion('US-01'), '🇺🇸');
});

test('非法正则在保存时被拒绝，输出时被忽略', () => {
    assert.equal(validateProcess({ include: '(' }), '保留筛选的正则无效');
    assert.match(validateProcess({ rename: { rules: [{ pattern: '[', replacement: '' }] } }), /重命名正则无效/);
    const kept = applyProcess([node('香港')], { include: '(' });
    assert.equal(kept.length, 1);
    assert.equal(compileRegex('(?i)hk').regex.flags, 'i');
});

test('重名在处理后再次去重编号', () => {
    const names = uniquifyNames([{ name: '香港' }, { name: '香港' }]).map(item => item.name);
    assert.deepEqual(names, ['香港', '香港 1']);
});

test('normalizeProcess 会整理空值和别名', () => {
    const process = normalizeProcess({
        protocols: ['Shadowsocks', 'hy2', ''],
        sort: 'weird',
        rename: { rules: [{ pattern: '  ', replacement: 'x' }, { pattern: 'A', replacement: 'B' }] }
    });
    assert.deepEqual(process.protocols, ['ss', 'hysteria2']);
    assert.equal(process.sort, 'none');
    assert.deepEqual(process.rename.rules, [{ pattern: 'A', replacement: 'B' }]);
});

test('处理结果同时出现在 Clash、Base64、sing-box 和节点列表里', () => {
    assert.equal(resolveFormat('sing-box'), 'singbox');
    assert.equal(resolveFormat('provider'), 'list');
    const built = renderSubscription({
        entries: [{
            nodes: [
                node('香港 01'),
                node('日本 01', '8.8.8.8'),
                node('剩余流量', '9.9.9.9')
            ],
            resourceName: '甲'
        }],
        clashConfig: {
            groups: [{ name: 'Proxy', type: 'select', useAllProxies: true }],
            rules: 'MATCH,Proxy',
            process: { include: '香港|日本', dropUseless: true, rename: { emoji: true } }
        }
    });
    const clashNames = parseYaml(built.clash).proxies.map(proxy => proxy.name);
    assert.deepEqual(clashNames, ['🇭🇰 香港 01', '🇯🇵 日本 01']);
    assert.deepEqual(parseYaml(built.list).proxies.map(proxy => proxy.name), clashNames);
    const singbox = JSON.parse(built.singbox);
    assert.deepEqual(singbox.outbounds.map(item => item.tag), clashNames);
    assert.equal(singbox.outbounds[0].type, 'vless');
    assert.equal(built.clash.includes('proxy-groups'), true);
    assert.equal(built.list.includes('proxy-groups'), false);
});
