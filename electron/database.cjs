const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

function createDatabase(dataDirectory) {
  fs.mkdirSync(path.join(dataDirectory, 'tenders'), { recursive: true });
  const db = new Database(path.join(dataDirectory, 'database.sqlite'));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenders (
      id TEXT PRIMARY KEY,
      tender_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      tender_date TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      bidding_amount REAL NOT NULL CHECK (bidding_amount >= 0),
      tender_reference TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      work_location TEXT NOT NULL DEFAULT '',
      work_scope TEXT NOT NULL DEFAULT '',
      submission_deadline TEXT,
      emd_amount REAL NOT NULL DEFAULT 0 CHECK (emd_amount >= 0),
      tender_fee REAL NOT NULL DEFAULT 0 CHECK (tender_fee >= 0),
      work_order_number TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Not set',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tender_files (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      short_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      bill_name TEXT NOT NULL,
      bill_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      hold_amount REAL NOT NULL DEFAULT 0 CHECK (hold_amount >= 0),
      amount_received REAL NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS bills_by_tender ON bills(tender_id, bill_date);
    CREATE TABLE IF NOT EXISTS bill_files (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      short_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const tenderColumns = [
    ['tender_reference', "TEXT NOT NULL DEFAULT ''"],
    ['department', "TEXT NOT NULL DEFAULT ''"],
    ['work_location', "TEXT NOT NULL DEFAULT ''"],
    ['work_scope', "TEXT NOT NULL DEFAULT ''"],
    ['submission_deadline', 'TEXT'],
    ['emd_amount', 'REAL NOT NULL DEFAULT 0 CHECK (emd_amount >= 0)'],
    ['tender_fee', 'REAL NOT NULL DEFAULT 0 CHECK (tender_fee >= 0)'],
    ['work_order_number', "TEXT NOT NULL DEFAULT ''"],
    ['status', "TEXT NOT NULL DEFAULT 'Not set'"],
  ];
  const existingColumns = new Set(db.pragma('table_info(tenders)').map((column) => column.name));
  const migrateTenders = db.transaction(() => {
    for (const [name, definition] of tenderColumns) {
      if (!existingColumns.has(name)) {
        db.exec(`ALTER TABLE tenders ADD COLUMN ${name} ${definition}`);
      }
    }
  });
  migrateTenders();

  for (const table of ['tender_files', 'bill_files']) {
    const columns = new Set(db.pragma(`table_info(${table})`).map((column) => column.name));
    if (!columns.has('short_name')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN short_name TEXT NOT NULL DEFAULT ''`);
    }
  }

  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'admin',
      `${salt}:${hash}`,
    );
  }
  return db;
}

function verifyPassword(db, username, password) {
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const [salt, storedHash] = user.password_hash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) return null;
  return { username: user.username };
}

module.exports = { createDatabase, verifyPassword };
