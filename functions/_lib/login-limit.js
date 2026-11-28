export const LOGIN_FAIL_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_BASE_MS = 60 * 1000;
export const LOGIN_LOCK_MAX_MS = 15 * 60 * 1000;

export const LOGIN_LOCKED_MESSAGE = '请稍后再试';
export const LOGIN_PASSWORD_ERROR = '密码错误';

export const LOGIN_ATTEMPTS_TABLE = `CREATE TABLE IF NOT EXISTS login_attempts (
    source TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    lock_until INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
)`;

export function loginSource(c) {
    const header = (name) => {
        try { return c?.req?.header?.(name) || ''; } catch { return ''; }
    };
    const cf = String(header('CF-Connecting-IP') || '').trim();
    if (cf) return `ip:${cf.slice(0, 128)}`;
    const forwarded = String(header('X-Forwarded-For') || '').split(',')[0].trim();
    if (forwarded) return `ip:${forwarded.slice(0, 128)}`;
    return 'ip:unknown';
}

function lockDuration(failCount) {
    if (failCount < LOGIN_FAIL_LIMIT) return 0;
    const shift = failCount - LOGIN_FAIL_LIMIT;
    const duration = LOGIN_LOCK_BASE_MS * (2 ** Math.min(shift, 10));
    return Math.min(LOGIN_LOCK_MAX_MS, duration);
}

async function cleanup(db, now) {
    if (!db) return;
    try {
        await db.prepare(
            'DELETE FROM login_attempts WHERE updated_at < ? AND lock_until < ?'
        ).bind(now - LOGIN_WINDOW_MS, now).run();
    } catch { /* 表尚未就绪时忽略 */ }
}

async function readAttempt(db, source) {
    if (!db) return null;
    try {
        return await db.prepare(
            'SELECT fail_count, lock_until, updated_at FROM login_attempts WHERE source = ?'
        ).bind(source).first();
    } catch {
        return null;
    }
}

async function writeAttempt(db, source, failCount, lockUntil, now) {
    if (!db) return;
    await db.prepare(
        `INSERT INTO login_attempts (source, fail_count, lock_until, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source) DO UPDATE SET
            fail_count = excluded.fail_count,
            lock_until = excluded.lock_until,
            updated_at = excluded.updated_at`
    ).bind(source, failCount, lockUntil, now).run();
}

export async function inspectLoginAttempt(db, source, now = Date.now()) {
    await cleanup(db, now);
    const row = await readAttempt(db, source);
    if (!row) return { allowed: true, failCount: 0, lockUntil: 0 };
    const lockUntil = Number(row.lock_until) || 0;
    if (lockUntil > now) {
        return { allowed: false, failCount: Number(row.fail_count) || 0, lockUntil };
    }
    const updatedAt = Number(row.updated_at) || 0;
    if (updatedAt && now - updatedAt > LOGIN_WINDOW_MS) {
        return { allowed: true, failCount: 0, lockUntil: 0 };
    }
    return { allowed: true, failCount: Number(row.fail_count) || 0, lockUntil: 0 };
}

export async function recordLoginFailure(db, source, now = Date.now()) {
    const current = await inspectLoginAttempt(db, source, now);
    if (!current.allowed) return current;
    const failCount = current.failCount + 1;
    const duration = lockDuration(failCount);
    const lockUntil = duration ? now + duration : 0;
    try {
        await writeAttempt(db, source, failCount, lockUntil, now);
    } catch { /* 不因计数失败打断登录响应 */ }
    return { allowed: lockUntil <= now, failCount, lockUntil };
}

export async function clearLoginFailures(db, source) {
    if (!db) return;
    try {
        await db.prepare('DELETE FROM login_attempts WHERE source = ?').bind(source).run();
    } catch { /* 忽略 */ }
}
