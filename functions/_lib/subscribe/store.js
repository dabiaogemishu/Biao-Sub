import { summarizeErrors } from '../core/model.js';
import { toUri } from '../uri/index.js';
import { parseSubscription } from './parse.js';

export function joinSubscriptionText(...parts) {
    return parts.map(part => String(part || '').trim()).filter(Boolean).join('\n');
}

export function canonicalize(text, names) {
    const parsed = parseSubscription(text);
    if (!parsed.nodes.length) {
        return { ok: false, error: summarizeErrors(parsed.errors), parsed, warnings: parsed.errors };
    }
    if (Array.isArray(names) && names.length === parsed.nodes.length) {
        parsed.nodes.forEach((node, index) => {
            if (names[index]) node.name = String(names[index]);
        });
    }
    try {
        const links = parsed.nodes.map(node => toUri(node));
        return { ok: true, parsed, links, url: links.join('\n'), warnings: parsed.errors };
    } catch (error) {
        return { ok: false, error: '节点无法导出', parsed, warnings: parsed.errors };
    }
}
