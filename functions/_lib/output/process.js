export const PROTOCOL_OPTIONS = [
    { value: 'ss', label: 'Shadowsocks' },
    { value: 'ssr', label: 'ShadowsocksR' },
    { value: 'vmess', label: 'VMess' },
    { value: 'vless', label: 'VLESS' },
    { value: 'trojan', label: 'Trojan' },
    { value: 'hysteria2', label: 'Hysteria2' },
    { value: 'hysteria', label: 'Hysteria' },
    { value: 'tuic', label: 'TUIC' },
    { value: 'anytls', label: 'AnyTLS' },
    { value: 'wireguard', label: 'WireGuard' },
    { value: 'socks', label: 'SOCKS' },
    { value: 'http', label: 'HTTP' },
    { value: 'snell', label: 'Snell' },
    { value: 'ssh', label: 'SSH' },
    { value: 'shadowtls', label: 'ShadowTLS' },
    { value: 'naive', label: 'NaiveProxy' }
];

const PROTOCOL_ALIASES = {
    ss: 'ss',
    shadowsocks: 'ss',
    ssr: 'ssr',
    shadowsocksr: 'ssr',
    vmess: 'vmess',
    vless: 'vless',
    trojan: 'trojan',
    hysteria2: 'hysteria2',
    hy2: 'hysteria2',
    hysteria: 'hysteria',
    tuic: 'tuic',
    anytls: 'anytls',
    wireguard: 'wireguard',
    wg: 'wireguard',
    socks: 'socks',
    socks5: 'socks',
    socks4: 'socks',
    http: 'http',
    https: 'http',
    snell: 'snell',
    ssh: 'ssh',
    shadowtls: 'shadowtls',
    naive: 'naive',
    naiveproxy: 'naive'
};

const TYPE_LABELS = {
    ss: 'SS',
    ssr: 'SSR',
    vmess: 'VMESS',
    vless: 'VLESS',
    trojan: 'TROJAN',
    hysteria2: 'HY2',
    hysteria: 'HYSTERIA',
    tuic: 'TUIC',
    anytls: 'ANYTLS',
    wireguard: 'WG',
    socks: 'SOCKS',
    http: 'HTTP',
    snell: 'SNELL',
    ssh: 'SSH',
    shadowtls: 'SHADOWTLS',
    naive: 'NAIVE'
};

const USELESS_RE = /流量|带宽|bandwidth|expire|过期|到期|剩余|官网|网址|套餐|重置|应急/i;

const REGIONS = [
    { flag: '🇭🇰', tests: [/香港/, /\bHKG?\b/i, /hong\s*kong/i] },
    { flag: '🇹🇼', tests: [/台湾|台灣/, /\bTWN?\b/i, /taiwan/i] },
    { flag: '🇲🇴', tests: [/澳门|澳門/, /\bMO\b|\bMAC\b/i, /macao|macau/i] },
    { flag: '🇸🇬', tests: [/新加坡|狮城/, /\bSGP?\b/i, /singapore/i] },
    { flag: '🇯🇵', tests: [/日本/, /\bJPN?\b/i, /japan|tokyo|osaka/i] },
    { flag: '🇰🇷', tests: [/韩国|韓國/, /\bKOR?\b/i, /korea|seoul/i] },
    { flag: '🇺🇸', tests: [/美国|美國/, /\bUSA\b|\bUS\b/i, /united\s*states|\bamerica\b|los\s*angeles|san\s*jose|seattle|chicago|miami|dallas/i] },
    { flag: '🇬🇧', tests: [/英国|英國/, /\bUK\b|\bGB\b|\bGBR\b/i, /united\s*kingdom|london|britain|england/i] },
    { flag: '🇩🇪', tests: [/德国|德國/, /\bDEU?\b/i, /germany|frankfurt|berlin/i] },
    { flag: '🇫🇷', tests: [/法国|法國/, /\bFRA?\b/i, /france|paris/i] },
    { flag: '🇨🇦', tests: [/加拿大/, /\bCAN?\b/i, /canada|toronto|vancouver/i] },
    { flag: '🇦🇺', tests: [/澳大利亚|澳洲/, /\bAUS?\b/i, /australia|sydney|melbourne/i] },
    { flag: '🇷🇺', tests: [/俄罗斯|俄羅斯/, /\bRUS?\b/i, /russia|moscow/i] },
    { flag: '🇮🇳', tests: [/印度/, /\bIND\b/i, /india|mumbai/i] },
    { flag: '🇹🇷', tests: [/土耳其/, /\bTUR?\b/i, /turkey|istanbul/i] },
    { flag: '🇳🇱', tests: [/荷兰|荷蘭/, /\bNLD?\b|\bNL\b/i, /netherlands|amsterdam/i] },
    { flag: '🇮🇹', tests: [/意大利|義大利/, /\bITA?\b/i, /italy|milan|rome/i] },
    { flag: '🇧🇷', tests: [/巴西/, /\bBRA?\b/i, /brazil|sao\s*paulo/i] },
    { flag: '🇦🇷', tests: [/阿根廷/, /\bARG?\b/i, /argentina/i] },
    { flag: '🇹🇭', tests: [/泰国|泰國/, /\bTHA?\b/i, /thailand|bangkok/i] },
    { flag: '🇻🇳', tests: [/越南/, /\bVNM?\b|\bVN\b/i, /vietnam/i] },
    { flag: '🇲🇾', tests: [/马来|馬來/, /\bMYS?\b|\bMY\b/i, /malaysia/i] },
    { flag: '🇵🇭', tests: [/菲律宾|菲律賓/, /\bPHL?\b|\bPH\b/i, /philippines/i] },
    { flag: '🇮🇩', tests: [/印尼|印度尼西亚/, /\bIDN?\b/i, /indonesia|jakarta/i] },
    { flag: '🇨🇳', tests: [/中国|大陸|大陆|内地/, /china/i] }
];

const FLAG_PREFIX_RE = /^(?:\uD83C[\uDDE6-\uDDFF]){2}\s*/u;

export function defaultProcess() {
    return {
        include: '',
        exclude: '',
        protocols: [],
        dropUseless: false,
        dedup: false,
        sort: 'none',
        rename: {
            prefix: '',
            suffix: '',
            appendType: false,
            emoji: false,
            rules: []
        }
    };
}

function textOf(value) {
    return value == null ? '' : String(value).trim();
}

export function compileRegex(input) {
    const text = textOf(input);
    if (!text) return { empty: true };
    let source = text;
    let flags = '';
    if (source.startsWith('(?i)')) {
        source = source.slice(4);
        flags = 'i';
    }
    try {
        return { regex: new RegExp(source, flags) };
    } catch {
        return { invalid: true };
    }
}

function canonicalType(value) {
    return PROTOCOL_ALIASES[String(value || '').trim().toLowerCase()] || '';
}

function normalizeRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules
        .map(rule => ({
            pattern: textOf(rule?.pattern),
            replacement: rule?.replacement == null ? '' : String(rule.replacement)
        }))
        .filter(rule => rule.pattern);
}

export function normalizeProcess(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const rename = source.rename && typeof source.rename === 'object' ? source.rename : {};
    const sort = source.sort === 'name' || source.sort === 'name-desc' ? source.sort : 'none';
    const protocols = [...new Set((Array.isArray(source.protocols) ? source.protocols : [])
        .map(canonicalType)
        .filter(Boolean))];
    return {
        include: textOf(source.include),
        exclude: textOf(source.exclude),
        protocols,
        dropUseless: source.dropUseless === true,
        dedup: source.dedup === true,
        sort,
        rename: {
            prefix: textOf(rename.prefix),
            suffix: textOf(rename.suffix),
            appendType: rename.appendType === true,
            emoji: rename.emoji === true,
            rules: normalizeRules(rename.rules)
        }
    };
}

export function validateProcess(raw) {
    const process = normalizeProcess(raw);
    if (compileRegex(process.include).invalid) return '保留筛选的正则无效';
    if (compileRegex(process.exclude).invalid) return '排除筛选的正则无效';
    for (const rule of process.rename.rules) {
        if (compileRegex(rule.pattern).invalid) return `重命名正则无效：${rule.pattern}`;
    }
    return '';
}

export function processLabels(raw) {
    const process = normalizeProcess(raw);
    const labels = [];
    if (process.include) labels.push('保留筛选');
    if (process.exclude) labels.push('排除筛选');
    if (process.protocols.length) labels.push(`协议 ${process.protocols.length} 种`);
    if (process.dropUseless) labels.push('去掉说明节点');
    if (process.dedup) labels.push('去重');
    if (process.sort === 'name') labels.push('按名称排序');
    if (process.sort === 'name-desc') labels.push('按名称倒序');
    if (process.rename.prefix || process.rename.suffix) labels.push('前后缀');
    if (process.rename.appendType) labels.push('协议前缀');
    if (process.rename.emoji) labels.push('地区旗帜');
    if (process.rename.rules.length) labels.push('正则重命名');
    return labels;
}

export function processIsActive(raw) {
    return processLabels(raw).length > 0;
}

export function detectRegion(name) {
    const text = String(name || '');
    for (const region of REGIONS) {
        if (region.tests.some(test => test.test(text))) return region.flag;
    }
    return '';
}

export function typeLabel(type) {
    return TYPE_LABELS[type] || String(type || '').toUpperCase();
}

function isUseless(name) {
    return USELESS_RE.test(String(name || ''));
}

function dedupKey(node) {
    return [
        node.type || '',
        node.server || '',
        node.port || '',
        node.uuid || '',
        node.password || '',
        node.token || '',
        node.username || '',
        node.network || '',
        node.cipher || '',
        node.plugin || '',
        node.privateKey || ''
    ].join('\0');
}

function stripLeadingFlag(name) {
    return String(name || '').replace(FLAG_PREFIX_RE, '').trim();
}

function renameNode(node, rename) {
    let name = String(node.name || '');
    if (rename.emoji) name = stripLeadingFlag(name);
    for (const rule of rename.rules) {
        const compiled = compileRegex(rule.pattern);
        if (!compiled.regex) continue;
        name = name.replace(compiled.regex, rule.replacement);
    }
    name = `${rename.prefix}${name}${rename.suffix}`;
    if (rename.appendType) {
        const label = typeLabel(node.type);
        if (label && !name.startsWith(`[${label}]`)) name = `[${label}] ${name}`.trim();
    }
    if (rename.emoji) {
        const flag = detectRegion(name) || detectRegion(node._originalName || node.name || '');
        if (flag) name = `${flag} ${stripLeadingFlag(name)}`.trim();
    }
    name = name.trim() || String(node.name || 'Node');
    return { ...node, name };
}

export function applyProcess(nodes, raw) {
    const process = normalizeProcess(raw);
    let list = (Array.isArray(nodes) ? nodes : []).map(node => ({
        ...node,
        _originalName: node?._originalName || node?.name || ''
    }));
    if (process.dropUseless) list = list.filter(node => !isUseless(node.name));
    if (process.protocols.length) {
        const allow = new Set(process.protocols);
        list = list.filter(node => allow.has(canonicalType(node.type) || node.type));
    }
    const include = compileRegex(process.include);
    if (include.regex) list = list.filter(node => include.regex.test(String(node.name || '')));
    const exclude = compileRegex(process.exclude);
    if (exclude.regex) list = list.filter(node => !exclude.regex.test(String(node.name || '')));
    if (process.dedup) {
        const seen = new Set();
        list = list.filter(node => {
            const key = dedupKey(node);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    const renaming = process.rename;
    const shouldRename = renaming.prefix || renaming.suffix || renaming.appendType || renaming.emoji || renaming.rules.length;
    if (shouldRename) list = list.map(node => renameNode(node, renaming));
    if (process.sort === 'name' || process.sort === 'name-desc') {
        const direction = process.sort === 'name-desc' ? -1 : 1;
        list = list.slice().sort((a, b) => direction * String(a.name || '').localeCompare(String(b.name || ''), 'zh'));
    }
    return list;
}

export function uniquifyNames(nodes) {
    const used = new Set();
    return (Array.isArray(nodes) ? nodes : []).map(node => {
        const base = String(node?.name || 'Node').trim() || 'Node';
        let name = base;
        let index = 1;
        while (used.has(name)) name = `${base} ${index++}`;
        used.add(name);
        return { ...node, name };
    });
}

export function retargetDialers(nodes) {
    const list = Array.isArray(nodes) ? nodes : [];
    const renamed = new Map();
    for (const node of list) {
        const original = node._originalName || node.name;
        if (original) renamed.set(String(original), node.name);
    }
    return list.map(node => {
        if (!node?._dialer) return node;
        const mapped = renamed.get(String(node._dialer));
        return mapped && mapped !== node._dialer ? { ...node, _dialer: mapped } : node;
    });
}
