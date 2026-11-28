import { parseSafeYaml } from '../core/yaml.js';
import { shareUrl, tryDecodeBase64 } from '../core/codec.js';
import { summarizeErrors } from '../core/model.js';
import { protocolOf, parseUri, URI_SCHEME_SOURCE } from '../uri/index.js';
import { clashProxyToNode } from '../clash/convert.js';

const SCHEME_SOURCE = `${URI_SCHEME_SOURCE}://`;

function looksLikeLink(text) {
    return /https?:\/\/|[a-z][a-z0-9+.-]*:\/\//i.test(String(text || ''));
}

function safeNodeError(label, error, fallback) {
    const message = String(error?.message || '').trim();
    if (message && !looksLikeLink(message) && message.length <= 160) {
        return `${label}：${message}`;
    }
    return `${label} ${fallback}`;
}


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

// 节点名里常有官网地址。# 后面的 http(s) 若不像代理节点，就留在名称里，不拆成第二条链接。
function isWebsiteInName(line, uriStart, nextStart, schemeMatch) {
    const hash = line.indexOf('#', uriStart);
    if (hash < 0 || nextStart <= hash) return false;
    const scheme = String(schemeMatch || '').replace(/:\/\/$/, '').toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return false;
    const url = shareUrl(line.slice(nextStart));
    if (!url) return true;
    if (url.pathname) return true;
    if (!url.port && !url.username) return true;
    return false;
}

export function splitUriList(text) {
    const links = [];
    const lines = String(text || '').split(/\r?\n/);
    const schemeRe = new RegExp(SCHEME_SOURCE, 'gi');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
        const marks = [...trimmed.matchAll(schemeRe)];
        if (marks.length === 0) continue;
        if (marks.length === 1) {
            links.push(trimmed.slice(marks[0].index).trim());
            continue;
        }
        const starts = [];
        for (const mark of marks) {
            const prev = starts.length ? starts[starts.length - 1] : mark.index;
            if (starts.length && isWebsiteInName(trimmed, prev, mark.index, mark[0])) continue;
            starts.push(mark.index);
        }
        for (let i = 0; i < starts.length; i++) {
            const start = starts[i];
            const end = i + 1 < starts.length ? starts[i + 1] : trimmed.length;
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
            errors.push({ message: safeNodeError(scheme || '链接', error, '解析失败') });
        }
    }
    return { nodes, errors };
}

export function parseClash(text) {
    let doc;
    try {
        doc = parseSafeYaml(text);
    } catch {
        return { nodes: [], errors: [{ message: 'Clash YAML 解析失败' }], yamlError: true };
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
            errors.push({ message: safeNodeError(label, error, '无法识别') });
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
