import { parse as parseYaml, stringify } from 'yaml';
import { encodeBase64 } from '../core/codec.js';
import { cleanObject } from '../core/model.js';
import { toUri } from '../uri/index.js';
import { clashProxyToNode, nodeToClashProxy } from '../clash/convert.js';

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
    const ordered = [];
    for (const entry of entries || []) {
        const dialerName = entry.dialerProxy?.enabled && entry.dialerProxy.group ? String(entry.dialerProxy.group).trim() : '';
        for (const source of filterEntry(entry)) {
            const base = String(source.name || 'Node').trim() || 'Node';
            let name = base;
            let index = 1;
            while (used.has(name)) name = `${base} ${index++}`;
            used.add(name);
            ordered.push({
                ...source,
                name,
                _resourceName: entry.resourceName || '',
                _subId: entry.subId,
                _dialer: dialerName
            });
        }
    }
    return ordered;
}

export function chainRejection(entries, groupNames) {
    const nodes = selectNodes(entries);
    const knownNodes = new Set(nodes.map(node => node.name));
    const knownGroups = new Set((groupNames || []).filter(Boolean).map(name => String(name)));
    for (const entry of entries || []) {
        if (!entry?.dialerProxy?.enabled) continue;
        const target = String(entry.dialerProxy.group || '').trim();
        if (!target) return '请选择链式代理目标';
        const own = new Set(nodes.filter(node => node._subId === entry.subId).map(node => node.name));
        if (own.has(target)) return '链式代理不能指向自身';
        if (!knownGroups.has(target) && !knownNodes.has(target)) return `链式代理目标不存在：${target}`;
    }
    return '';
}

export function policyGroupNames(clashConfig = {}) {
    const names = [];
    for (const group of clashConfig.groups || []) {
        if (group?.name) names.push(String(group.name));
    }
    if (clashConfig.mode === 'raw' && clashConfig.raw_yaml) {
        try {
            const doc = parseYaml(String(clashConfig.raw_yaml));
            for (const group of doc?.['proxy-groups'] || []) {
                if (group?.name) names.push(String(group.name));
            }
        } catch {
            // 非法托管 YAML 由渲染阶段报告，这里只收集能认出的策略组。
        }
    }
    return [...new Set(names)];
}

export function ensureUsableGenerate(clashConfig = {}) {
    if (clashConfig.mode === 'raw') return clashConfig;
    const groups = Array.isArray(clashConfig.groups) ? clashConfig.groups : [];
    const named = groups.filter(group => group && group.name);
    const rules = String(clashConfig.rules || '').trim();
    if (named.length || rules) return clashConfig;
    return {
        ...clashConfig,
        mode: clashConfig.mode || 'generate',
        groups: [{ name: 'Proxy', type: 'select', proxies: [], useAllProxies: true }],
        rules: 'MATCH,Proxy'
    };
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

function explicitProxies(group) {
    if (!Array.isArray(group?.proxies)) return [];
    return group.proxies.map(item => String(item ?? '').trim()).filter(Boolean);
}

function buildProxyGroups(nodes, clashConfig) {
    const groups = Array.isArray(clashConfig?.groups) ? clashConfig.groups : [];
    if (!groups.length) return [];
    const nodeNames = nodes.map(node => node.name);
    const nodeSet = new Set(nodeNames);
    const groupNames = new Set(groups.map(group => group.name).filter(Boolean));
    const byResource = resourceNames(nodes);
    return groups.filter(group => group && group.name).map(group => {
        const explicit = explicitProxies(group);
        let proxies;
        // 默认模板的 Proxy 组不填写节点。空列表表示放进本次选出的节点，避免策略组只剩 DIRECT。
        if (group.useAllProxies || explicit.length === 0) {
            proxies = nodeNames.length ? nodeNames.slice() : ['DIRECT'];
        } else {
            proxies = [];
            for (const item of explicit) {
                if (groupNames.has(item) && item !== group.name) proxies.push(item);
                else if (byResource.has(item)) proxies.push(...byResource.get(item));
                else if (nodeSet.has(item) || BUILTIN.has(item)) proxies.push(item);
            }
            if (!proxies.length) proxies = ['DIRECT'];
        }
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
    const usable = ensureUsableGenerate(clashConfig || {});
    const clash = renderClash(nodes, usable);
    const encoded = renderBase64(nodes);
    return { nodes, clash, base64: encoded.base64, links: encoded.links, errors: encoded.errors };
}

const USE_ALL_KEYS = ['useAllProxies', 'use-all-proxies', 'include-all', 'include-all-proxies'];

function groupUsesAll(group) {
    return USE_ALL_KEYS.some(key => group?.[key] === true || group?.[key] === 'true');
}

function listedGroupProxies(group) {
    if (!Array.isArray(group?.proxies)) return [];
    return group.proxies.map(item => String(item ?? '').trim()).filter(Boolean);
}

function fillHostedGroup(group, nodeNames) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) return group;
    const explicit = listedGroupProxies(group);
    if (!groupUsesAll(group) && explicit.length) return group;
    const next = { ...group };
    for (const key of USE_ALL_KEYS) delete next[key];
    next.proxies = nodeNames.length ? nodeNames.slice() : ['DIRECT'];
    return next;
}

function mergeHostedProxies(uploaded, selected) {
    const selectedByName = new Map(selected.map(proxy => [proxy.name, proxy]));
    const merged = [];
    const seen = new Set();
    for (const proxy of uploaded) {
        const name = proxy && proxy.name != null ? String(proxy.name) : '';
        if (name && seen.has(name)) continue;
        if (name && selectedByName.has(name)) merged.push(selectedByName.get(name));
        else merged.push(proxy);
        if (name) seen.add(name);
    }
    for (const proxy of selected) {
        if (seen.has(proxy.name)) continue;
        merged.push(proxy);
        seen.add(proxy.name);
    }
    return merged;
}

export function renderHostedSubscription(rawYaml, nodes) {
    const raw = String(rawYaml || '');
    const selected = (nodes || []).map(node => nodeToClashProxy(node));
    let doc;
    try {
        doc = raw.trim() ? parseYaml(raw) : {};
    } catch (error) {
        const encoded = renderBase64(nodes || []);
        return {
            nodes: nodes || [],
            clash: raw,
            base64: encoded.base64,
            links: encoded.links,
            errors: [{ message: `托管 YAML 无法解析：${error.message}` }, ...encoded.errors]
        };
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        const encoded = renderBase64(nodes || []);
        return {
            nodes: nodes || [],
            clash: raw,
            base64: encoded.base64,
            links: encoded.links,
            errors: [{ message: '托管 YAML 不是配置对象' }, ...encoded.errors]
        };
    }
    const uploaded = Array.isArray(doc.proxies) ? doc.proxies : [];
    doc.proxies = mergeHostedProxies(uploaded, selected);
    if (Array.isArray(doc['proxy-groups'])) {
        const names = (nodes || []).map(node => node.name);
        doc['proxy-groups'] = doc['proxy-groups'].map(group => fillHostedGroup(group, names));
    }
    const outputNodes = [];
    const errors = [];
    for (const proxy of doc.proxies) {
        try {
            const node = clashProxyToNode(proxy);
            if (node) outputNodes.push(node);
        } catch (error) {
            errors.push({ message: `${proxy?.name || '代理'}：${error.message}` });
        }
    }
    const encoded = renderBase64(outputNodes);
    return {
        nodes: outputNodes,
        clash: stringify(doc, { lineWidth: 0 }),
        base64: encoded.base64,
        links: encoded.links,
        errors: [...errors, ...encoded.errors]
    };
}
