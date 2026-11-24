import { parseJson } from '../core/model.js';
import { parseSubscription } from '../subscribe/parse.js';
import { renderSubscription } from './build.js';

function entriesFrom(group, subsById) {
    const clashConfig = group.clash_config || {};
    const items = Array.isArray(clashConfig.resources) && clashConfig.resources.length
        ? clashConfig.resources
        : (group.config || []);
    const entries = [];
    for (const item of items) {
        const sub = subsById.get(Number(item.subId));
        if (!sub || !sub.url) continue;
        const parsed = parseSubscription(sub.url);
        entries.push({
            nodes: parsed.nodes,
            include: item.include,
            selectedNodes: item.include?.length ? undefined : item.selectedNodes,
            dialerProxy: item.dialerProxy,
            resourceName: sub.name || ''
        });
    }
    return { entries, clashConfig };
}

export function buildGroupFromRows(group, subs) {
    const clashConfig = parseJson(group.clash_config, {});
    const config = parseJson(group.config, []);
    if (clashConfig.mode === 'raw') {
        const raw = clashConfig.raw_yaml || '';
        const parsed = parseSubscription(raw);
        const built = renderSubscription({ entries: [{ nodes: parsed.nodes }], clashConfig });
        return { clash: raw, base64: built.base64, nodes: built.nodes, links: built.links, errors: parsed.errors };
    }
    const map = new Map((subs || []).map(sub => [Number(sub.id), sub]));
    return renderSubscription(entriesFrom({ config, clash_config: clashConfig }, map));
}

export async function buildGroupOutput(db, group) {
    const clashConfig = parseJson(group.clash_config, {});
    const config = parseJson(group.config, []);
    if (clashConfig.mode === 'raw') return buildGroupFromRows({ config, clash_config: clashConfig }, []);
    const items = Array.isArray(clashConfig.resources) && clashConfig.resources.length ? clashConfig.resources : config;
    const ids = [...new Set(items.map(item => Number(item.subId)).filter(id => Number.isInteger(id)))];
    if (!ids.length) return renderSubscription({ entries: [], clashConfig });
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await db.prepare(
        `SELECT id, name, url FROM subscriptions WHERE id IN (${placeholders})`
    ).bind(...ids).all();
    return buildGroupFromRows({ config, clash_config: clashConfig }, results || []);
}

export async function rebuildCachesFor(db, resourceIds) {
    const wanted = new Set((resourceIds || []).map(id => String(id)));
    const { results } = await db.prepare('SELECT id, config, clash_config FROM groups WHERE status = 1').all();
    for (const row of results || []) {
        const config = parseJson(row.config, []);
        const clashConfig = parseJson(row.clash_config, {});
        const resources = clashConfig.resources || [];
        const used = !wanted.size
            || config.some(item => wanted.has(String(item.subId)))
            || resources.some(item => wanted.has(String(item.subId)));
        if (!used) continue;
        const built = await buildGroupOutput(db, row);
        await db.prepare('UPDATE groups SET cached_yaml = ? WHERE id = ?').bind(built.clash || '', row.id).run();
    }
}
