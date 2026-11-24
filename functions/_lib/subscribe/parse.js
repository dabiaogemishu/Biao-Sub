import { parse as parseYaml } from 'yaml';
import { tryDecodeBase64 } from '../core/codec.js';
import { summarizeErrors } from '../core/model.js';
import { protocolOf, parseUri } from '../uri/index.js';
import { clashProxyToNode } from '../clash/convert.js';

const SCHEME_SOURCE = '(ssr|vmess|vless|trojan|hysteria2|hysteria|hy2|hy|tuic|anytls|ss):\\/\\/';

function looksLikeConfig(text) {
    return /:\/\//.test(text) || /(^|\n)\s*(proxies|Proxy)\s*:/.test(text);
}

function unwrap(text) {
    let current = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!current) return '';
    if (looksLikeConfig(current)) return current;
    const once = tryDecodeBase64(current);
    if (once && looksLikeConfig(once)) {
        const twice = tryDecodeBase64(once.trim());
        if (twice && looksLikeConfig(twice) && twice.length > once.length) return twice.trim();
        return once.trim();
    }
    return current;
}

export function splitUriList(text) {
    const links = [];
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
        const marks = [...trimmed.matchAll(new RegExp(SCHEME_SOURCE, 'gi'))];
        if (marks.length === 0) continue;
        if (marks.length === 1) {
            links.push(trimmed.slice(marks[0].index).trim());
            continue;
        }
        for (let i = 0; i < marks.length; i++) {
            const start = marks[i].index;
            const end = i + 1 < marks.length ? marks[i + 1].index : trimmed.length;
            const piece = trimmed.slice(start, end).trim();
            if (piece) links.push(piece);
        }
    }
    return links;
}

export function parseUriList(text) {
    const nodes = [];
    const errors = [];
    const seen = new Set();
    for (const link of splitUriList(text)) {
        if (seen.has(link)) continue;
        seen.add(link);
        const scheme = protocolOf(link);
        try {
            nodes.push(parseUri(link));
        } catch (error) {
            const snippet = link.length > 96 ? `${link.slice(0, 96)}…` : link;
            errors.push({ message: `${scheme || '链接'} 解析失败：${error.message}（${snippet}）` });
        }
    }
    return { nodes, errors };
}

export function parseClash(text) {
    let doc;
    try {
        doc = parseYaml(text);
    } catch (error) {
        return { nodes: [], errors: [{ message: `Clash YAML 解析失败：${error.message}` }], yamlError: true };
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        return { nodes: [], errors: [], notClash: true };
    }
    const list = doc.proxies || doc.Proxies || doc.Proxy;
    if (!Array.isArray(list)) return { nodes: [], errors: [], notClash: true };
    const nodes = [];
    const errors = [];
    list.forEach((proxy, index) => {
        const label = proxy?.name || `第 ${index + 1} 个`;
        try {
            const node = clashProxyToNode(proxy);
            if (node) nodes.push(node);
        } catch (error) {
            errors.push({ message: `${label}：${error.message}` });
        }
    });
    return { nodes, errors, notClash: false };
}

export function parseSubscription(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return { nodes: [], errors: [{ message: '内容为空' }], format: 'empty' };
    const content = unwrap(raw);
    const fromBase64 = content !== raw;
    const clash = parseClash(content);
    const uri = parseUriList(content);
    if (!clash.notClash && !clash.yamlError) {
        if (clash.nodes.length > 0) return { nodes: clash.nodes, errors: clash.errors, format: 'clash' };
        if (uri.nodes.length === 0) {
            const errors = clash.errors.length ? clash.errors : [{ message: 'Clash 配置里没有可用节点' }];
            return { nodes: [], errors, format: 'clash' };
        }
    }
    if (uri.nodes.length > 0 || uri.errors.length > 0) {
        return { nodes: uri.nodes, errors: uri.errors, format: fromBase64 ? 'base64' : 'uri' };
    }
    if (clash.yamlError) return { nodes: [], errors: clash.errors, format: 'unknown' };
    return { nodes: [], errors: [{ message: '无法识别订阅格式，需要 Clash Meta YAML、标准 Base64 节点列表或原始 URI 列表' }], format: 'unknown' };
}

export { summarizeErrors };
