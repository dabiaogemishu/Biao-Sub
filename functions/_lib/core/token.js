export function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let result = '';
    for (let i = 0; i < bytes.length; i++) result += chars[bytes[i] % chars.length];
    return result;
}
