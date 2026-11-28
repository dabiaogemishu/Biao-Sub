import { parse as parseYaml } from 'yaml';

export const MAX_YAML_BYTES = 2 * 1024 * 1024;
export const MAX_YAML_DEPTH = 64;
export const YAML_PARSE_OPTIONS = { maxAliasCount: 100 };

export class YamlLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'YamlLimitError';
    }
}

function byteLength(text) {
    return new TextEncoder().encode(String(text || '')).length;
}

export function assertYamlDepth(value, max = MAX_YAML_DEPTH, depth = 0) {
    if (depth > max) throw new YamlLimitError('YAML 嵌套过深');
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        for (const item of value) assertYamlDepth(item, max, depth + 1);
        return value;
    }
    for (const item of Object.values(value)) assertYamlDepth(item, max, depth + 1);
    return value;
}

export function parseSafeYaml(text) {
    const raw = String(text ?? '');
    if (byteLength(raw) > MAX_YAML_BYTES) throw new YamlLimitError('YAML 内容过大');
    const doc = parseYaml(raw, YAML_PARSE_OPTIONS);
    return assertYamlDepth(doc);
}
