import { parseSs, generateSs } from './ss.js';
import { parseSsr, generateSsr } from './ssr.js';
import { parseVmess, generateVmess } from './vmess.js';
import { parseVless, generateVless } from './vless.js';
import { parseTrojan, generateTrojan } from './trojan.js';
import { parseHysteria, parseHysteria2, generateHysteria, generateHysteria2 } from './hysteria.js';
import { parseTuic, generateTuic } from './tuic.js';
import { parseAnytls, generateAnytls } from './anytls.js';

const PARSERS = [
    ['ssr', parseSsr],
    ['vmess', parseVmess],
    ['vless', parseVless],
    ['trojan', parseTrojan],
    ['hysteria2', parseHysteria2],
    ['hy2', parseHysteria2],
    ['hy', parseHysteria2],
    ['hysteria', parseHysteria],
    ['tuic', parseTuic],
    ['anytls', parseAnytls],
    ['ss', parseSs]
];

const GENERATORS = {
    ss: generateSs,
    ssr: generateSsr,
    vmess: generateVmess,
    vless: generateVless,
    trojan: generateTrojan,
    hysteria2: generateHysteria2,
    hysteria: generateHysteria,
    tuic: generateTuic,
    anytls: generateAnytls
};

export function protocolOf(uri) {
    const match = String(uri || '').trim().toLowerCase().match(/^(ssr|vmess|vless|trojan|hysteria2|hysteria|hy2|hy|tuic|anytls|ss):\/\//);
    return match ? match[1] : '';
}

export function parseUri(uri) {
    const text = String(uri || '').trim();
    const scheme = protocolOf(text);
    if (!scheme) throw new Error('无法识别的协议链接');
    const found = PARSERS.find(([name]) => name === scheme);
    if (!found) throw new Error(`不支持的协议 ${scheme}`);
    return found[1](text);
}

export function toUri(node) {
    const generate = GENERATORS[node?.type];
    if (!generate) throw new Error(`无法生成 ${node?.type || '未知'} 链接`);
    return generate(node);
}

export function toPublicNode(node) {
    let link = '';
    try { link = toUri(node); } catch { link = ''; }
    return {
        name: node.name,
        type: node.type,
        protocol: node.type,
        server: node.server,
        port: node.port,
        network: node.network,
        security: node.security,
        link
    };
}
