import { parseJson } from '../core/model.js';
import { stripResources } from './membership.js';
import { rebuildCachesFor } from '../output/render.js';

export async function detachResources(db, ids) {
    const { results } = await db.prepare('SELECT id, config, clash_config FROM groups').all();
    for (const row of results || []) {
        const next = stripResources(row, ids);
        const sameConfig = JSON.stringify(parseJson(row.config, [])) === JSON.stringify(next.config);
        const previous = parseJson(row.clash_config, {});
        const sameResources = JSON.stringify(previous.resources || []) === JSON.stringify(next.clash_config.resources || []);
        if (sameConfig && sameResources) continue;
        await db.prepare('UPDATE groups SET config = ?, clash_config = ? WHERE id = ?')
            .bind(JSON.stringify(next.config), JSON.stringify(next.clash_config), row.id)
            .run();
    }
    await rebuildCachesFor(db);
}
