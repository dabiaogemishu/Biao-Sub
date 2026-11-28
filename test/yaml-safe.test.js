import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_YAML_BYTES, MAX_YAML_DEPTH, YamlLimitError, parseSafeYaml } from '../functions/_lib/core/yaml.js';
import { parseSubscription } from '../functions/_lib/subscribe/parse.js';

test('正常 Clash YAML 仍可解析', () => {
    const doc = parseSafeYaml('proxies:\n  - {name: a, type: ss, server: 1.2.3.4, port: 8388, cipher: aes-128-gcm, password: x}\n');
    assert.equal(doc.proxies[0].name, 'a');
});

test('超大或嵌套过深的 YAML 会被拒绝，且不把解析细节带出去', () => {
    const big = `x: ${'a'.repeat(MAX_YAML_BYTES + 10)}`;
    assert.throws(() => parseSafeYaml(big), YamlLimitError);

    const deep = `${'['.repeat(MAX_YAML_DEPTH + 8)}${']'.repeat(MAX_YAML_DEPTH + 8)}`;
    assert.throws(() => parseSafeYaml(deep), /YAML 嵌套过深|YAMLParseError|Maximum/);

    const parsed = parseSubscription(`${'['.repeat(MAX_YAML_DEPTH + 8)}${']'.repeat(MAX_YAML_DEPTH + 8)}`);
    assert.equal(parsed.nodes.length, 0);
    for (const error of parsed.errors) {
        assert.equal(/RangeError|call stack|at parseSafeYaml|yaml\/dist/i.test(error.message), false);
        assert.match(error.message, /Clash YAML 解析失败|无法识别/);
    }
});
