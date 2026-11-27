import { nodeViews } from '../preview/view.js';
import { parseSs, generateSs } from './ss.js';
import { parseSsr, generateSsr } from './ssr.js';
import { parseVmess, generateVmess } from './vmess.js';
import { parseVless, generateVless } from './vless.js';
import { parseTrojan, generateTrojan } from './trojan.js';
import { parseHysteria, parseHysteria2, generateHysteria, generateHysteria2 } from './hysteria.js';
import { parseTuic, generateTuic } from './tuic.js';
import { parseAnytls, generateAnytls } from './anytls.js';
import { parseWireguard, generateWireguard } from './wireguard.js';
import {
    parseSocks, generateSocks,
    parseHttpProxy, generateHttpProxy,
    parseSsh, generateSsh,
    parseSnell, generateSnell,
    parseShadowtls, generateShadowtls,
    parseNaive, generateNaive
} from './plain.js';

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
    ['wireguard', parseWireguard],
    ['wg', parseWireguard],
    ['shadowtls', parseShadowtls],
    ['snell', parseSnell],
    ['socks5', parseSocks],
    ['socks4a', parseSocks],
    ['socks4', parseSocks],
    ['socks', parseSocks],
    ['ssh', parseSsh],
    ['naive', parseNaive],
    ['https', parseHttpProxy],
    ['http', parseHttpProxy],
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
    anytls: generateAnytls,
    wireguard: generateWireguard,
    socks: generateSocks,
    http: generateHttpProxy,
    ssh: generateSsh,
    snell: generateSnell,
    shadowtls: generateShadowtls,
    naive: generateNaive
};

const URI_SCHEME_TOKENS = [
    'naive+https', 'naive+quic',
    'ssr', 'vmess', 'vless', 'trojan',
    'hysteria2', 'hysteria', 'hy2', 'hy',
    'tuic', 'anytls',
    'wireguard', 'wg', 'shadowtls', 'snell',
    'socks5', 'socks4a', 'socks4', 'socks',
    'ssh', 'https', 'http', 'ss'
];

export const URI_SCHEME_SOURCE = `(${URI_SCHEME_TOKENS.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;

export function protocolOf(uri) {
    const text = String(uri || '').trim().toLowerCase();
    const match = text.match(new RegExp(`^${URI_SCHEME_SOURCE}://`));
    if (!match) return '';
    if (match[1] === 'naive+https' || match[1] === 'naive+quic') return 'naive';
    return match[1];
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
    const views = nodeViews(node);
    return {
        name: node.name,
        type: node.type,
        protocol: node.type,
        server: node.server,
        port: node.port,
        network: node.network,
        security: node.security,
        link,
        yaml: views.yaml,
        yamlLabel: views.yamlLabel,
        json: views.json,
        jsonLabel: views.jsonLabel,
        note: views.note
    };
}
