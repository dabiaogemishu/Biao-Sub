import { stringify } from 'yaml';
import { encodeBase64 } from '../core/codec.js';
import { cleanObject } from '../core/model.js';
import { toUri } from '../uri/index.js';
import { nodeToClashProxy } from '../clash/convert.js';

const BUILTIN = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE']);

export function resolveFormat(format) {
    const value = String(format || '').toLowerCase();
    if (value === 'base64' || value === 'v2ray' || value === 'uri') return 'base64';
    return 'clash';
}

function filterEntry(entry) {
    const nodes = entry.nodes || [];
    if (Array.isArray(entry.include) && entry.include.length > 0) {
        const allow = new Set(entry.include);
        return nodes.filter(node => allow.has(node.name));
    }
    if (Array.isArray(entry.selectedNodes) && entry.selectedNodes.length > 0) {
        const allow = new Set(entry.selectedNodes.map(Number));
        return nodes.filter((_, index) => allow.has(index));
    }
    return nodes.slice();
}

export function selectNodes(entries) {
    const used = new Set();
    const normal = [];
    const dialer = [];
    for (const entry of entries || []) {
        const dialerName = entry.dialerProxy?.enabled && entry.dialerProxy.group ? entry.dialerProxy.group : '';
        for (const source of filterEntry(entry)) {
            const base = String(source.name || 'Node').trim() || 'Node';
            let name = base;
            let index = 1;
            while (used.has(name)) name = `${base} ${index++}`;
            used.add(name);
            const node = { ...source, name, _resourceName: entry.resourceName || '', _dialer: dialerName };
            if (dialerName) dialer.push(node);
            else normal.push(node);
        }
    }
    return [...normal, ...dialer];
}

function resourceNames(nodes) {
    const map = new Map();
    for (const node of nodes) {
        if (!node._resourceName) continue;
        if (!map.has(node._resourceName)) map.set(node._resourceName, []);
        map.get(node._resourceName).push(node.name);
    }
    return map;
}

function buildProxyGroups(nodes, clashConfig) {
    const groups = Array.isArray(clashConfig?.groups) ? clashConfig.groups : [];
    if (!groups.length) return [];
    const nodeNames = nodes.map(node => node.name);
    const nodeSet = new Set(nodeNames);
    const groupNames = new Set(groups.map(group => group.name).filter(Boolean));
    const byResource = resourceNames(nodes);
    return groups.filter(group => group && group.name).map(group => {
        let proxies;
        if (group.useAllProxies) proxies = nodeNames.slice();
        else {
            proxies = [];
            for (const item of group.proxies || []) {
                if (groupNames.has(item) && item !== group.name) proxies.push(item);
                else if (byResource.has(item)) proxies.push(...byResource.get(item));
                else if (nodeSet.has(item) || BUILTIN.has(item)) proxies.push(item);
            }
        }
        if (!proxies.length) proxies = ['DIRECT'];
        return cleanObject({
            name: group.name,
            type: group.type || 'select',
            proxies,
            url: group.url || undefined,
            interval: group.interval || undefined,
            tolerance: group.type === 'url-test' ? group.tolerance : undefined
        });
    });
}

function renderRules(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const firstContent = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
    // 用户已经给了完整的 rules: 块时原样拼上，避免再包一层。
    if (firstContent && /^rules\s*:/.test(firstContent)) return text;
    const items = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        items.push(trimmed.replace(/^-\s+/, ''));
    }
    if (!items.length) return '';
    return stringify({ rules: items }, { lineWidth: 0 }).trimEnd();
}

export function renderClash(nodes, clashConfig = {}) {
    const proxies = nodes.map(node => nodeToClashProxy(node));
    const groups = buildProxyGroups(nodes, clashConfig);
    const parts = [];
    if (clashConfig.header && String(clashConfig.header).trim()) parts.push(String(clashConfig.header).trim());
    parts.push(stringify({ proxies }, { lineWidth: 0 }).trimEnd());
    if (groups.length) parts.push(stringify({ 'proxy-groups': groups }, { lineWidth: 0 }).trimEnd());
    const rules = renderRules(clashConfig.rules);
    if (rules) parts.push(rules);
    return `${parts.join('\n\n')}\n`;
}

export function renderBase64(nodes) {
    const links = [];
    const errors = [];
    for (const node of nodes) {
        try {
            links.push(toUri(node));
        } catch (error) {
            errors.push({ message: `${node.name}：${error.message}` });
        }
    }
    return { base64: encodeBase64(links.join('\n')), links, errors };
}

export function renderSubscription({ entries, clashConfig }) {
    const nodes = selectNodes(entries);
    const clash = renderClash(nodes, clashConfig || {});
    const encoded = renderBase64(nodes);
    return { nodes, clash, base64: encoded.base64, links: encoded.links, errors: encoded.errors };
}
