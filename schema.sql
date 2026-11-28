-- BiaoSUB D1 schema. Binding name must be DB.
-- Safe to run on a new database. On the existing biaosub-db, tables already
-- exist; the Pages Function applies the ALTER statements automatically and
-- ignores "duplicate column" errors. Do not put secrets in this file.

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source_url TEXT,
    type TEXT DEFAULT 'node',
    info TEXT,
    params TEXT DEFAULT '{}',
    snapshot TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    config TEXT,
    clash_config TEXT,
    cached_yaml TEXT,
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    header TEXT,
    groups TEXT,
    rules TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Key/value panel settings. Existing subscriptions, groups and templates are left untouched.
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Login rate limiting. Does not alter subscriptions, groups or templates.
CREATE TABLE IF NOT EXISTS login_attempts (
    source TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    lock_until INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- Upgrades for databases created by older BiaoSUB versions.
-- Ignore "duplicate column name" if a column is already there.
ALTER TABLE subscriptions ADD COLUMN source_url TEXT;
ALTER TABLE subscriptions ADD COLUMN params TEXT DEFAULT '{}';
ALTER TABLE subscriptions ADD COLUMN snapshot TEXT;
ALTER TABLE groups ADD COLUMN cached_yaml TEXT;
ALTER TABLE groups ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN last_accessed TEXT;
ALTER TABLE subscriptions ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE groups ADD COLUMN sort_order INTEGER DEFAULT 0;
