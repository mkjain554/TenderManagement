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
      work_code TEXT NOT NULL DEFAULT '',
      quoted_rate REAL NOT NULL DEFAULT 0 CHECK (quoted_rate >= 0),
      rebate_percent REAL NOT NULL DEFAULT 0 CHECK (rebate_percent >= 0),
      stipulated_months INTEGER NOT NULL DEFAULT 0 CHECK (stipulated_months >= 0),
      allotment_date TEXT,
      extension_date_1 TEXT,
      extension_date_2 TEXT,
      extension_date_3 TEXT,
      bank_guarantee_number TEXT NOT NULL DEFAULT '',
      bank_guarantee_amount REAL NOT NULL DEFAULT 0 CHECK (bank_guarantee_amount >= 0),
      bank_guarantee_issue_date TEXT,
      bank_guarantee_expiry_date TEXT,
      bank_guarantee_extension_date_1 TEXT,
      bank_guarantee_extension_date_2 TEXT,
      bank_guarantee_extension_date_3 TEXT,
      fdr_number TEXT NOT NULL DEFAULT '',
      fdr_amount REAL NOT NULL DEFAULT 0 CHECK (fdr_amount >= 0),
      fdr_bank TEXT NOT NULL DEFAULT '',
      fdr_issue_date TEXT,
      fdr_maturity_date TEXT,
      insurance_number TEXT NOT NULL DEFAULT '',
      insurance_provider TEXT NOT NULL DEFAULT '',
      insurance_issue_date TEXT,
      insurance_amount REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0),
      insurance_payment_release_date TEXT,
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
      bill_type TEXT NOT NULL DEFAULT 'Running bill',
      work_done_amount REAL NOT NULL DEFAULT 0 CHECK (work_done_amount >= 0),
      culture_cess_percent REAL NOT NULL DEFAULT 1 CHECK (culture_cess_percent >= 0),
      rebate_percent REAL NOT NULL DEFAULT 2 CHECK (rebate_percent >= 0),
      escalation_type TEXT NOT NULL DEFAULT 'None',
      escalation_amount REAL NOT NULL DEFAULT 0 CHECK (escalation_amount >= 0),
      security_percent REAL NOT NULL DEFAULT 5 CHECK (security_percent >= 0),
      cgst_percent REAL NOT NULL DEFAULT 1 CHECK (cgst_percent >= 0),
      sgst_percent REAL NOT NULL DEFAULT 1 CHECK (sgst_percent >= 0),
      income_tax_percent REAL NOT NULL DEFAULT 2 CHECK (income_tax_percent >= 0),
      labour_cess_percent REAL NOT NULL DEFAULT 1 CHECK (labour_cess_percent >= 0),
      construction_cess_percent REAL NOT NULL DEFAULT 1 CHECK (construction_cess_percent >= 0),
      tpa_amount REAL NOT NULL DEFAULT 0 CHECK (tpa_amount >= 0),
      withheld_amount REAL NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0),
      other_deduction_type TEXT NOT NULL DEFAULT '',
      other_deduction_description TEXT NOT NULL DEFAULT '',
      other_deduction_amount REAL NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0),
      received_date TEXT,
      cheque_number TEXT NOT NULL DEFAULT '',
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
    ['work_code', "TEXT NOT NULL DEFAULT ''"],
    ['quoted_rate', 'REAL NOT NULL DEFAULT 0 CHECK (quoted_rate >= 0)'],
    ['rebate_percent', 'REAL NOT NULL DEFAULT 0 CHECK (rebate_percent >= 0)'],
    ['stipulated_months', 'INTEGER NOT NULL DEFAULT 0 CHECK (stipulated_months >= 0)'],
    ['allotment_date', 'TEXT'],
    ['extension_date_1', 'TEXT'],
    ['extension_date_2', 'TEXT'],
    ['extension_date_3', 'TEXT'],
    ['bank_guarantee_number', "TEXT NOT NULL DEFAULT ''"],
    ['bank_guarantee_amount', 'REAL NOT NULL DEFAULT 0 CHECK (bank_guarantee_amount >= 0)'],
    ['bank_guarantee_issue_date', 'TEXT'],
    ['bank_guarantee_expiry_date', 'TEXT'],
    ['bank_guarantee_extension_date_1', 'TEXT'],
    ['bank_guarantee_extension_date_2', 'TEXT'],
    ['bank_guarantee_extension_date_3', 'TEXT'],
    ['fdr_number', "TEXT NOT NULL DEFAULT ''"],
    ['fdr_amount', 'REAL NOT NULL DEFAULT 0 CHECK (fdr_amount >= 0)'],
    ['fdr_bank', "TEXT NOT NULL DEFAULT ''"],
    ['fdr_issue_date', 'TEXT'],
    ['fdr_maturity_date', 'TEXT'],
    ['insurance_number', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_provider', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_issue_date', 'TEXT'],
    ['insurance_amount', 'REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0)'],
    ['insurance_payment_release_date', 'TEXT'],
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

  const billColumns = [
    ['bill_type', "TEXT NOT NULL DEFAULT 'Running bill'"],
    ['work_done_amount', 'REAL NOT NULL DEFAULT 0 CHECK (work_done_amount >= 0)'],
    ['culture_cess_percent', 'REAL NOT NULL DEFAULT 1 CHECK (culture_cess_percent >= 0)'],
    ['rebate_percent', 'REAL NOT NULL DEFAULT 2 CHECK (rebate_percent >= 0)'],
    ['escalation_type', "TEXT NOT NULL DEFAULT 'None'"],
    ['escalation_amount', 'REAL NOT NULL DEFAULT 0 CHECK (escalation_amount >= 0)'],
    ['security_percent', 'REAL NOT NULL DEFAULT 5 CHECK (security_percent >= 0)'],
    ['cgst_percent', 'REAL NOT NULL DEFAULT 1 CHECK (cgst_percent >= 0)'],
    ['sgst_percent', 'REAL NOT NULL DEFAULT 1 CHECK (sgst_percent >= 0)'],
    ['income_tax_percent', 'REAL NOT NULL DEFAULT 2 CHECK (income_tax_percent >= 0)'],
    ['labour_cess_percent', 'REAL NOT NULL DEFAULT 1 CHECK (labour_cess_percent >= 0)'],
    ['construction_cess_percent', 'REAL NOT NULL DEFAULT 1 CHECK (construction_cess_percent >= 0)'],
    ['tpa_amount', 'REAL NOT NULL DEFAULT 0 CHECK (tpa_amount >= 0)'],
    ['withheld_amount', 'REAL NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0)'],
    ['other_deduction_type', "TEXT NOT NULL DEFAULT ''"],
    ['other_deduction_description', "TEXT NOT NULL DEFAULT ''"],
    ['other_deduction_amount', 'REAL NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0)'],
    ['received_date', 'TEXT'],
    ['cheque_number', "TEXT NOT NULL DEFAULT ''"],
  ];
  const existingBillColumns = new Set(db.pragma('table_info(bills)').map((column) => column.name));
  const migrateBills = db.transaction(() => {
    for (const [name, definition] of billColumns) {
      if (!existingBillColumns.has(name)) {
        db.exec(`ALTER TABLE bills ADD COLUMN ${name} ${definition}`);
      }
    }
  });
  migrateBills();

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
