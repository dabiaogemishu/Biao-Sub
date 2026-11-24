import { parseJson } from '../core/model.js';
import { parseSubscription } from '../subscribe/parse.js';
import { chainRejection, policyGroupNames, renderHostedSubscription, renderSubscription, selectNodes } from './build.js';

export function entriesFrom(group, subsById) {
    const clashConfig = group.clash_config || {};
    const items = Array.isArray(group.config) ? group.config : [];
    const entries = [];
    for (const item of items) {
        if (!item || item.subId == null) continue;
        const sub = subsById.get(Number(item.subId));
        if (!sub || !sub.url) continue;
        const parsed = parseSubscription(sub.url);
        entries.push({
            subId: Number(item.subId),
            nodes: parsed.nodes,
            include: item.include,
            selectedNodes: item.include?.length ? undefined : item.selectedNodes,
            dialerProxy: item.dialerProxy,
            resourceName: sub.name || ''
        });
    }
    return { entries, clashConfig };
}

export async function chainProblem(db, config, clashConfig) {
    const items = Array.isArray(config) ? config : [];
    if (!items.some(item => item?.dialerProxy?.enabled)) return '';
    const ids = [...new Set(items.map(item => Number(item.subId)).filter(id => Number.isInteger(id)))];
    let subs = [];
    if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await db.prepare(
            `SELECT id, name, url FROM subscriptions WHERE id IN (${placeholders})`
        ).bind(...ids).all();
        subs = results || [];
    }
    const map = new Map(subs.map(sub => [Number(sub.id), sub]));
    const { entries } = entriesFrom({ config: items, clash_config: clashConfig || {} }, map);
    return chainRejection(entries, policyGroupNames(clashConfig || {}));
}

export function buildGroupFromRows(group, subs) {
    const clashConfig = parseJson(group.clash_config, {});
    const config = parseJson(group.config, []);
    const map = new Map((subs || []).map(sub => [Number(sub.id), sub]));
    const { entries } = entriesFrom({ config, clash_config: clashConfig }, map);
    if (clashConfig.mode === 'raw') return renderHostedSubscription(clashConfig.raw_yaml || '', selectNodes(entries));
    return renderSubscription({ entries, clashConfig });
}

async function loadMemberSubs(db, config) {
    const ids = [...new Set((Array.isArray(config) ? config : []).map(item => Number(item?.subId)).filter(id => Number.isInteger(id)))];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await db.prepare(
        `SELECT id, name, url FROM subscriptions WHERE id IN (${placeholders})`
    ).bind(...ids).all();
    return results || [];
}

export async function buildGroupOutput(db, group) {
    const clashConfig = parseJson(group.clash_config, {});
    const config = parseJson(group.config, []);
    const subs = await loadMemberSubs(db, config);
    return buildGroupFromRows({ config, clash_config: clashConfig }, subs);
}

export async function rebuildCachesFor(db, resourceIds) {
    const wanted = new Set((resourceIds || []).map(id => String(id)));
    const { results } = await db.prepare('SELECT id, config, clash_config FROM groups WHERE status = 1').all();
    for (const row of results || []) {
        const config = parseJson(row.config, []);
        const used = !wanted.size || config.some(item => wanted.has(String(item.subId)));
        if (!used) continue;
        const built = await buildGroupOutput(db, row);
        await db.prepare('UPDATE groups SET cached_yaml = ? WHERE id = ?').bind(built.clash || '', row.id).run();
    }
}
