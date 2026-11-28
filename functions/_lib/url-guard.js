export const UNSUPPORTED_SUBSCRIPTION_URL = '订阅地址不受支持';

export class UnsafeSubscriptionUrlError extends Error {
    constructor() {
        super(UNSUPPORTED_SUBSCRIPTION_URL);
        this.name = 'UnsafeSubscriptionUrlError';
    }
}

const BLOCKED_HOSTS = new Set([
    'localhost',
    'localhost.localdomain',
    'metadata',
    'metadata.internal',
    'metadata.google.internal',
    'metadata.goog',
    'metadata.googleapis.com',
    'instance-data',
    'ipv6.localhost'
]);

const BLOCKED_HOST_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
    '.nip.io',
    '.sslip.io',
    '.localtest.me',
    '.lvh.me'
];

// Azure IMDS
const BLOCKED_IPV4 = new Set([ipv4ToInt('168.63.129.16')]);

function ipv4ToInt(host) {
    const parts = String(host).split('.');
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const num = Number(part);
        if (num > 255 || String(num) !== part) return null;
        value = (value * 256 + num) >>> 0;
    }
    return value;
}

function inIPv4Range(ip, prefix, bits) {
    const base = ipv4ToInt(prefix);
    if (ip == null || base == null) return false;
    const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
    return (ip & mask) === (base & mask);
}

export function isBlockedIPv4(host) {
    const ip = ipv4ToInt(host);
    if (ip == null) return false;
    if (BLOCKED_IPV4.has(ip)) return true;
    return (
        inIPv4Range(ip, '0.0.0.0', 8) ||
        inIPv4Range(ip, '10.0.0.0', 8) ||
        inIPv4Range(ip, '100.64.0.0', 10) ||
        inIPv4Range(ip, '127.0.0.0', 8) ||
        inIPv4Range(ip, '169.254.0.0', 16) ||
        inIPv4Range(ip, '172.16.0.0', 12) ||
        inIPv4Range(ip, '192.168.0.0', 16) ||
        inIPv4Range(ip, '224.0.0.0', 4) ||
        inIPv4Range(ip, '240.0.0.0', 4)
    );
}

export function ipv6ToBytes(host) {
    const zone = String(host).split('%')[0];
    if (zone.includes('.')) {
        const lastColon = zone.lastIndexOf(':');
        const mapped = zone.slice(lastColon + 1);
        const head = zone.slice(0, lastColon);
        const ip = ipv4ToInt(mapped);
        if (ip == null) throw new Error('invalid');
        const hi = ((ip >>> 16) & 0xffff).toString(16);
        const lo = (ip & 0xffff).toString(16);
        return ipv6ToBytes(`${head}:${hi}:${lo}`);
    }
    const halves = zone.split('::');
    if (halves.length > 2) throw new Error('invalid');
    const parseSide = (part) => {
        if (!part) return [];
        return part.split(':').map(piece => {
            if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) throw new Error('invalid');
            return Number.parseInt(piece, 16);
        });
    };
    const head = parseSide(halves[0]);
    const tail = halves.length === 2 ? parseSide(halves[1]) : [];
    if (halves.length === 1 && head.length !== 8) throw new Error('invalid');
    const missing = 8 - head.length - tail.length;
    if (missing < 0) throw new Error('invalid');
    const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill(0), ...tail];
    const out = new Uint8Array(16);
    groups.forEach((group, index) => {
        out[index * 2] = (group >> 8) & 0xff;
        out[index * 2 + 1] = group & 0xff;
    });
    return out;
}

function isIPv4Mapped(bytes) {
    return bytes.slice(0, 10).every(b => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
}

function isIPv4Compatible(bytes) {
    return bytes.slice(0, 12).every(b => b === 0) && !(bytes.slice(12).every(b => b === 0));
}

function mappedIPv4(bytes) {
    return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}

export function isBlockedIPv6(host) {
    let bytes;
    try { bytes = ipv6ToBytes(host); } catch { return true; }
    if (isIPv4Mapped(bytes) || isIPv4Compatible(bytes)) return isBlockedIPv4(mappedIPv4(bytes));
    // unspecified :: and loopback ::1
    const allZero = bytes.every(b => b === 0);
    if (allZero) return true;
    const loopback = bytes.slice(0, 15).every(b => b === 0) && bytes[15] === 1;
    if (loopback) return true;
    // link-local fe80::/10
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
    // unique local fc00::/7
    if ((bytes[0] & 0xfe) === 0xfc) return true;
    // multicast ff00::/8
    if (bytes[0] === 0xff) return true;
    return false;
}

export function normalizeHostname(host) {
    let value = String(host || '').trim().toLowerCase();
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
    while (value.endsWith('.')) value = value.slice(0, -1);
    return value;
}

export function isBlockedHostname(host) {
    const hostname = normalizeHostname(host);
    if (!hostname) return true;
    if (BLOCKED_HOSTS.has(hostname)) return true;
    if (isBlockedIPv4(hostname) || (hostname.includes(':') && isBlockedIPv6(hostname))) return true;
    return BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix));
}

export function parseHttpUrl(input, base) {
    try {
        return base ? new URL(String(input), base) : new URL(String(input));
    } catch {
        throw new UnsafeSubscriptionUrlError();
    }
}

export function assertSafeHttpUrl(input, base) {
    const url = parseHttpUrl(input, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new UnsafeSubscriptionUrlError();
    }
    if (isBlockedHostname(url.hostname)) {
        throw new UnsafeSubscriptionUrlError();
    }
    return url;
}
