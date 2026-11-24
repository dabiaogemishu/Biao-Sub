const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function bytesToBase64Url(bytes) {
    let binary = '';
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text) {
    const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function hmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

export async function signSession(secret, now = Date.now()) {
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ exp: now + SESSION_TTL_MS, v: 1 })));
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return `${payload}.${bytesToBase64Url(sig)}`;
}

export async function verifySession(token, secret, now = Date.now()) {
    if (!token || !secret || !token.includes('.')) return false;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const key = await hmacKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
    let actual;
    try { actual = base64UrlToBytes(sig); } catch { return false; }
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    if (diff !== 0) return false;
    try {
        const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
        return typeof data.exp === 'number' && data.exp > now;
    } catch {
        return false;
    }
}

export async function passwordMatches(input, expected) {
    if (!expected || input == null) return false;
    const digest = async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
    const left = await digest(input);
    const right = await digest(expected);
    let diff = 0;
    for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
    return diff === 0;
}

export function readBearer(header) {
    if (!header) return '';
    const value = String(header).trim();
    if (value.toLowerCase().startsWith('bearer ')) return value.slice(7).trim();
    return value;
}
