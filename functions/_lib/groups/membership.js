import { parseJson } from '../core/model.js';
import { ensureUsableGenerate } from '../output/build.js';
import { normalizeProcess, validateProcess } from '../output/process.js';

export function idSetOf(ids) {
    const set = new Set();
    for (const id of ids || []) {
        set.add(Number(id));
        set.add(String(id));
    }
    return set;
}

export function alignMembership(config, clashConfig) {
    const members = (Array.isArray(config) ? config : []).filter(item => item && item.subId != null);
    const next = { ...(clashConfig && typeof clashConfig === 'object' ? clashConfig : {}) };
    next.resources = JSON.parse(JSON.stringify(members));
    return { config: members, clashConfig: next };
}

export function prepareGroupWrite(existing, body) {
    const hasConfig = body?.config !== undefined;
    const hasClash = body?.clash_config !== undefined;
    if (!hasConfig && !hasClash) {
        return {
            changed: false,
            config: parseJson(existing?.config, []),
            clashConfig: parseJson(existing?.clash_config, {})
        };
    }
    const config = hasConfig ? body.config : parseJson(existing?.config, []);
    const clashConfig = hasClash ? body.clash_config : parseJson(existing?.clash_config, {});
    const aligned = alignMembership(config, clashConfig);
    const usable = aligned.clashConfig.mode === 'raw' ? aligned.clashConfig : ensureUsableGenerate(aligned.clashConfig);
    const processError = validateProcess(usable.process);
    if (processError) return { changed: true, config: aligned.config, clashConfig: usable, error: processError };
    usable.process = normalizeProcess(usable.process);
    return { changed: true, config: aligned.config, clashConfig: usable };
}

export function stripResources(group, ids) {
    const banned = idSetOf(ids);
    const config = parseJson(group.config, []).filter(item => !banned.has(item.subId) && !banned.has(Number(item.subId)));
    const aligned = alignMembership(config, parseJson(group.clash_config, {}));
    return { ...group, config: aligned.config, clash_config: aligned.clashConfig };
}

export function planRemoteRefresh(subscription, parsed) {
    if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
        return {
            ok: false,
            error: parsed?.errors?.length ? parsed.errors.map(item => item.message).join('；') : '未能识别任何节点',
            subscription
        };
    }
    return {
        ok: true,
        subscription: {
            ...subscription,
            snapshot: subscription.url || '',
            url: parsed.links ? parsed.links.join('\n') : subscription.url,
            info: {
                ...(subscription.info || {}),
                nodeCount: parsed.nodes.length,
                format: parsed.format || ''
            }
        }
    };
}
