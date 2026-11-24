export function planRestore(payload, mode) {
    const action = mode === 'append' ? 'append' : 'overwrite';
    return {
        mode: action,
        items: Array.isArray(payload?.items) ? payload.items : [],
        groups: Array.isArray(payload?.groups) ? payload.groups : [],
        templates: Array.isArray(payload?.templates) ? payload.templates : []
    };
}

function asJson(value, fallback) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? fallback);
}

async function runBatch(db, statements) {
    const size = 40;
    for (let i = 0; i < statements.length; i += size) {
        await db.batch(statements.slice(i, i + size));
    }
}

export async function restoreBackup(db, payload, mode) {
    const plan = planRestore(payload, mode);
    const statements = [];
    if (plan.mode === 'overwrite') {
        statements.push(db.prepare('DELETE FROM subscriptions'));
        statements.push(db.prepare('DELETE FROM groups'));
        statements.push(db.prepare('DELETE FROM templates'));
    }
    const keepId = plan.mode === 'overwrite';
    for (const item of plan.items) {
        const fields = [
            item.name || '未命名资源',
            item.url || '',
            item.source_url || null,
            item.type || 'node',
            asJson(item.info, {}),
            asJson(item.params, {}),
            item.status ?? 1,
            item.sort_order ?? 0,
            item.snapshot || null
        ];
        if (keepId && item.id != null) {
            statements.push(db.prepare(
                'INSERT INTO subscriptions (id, name, url, source_url, type, info, params, status, sort_order, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(item.id, ...fields));
        } else {
            statements.push(db.prepare(
                'INSERT INTO subscriptions (name, url, source_url, type, info, params, status, sort_order, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(...fields));
        }
    }
    for (const group of plan.groups) {
        const fields = [
            group.name || '未命名聚合',
            group.token,
            asJson(group.config, []),
            asJson(group.clash_config, {}),
            group.cached_yaml || null,
            group.access_count || 0,
            group.last_accessed || null,
            group.status ?? 1,
            group.sort_order ?? 0
        ];
        if (!group.token) continue;
        if (keepId && group.id != null) {
            statements.push(db.prepare(
                'INSERT INTO groups (id, name, token, config, clash_config, cached_yaml, access_count, last_accessed, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(group.id, ...fields));
        } else {
            statements.push(db.prepare(
                'INSERT INTO groups (name, token, config, clash_config, cached_yaml, access_count, last_accessed, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(...fields));
        }
    }
    for (const template of plan.templates) {
        const fields = [
            template.name || '未命名模板',
            template.header || '',
            asJson(template.groups, []),
            template.rules || ''
        ];
        if (keepId && template.id != null) {
            statements.push(db.prepare(
                'INSERT INTO templates (id, name, header, groups, rules) VALUES (?, ?, ?, ?, ?)'
            ).bind(template.id, ...fields));
        } else {
            statements.push(db.prepare(
                'INSERT INTO templates (name, header, groups, rules) VALUES (?, ?, ?, ?)'
            ).bind(...fields));
        }
    }
    await runBatch(db, statements);
    if (plan.mode === 'overwrite') {
        for (const table of ['subscriptions', 'groups', 'templates']) {
            try {
                await db.prepare(
                    `UPDATE sqlite_sequence SET seq = IFNULL((SELECT MAX(id) FROM ${table}), 0) WHERE name = ?`
                ).bind(table).run();
            } catch { /* 新库可能还没有 sqlite_sequence */ }
        }
    }
    return plan;
}
