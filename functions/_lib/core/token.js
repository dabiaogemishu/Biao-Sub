export function generateToken(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const max = 256 - (256 % chars.length);
    let result = '';
    while (result.length < length) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        for (const byte of bytes) {
            if (byte >= max) continue;
            result += chars[byte % chars.length];
            if (result.length === length) break;
        }
    }
    return result;
}
